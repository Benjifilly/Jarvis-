import { useEffect, useRef } from "react";
import { getConfig, type VoiceConfig } from "../ipc/commands";
import { useAppStore } from "../store/useAppStore";
import { onAiDone } from "../ipc/events";

/**
 * Rough language sniff: looks at diacritics, common stopwords, and a few
 * script boundaries to guess the language of a short blob of text.
 * Returns a BCP-47 primary subtag ("fr", "en", "es", "de", "it", "pt").
 * Fallbacks to the browser UI language.
 */
function detectLang(text: string): string {
  const t = text.toLowerCase();
  if (/[àâçéèêëîïôùûüÿœæ]/.test(t) || /\b(je|tu|vous|bonjour|merci|c'est|est-ce que|voici)\b/.test(t))
    return "fr";
  if (/[äöüß]/.test(t) || /\b(ich|du|das|und|nicht|ist|bitte)\b/.test(t)) return "de";
  if (/[ñ¿¡]/.test(t) || /\b(hola|gracias|qué|cómo|pero|está|muy)\b/.test(t)) return "es";
  if (/\b(ciao|grazie|sono|molto|perché|però)\b/.test(t)) return "it";
  if (/[ãõ]/.test(t) || /\b(olá|obrigado|você|muito|está)\b/.test(t)) return "pt";
  if (/[а-яё]/i.test(t)) return "ru";
  if (/[ぁ-んァ-ン一-龯]/.test(t)) return "ja";
  if (/\b(hello|thanks|the|and|is|with|please|what)\b/.test(t)) return "en";
  return (navigator.language || "en").split("-")[0];
}

/**
 * Picks the best available voice for a given language. Preference order:
 *   1. Voices whose name contains "Natural"/"Neural"/"Premium"/"Enhanced"
 *      (Windows 11 has Microsoft Natural voices that sound far better than
 *      the legacy SAPI ones).
 *   2. Any voice matching the requested language.
 *   3. First voice in the list (absolute fallback).
 */
function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
): SpeechSynthesisVoice | undefined {
  if (voices.length === 0) return undefined;
  const langMatches = voices.filter((v) => v.lang?.toLowerCase().startsWith(lang));
  const premium = langMatches.find((v) =>
    /Natural|Neural|Premium|Enhanced|Online/i.test(v.name),
  );
  return premium ?? langMatches[0] ?? voices[0];
}

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

      const lang = detectLang(plain);
      const voices = window.speechSynthesis.getVoices();

      const utter = new SpeechSynthesisUtterance(plain);
      utter.rate = cfg.ttsRate;
      utter.lang = voices.find((v) => v.lang?.toLowerCase().startsWith(lang))?.lang ?? lang;

      // User-picked voice wins; otherwise auto-select the best match.
      const explicit = cfg.ttsVoice
        ? voices.find((v) => v.name === cfg.ttsVoice)
        : undefined;
      const selected = explicit ?? pickVoice(voices, lang);
      if (selected) utter.voice = selected;

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
