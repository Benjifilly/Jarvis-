import { useEffect, useMemo, useRef, useState } from "react";
import {
  hfDownload,
  hfListFiles,
  hfListModels,
  hfLocalModels,
  type HfFile,
  type HfModel,
  type HfSort,
  type LocalModel,
} from "@/ipc/commands";
import { onDownloadProgress } from "@/ipc/events";

const TASKS: Array<{ value: string; label: string }> = [
  { value: "", label: "Toutes tâches" },
  { value: "text-generation", label: "Génération de texte (LLM)" },
  { value: "text2text-generation", label: "Texte → Texte" },
  { value: "automatic-speech-recognition", label: "Reconnaissance vocale" },
  { value: "text-to-speech", label: "Synthèse vocale" },
  { value: "image-text-to-text", label: "Vision (multimodal)" },
  { value: "feature-extraction", label: "Embeddings" },
];

const LIBRARIES: Array<{ value: string; label: string }> = [
  { value: "", label: "Toutes bibliothèques" },
  { value: "gguf", label: "GGUF (Ollama / llama.cpp)" },
  { value: "transformers", label: "Transformers" },
  { value: "diffusers", label: "Diffusers" },
  { value: "safetensors", label: "Safetensors" },
];

const SORTS: Array<{ value: HfSort; label: string }> = [
  { value: "trending", label: "Tendances" },
  { value: "downloads", label: "Téléchargements" },
  { value: "likes", label: "Likes" },
  { value: "modified", label: "Récemment modifiés" },
];

type ProgressState = {
  pct: number;
  downloaded: number;
  total: number | null;
  done: boolean;
  error: string | null;
  path: string | null;
};

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const [task, setTask] = useState("");
  const [library, setLibrary] = useState("gguf");
  const [sort, setSort] = useState<HfSort>("trending");
  const [models, setModels] = useState<HfModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HfModel | null>(null);
  const [progress, setProgress] = useState<Record<string, ProgressState>>({});
  const [local, setLocal] = useState<LocalModel[]>([]);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const unlisten = onDownloadProgress((p) => {
      const key = `${p.repo}:${p.file}`;
      setProgress((prev) => ({
        ...prev,
        [key]: {
          downloaded: p.downloaded,
          total: p.total,
          pct: p.total
            ? Math.min(100, Math.round((p.downloaded / p.total) * 100))
            : 0,
          done: p.done,
          error: p.error,
          path: p.path,
        },
      }));
      if (p.done) {
        hfLocalModels().then(setLocal).catch(() => {});
      }
    });
    hfLocalModels().then(setLocal).catch(() => {});
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const fetchModels = useMemo(
    () => async (s: string, t: string, l: string, sr: HfSort) => {
      setLoading(true);
      setError(null);
      try {
        const result = await hfListModels({
          search: s || undefined,
          task: t || undefined,
          library: l || undefined,
          sort: sr,
          limit: 40,
        });
        setModels(result);
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void fetchModels(search, task, library, sort);
    }, 300);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [search, task, library, sort, fetchModels]);

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-base font-medium text-white/90">
          Marketplace IA — Hugging Face
        </h2>
        <span className="text-xs text-white/40">
          {loading ? "Chargement…" : `${models.length} modèles`}
        </span>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un modèle (ex. llama, qwen, whisper…)"
          className="min-w-[260px] flex-1 rounded-md border border-white/10 bg-ink-800/70 px-3 py-2 text-sm text-white/90 outline-none focus:border-glow-violet/70"
        />
        <Select value={task} onChange={setTask} options={TASKS} />
        <Select value={library} onChange={setLibrary} options={LIBRARIES} />
        <Select
          value={sort}
          onChange={(v) => setSort(v as HfSort)}
          options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
        />
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {models.map((m) => (
          <ModelCard
            key={m.id}
            model={m}
            onSelect={() => setSelected(m)}
          />
        ))}
        {!loading && models.length === 0 && (
          <div className="col-span-full rounded-md border border-white/5 bg-ink-800/40 px-4 py-6 text-center text-sm text-white/50">
            Aucun modèle trouvé. Modifiez vos filtres ou votre recherche.
          </div>
        )}
      </div>

      {local.length > 0 && (
        <section className="space-y-2 pt-4">
          <h3 className="text-sm font-medium text-white/80">
            Mes modèles téléchargés
          </h3>
          <ul className="space-y-1.5 text-sm">
            {local.map((m) => (
              <li
                key={m.path}
                className="flex items-center gap-3 rounded-md border border-white/5 bg-ink-800/40 px-3 py-2"
              >
                <div className="flex-1 truncate">
                  <div className="truncate text-white/90">{m.repo}</div>
                  <div className="truncate text-xs text-white/40">
                    {m.file} — {humanSize(m.size)}
                  </div>
                </div>
                <code className="truncate text-xs text-white/40">
                  {m.path}
                </code>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selected && (
        <DownloadDialog
          model={selected}
          onClose={() => setSelected(null)}
          progress={progress}
        />
      )}
    </section>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-white/10 bg-ink-800/70 px-3 py-2 text-sm text-white/90 outline-none focus:border-glow-violet/70"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value} className="bg-ink-900">
          {o.label}
        </option>
      ))}
    </select>
  );
}

