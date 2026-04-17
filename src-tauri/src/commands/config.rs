use tauri::State;

use crate::error::Result;
use crate::models::AppConfig;
use crate::AppState;

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> Result<AppConfig> {
    Ok(state.config.get())
}

#[tauri::command]
pub fn set_config(cfg: AppConfig, state: State<'_, AppState>) -> Result<()> {
    state.config.set(cfg)
}
