use tauri::{AppHandle, Emitter, Runtime, State};
use tokio::sync::oneshot;

use crate::error::Result;
use crate::AppState;

#[tauri::command]
pub async fn send_prompt<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
    prompt: String,
    message_id: String,
) -> Result<()> {
    // Cancel any previous in-flight stream before starting a new one.
    {
        let mut slot = state.cancel.lock().await;
        if let Some(tx) = slot.take() {
            let _ = tx.send(());
        }
        let (tx, rx) = oneshot::channel();
        *slot = Some(tx);

        let ai = state.ai.clone();
        let app2 = app.clone();
        let msg_id = message_id.clone();
        tauri::async_runtime::spawn(async move {
            let result = ai.stream_chat(app2.clone(), msg_id.clone(), prompt, rx).await;
            match result {
                Ok(()) => {
                    let _ = app2.emit(
                        "ai://done",
                        serde_json::json!({ "messageId": msg_id }),
                    );
                }
                Err(err) => {
                    tracing::error!(?err, "stream error");
                    let _ = app2.emit(
                        "ai://done",
                        serde_json::json!({
                            "messageId": msg_id,
                            "error": err.to_string(),
                        }),
                    );
                }
            }
        });
    }
    Ok(())
}

#[tauri::command]
pub async fn cancel_stream(state: State<'_, AppState>) -> Result<()> {
    let mut slot = state.cancel.lock().await;
    if let Some(tx) = slot.take() {
        let _ = tx.send(());
    }
    Ok(())
}
