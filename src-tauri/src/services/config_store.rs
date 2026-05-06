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
            let mut cfg: AppConfig = serde_json::from_str(&raw).unwrap_or_default();
            // Migrate the legacy system prompt that had no language rule — it was
            // letting the LLM drift into other languages. Only overwrite if the
            // user hasn't customised it.
            if cfg.ai.system_prompt.as_deref()
                == Some("Tu es Jarvis, un assistant local concis, précis et utile.")
            {
                cfg.ai.system_prompt = AppConfig::default().ai.system_prompt;
            }
            cfg
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
