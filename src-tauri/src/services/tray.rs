use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Runtime,
};

use crate::commands::overlay;
use crate::error::Result;

pub fn build_tray<R: Runtime>(app: &AppHandle<R>) -> Result<()> {
    let settings = MenuItem::with_id(app, "settings", "Paramètres", true, None::<&str>)?;
    let ai_model = MenuItem::with_id(
        app,
        "ai_model",
        "Configuration du Modèle IA Local",
        true,
        None::<&str>,
    )?;
    let toggle = MenuItem::with_id(app, "toggle", "Afficher / Masquer", true, None::<&str>)?;
    let sep = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quitter", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[&toggle, &settings, &ai_model, &sep, &quit])?;

    let _tray = TrayIconBuilder::with_id("jarvis-tray")
        .tooltip("Jarvis — Assistant IA local")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(move |app, event| match event.id.as_ref() {
            "settings" => {
                if let Err(err) = show_settings(app, None) {
                    tracing::error!(?err, "open settings failed");
                }
            }
            "ai_model" => {
                if let Err(err) = show_settings(app, Some("ai")) {
                    tracing::error!(?err, "open settings failed");
                }
            }
            "toggle" => {
                let h = app.clone();
                tauri::async_runtime::spawn(async move {
                    let _ = overlay::toggle_overlay(h).await;
                });
            }
            "quit" => {
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let h = tray.app_handle().clone();
                tauri::async_runtime::spawn(async move {
                    let _ = overlay::toggle_overlay(h).await;
                });
            }
        })
        .build(app)?;

    Ok(())
}

fn show_settings<R: Runtime>(app: &AppHandle<R>, _focus_tab: Option<&str>) -> Result<()> {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
    }
    Ok(())
}
