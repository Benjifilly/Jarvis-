use serde::Serialize;

#[derive(Debug, thiserror::Error)]
pub enum JarvisError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("HTTP error: {0}")]
    Http(#[from] reqwest::Error),

    #[error("Serde error: {0}")]
    Serde(#[from] serde_json::Error),

    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),

    #[error("Config error: {0}")]
    Config(String),

    #[error("AI upstream returned {status}: {body}")]
    Upstream { status: u16, body: String },

    #[error("Stream cancelled")]
    Cancelled,

    #[error("Other: {0}")]
    Other(String),
}

impl Serialize for JarvisError {
    fn serialize<S>(&self, serializer: S) -> std::result::Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

pub type Result<T> = std::result::Result<T, JarvisError>;
