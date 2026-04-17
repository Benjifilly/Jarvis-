# Jarvis — Assistant IA local pour Windows

Overlay de bureau transparent style *Apple Intelligence* qui se branche sur un LLM
local exposé via une API OpenAI-compatible (Ollama, LM Studio, llama.cpp server).

## État actuel (MVP — Sprints 0 à 4)

- [x] Sprint 0 — Bootstrap Tauri 2 + React + TypeScript, fenêtre transparente always-on-top
- [x] Sprint 1 — Effet **GlowBorder** Apple Intelligence + toggle `Ctrl+Space`
- [x] Sprint 2 — **System Tray** avec menu contextuel et fenêtre *Paramètres*
- [x] Sprint 3 — **Saisie texte fluide** (barre qui apparaît dès que l'overlay est actif)
- [x] Sprint 4 — **Client IA streaming** compatible OpenAI + rendu markdown

## Phase 2 (à venir)

- [ ] Sprint 5 — Capture audio + VAD + STT Whisper (cloud si WiFi, local sinon)
- [ ] Sprint 6 — TTS via Piper sidecar
- [ ] Sprint 7 — Panneau Paramètres complet (voix, raccourcis, API keys chiffrées)
- [ ] Sprint 8 — Registre d'outils pour actions système
- [ ] Sprint 9 — Packaging MSI/NSIS + auto-update

## Stack

| Couche    | Technologie                                               |
|-----------|-----------------------------------------------------------|
| Shell app | **Tauri 2.x** (WebView2 sur Windows)                      |
| Frontend  | **React 18 + TypeScript + Vite + TailwindCSS**            |
| State     | **Zustand**                                               |
| Animation | **Framer Motion** + CSS `@property` / `conic-gradient`    |
| Backend   | **Rust** (tokio, reqwest, tracing, window-vibrancy)       |
| Hotkeys   | `tauri-plugin-global-shortcut`                            |
| Tray      | API native Tauri 2 (`TrayIconBuilder`)                    |

## Prérequis de développement

- **Rust** ≥ 1.77 (`rustup install stable`)
- **Node.js** ≥ 20 et **pnpm** ≥ 9
- **Windows 10/11** cible (dev cross-platform possible)
- Un backend local : **Ollama** (`ollama serve`) ou **LM Studio** (mode serveur)

## Installation

```powershell
pnpm install
pnpm tauri:dev
```

## Build Windows

```powershell
pnpm tauri:build
```

Produit un installeur NSIS et MSI dans `src-tauri/target/release/bundle/`.

## Configuration du modèle IA

Ouvrir la fenêtre **Paramètres** (clic droit sur l'icône tray → *Paramètres*) :

- **URL de base** : `http://localhost:11434/v1` pour Ollama, `http://localhost:1234/v1` pour LM Studio
- **Modèle** : p.ex. `llama3.2`, `qwen2.5-coder:14b`
- **Clé API** : laisser vide pour un backend local

La configuration est persistée en JSON dans `%APPDATA%\com.jarvis.assistant\config.json`.

## Raccourcis

| Action              | Raccourci      |
|---------------------|----------------|
| Activer / masquer   | `Ctrl + Space` |
| Fermer l'overlay    | `Échap`        |
| Valider le prompt   | `Entrée`       |

## Architecture

```
┌──────────────────────────────┐
│ Frontend (React)             │
│  overlay/ — glow + input     │
│  settings/ — config tabs     │
└──────────────────────────────┘
            ↕ Tauri IPC
┌──────────────────────────────┐
│ Backend (Rust)               │
│  services/ai_client          │
│  services/config_store       │
│  services/tray               │
│  services/window_fx          │
│  commands/                   │
└──────────────────────────────┘
            ↕ HTTP
┌──────────────────────────────┐
│ Ollama / LM Studio           │
│ localhost:11434 ou :1234     │
└──────────────────────────────┘
```

## Licence

Apache 2.0 — voir `LICENSE`.
