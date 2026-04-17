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
