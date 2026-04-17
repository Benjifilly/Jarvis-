import { useEffect } from "react";
import GlowBorder from "./GlowBorder";
import TextInputBar from "./TextInputBar";
import ResponseBubble from "./ResponseBubble";
import { useAppStore } from "../store/useAppStore";
import {
  onAiDone,
  onAiToken,
  onOverlayToggle,
  onTypingStarted,
} from "../ipc/events";
import { hideOverlay } from "../ipc/commands";

export default function OverlayRoot() {
  const active = useAppStore((s) => s.active);
  const setActive = useAppStore((s) => s.setActive);
  const setTyping = useAppStore((s) => s.setTyping);
  const setDraft = useAppStore((s) => s.setInputDraft);
  const appendToken = useAppStore((s) => s.appendToken);
  const finalizeMessage = useAppStore((s) => s.finalizeMessage);

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

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setTyping(false);
        setDraft("");
        void hideOverlay();
        return;
      }
      // Fluid text input: the overlay is visible but the input bar isn't shown.
      // A printable keystroke opens the bar, pre-filled with that character.
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
  }, [appendToken, finalizeMessage, setActive, setDraft, setTyping]);

  return (
    <div className="relative h-full w-full">
      <GlowBorder active={active} />
      <TextInputBar />
      <ResponseBubble />
    </div>
  );
}
