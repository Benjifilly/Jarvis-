import { invoke } from "@tauri-apps/api/core";

export type ProviderKind =
  | "local-ollama"
  | "local-lmstudio"
  | "groq"
  | "openrouter"
  | "huggingface"
  | "google"
  | "custom";

export type GenParams = {
  temperature: number;
  topP: number;
  maxTokens: number;
  contextWindow: number;
  presencePenalty: number;
  frequencyPenalty: number;
  stop: string[];
};

export type AiConfig = {
  provider: ProviderKind;
  baseUrl: string;
  model: string;
  apiKey?: string;
  systemPrompt?: string;
  params: GenParams;
  localModelPath?: string | null;
};

export type SttMode = "auto" | "cloud" | "local";

export type VoiceConfig = {
  stt_mode: SttMode;
  sttBaseUrl: string;
  sttModel: string;
  sttApiKey?: string;
  ttsEnabled: boolean;
  ttsVoice?: string;
  ttsRate: number;
};

export type AppConfig = {
  ai: AiConfig;
  voice: VoiceConfig;
  hotkey: string;
  sttMode: SttMode;
};

export type ProviderInfo = {
  id: ProviderKind;
  name: string;
  baseUrl: string;
  defaultModel: string;
  requiresApiKey: boolean;
  signupUrl: string | null;
  description: string;
  category: "local" | "cloud-free" | "custom" | string;
};

export async function getConfig(): Promise<AppConfig> {
  return invoke("get_config");
}

export async function setConfig(cfg: AppConfig): Promise<void> {
  return invoke("set_config", { cfg });
}

export async function listProviders(): Promise<ProviderInfo[]> {
  return invoke("list_providers");
}

export async function probeProvider(): Promise<unknown> {
  return invoke("probe_provider");
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

export async function transcribe(
  audioBase64: string,
  mime: string,
): Promise<string> {
  return invoke("transcribe", {
    payload: { audio_base64: audioBase64, mime },
  });
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
