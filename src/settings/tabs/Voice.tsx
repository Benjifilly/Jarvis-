import { useEffect, useState } from "react";
import type { VoiceConfig, SttMode } from "@/ipc/commands";

type Props = {
  value: VoiceConfig;
  onChange: (next: VoiceConfig) => void;
};

const STT_MODES: Array<{ value: SttMode; label: string; hint: string }> = [
  { value: "auto", label: "Automatique", hint: "Cloud si réseau, local sinon" },
  { value: "cloud", label: "Cloud uniquement", hint: "Whisper via API (Groq / OpenAI)" },
  { value: "local", label: "Local uniquement", hint: "100 % hors-ligne (whisper.cpp)" },
];

export default function Voice({ value, onChange }: Props) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  const set = <K extends keyof VoiceConfig>(key: K, v: VoiceConfig[K]) =>
    onChange({ ...value, [key]: v });

  const previewTts = () => {
    if (!window.speechSynthesis) return;
    const u = new SpeechSynthesisUtterance(
      "Bonjour, je suis Jarvis. Voici un aperçu de la voix sélectionnée.",
    );
    u.rate = value.ttsRate;
    if (value.ttsVoice) {
      const v = voices.find((vv) => vv.name === value.ttsVoice);
      if (v) u.voice = v;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  };

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-base font-medium text-white/90">Voix</h2>
        <p className="text-xs text-white/50">
          Configurez la reconnaissance vocale (STT) et la synthèse (TTS).
          Raccourci vocal : <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Espace</kbd>.
        </p>
      </header>

      {/* ── STT ────────────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-lg border border-white/5 bg-ink-800/40 p-4">
        <h3 className="text-sm font-medium text-white/80">
          Reconnaissance vocale (STT)
        </h3>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
          {STT_MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => set("stt_mode", m.value)}
              className={`rounded-md border px-3 py-2 text-left transition ${
                value.stt_mode === m.value
                  ? "border-glow-violet/70 bg-glow-violet/10"
                  : "border-white/10 bg-ink-900/60 hover:border-white/25"
              }`}
            >
              <div className="text-sm text-white/90">{m.label}</div>
              <div className="text-[11px] text-white/50">{m.hint}</div>
            </button>
          ))}
        </div>

        <Field
          label="URL de base Whisper"
          value={value.sttBaseUrl}
          onChange={(v) => set("sttBaseUrl", v)}
          placeholder="https://api.groq.com/openai/v1"
        />
        <Field
          label="Modèle Whisper"
          value={value.sttModel}
          onChange={(v) => set("sttModel", v)}
          placeholder="whisper-large-v3-turbo"
        />
        <Field
          label="Clé API (Groq / OpenAI)"
          value={value.sttApiKey ?? ""}
          onChange={(v) => set("sttApiKey", v || undefined)}
          placeholder="gsk_..."
          type="password"
        />
        <p className="text-[11px] text-white/45">
          Groq propose Whisper large-v3-turbo gratuitement (
          <a
            className="text-glow-violet hover:underline"
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noreferrer"
          >
            obtenir une clé
          </a>
          ).
        </p>
      </div>

      {/* ── TTS ────────────────────────────────────────────────────── */}
      <div className="space-y-3 rounded-lg border border-white/5 bg-ink-800/40 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white/80">
            Synthèse vocale (TTS)
          </h3>
          <label className="flex items-center gap-2 text-xs text-white/70">
            <input
              type="checkbox"
              checked={value.ttsEnabled}
              onChange={(e) => set("ttsEnabled", e.target.checked)}
              className="h-4 w-4 accent-glow-violet"
            />
            Activer
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">
            Voix système
          </span>
          <select
            value={value.ttsVoice ?? ""}
            onChange={(e) => set("ttsVoice", e.target.value || undefined)}
            disabled={!value.ttsEnabled}
            className="w-full rounded-md border border-white/10 bg-ink-800/70 px-3 py-2 text-sm text-white/90 outline-none focus:border-glow-violet/70 disabled:opacity-50"
          >
            <option value="" className="bg-ink-900">
              Voix par défaut
            </option>
            {voices.map((v) => (
              <option key={v.name} value={v.name} className="bg-ink-900">
                {v.name} — {v.lang}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-wide text-white/50">
              Vitesse
            </span>
            <span className="text-xs text-white/70">
              {value.ttsRate.toFixed(2)}×
            </span>
          </div>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.05}
            value={value.ttsRate}
            onChange={(e) => set("ttsRate", Number(e.target.value))}
            disabled={!value.ttsEnabled}
            className="w-full accent-glow-violet disabled:opacity-50"
          />
        </label>

        <button
          onClick={previewTts}
          disabled={!value.ttsEnabled}
          className="rounded-md border border-white/10 bg-ink-900/70 px-3 py-1.5 text-xs text-white/80 hover:border-white/25 disabled:opacity-50"
        >
          ▶︎ Écouter un aperçu
        </button>
      </div>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-white/10 bg-ink-800/70 px-3 py-2 text-sm text-white/90 outline-none focus:border-glow-violet/70"
      />
    </label>
  );
}
