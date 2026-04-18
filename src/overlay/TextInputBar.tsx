import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAppStore } from "../store/useAppStore";
import { sendPrompt } from "../ipc/commands";

function newMessageId(): string {
  return `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export default function TextInputBar() {
  const typing = useAppStore((s) => s.typing);
  const draft = useAppStore((s) => s.inputDraft);
  const setDraft = useAppStore((s) => s.setInputDraft);
  const setTyping = useAppStore((s) => s.setTyping);
  const pushMessage = useAppStore((s) => s.pushMessage);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typing) inputRef.current?.focus();
  }, [typing]);

  const submit = async () => {
    const prompt = draft.trim();
    if (!prompt) return;
    const userId = newMessageId();
    const assistantId = newMessageId();
    pushMessage({ id: userId, role: "user", content: prompt });
    pushMessage({
      id: assistantId,
      role: "assistant",
      content: "",
      pending: true,
    });
    setDraft("");
    setTyping(false);
    await sendPrompt(prompt, assistantId);
  };

  return (
    <AnimatePresence>
      {typing && (
        <motion.div
          className="pointer-events-auto fixed left-1/2 top-[32%] w-[min(720px,70vw)] max-w-[calc(100vw-4rem)] -translate-x-1/2 -translate-y-1/2"
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="rounded-2xl border border-white/10 bg-ink-900/70 px-5 py-4 shadow-glow-soft backdrop-blur-xl">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void submit();
                } else if (e.key === "Escape") {
                  setTyping(false);
                  setDraft("");
                }
              }}
              placeholder="Demandez à Jarvis…"
              className="w-full bg-transparent text-lg font-sans text-white/95 placeholder-white/40 outline-none"
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
