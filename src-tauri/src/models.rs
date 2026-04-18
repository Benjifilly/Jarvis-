use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderKind {
    LocalOllama,
    LocalLmstudio,
    Groq,
    Openrouter,
    Huggingface,
    Google,
    Custom,
}

impl Default for ProviderKind {
    fn default() -> Self {
        ProviderKind::LocalOllama
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderPreset {
    pub id: ProviderKind,
    pub name: &'static str,
    pub base_url: &'static str,
    pub default_model: &'static str,
    pub requires_api_key: bool,
    pub signup_url: Option<&'static str>,
    pub description: &'static str,
    pub category: &'static str,
}

pub const PROVIDERS: &[ProviderPreset] = &[
    ProviderPreset {
        id: ProviderKind::LocalOllama,
        name: "Ollama (local)",
        base_url: "http://localhost:11434/v1",
        default_model: "llama3.2",
        requires_api_key: false,
        signup_url: Some("https://ollama.com/download"),
        description: "Serveur LLM local. 100 % privé, aucune donnée n'est envoyée sur Internet.",
        category: "local",
    },
    ProviderPreset {
        id: ProviderKind::LocalLmstudio,
        name: "LM Studio (local)",
        base_url: "http://localhost:1234/v1",
        default_model: "local-model",
        requires_api_key: false,
        signup_url: Some("https://lmstudio.ai"),
        description: "Serveur compatible OpenAI de LM Studio, avec interface graphique pour choisir le modèle.",
        category: "local",
    },
    ProviderPreset {
        id: ProviderKind::Groq,
        name: "Groq — gratuit",
        base_url: "https://api.groq.com/openai/v1",
        default_model: "llama-3.3-70b-versatile",
        requires_api_key: true,
        signup_url: Some("https://console.groq.com/keys"),
        description: "Inférence LPU ultra-rapide (~500 tok/s). Niveau gratuit généreux pour les Llama 3.",
        category: "cloud-free",
    },
    ProviderPreset {
        id: ProviderKind::Openrouter,
        name: "OpenRouter — modèles :free",
        base_url: "https://openrouter.ai/api/v1",
        default_model: "meta-llama/llama-3.3-70b-instruct:free",
        requires_api_key: true,
        signup_url: Some("https://openrouter.ai/keys"),
        description: "Aggregateur multi-providers avec des modèles suffixés `:free` sans carte bancaire.",
        category: "cloud-free",
    },
    ProviderPreset {
        id: ProviderKind::Huggingface,
        name: "Hugging Face Inference",
        base_url: "https://router.huggingface.co/v1",
        default_model: "meta-llama/Llama-3.1-8B-Instruct",
        requires_api_key: true,
        signup_url: Some("https://huggingface.co/settings/tokens"),
        description: "Routeur d'inférence Hugging Face compatible OpenAI. Crédits gratuits mensuels.",
        category: "cloud-free",
    },
    ProviderPreset {
        id: ProviderKind::Google,
        name: "Google AI Studio (Gemini)",
        base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
        default_model: "gemini-2.0-flash",
        requires_api_key: true,
        signup_url: Some("https://aistudio.google.com/apikey"),
        description: "Gemini via passerelle OpenAI-compatible. Niveau gratuit avec quotas journaliers.",
        category: "cloud-free",
    },
    ProviderPreset {
        id: ProviderKind::Custom,
        name: "Personnalisé",
        base_url: "",
        default_model: "",
        requires_api_key: false,
        signup_url: None,
        description: "URL, modèle et clé saisis manuellement (compatible n'importe quel serveur OpenAI-style).",
        category: "custom",
    },
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenParams {
    #[serde(default = "default_temperature")]
    pub temperature: f32,
    #[serde(rename = "topP", default = "default_top_p")]
    pub top_p: f32,
    #[serde(rename = "maxTokens", default = "default_max_tokens")]
    pub max_tokens: u32,
    /// Context window size in tokens. Sent as `options.num_ctx` for Ollama;
    /// ignored by providers that don't accept it.
    #[serde(rename = "contextWindow", default = "default_context")]
    pub context_window: u32,
    #[serde(rename = "presencePenalty", default)]
    pub presence_penalty: f32,
    #[serde(rename = "frequencyPenalty", default)]
    pub frequency_penalty: f32,
    #[serde(default)]
    pub stop: Vec<String>,
}

impl Default for GenParams {
    fn default() -> Self {
        Self {
            temperature: default_temperature(),
            top_p: default_top_p(),
            max_tokens: default_max_tokens(),
            context_window: default_context(),
            presence_penalty: 0.0,
            frequency_penalty: 0.0,
            stop: Vec::new(),
        }
    }
}

fn default_temperature() -> f32 { 0.7 }
fn default_top_p() -> f32 { 0.95 }
fn default_max_tokens() -> u32 { 2048 }
fn default_context() -> u32 { 8192 }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiConfig {
    #[serde(default)]
    pub provider: ProviderKind,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    pub model: String,
    #[serde(rename = "apiKey", skip_serializing_if = "Option::is_none")]
    pub api_key: Option<String>,
    #[serde(rename = "systemPrompt", skip_serializing_if = "Option::is_none")]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub params: GenParams,
    /// Optional absolute path to a locally downloaded model file
    /// (e.g. a GGUF from the marketplace). Non-null when the user chose
    /// "local downloaded" and wants the app to load this file via Ollama.
    #[serde(rename = "localModelPath", skip_serializing_if = "Option::is_none")]
    pub local_model_path: Option<String>,
}

impl Default for AiConfig {
    fn default() -> Self {
        Self {
            provider: ProviderKind::LocalOllama,
            base_url: "http://localhost:11434/v1".to_string(),
            model: "llama3.2".to_string(),
            api_key: None,
            system_prompt: Some(
                "Tu es Jarvis, un assistant personnel concis, précis et chaleureux. \
                 Règle absolue de langue : réponds TOUJOURS dans la même langue que le dernier \
                 message de l'utilisateur. Si l'utilisateur écrit en français, réponds en français. \
                 En anglais → anglais. En espagnol → espagnol. N'inclus jamais de message système \
                 ni de justification méta dans ta réponse."
                    .to_string(),
            ),
            params: GenParams::default(),
            local_model_path: None,
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
pub struct VoiceConfig {
    #[serde(default)]
    pub stt_mode: SttMode,
    /// Whisper cloud endpoint (OpenAI-compatible). Defaults to Groq's free Whisper.
    #[serde(rename = "sttBaseUrl", default = "default_stt_base_url")]
    pub stt_base_url: String,
    #[serde(rename = "sttModel", default = "default_stt_model")]
    pub stt_model: String,
    #[serde(rename = "sttApiKey", skip_serializing_if = "Option::is_none")]
    pub stt_api_key: Option<String>,
    #[serde(rename = "ttsEnabled", default)]
    pub tts_enabled: bool,
    #[serde(rename = "ttsVoice", skip_serializing_if = "Option::is_none")]
    pub tts_voice: Option<String>,
    #[serde(rename = "ttsRate", default = "default_tts_rate")]
    pub tts_rate: f32,
}

fn default_stt_base_url() -> String {
    "https://api.groq.com/openai/v1".to_string()
}
fn default_stt_model() -> String {
    "whisper-large-v3-turbo".to_string()
}
fn default_tts_rate() -> f32 { 1.0 }

impl Default for VoiceConfig {
    fn default() -> Self {
        Self {
            stt_mode: SttMode::Auto,
            stt_base_url: default_stt_base_url(),
            stt_model: default_stt_model(),
            stt_api_key: None,
            tts_enabled: false,
            tts_voice: None,
            tts_rate: default_tts_rate(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub ai: AiConfig,
    #[serde(default)]
    pub voice: VoiceConfig,
    pub hotkey: String,
    /// Kept for backward compatibility; real home is now `voice.stt_mode`.
    #[serde(rename = "sttMode", default)]
    pub stt_mode: SttMode,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            ai: AiConfig::default(),
            voice: VoiceConfig::default(),
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
