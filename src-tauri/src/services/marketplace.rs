use std::path::{Path, PathBuf};

use futures_util::StreamExt;
use reqwest::{Client, header};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio::io::AsyncWriteExt;

use crate::error::{JarvisError, Result};

const HF_API: &str = "https://huggingface.co/api";
const HF_RESOLVE: &str = "https://huggingface.co";

pub struct HfClient {
    http: Client,
    token: parking_lot::RwLock<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HfModel {
    pub id: String,
    #[serde(rename = "modelId", default)]
    pub model_id: Option<String>,
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub downloads: Option<u64>,
    #[serde(default)]
    pub likes: Option<u64>,
    #[serde(rename = "pipeline_tag", default)]
    pub pipeline_tag: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(rename = "lastModified", default)]
    pub last_modified: Option<String>,
    #[serde(rename = "trendingScore", default)]
    pub trending_score: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HfFile {
    pub rfilename: String,
    #[serde(default)]
    pub size: Option<u64>,
    #[serde(default)]
    pub blob_id: Option<String>,
}

#[derive(Debug, Deserialize)]
struct HfModelDetail {
    #[serde(default)]
    siblings: Vec<HfFile>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DownloadProgress {
    pub repo: String,
    pub file: String,
    pub downloaded: u64,
    pub total: Option<u64>,
    pub done: bool,
    pub path: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum HfSort {
    Trending,
    Downloads,
    Likes,
    Modified,
}

impl HfSort {
    fn as_query(self) -> &'static str {
        match self {
            HfSort::Trending => "trendingScore",
            HfSort::Downloads => "downloads",
            HfSort::Likes => "likes",
            HfSort::Modified => "lastModified",
        }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListQuery {
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub task: Option<String>,
    #[serde(default)]
    pub library: Option<String>,
    #[serde(default)]
    pub sort: Option<HfSort>,
    #[serde(default)]
    pub limit: Option<u32>,
}

impl HfClient {
    pub fn new() -> Self {
        let http = Client::builder()
            .user_agent("Jarvis/0.1 (+https://github.com/Benjifilly/Jarvis-)")
            .build()
            .expect("reqwest client");
        Self {
            http,
            token: parking_lot::RwLock::new(None),
        }
    }

    pub fn set_token(&self, token: Option<String>) {
        *self.token.write() = token.filter(|t| !t.is_empty());
    }

    fn auth_header(&self) -> Option<header::HeaderValue> {
        self.token
            .read()
            .as_ref()
            .and_then(|t| header::HeaderValue::from_str(&format!("Bearer {t}")).ok())
    }

    pub async fn list(&self, q: ListQuery) -> Result<Vec<HfModel>> {
        let sort = q.sort.unwrap_or(HfSort::Trending).as_query();
        let limit = q.limit.unwrap_or(40).min(100);

        let mut url = reqwest::Url::parse(&format!("{HF_API}/models")).unwrap();
        {
            let mut qs = url.query_pairs_mut();
            qs.append_pair("sort", sort);
            qs.append_pair("direction", "-1");
            qs.append_pair("limit", &limit.to_string());
            qs.append_pair("full", "false");
            if let Some(s) = q.search.as_deref() {
                if !s.trim().is_empty() {
                    qs.append_pair("search", s.trim());
                }
            }
            if let Some(t) = q.task.as_deref() {
                if !t.is_empty() {
                    qs.append_pair("pipeline_tag", t);
                }
            }
            if let Some(l) = q.library.as_deref() {
                if !l.is_empty() {
                    qs.append_pair("library", l);
                }
            }
        }

        let mut req = self.http.get(url);
        if let Some(h) = self.auth_header() {
            req = req.header(header::AUTHORIZATION, h);
        }

        let resp = req.send().await?;
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(JarvisError::Upstream { status, body });
        }
        let models: Vec<HfModel> = resp.json().await?;
        Ok(models)
    }

    pub async fn list_files(&self, repo_id: &str) -> Result<Vec<HfFile>> {
        let url = format!("{HF_API}/models/{repo_id}");
        let mut req = self.http.get(url);
        if let Some(h) = self.auth_header() {
            req = req.header(header::AUTHORIZATION, h);
        }
        let resp = req.send().await?;
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            return Err(JarvisError::Upstream { status, body });
        }
        let detail: HfModelDetail = resp.json().await?;
        Ok(detail.siblings)
    }

    pub async fn download<R: Runtime>(
        &self,
        app: AppHandle<R>,
        repo_id: String,
        filename: String,
    ) -> Result<PathBuf> {
        let dest = models_dir(&app)?.join(sanitize_repo(&repo_id)).join(&filename);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)?;
        }

