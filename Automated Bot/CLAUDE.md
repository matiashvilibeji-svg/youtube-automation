# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A browser-based automation tool that converts a chat conversation into a YouTube Shorts video pipeline. Users brainstorm a "What if you [X] in [era]?" concept with Claude, then say "generate" to automatically produce scripts, images (via Nano Banana API), and videos (via Kling API) — all displayed in a real-time scene grid.

## Commands

```bash
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # Production build to dist/
npm run serve    # Express production server at http://localhost:3000
```

No test runner or linter is configured.

## Environment Setup

Copy `.env.example` to `.env.local`. All keys use `VITE_` prefix (exposed via `import.meta.env`):
- `VITE_CLAUDE_API_KEY` — Anthropic console
- `VITE_NANOBANANA_API_KEY` — nanobnana.com
- `VITE_KLING_ACCESS_KEY` / `VITE_KLING_SECRET_KEY` — klingai.com
- `VITE_GEMINI_API_KEY` — aistudio.google.com
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — Supabase project

Keys can also be entered at runtime via the Settings modal (stored in localStorage under `vp-api-keys`).

## Architecture

**Stack:** React 19 + Vite + Tailwind CSS 3. No router, no state library — all state lives in hooks at the App level.

### Layout
Two-panel SPA: `ChatPanel` (left) + `PipelinePanel` (right). `App.jsx` is the orchestrator — it instantiates all hooks and passes data/callbacks down.

### Key Hooks (in `src/hooks/`)
- **`useChat`** — Sends messages to Claude via `/api/claude` proxy. Detects `generate_pipeline` tool_use responses and triggers pipeline.
- **`usePipeline`** — Orchestrates image→video generation. Processes images in batches of 3, starts video generation per-scene as soon as its image completes (semaphore-limited to 3 concurrent). Uses `AbortController` for cancellation.
- **`useProject`** — CRUD for projects via Supabase. Loads/saves messages and scenes per project.
- **`useApiKeys`** — Reads from localStorage, falls back to env vars.
- **`useActivityLog`** — Event log with auto-duration calculation between `_loading` → `_done` events.

### API Proxy Layer
All external API calls go through Vite dev proxy (or Express in production) to avoid CORS:
- `/api/claude` → `api.anthropic.com/v1/messages`
- `/api/nanobanana/*` → `nanobnana.com/api/v2/*`
- `/api/kling/*` → `api.kie.ai/api/v1/*`

Proxy config: `vite.config.js` (dev), `server/proxy.js` (prod).

### Async Generation Flow
1. Claude returns `generate_pipeline` tool_use with `{ sentences, imagePrompts, klingPrompts }` (all same length, 15–22 items)
2. Images generate in batches of 3 via poll-based API (POST task → poll status every 4s, max 4min)
3. Videos start per-scene as soon as its image completes (POST task → poll every 5s, max 10min)
4. Kling JWT is generated client-side from access+secret keys (`src/lib/klingJwt.js`)

### Pipeline Stages
`ideas` → `script` → `images` → `videos` → `done` (defined in `src/lib/constants.js`)

### Persistence
- **Supabase** — projects, messages, scenes (tables + `project_summaries` view)
- **localStorage** — API keys (`vp-api-keys`), current project (`vp-current-project`)
- Scene updates are dual-write: React state + fire-and-forget Supabase upsert

### Scene State Shape
```js
{ sentence, imagePrompt, klingPrompt, imgStatus, vidStatus, imageUrl, videoUrl }
```
Status values: `"pending"` | `"loading"` | `"done"` | `"error"`

DB columns use snake_case (`img_status`, `image_url`) while React state uses camelCase.

## Critical Invariants

- **Three arrays must be equal length** — `sentences`, `imagePrompts`, `klingPrompts`. Validated in `src/lib/pipelineParser.js`.
- **AbortController propagation** — Signal passes through the entire async chain. Always check `signal.aborted` after any await.
- **Semaphore pattern** — `videoSemaphoreRef` limits concurrent video requests. Don't bypass this.
- **Fallback pipeline parsing** — If Claude sends a ` ```pipeline ` code block instead of tool_use, `parsePipelineResponse` still handles it.

## Troubleshooting

### Vite dev server not responding (blank page / infinite loading)
**Symptoms:** `npm run dev` starts, says "ready", but browser shows blank white page or loads forever.

**Root causes & fixes (check in order):**
1. **Zombie Vite processes** — Kill all: `ps aux | grep vite | grep -v grep | awk '{print $2}' | xargs kill -9`
2. **Corrupted Vite dep cache** — Delete: `rm -rf node_modules/.vite`
3. **Corrupted node_modules** — Full reinstall: `rm -rf node_modules package-lock.json && npm install`
4. **IPv6-only binding (Node 22+)** — Vite may bind IPv6 only. `vite.config.js` has `host: '127.0.0.1'` to force IPv4. If removed, add it back under `server`.
5. **Claude Code triggering HMR reloads** — `vite.config.js` ignores `.claude/**`, `CLAUDE.md`, and `*.jsonl` in the watcher. Don't remove these.

**Quick recovery:**
```bash
ps aux | grep vite | grep -v grep | awk '{print $2}' | xargs kill -9
rm -rf node_modules/.vite
npm run dev
```
If that fails, do a full `rm -rf node_modules package-lock.json && npm install && npm run dev`.

## Claude AI Configuration

Model: `claude-sonnet-4-20250514` with `generate_pipeline` tool. System prompt and tool schema are in `src/lib/constants.js`. The skeleton character description is injected into every image prompt by Claude (per system prompt rules).
