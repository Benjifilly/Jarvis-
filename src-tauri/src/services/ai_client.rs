use std::sync::Arc;

use futures_util::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};
use tokio::sync::oneshot;

use crate::error::{JarvisError, Result};
use crate::models::ChatMessage;
use crate::services::config_store::ConfigStore;

pub struct AiClient {
    http: Client,
    config: Arc<ConfigStore>,
}

#[derive(Debug, Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
}

#[derive(Debug, Deserialize)]
struct ChatChunk {
    choices: Vec<ChatChoice>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    delta: Option<ChatDelta>,
    #[serde(default)]
    finish_reason: Option<String>,
}

#[derive(Debug, Deserialize)]
struct ChatDelta {
    #[serde(default)]
    content: Option<String>,
}

impl AiClient {
    pub fn new(config: Arc<ConfigStore>) -> Self {
        let http = Client::builder()
            .pool_idle_timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("reqwest client");
        Self { http, config }
    }

    /// Streams tokens from an OpenAI-compatible endpoint. Emits:
    ///   - `ai://token` { messageId, token }
    ///   - `ai://done`  { messageId, error? }
    pub async fn stream_chat<R: Runtime>(
        &self,
        app: AppHandle<R>,
        message_id: String,
        prompt: String,
        mut cancel: oneshot::Receiver<()>,
    ) -> Result<()> {
        let cfg = self.config.get();
        let mut messages: Vec<ChatMessage> = Vec::new();
        if let Some(sys) = cfg.ai.system_prompt.as_deref() {
            if !sys.trim().is_empty() {
                messages.push(ChatMessage {
                    role: "system".into(),
                    content: sys.to_string(),
                });
            }
        }
        messages.push(ChatMessage {
            role: "user".into(),
            content: prompt,
        });

        let url = format!("{}/chat/completions", cfg.ai.base_url.trim_end_matches('/'));
        let body = ChatRequest {
            model: &cfg.ai.model,
            messages: &messages,
            stream: true,
            temperature: cfg.ai.temperature,
        };

        let mut req = self.http.post(url).json(&body);
        if let Some(key) = cfg.ai.api_key.as_deref() {
            if !key.is_empty() {
                req = req.bearer_auth(key);
            }
        }

        let resp = req.send().await?;
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(JarvisError::Upstream { status, body });
        }

        let mut stream = resp.bytes_stream();
        let mut buf: Vec<u8> = Vec::with_capacity(4096);

        loop {
            tokio::select! {
                _ = &mut cancel => {
                    return Err(JarvisError::Cancelled);
                }
                next = stream.next() => {
                    let Some(chunk) = next else { break };
                    let chunk = chunk?;
                    buf.extend_from_slice(&chunk);
                    while let Some(pos) = find_double_newline(&buf) {
                        let frame = buf.drain(..pos + 2).collect::<Vec<_>>();
                        let text = String::from_utf8_lossy(&frame);
                        for line in text.lines() {
                            let line = line.trim_start();
                            let Some(data) = line.strip_prefix("data:") else {
                                continue;
                            };
                            let data = data.trim();
                            if data.is_empty() { continue; }
                            if data == "[DONE]" {
                                return Ok(());
                            }
                            match serde_json::from_str::<ChatChunk>(data) {
                                Ok(c) => {
                                    if let Some(choice) = c.choices.into_iter().next() {
                                        if let Some(delta) = choice.delta {
                                            if let Some(tok) = delta.content {
                                                if !tok.is_empty() {
                                                    let _ = app.emit(
                                                        "ai://token",
                                                        serde_json::json!({
                                                            "messageId": message_id,
                                                            "token": tok,
                                                        }),
                                                    );
                                                }
                                            }
                                        }
                                        if choice.finish_reason.is_some() {
                                            return Ok(());
                                        }
                                    }
                                }
                                Err(err) => {
                                    tracing::warn!(?err, raw = %data, "bad chunk");
                                }
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }
}

fn find_double_newline(buf: &[u8]) -> Option<usize> {
    buf.windows(2).position(|w| w == b"\n\n")
}
