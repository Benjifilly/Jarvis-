mod commands;
mod error;
mod models;
mod services;

use std::sync::Arc;

use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};
use tokio::sync::Mutex;
use tracing_subscriber::EnvFilter;

use crate::services::{
    ai_client::AiClient, config_store::ConfigStore, marketplace::HfClient, tray::build_tray,
    window_fx,
};

pub struct AppState {
    pub config: Arc<ConfigStore>,
    pub ai: Arc<AiClient>,
    pub hf: Arc<HfClient>,
    pub cancel: Arc<Mutex<Option<tokio::sync::oneshot::Sender<()>>>>,
    pub overlay_visible: Arc<parking_lot::Mutex<bool>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let handle = app.handle().clone();

            // Config + services.
            let config = Arc::new(ConfigStore::load(&handle)?);
            let ai = Arc::new(AiClient::new(Arc::clone(&config)));
            let hf = Arc::new(HfClient::new());

            app.manage(AppState {
                config: Arc::clone(&config),
                ai: Arc::clone(&ai),
                hf: Arc::clone(&hf),
                cancel: Arc::new(Mutex::new(None)),
                overlay_visible: Arc::new(parking_lot::Mutex::new(false)),
            });

            // Tray icon + context menu.
            build_tray(&handle)?;

            // Overlay window: make it click-through by default; toggle ON on activate.
            if let Some(overlay) = handle.get_webview_window("overlay") {
                let _ = window_fx::apply_overlay_effects(&overlay);
                let _ = overlay.set_ignore_cursor_events(true);
            }

            // Register global shortcut Ctrl+Space for overlay toggle.
            let shortcut = Shortcut::new(Some(Modifiers::CONTROL), Code::Space);
            {
                let handle_for_hotkey = handle.clone();
                handle.global_shortcut().on_shortcut(shortcut, move |_app, _sc, event| {
                    if event.state() == ShortcutState::Pressed {
                        let h = handle_for_hotkey.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(err) = commands::overlay::toggle_overlay(h).await {
                                tracing::error!(?err, "toggle_overlay failed");
                            }
                        });
                    }
                })?;
                handle.global_shortcut().register(shortcut)?;
            }

            // Forward global typing events while overlay is active.
            services::key_capture::spawn_key_listener(handle.clone());

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::config::get_config,
            commands::config::set_config,
            commands::ai::send_prompt,
            commands::ai::cancel_stream,
            commands::overlay::open_settings,
            commands::overlay::hide_overlay,
            commands::overlay::quit_app,
            commands::marketplace::hf_list_models,
            commands::marketplace::hf_list_files,
            commands::marketplace::hf_download,
            commands::marketplace::hf_set_token,
            commands::marketplace::hf_local_models,
        ])
        .on_window_event(|window, event| {
            // Prevent the settings window from closing the whole app.
            if window.label() == "settings" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

pub fn emit_overlay_toggle<R: tauri::Runtime>(app: &tauri::AppHandle<R>, visible: bool) {
    let _ = app.emit("overlay://toggle", serde_json::json!({ "visible": visible }));
}
