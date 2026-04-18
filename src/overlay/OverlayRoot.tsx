import { useCallback, useEffect } from "react";
import GlowBorder from "./GlowBorder";
import TextInputBar from "./TextInputBar";
import ResponseBubble from "./ResponseBubble";
import VoiceIndicator from "./VoiceIndicator";
import { useAppStore } from "../store/useAppStore";
import {
  onAiDone,
  onAiToken,
  onOverlayToggle,
  onTypingStarted,
  onVoiceToggle,
} from "../ipc/events";
import { hideOverlay, sendPrompt } from "../ipc/commands";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { useTts } from "./useTts";

function newMessageId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function OverlayRoot() {
  const active = useAppStore((s) => s.active);
  const setActive = useAppStore((s) => s.setActive);
  const setTyping = useAppStore((s) => s.setTyping);
  const setDraft = useAppStore((s) => s.setInputDraft);
  const appendToken = useAppStore((s) => s.appendToken);
  const finalizeMessage = useAppStore((s) => s.finalizeMessage);
  const pushMessage = useAppStore((s) => s.pushMessage);
  const resetConversation = useAppStore((s) => s.resetConversation);

  useTts();

  const onTranscript = useCallback(
    async (text: string) => {
      const userId = newMessageId();
      const assistantId = newMessageId();
      pushMessage({ id: userId, role: "user", content: text });
      pushMessage({
        id: assistantId,
        role: "assistant",
        content: "",
        pending: true,
      });
      await sendPrompt(text, assistantId);
    },
    [pushMessage],
  );

  const { toggle: toggleVoice } = useVoiceRecorder({ onTranscript });

  useEffect(() => {
    const unlisteners: Array<Promise<() => void>> = [];

    unlisteners.push(
      onOverlayToggle(({ visible }) => {
        setActive(visible);
        if (!visible) setTyping(false);
      }),
    );

    unlisteners.push(
      onTypingStarted(({ char }) => {
        setDraft(char);
        setTyping(true);
      }),
    );

    unlisteners.push(
      onAiToken(({ messageId, token }) => appendToken(messageId, token)),
    );

    unlisteners.push(
      onAiDone(({ messageId }) => finalizeMessage(messageId)),
    );

    unlisteners.push(onVoiceToggle(() => toggleVoice()));

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        resetConversation();
        void hideOverlay();
        return;
      }
      const state = useAppStore.getState();
      if (!state.active || state.typing) return;
      const isPrintable =
        e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey;
      if (isPrintable) {
        e.preventDefault();
        setDraft(e.key);
        setTyping(true);
      }
    };
    window.addEventListener("keydown", onKey);

    return () => {
      unlisteners.forEach((p) => p.then((fn) => fn()));
      window.removeEventListener("keydown", onKey);
    };
  }, [
    appendToken,
    finalizeMessage,
    resetConversation,
    setActive,
    setDraft,
    setTyping,
    toggleVoice,
  ]);

  return (
    <div className="fixed inset-0 h-screen w-screen pointer-events-none">
      <GlowBorder active={active} />
      <TextInputBar />
      <ResponseBubble />
      <VoiceIndicator />
    </div>
  );
}
