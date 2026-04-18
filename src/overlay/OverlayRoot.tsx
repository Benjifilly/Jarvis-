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
import { cancelStream, hideOverlay, sendPrompt } from "../ipc/commands";
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

  // Barge-in: the user just started talking over the assistant. Kill the
  // in-flight AI stream and any TTS playback so we cleanly pivot to the
  // new utterance.
  const onSpeechStart = useCallback(() => {
    void cancelStream().catch(() => {});
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  const {
    open: openVoice,
    close: closeVoice,
  } = useVoiceRecorder({ onTranscript, onSpeechStart });

  useEffect(() => {
    const unlisteners: Array<Promise<() => void>> = [];

    unlisteners.push(
      onOverlayToggle(({ visible }) => {
        setActive(visible);
        if (visible) {
          // Overlay just opened — kick off the continuous voice session
          // after the bloom animation has breathing room. From this point
          // the mic stays open: user can speak any time, and if they talk
          // over Jarvis's reply the barge-in handler will cut TTS/AI off.
          window.setTimeout(() => {
            void openVoice();
          }, 320);
        } else {
          closeVoice();
          setTyping(false);
        }
      }),
    );

    unlisteners.push(
      onTypingStarted(({ char }) => {
        // User started typing — switch to text mode. The voice session
        // keeps running in the background so the user can still barge in
        // by speaking; that's part of the "conversation mode" expectation.
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

    unlisteners.push(
      onVoiceToggle(() => {
        // Manual hotkey still works as a "force restart": close the current
        // session and reopen it so the mic is definitely listening.
        closeVoice();
        window.setTimeout(() => {
          void openVoice();
        }, 80);
      }),
    );

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeVoice();
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
    closeVoice,
    finalizeMessage,
    openVoice,
    resetConversation,
    setActive,
    setDraft,
    setTyping,
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
