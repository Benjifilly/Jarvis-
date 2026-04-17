import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type OverlayToggleEvent = { visible: boolean };
export type TypingStartedEvent = { char: string };
export type AiTokenEvent = { messageId: string; token: string };
export type AiDoneEvent = { messageId: string; error?: string };

export function onOverlayToggle(
  cb: (ev: OverlayToggleEvent) => void,
): Promise<UnlistenFn> {
  return listen<OverlayToggleEvent>("overlay://toggle", (e) => cb(e.payload));
}

export function onTypingStarted(
  cb: (ev: TypingStartedEvent) => void,
): Promise<UnlistenFn> {
  return listen<TypingStartedEvent>("overlay://typing-started", (e) =>
    cb(e.payload),
  );
}

export function onAiToken(
  cb: (ev: AiTokenEvent) => void,
): Promise<UnlistenFn> {
  return listen<AiTokenEvent>("ai://token", (e) => cb(e.payload));
}

export function onAiDone(cb: (ev: AiDoneEvent) => void): Promise<UnlistenFn> {
  return listen<AiDoneEvent>("ai://done", (e) => cb(e.payload));
}
