use serde::Serialize;
use tauri::State;

use crate::error::Result;
use crate::models::{AppConfig, ProviderKind, PROVIDERS};
use crate::AppState;

#[tauri::command]
pub fn get_config(state: State<'_, AppState>) -> Result<AppConfig> {
    Ok(state.config.get())
}

#[tauri::command]
pub fn set_config(cfg: AppConfig, state: State<'_, AppState>) -> Result<()> {
    state.config.set(cfg)
}

#[derive(Serialize)]
pub struct ProviderInfo {
    pub id: ProviderKind,
    pub name: String,
    #[serde(rename = "baseUrl")]
    pub base_url: String,
    #[serde(rename = "defaultModel")]
    pub default_model: String,
    #[serde(rename = "requiresApiKey")]
    pub requires_api_key: bool,
    #[serde(rename = "signupUrl")]
    pub signup_url: Option<String>,
    pub description: String,
    pub category: String,
}

#[tauri::command]
pub fn list_providers() -> Vec<ProviderInfo> {
    PROVIDERS
        .iter()
        .map(|p| ProviderInfo {
            id: p.id,
            name: p.name.to_string(),
            base_url: p.base_url.to_string(),
            default_model: p.default_model.to_string(),
            requires_api_key: p.requires_api_key,
            signup_url: p.signup_url.map(|s| s.to_string()),
            description: p.description.to_string(),
            category: p.category.to_string(),
        })
        .collect()
}

#[tauri::command]
pub async fn probe_provider(state: State<'_, AppState>) -> Result<serde_json::Value> {
    state.ai.probe().await
}
