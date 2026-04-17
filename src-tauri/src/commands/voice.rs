use serde::Deserialize;
use tauri::State;

use crate::error::Result;
use crate::AppState;

#[derive(Deserialize)]
pub struct TranscribePayload {
    /// Base64 (no prefix) of the audio blob captured in the WebView.
    pub audio_base64: String,
    pub mime: String,
}

#[tauri::command]
pub async fn transcribe(
    state: State<'_, AppState>,
    payload: TranscribePayload,
) -> Result<String> {
    use base64::Engine as _;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(payload.audio_base64.as_bytes())
        .map_err(|e| crate::error::JarvisError::Other(format!("invalid base64: {e}")))?;
    state.voice.transcribe(bytes, payload.mime).await
}
