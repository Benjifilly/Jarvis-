use tauri::{Runtime, WebviewWindow};

use crate::error::Result;

/// Applies platform-specific visual effects to the overlay window.
/// On Windows, attempts acrylic blur so the glow bleeds over whatever is behind.
pub fn apply_overlay_effects<R: Runtime>(window: &WebviewWindow<R>) -> Result<()> {
    #[cfg(windows)]
    {
        use window_vibrancy::{apply_acrylic, clear_acrylic};
        // A near-black tint with ~15 alpha produces a very discreet frame tint.
        if apply_acrylic(window, Some((5, 6, 10, 16))).is_err() {
            // If acrylic isn't available (older Windows), clear and fall back to pure transparency.
            let _ = clear_acrylic(window);
        }
    }

    #[cfg(not(windows))]
    {
        let _ = window;
    }

    Ok(())
}