function ModelCard({
  model,
  onSelect,
}: {
  model: HfModel;
  onSelect: () => void;
}) {
  const repo = model.modelId ?? model.id;
  const author = model.author ?? repo.split("/")[0];
  const name = repo.split("/").slice(1).join("/") || repo;

  return (
    <button
      onClick={onSelect}
      className="group flex flex-col gap-2 rounded-lg border border-white/10 bg-ink-800/60 p-4 text-left transition hover:border-glow-violet/60 hover:bg-ink-800/80"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="truncate text-sm font-medium text-white/90">
            {name}
          </div>
          <div className="truncate text-xs text-white/45">{author}</div>
        </div>
        {model.pipeline_tag && (
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/60">
            {model.pipeline_tag}
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {model.tags.slice(0, 4).map((t) => (
          <span
            key={t}
            className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] text-white/55"
          >
            {t}
          </span>
        ))}
      </div>

      <div className="mt-auto flex items-center gap-3 text-xs text-white/45">
        <span>↓ {compactNumber(model.downloads ?? 0)}</span>
        <span>♥ {compactNumber(model.likes ?? 0)}</span>
        <span className="ml-auto text-glow-violet/80 opacity-0 transition group-hover:opacity-100">
          Télécharger →
        </span>
      </div>
    </button>
  );
}

function DownloadDialog({
  model,
  onClose,
  progress,
}: {
  model: HfModel;
  onClose: () => void;
  progress: Record<string, ProgressState>;
}) {
  const repo = model.modelId ?? model.id;
  const [files, setFiles] = useState<HfFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFiles(null);
    setError(null);
    hfListFiles(repo)
      .then(setFiles)
      .catch((err) => setError(String(err)));
  }, [repo]);

  // Highlight downloadable model weights (GGUF, safetensors) first.
  const ranked = useMemo(() => {
    if (!files) return [];
    const score = (f: HfFile) => {
      const n = f.rfilename.toLowerCase();
      if (n.endsWith(".gguf")) return 100;
      if (n.endsWith(".safetensors")) return 80;
      if (n.endsWith(".bin")) return 60;
      if (n.endsWith(".onnx")) return 50;
      if (n === "readme.md") return 10;
      return 1;
    };
    return [...files].sort((a, b) => score(b) - score(a));
  }, [files]);

  const onDownload = async (file: string) => {
    try {
      await hfDownload(repo, file);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur"
      onClick={onClose}
    >
      <div
        className="w-[min(720px,90vw)] max-h-[80vh] overflow-hidden rounded-xl border border-white/10 bg-ink-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center gap-3 border-b border-white/5 px-5 py-4">
          <div className="flex-1 truncate">
            <div className="truncate text-sm font-medium text-white/90">
              {repo}
            </div>
            <div className="text-xs text-white/45">
              Choisissez un fichier à télécharger localement.
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-white/60 hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </header>

        <div className="max-h-[60vh] overflow-auto px-5 py-4">
          {error && (
            <div className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}
          {!files && !error && (
            <div className="py-8 text-center text-sm text-white/50">
              Chargement des fichiers…
            </div>
          )}
          {files && (
            <ul className="space-y-1.5">
              {ranked.map((f) => {
                const key = `${repo}:${f.rfilename}`;
                const p = progress[key];
                return (
                  <li
                    key={f.rfilename}
                    className="flex items-center gap-3 rounded-md border border-white/5 bg-ink-800/60 px-3 py-2"
                  >
                    <div className="flex-1 truncate">
                      <div className="truncate text-sm text-white/90">
                        {f.rfilename}
                      </div>
                      {f.size != null && (
                        <div className="text-xs text-white/40">
                          {humanSize(f.size)}
                        </div>
                      )}
                      {p && (
                        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
                          <div
                            className="h-full bg-glow-violet transition-all"
                            style={{ width: `${p.pct}%` }}
                          />
                        </div>
                      )}
                      {p?.error && (
                        <div className="mt-1 text-xs text-red-300">
                          {p.error}
                        </div>
                      )}
                      {p?.done && p.path && !p.error && (
                        <div className="mt-1 truncate text-xs text-emerald-300/80">
                          ✓ {p.path}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => onDownload(f.rfilename)}
                      disabled={Boolean(p && !p.done && !p.error)}
                      className="shrink-0 rounded-md bg-glow-violet/80 px-3 py-1.5 text-xs font-medium text-white shadow-glow-soft hover:bg-glow-violet disabled:opacity-50"
                    >
                      {p && !p.done && !p.error
                        ? `${p.pct}%`
                        : p?.done
                          ? "OK"
                          : "Télécharger"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function compactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function humanSize(b: number): string {
  if (!b) return "—";
  const u = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < u.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${u[i]}`;
}
