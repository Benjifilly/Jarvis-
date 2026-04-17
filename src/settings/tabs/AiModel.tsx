import { useEffect, useMemo, useState } from "react";
import {
  hfLocalModels,
  listProviders,
  probeProvider,
  type AiConfig,
  type GenParams,
  type LocalModel,
  type ProviderInfo,
} from "@/ipc/commands";

type Props = {
  value: AiConfig;
  onChange: (next: AiConfig) => void;
};

export default function AiModel({ value, onChange }: Props) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [local, setLocal] = useState<LocalModel[]>([]);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<string | null>(null);

  useEffect(() => {
    listProviders().then(setProviders).catch(() => setProviders([]));
    hfLocalModels().then(setLocal).catch(() => setLocal([]));
  }, []);

  const grouped = useMemo(() => {
    const by: Record<string, ProviderInfo[]> = {};
    for (const p of providers) {
      (by[p.category] ??= []).push(p);
    }
    return by;
  }, [providers]);

  const current = providers.find((p) => p.id === value.provider);

  const setProvider = (p: ProviderInfo) => {
    const next: AiConfig = {
      ...value,
      provider: p.id,
      baseUrl: p.baseUrl || value.baseUrl,
      model: p.defaultModel || value.model,
    };
    if (p.id !== "huggingface") {
      next.localModelPath = null;
    }
    onChange(next);
  };

  const setAi = <K extends keyof AiConfig>(key: K, v: AiConfig[K]) =>
    onChange({ ...value, [key]: v });

  const setParam = <K extends keyof GenParams>(key: K, v: GenParams[K]) =>
    onChange({ ...value, params: { ...value.params, [key]: v } });

  const onProbe = async () => {
    setProbing(true);
    setProbeResult(null);
    try {
      const res = await probeProvider();
      const count =
        res && typeof res === "object" && "data" in (res as object)
          ? ((res as { data?: unknown[] }).data?.length ?? 0)
          : 0;
      setProbeResult(`✓ Endpoint joignable — ${count} modèle(s) listé(s).`);
    } catch (err) {
      setProbeResult(`✗ ${String(err)}`);
    } finally {
      setProbing(false);
    }
  };

  const isLocalGguf = value.provider === "huggingface";

  return (
    <section className="space-y-6">
      <header>
        <h2 className="text-base font-medium text-white/90">Modèle IA</h2>
        <p className="text-xs text-white/50">
          Choisissez un fournisseur gratuit ou utilisez un modèle téléchargé
          localement, puis ajustez ses paramètres.
        </p>
      </header>

      {/* ── Provider picker ─────────────────────────────────────────── */}
      <div className="space-y-4">
        {["local", "cloud-free", "custom"].map((cat) => {
          const list = grouped[cat];
          if (!list || list.length === 0) return null;
          return (
            <div key={cat}>
              <h3 className="mb-2 text-xs uppercase tracking-wide text-white/45">
                {cat === "local"
                  ? "Exécution locale"
                  : cat === "cloud-free"
                    ? "Fournisseurs gratuits"
                    : "Personnalisé"}
              </h3>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {list.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProvider(p)}
                    className={`flex flex-col gap-1 rounded-lg border px-4 py-3 text-left transition ${
                      value.provider === p.id
                        ? "border-glow-violet/70 bg-glow-violet/10"
                        : "border-white/10 bg-ink-800/60 hover:border-white/25 hover:bg-ink-800/80"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/90">
                        {p.name}
                      </span>
                      {p.requiresApiKey && (
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-200">
                          clé API
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-white/50">
                      {p.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Provider connection ────────────────────────────────────── */}
      <div className="space-y-3 rounded-lg border border-white/5 bg-ink-800/40 p-4">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-white/80">Connexion</h3>
          {current?.signupUrl && (
            <a
              href={current.signupUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-glow-violet hover:underline"
            >
              Obtenir une clé →
            </a>
          )}
          <button
            onClick={onProbe}
            disabled={probing}
            className="ml-auto rounded-md border border-white/10 bg-ink-900/70 px-3 py-1 text-xs text-white/80 hover:border-white/25 disabled:opacity-50"
          >
            {probing ? "Test…" : "Tester"}
          </button>
        </div>

        <Field
          label="URL de base"
          value={value.baseUrl}
          onChange={(v) => setAi("baseUrl", v)}
          placeholder="http://localhost:11434/v1"
        />

        {current?.requiresApiKey && (
          <Field
            label="Clé API"
            value={value.apiKey ?? ""}
            onChange={(v) => setAi("apiKey", v || undefined)}
            placeholder="sk-..."
            type="password"
          />
        )}

        <Field
          label="Modèle"
          value={value.model}
          onChange={(v) => setAi("model", v)}
          placeholder={current?.defaultModel}
        />

        {isLocalGguf && (
          <div>
            <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">
              Fichier .gguf local
            </span>
            {local.length === 0 ? (
              <p className="rounded-md border border-white/10 bg-ink-900/60 px-3 py-2 text-xs text-white/50">
                Aucun modèle téléchargé. Rendez-vous dans l'onglet
                <span className="mx-1 text-white/80">Marketplace</span>
                pour télécharger un GGUF depuis Hugging Face.
              </p>
            ) : (
              <select
                value={value.localModelPath ?? ""}
                onChange={(e) =>
                  setAi(
                    "localModelPath",
                    e.target.value ? e.target.value : null,
                  )
                }
                className="w-full rounded-md border border-white/10 bg-ink-800/70 px-3 py-2 text-sm text-white/90 outline-none focus:border-glow-violet/70"
              >
                <option value="" className="bg-ink-900">
                  — Sélectionnez un modèle —
                </option>
                {local.map((m) => (
                  <option
                    key={m.path}
                    value={m.path}
                    className="bg-ink-900"
                  >
                    {m.repo} · {m.file}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {probeResult && (
          <div
            className={`rounded-md border px-3 py-2 text-xs ${
              probeResult.startsWith("✓")
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"
                : "border-red-500/30 bg-red-500/10 text-red-200"
            }`}
          >
            {probeResult}
          </div>
        )}
      </div>

      {/* ── System prompt ──────────────────────────────────────────── */}
      <Field
        label="Prompt système"
        value={value.systemPrompt ?? ""}
        onChange={(v) => setAi("systemPrompt", v)}
        placeholder="Tu es Jarvis, un assistant concis et utile."
        multiline
      />

      {/* ── Advanced params ────────────────────────────────────────── */}
      <details className="rounded-lg border border-white/5 bg-ink-800/40 p-4" open>
        <summary className="cursor-pointer text-sm font-medium text-white/80">
          Paramètres de génération
        </summary>

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Slider
            label="Température"
            hint="Créativité — 0 = déterministe, 2 = aléatoire"
            min={0}
            max={2}
            step={0.05}
            value={value.params.temperature}
            onChange={(v) => setParam("temperature", v)}
          />
          <Slider
            label="Top-P"
            hint="Échantillonnage nucleus"
            min={0}
            max={1}
            step={0.05}
            value={value.params.topP}
            onChange={(v) => setParam("topP", v)}
          />
          <NumberField
            label="Tokens max. (réponse)"
            value={value.params.maxTokens}
            onChange={(v) => setParam("maxTokens", v)}
            min={16}
            max={32768}
            step={64}
          />
          <NumberField
            label="Fenêtre de contexte"
            hint="num_ctx (appliqué sur Ollama)"
            value={value.params.contextWindow}
            onChange={(v) => setParam("contextWindow", v)}
            min={512}
            max={131072}
            step={256}
          />
          <Slider
            label="Presence penalty"
            min={-2}
            max={2}
            step={0.05}
            value={value.params.presencePenalty}
            onChange={(v) => setParam("presencePenalty", v)}
          />
          <Slider
            label="Frequency penalty"
            min={-2}
            max={2}
            step={0.05}
            value={value.params.frequencyPenalty}
            onChange={(v) => setParam("frequencyPenalty", v)}
          />
        </div>

        <div className="mt-4">
          <Field
            label="Séquences d'arrêt (séparées par virgule)"
            value={value.params.stop.join(", ")}
            onChange={(v) =>
              setParam(
                "stop",
                v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
            placeholder="User:, </s>"
          />
        </div>
      </details>
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "password";
  multiline?: boolean;
}) {
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
          rows={3}
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

function Slider({
  label,
  hint,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-white/50">
          {label}
        </span>
        <span className="text-xs text-white/70">{value.toFixed(2)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-glow-violet"
      />
      {hint && <span className="text-[11px] text-white/40">{hint}</span>}
    </label>
  );
}

function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-white/50">
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full rounded-md border border-white/10 bg-ink-800/70 px-3 py-2 text-sm text-white/90 outline-none focus:border-glow-violet/70"
      />
      {hint && <span className="text-[11px] text-white/40">{hint}</span>}
    </label>
  );
}

export type { Props as AiModelProps };
