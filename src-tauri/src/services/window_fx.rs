use tauri::{Runtime, WebviewWindow};

use crate::error::Result;

/// Keeps the overlay window in pure transparency mode.
/// We intentionally avoid acrylic/mica — Windows DWM effects add a grey tint
/// that conflicts with the aurora glow we render in CSS, and fullscreen-ish
/// transparent windows are much cleaner without any DWM backdrop.
pub fn apply_overlay_effects<R: Runtime>(window: &WebviewWindow<R>) -> Result<()> {
    #[cfg(windows)]
    {
        use window_vibrancy::clear_acrylic;
        let _ = clear_acrylic(window);
    }

    #[cfg(not(windows))]
    {
        let _ = window;
    }

    Ok(())
}
