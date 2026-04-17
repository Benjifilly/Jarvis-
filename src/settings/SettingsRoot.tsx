import { useEffect, useState } from "react";
import {
  getConfig,
  setConfig,
  type AiConfig,
  type AppConfig,
  type VoiceConfig,
} from "../ipc/commands";
import { onSettingsNavigate } from "../ipc/events";
import Marketplace from "./tabs/Marketplace";
import AiModel from "./tabs/AiModel";
import Voice from "./tabs/Voice";

const tabs = [
  "Général",
  "Modèle IA",
  "Voix",
  "Marketplace",
  "Raccourcis",
] as const;
type Tab = (typeof tabs)[number];

export default function SettingsRoot() {
  const [tab, setTab] = useState<Tab>("Modèle IA");
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    setSaved(false);
    setCfg((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateAi = (next: AiConfig) => update("ai", next);
  const updateVoice = (next: VoiceConfig) => update("voice", next);

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      await setConfig(cfg);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
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
              <h2 className="text-base font-medium text-white/90">Général</h2>
              <p className="text-sm text-white/55">
                Jarvis tourne en arrière-plan. Utilisez le raccourci pour
                l'activer à tout moment.
              </p>
              <ul className="space-y-1 text-sm text-white/70">
                <li>
                  <kbd>Ctrl</kbd>+<kbd>Espace</kbd> — afficher / cacher l'overlay
                </li>
                <li>
                  <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Espace</kbd> — démarrer
                  une requête vocale
                </li>
                <li>
                  <kbd>Échap</kbd> — cacher l'overlay
                </li>
              </ul>
            </section>
          )}

          {tab === "Modèle IA" && (
            <AiModel value={cfg.ai} onChange={updateAi} />
          )}

          {tab === "Voix" && (
            <Voice value={cfg.voice} onChange={updateVoice} />
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
              <p className="text-[11px] text-white/45">
                La modification du raccourci sera appliquée au prochain
                démarrage.
              </p>
            </section>
          )}
        </main>
      </div>

      {tab !== "Marketplace" && (
        <footer className="flex items-center justify-end gap-3 border-t border-white/5 bg-ink-900/60 px-4 py-3">
          {saved && (
            <span className="text-xs text-emerald-300/80">✓ Enregistré</span>
          )}
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
