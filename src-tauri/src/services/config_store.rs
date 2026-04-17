use std::path::PathBuf;

use parking_lot::RwLock;
use tauri::{AppHandle, Manager, Runtime};

use crate::error::{JarvisError, Result};
use crate::models::AppConfig;

pub struct ConfigStore {
    path: PathBuf,
    inner: RwLock<AppConfig>,
}

impl ConfigStore {
    pub fn load<R: Runtime>(app: &AppHandle<R>) -> Result<Self> {
        let dir = app
            .path()
            .app_config_dir()
            .map_err(|e| JarvisError::Config(e.to_string()))?;
        std::fs::create_dir_all(&dir)?;
        let path = dir.join("config.json");

        let cfg = if path.exists() {
            let raw = std::fs::read_to_string(&path)?;
            serde_json::from_str::<AppConfig>(&raw).unwrap_or_default()
        } else {
            let default = AppConfig::default();
            std::fs::write(&path, serde_json::to_string_pretty(&default)?)?;
            default
        };

        Ok(Self {
            path,
            inner: RwLock::new(cfg),
        })
    }

    pub fn get(&self) -> AppConfig {
        self.inner.read().clone()
    }

    pub fn set(&self, cfg: AppConfig) -> Result<()> {
        std::fs::write(&self.path, serde_json::to_string_pretty(&cfg)?)?;
        *self.inner.write() = cfg;
        Ok(())
    }
}