        let url = format!("{HF_RESOLVE}/{repo_id}/resolve/main/{filename}");
        let mut req = self.http.get(url);
        if let Some(h) = self.auth_header() {
            req = req.header(header::AUTHORIZATION, h);
        }

        let resp = req.send().await?;
        if !resp.status().is_success() {
            let status = resp.status().as_u16();
            let body = resp.text().await.unwrap_or_default();
            emit_progress(
                &app,
                DownloadProgress {
                    repo: repo_id.clone(),
                    file: filename.clone(),
                    downloaded: 0,
                    total: None,
                    done: true,
                    path: None,
                    error: Some(format!("HTTP {status}: {body}")),
                },
            );
            return Err(JarvisError::Upstream { status, body });
        }

        let total = resp.content_length();
        let mut downloaded: u64 = 0;
        let mut last_emit_pct: u8 = 0;

        let mut file = tokio::fs::File::create(&dest).await?;
        let mut stream = resp.bytes_stream();
        while let Some(chunk) = stream.next().await {
            let chunk = chunk?;
            file.write_all(&chunk).await?;
            downloaded += chunk.len() as u64;

            // Emit at most ~1 event per percent to keep IPC quiet on big files.
            let pct = match total {
                Some(t) if t > 0 => ((downloaded * 100) / t).min(100) as u8,
                _ => 0,
            };
            if pct != last_emit_pct {
                last_emit_pct = pct;
                emit_progress(
                    &app,
                    DownloadProgress {
                        repo: repo_id.clone(),
                        file: filename.clone(),
                        downloaded,
                        total,
                        done: false,
                        path: None,
                        error: None,
                    },
                );
            }
        }
        file.flush().await?;

        emit_progress(
            &app,
            DownloadProgress {
                repo: repo_id.clone(),
                file: filename.clone(),
                downloaded,
                total,
                done: true,
                path: Some(dest.to_string_lossy().to_string()),
                error: None,
            },
        );

        Ok(dest)
    }
}

pub fn models_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|e| JarvisError::Config(e.to_string()))?
        .join("models");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn sanitize_repo(repo: &str) -> String {
    repo.replace(['/', '\\', ':'], "_")
}

fn emit_progress<R: Runtime>(app: &AppHandle<R>, p: DownloadProgress) {
    let _ = app.emit("hf://download-progress", p);
}

#[derive(Debug, Clone, Serialize)]
pub struct LocalModel {
    pub repo: String,
    pub file: String,
    pub path: String,
    pub size: u64,
}

pub fn list_local_models<R: Runtime>(app: &AppHandle<R>) -> Result<Vec<LocalModel>> {
    let root = models_dir(app)?;
    let mut out = Vec::new();
    walk(&root, &root, &mut out)?;
    Ok(out)
}

fn walk(root: &Path, dir: &Path, out: &mut Vec<LocalModel>) -> Result<()> {
    if !dir.exists() {
        return Ok(());
    }
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            walk(root, &path, out)?;
        } else {
            let rel = path.strip_prefix(root).unwrap_or(&path);
            let mut iter = rel.iter();
            let repo = iter
                .next()
                .map(|s| s.to_string_lossy().replace('_', "/"))
                .unwrap_or_default();
            let file = iter
                .next()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| rel.to_string_lossy().to_string());
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            out.push(LocalModel {
                repo,
                file,
                path: path.to_string_lossy().to_string(),
                size,
            });
        }
    }
    Ok(())
}
