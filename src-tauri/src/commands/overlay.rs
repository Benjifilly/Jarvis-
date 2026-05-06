use tauri::{AppHandle, Emitter, Manager, Runtime, State};

use crate::error::Result;
use crate::AppState;

/// Shows or hides the overlay window and emits `overlay://toggle` to the frontend.
/// When showing, we disable click-through so the user can interact with the input bar.
pub async fn toggle_overlay<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    let state = app.state::<AppState>();
    let mut visible_flag = state.overlay_visible.lock();

    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| crate::error::JarvisError::Other("overlay window missing".into()))?;

    if *visible_flag {
        let _ = window.set_ignore_cursor_events(true);
        let _ = window.hide();
        *visible_flag = false;
        let _ = app.emit(
            "overlay://toggle",
            serde_json::json!({ "visible": false }),
        );
    } else {
        let _ = window.show();
        let _ = window.set_always_on_top(true);
        let _ = window.set_ignore_cursor_events(false);
        let _ = window.set_focus();
        *visible_flag = true;
        let _ = app.emit(
            "overlay://toggle",
            serde_json::json!({ "visible": true }),
        );
    }
    Ok(())
}

pub async fn ensure_overlay_visible<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    let state = app.state::<AppState>();
    let mut visible_flag = state.overlay_visible.lock();
    if *visible_flag {
        return Ok(());
    }
    let window = app
        .get_webview_window("overlay")
        .ok_or_else(|| crate::error::JarvisError::Other("overlay window missing".into()))?;
    let _ = window.show();
    let _ = window.set_always_on_top(true);
    let _ = window.set_ignore_cursor_events(false);
    let _ = window.set_focus();
    *visible_flag = true;
    let _ = app.emit("overlay://toggle", serde_json::json!({ "visible": true }));
    Ok(())
}

#[tauri::command]
pub async fn open_settings<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
    }
    Ok(())
}

#[tauri::command]
pub async fn hide_overlay<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
) -> Result<()> {
    let mut visible_flag = state.overlay_visible.lock();
    if let Some(w) = app.get_webview_window("overlay") {
        let _ = w.set_ignore_cursor_events(true);
        let _ = w.hide();
    }
    *visible_flag = false;
    let _ = app.emit(
        "overlay://toggle",
        serde_json::json!({ "visible": false }),
    );
    Ok(())
}

#[tauri::command]
pub async fn quit_app<R: Runtime>(app: AppHandle<R>) -> Result<()> {
    app.exit(0);
    Ok(())
}
