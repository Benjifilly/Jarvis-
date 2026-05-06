use tauri::{AppHandle, Emitter, Listener, Manager, Runtime};

use crate::AppState;

/// Sprint 3+ will wire a global keyboard hook via `rdev` here.
/// For the MVP, we forward typing events that come from the overlay itself
/// (WebView `keydown`). This keeps the hot path simple and works for the
/// "overlay active, user starts typing" flow when the overlay has focus.
///
/// The `overlay://typing-started` event is emitted by the frontend
/// `OverlayRoot` when the user types a printable character while the overlay
/// is visible. A future iteration will replace this with a real system-level
/// hook so typing anywhere on screen routes here.
pub fn spawn_key_listener<R: Runtime>(app: AppHandle<R>) {
    let h = app.clone();
    app.listen("overlay://request-typing", move |event| {
        let payload: serde_json::Value =
            serde_json::from_str(event.payload()).unwrap_or(serde_json::Value::Null);
        let ch = payload
            .get("char")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let state = h.state::<AppState>();
        if *state.overlay_visible.lock() {
            let _ = h.emit(
                "overlay://typing-started",
                serde_json::json!({ "char": ch }),
            );
        }
    });
}
