import { useEffect, useRef } from "react";
import { getConfig, type VoiceConfig } from "../ipc/commands";
import { useAppStore } from "../store/useAppStore";
import { onAiDone } from "../ipc/events";

export function useTts() {
  const cfgRef = useRef<VoiceConfig | null>(null);

  useEffect(() => {
    getConfig()
      .then((c) => {
        cfgRef.current = c.voice;
      })
      .catch(() => {});

    const interval = window.setInterval(() => {
      getConfig()
        .then((c) => {
          cfgRef.current = c.voice;
        })
        .catch(() => {});
    }, 10_000);

    const unlisten = onAiDone(({ messageId, error }) => {
      const cfg = cfgRef.current;
      if (!cfg?.ttsEnabled || error) return;
      if (typeof window === "undefined" || !window.speechSynthesis) return;

      const msg = useAppStore
        .getState()
        .messages.find((m) => m.id === messageId);
      if (!msg || msg.role !== "assistant" || !msg.content) return;

      const plain = msg.content
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/[*_#>\[\]]/g, "")
        .trim();
      if (!plain) return;

      const utter = new SpeechSynthesisUtterance(plain);
      utter.rate = cfg.ttsRate;
      if (cfg.ttsVoice) {
        const v = window.speechSynthesis
          .getVoices()
          .find((vv) => vv.name === cfg.ttsVoice);
        if (v) utter.voice = v;
      }
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    });

    return () => {
      window.clearInterval(interval);
      unlisten.then((fn) => fn());
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);
}
