import { invoke } from "@tauri-apps/api/core";

export type AiConfig = {
  baseUrl: string;
  model: string;
  apiKey?: string;
  systemPrompt?: string;
  temperature?: number;
};

export type AppConfig = {
  ai: AiConfig;
  hotkey: string;
  sttMode: "auto" | "cloud" | "local";
};

export async function getConfig(): Promise<AppConfig> {
  return invoke("get_config");
}

export async function setConfig(cfg: AppConfig): Promise<void> {
  return invoke("set_config", { cfg });
}

export async function sendPrompt(
  prompt: string,
  messageId: string,
): Promise<void> {
  return invoke("send_prompt", { prompt, messageId });
}

export async function cancelStream(): Promise<void> {
  return invoke("cancel_stream");
}

export async function openSettings(): Promise<void> {
  return invoke("open_settings");
}

export async function hideOverlay(): Promise<void> {
  return invoke("hide_overlay");
}

export async function quitApp(): Promise<void> {
  return invoke("quit_app");
}

// ─── Hugging Face marketplace ───────────────────────────────────────────────

export type HfSort = "trending" | "downloads" | "likes" | "modified";

export type HfListQuery = {
  search?: string;
  task?: string;
  library?: string;
  sort?: HfSort;
  limit?: number;
};

export type HfModel = {
  id: string;
  modelId?: string | null;
  author?: string | null;
  downloads?: number | null;
  likes?: number | null;
  pipeline_tag?: string | null;
  tags: string[];
  lastModified?: string | null;
  trendingScore?: number | null;
};

export type HfFile = {
  rfilename: string;
  size?: number | null;
  blob_id?: string | null;
};

export type LocalModel = {
  repo: string;
  file: string;
  path: string;
  size: number;
};

export async function hfListModels(query: HfListQuery): Promise<HfModel[]> {
  return invoke("hf_list_models", { query });
}

export async function hfListFiles(repoId: string): Promise<HfFile[]> {
  return invoke("hf_list_files", { repoId });
}

export async function hfDownload(
  repoId: string,
  filename: string,
): Promise<string> {
  return invoke("hf_download", { repoId, filename });
}

export async function hfSetToken(token: string | null): Promise<void> {
  return invoke("hf_set_token", { token });
}

export async function hfLocalModels(): Promise<LocalModel[]> {
  return invoke("hf_local_models");
}
