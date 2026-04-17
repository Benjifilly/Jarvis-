use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    pub model: String,
    #[serde(rename = "apiKey", skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(rename = "systemPrompt", skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            base_url: "http://localhost:11434/v1".to_string(),
            model: "llama3.2".to_string(),
            api_key: None,
            system_prompt: Some(
                "Tu es Jarvis, un assistant local concis, précis et utile.".to_string(),
            ),
            temperature: Some(0.7),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SttMode {
    Auto,
    Cloud,
    Local,
}

impl Default for SttMode {
    fn default() -> Self {
        SttMode::Auto
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub ai: AiConfig,
    pub hotkey: String,
    #[serde(rename = "sttMode")]
    pub stt_mode: SttMode,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            ai: AiConfig::default(),
            hotkey: "Ctrl+Space".to_string(),
            stt_mode: SttMode::Auto,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}
