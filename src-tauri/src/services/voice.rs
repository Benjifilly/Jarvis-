use std::sync::Arc;

use reqwest::{multipart, Client};
use serde::Deserialize;

use crate::error::{JarvisError, Result};
use crate::services::config_store::ConfigStore;

pub struct VoiceClient {
    http: Client,
    config: Arc<ConfigStore>,
}

#[derive(Debug, Deserialize)]
struct WhisperResponse {
    #[serde(default)]
    text: Option<String>,
}

impl VoiceClient {
    pub fn new(config: Arc<ConfigStore>) -> Self {
        let http = Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .expect("reqwest client");
        Self { http, config }
    }

    /// Transcribes audio bytes via a Whisper-compatible `/audio/transcriptions`
    /// endpoint. Defaults to Groq's free Whisper.
    pub async fn transcribe(&self, audio: Vec<u8>, mime: String) -> Result<String> {
        let cfg = self.config.get();
        let voice = &cfg.voice;

        let filename = match mime.as_str() {
            "audio/webm" => "audio.webm",
            "audio/mp4" | "audio/m4a" => "audio.m4a",
            "audio/wav" => "audio.wav",
            _ => "audio.ogg",
        };

        let url = format!(
            "{}/audio/transcriptions",
            voice.stt_base_url.trim_end_matches('/')
        );

        let part = multipart::Part::bytes(audio)
            .file_name(filename.to_string())
            .mime_str(&mime)
            .map_err(|e| JarvisError::Other(e.to_string()))?;
        let form = multipart::Form::new()
            .part("file", part)
            .text("model", voice.stt_model.clone())
            .text("response_format", "json");

        let mut req = self.http.post(url).multipart(form);
        if let Some(key) = voice.stt_api_key.as_deref() {
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
        let parsed: WhisperResponse = resp.json().await?;
        Ok(parsed.text.unwrap_or_default())
    }
}
