import { useEffect, useState } from "react";
import { getConfig, setConfig, type AppConfig } from "../ipc/commands";
import { onSettingsNavigate } from "../ipc/events";
import Marketplace from "./tabs/Marketplace";

const tabs = ["Général", "Modèle IA", "Marketplace", "Raccourcis"] as const;
type Tab = (typeof tabs)[number];

export default function SettingsRoot() {
  const [tab, setTab] = useState<Tab>("Modèle IA");
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConfig().then(setCfg).catch(() => setCfg(null));
  }, []);

  useEffect(() => {
    const unlisten = onSettingsNavigate((target) => {
      if ((tabs as readonly string[]).includes(target)) {
        setTab(target as Tab);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const update = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => {
    setCfg((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateAi = <K extends keyof AppConfig["ai"]>(
    key: K,
    value: AppConfig["ai"][K],
  ) => {
    setCfg((prev) =>
      prev ? { ...prev, ai: { ...prev.ai, [key]: value } } : prev,
    );
  };

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      await setConfig(cfg);
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) {
    return (
      <div className="settings-window flex h-full w-full items-center justify-center text-white/60">
        Chargement…
      </div>
    );
  }

  return (
    <div className="settings-window flex h-full w-full flex-col">
      <header className="drag-region flex h-10 items-center border-b border-white/5 px-4 text-sm text-white/70">
        Paramètres Jarvis
      </header>

      <div className="flex flex-1 overflow-hidden">
        <nav className="flex w-44 flex-col border-r border-white/5 bg-ink-900/60 py-3">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-left text-sm transition ${
                tab === t
                  ? "bg-white/5 text-white"
                  : "text-white/55 hover:text-white/80"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>

        <main className="flex-1 overflow-auto p-6">
          {tab === "Général" && (
            <section className="space-y-4">
              <h2 className="text-base font-medium text-white/90">
                Général
              </h2>
              <p className="text-sm text-white/55">
                Jarvis tourne en arrière-plan. Utilisez le raccourci pour
                l'activer à tout moment.
              </p>
            </section>
          )}

          {tab === "Modèle IA" && (
            <section className="space-y-5">
              <h2 className="text-base font-medium text-white/90">
                Modèle IA local
              </h2>
              <Field
                label="URL de base (Ollama / LM Studio)"
                value={cfg.ai.baseUrl}
                onChange={(v) => updateAi("baseUrl", v)}
                placeholder="http://localhost:11434/v1"
              />
              <Field
                label="Nom du modèle"
                value={cfg.ai.model}
                onChange={(v) => updateAi("model", v)}
                placeholder="llama3.2"
              />
              <Field
                label="Clé API (optionnelle)"
                value={cfg.ai.apiKey ?? ""}
                onChange={(v) => updateAi("apiKey", v || undefined)}
                placeholder="laisser vide pour un serveur local"
                type="password"
              />
              <Field
                label="Prompt système"
                value={cfg.ai.systemPrompt ?? ""}
                onChange={(v) => updateAi("systemPrompt", v)}
                placeholder="Tu es Jarvis, un assistant concis et utile."
                multiline
              />
            </section>
          )}

          {tab === "Marketplace" && <Marketplace />}

          {tab === "Raccourcis" && (
            <section className="space-y-4">
              <h2 className="text-base font-medium text-white/90">
                Raccourcis
              </h2>
              <Field
                label="Activation de l'overlay"
                value={cfg.hotkey}
                onChange={(v) => update("hotkey", v)}
                placeholder="Ctrl+Space"
              />
            </section>
          )}
        </main>
      </div>

      {tab !== "Marketplace" && (
        <footer className="flex justify-end border-t border-white/5 bg-ink-900/60 px-4 py-3">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-glow-violet/80 px-4 py-1.5 text-sm font-medium text-white shadow-glow-soft hover:bg-glow-violet disabled:opacity-50"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </footer>
      )}
    </div>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password";
  multiline?: boolean;
};

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline,
}: FieldProps) {
  const common =
    "w-full rounded-md border border-white/10 bg-ink-800/70 px-3 py-2 text-sm text-white/90 outline-none focus:border-glow-violet/70";
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={4}
          className={common}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={common}
        />
      )}
    </label>
  );
}
