use tauri::{AppHandle, Runtime, State};

use crate::error::Result;
use crate::services::marketplace::{
    HfFile, HfModel, ListQuery, LocalModel, list_local_models,
};
use crate::AppState;

#[tauri::command]
pub async fn hf_list_models(
    state: State<'_, AppState>,
    query: ListQuery,
) -> Result<Vec<HfModel>> {
    state.hf.list(query).await
}

#[tauri::command]
pub async fn hf_list_files(
    state: State<'_, AppState>,
    repo_id: String,
) -> Result<Vec<HfFile>> {
    state.hf.list_files(&repo_id).await
}

#[tauri::command]
pub async fn hf_download<R: Runtime>(
    app: AppHandle<R>,
    state: State<'_, AppState>,
    repo_id: String,
    filename: String,
) -> Result<String> {
    let path = state.hf.download(app, repo_id, filename).await?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn hf_set_token(state: State<'_, AppState>, token: Option<String>) -> Result<()> {
    state.hf.set_token(token);
    Ok(())
}

#[tauri::command]
pub async fn hf_local_models<R: Runtime>(app: AppHandle<R>) -> Result<Vec<LocalModel>> {
    list_local_models(&app)
}
