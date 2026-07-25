# CLAUDE.md

Context for Claude Code (or any future contributor) working on this repository, so it doesn't need to be re-derived from scratch.

## What this is

stl-organizer is a Windows-first Electron desktop app for organizing 3D-printing model files (`.stl` and `.3mf`) that a hobbyist has scattered across their disk. Core value: rediscover forgotten downloads, spot exact duplicates, and browse via real 3D previews instead of cryptic filenames.

## Stack

Electron + React 19 + TypeScript, scaffolded via `electron-vite`. Tailwind v4 (via `@tailwindcss/vite`, no PostCSS config needed). Zustand for renderer state. `better-sqlite3` for the local library database. `three.js` + `@react-three/fiber`/`drei` for 3D rendering. `chokidar` for filesystem watching.

## Architecture

- `src/main/` — Electron main process (Node context)
  - `db/` — SQLite schema (`migrations.ts`, numbered migrations applied idempotently), repositories per entity (`filesRepo`, `foldersRepo`, `tagsRepo`, `categoriesRepo`)
  - `watcher/watcherManager.ts` — one `chokidar` watcher per watched folder; the initial `ready` scan doubles as the recursive first pass
  - `scanning/scanner.ts` — turns a raw fs path into a DB upsert (extension filter, stat, upsert)
  - `hashing/` — streaming sha256 (`hasher.ts`) + a concurrency-limited sweep queue (`hashQueue.ts`, `CONCURRENCY=3`, no worker_threads — deliberate simplification)
  - `thumbnails/` — `thumbnailWindow.ts` manages a **hidden** second `BrowserWindow` (vanilla three.js, not React) that renders one model to PNG per job over IPC; `thumbnailQueue.ts` orchestrates which file gets rendered next and writes the PNG to `userData/thumbnails/<hash-or-file-id>.png`
  - `priorityQueue.ts` — holds the current "visible on screen" file ids so hash/thumbnail sweeps process those first (see Renderer below)
  - `protocol.ts` — registers the custom `stl-file://` scheme used to stream local file bytes (and cached thumbnails) into the renderer's three.js loaders / `<img>` tags without CSP/`file://` friction
  - `ipc/` — one file per IPC "namespace" (`filesIpc`, `foldersIpc`, `tagsIpc`, `categoriesIpc`, `duplicatesIpc`), registered from `ipc/index.ts`, which also forwards main-process events to the renderer
  - `appEvents.ts` — shared `EventEmitter` so watcher/hasher/thumbnailer can all notify the IPC layer without circular imports
- `src/preload/` — two separate preload scripts: `index.ts` (main window, full `window.api` surface) and `thumbnail.ts` (hidden thumbnail window, minimal `window.thumbnailApi`). Both are separate electron-vite build entries (see `electron.vite.config.ts`).
- `src/renderer/` — two separate HTML/entry pairs, also separate build entries: `index.html`/`src/main.tsx` (the real app) and `thumbnail.html`/`src/thumbnail-entry.ts` (vanilla three.js, no React, runs only in the hidden window)
  - `src/renderer/src/store/useLibraryStore.ts` — single Zustand store for all renderer state (files, folders, tags, categories, filters, selection)
  - `src/renderer/src/components/` — `FolderSidebar`, `TagCategorySidebar`, `FileList` (container: search/filter bar + list-vs-grid toggle), `FileTable` (sortable + resizable-column list view), `FileGrid` (thumbnail card grid), `DetailPane` (live 3D preview + tag/category editor for the selected file), `ModelPreview` (the actual `@react-three/fiber` viewer), `DuplicatesView`
  - `src/renderer/src/hooks/useVisibilityPriority.ts` — `IntersectionObserver`-based hook reporting on-screen file ids to the main process
- `src/shared/` — types/helpers usable from both main and renderer (`types.ts` for all IPC wire-format types, `modelFileUrl.ts` for the `stl-file://` URL builders). Renderer imports these via the `@shared` alias; main/preload use relative paths (the renderer's tsconfig doesn't include `src/main`, so keeping wire-format types here avoids cross-tsconfig type leakage).

## Data pipeline (per file)

1. **Scan**: chokidar detects a `.stl`/`.3mf` file → `scanner.ts` upserts a `files` row (`hash_status`/`thumbnail_status` both start `'pending'`).
2. **Hash**: `hashQueue.ts` only hashes files that **share their exact size with another file** (a uniquely-sized file can never be an exact duplicate — pure optimization for dedup detection). This means a large fraction of any real library never gets hashed, by design.
3. **Duplicates**: derived on demand from `content_hash` (`listDuplicateFiles`), not stored — always current, no separate table to keep in sync.
4. **Thumbnail**: `thumbnailQueue.ts` picks any file with `thumbnail_status='pending'`, **independent of hash status** (this was a real bug once — see Gotchas). If the file has a `content_hash` and another file with that hash already has a thumbnail, it's reused (dedup); otherwise the hidden window renders a fresh PNG, keyed by `content_hash` if available or `file-<id>` if not.
5. **Priority**: whatever `useVisibilityPriority` reports as on-screen gets processed first in both the hash and thumbnail sweeps; everything else is still worked through in the background regardless (never starves).

## Gotchas already hit — don't reintroduce these

- **Never use a bare numeric string as a custom-protocol hostname on a `standard: true` Electron scheme.** Chromium's URL parser reinterprets an all-digit host as an IPv4 address and silently rewrites it (`stl-file://3812/...` → `stl-file://0.0.14.228/...`), breaking any id-based lookup. Fix in place: prefix with a letter (`f${id}`) — see `src/shared/modelFileUrl.ts`.
- **Dispose three.js resources between jobs in the hidden thumbnail window.** It's a single long-lived WebGL context processing thousands of jobs; without explicit `geometry.dispose()`/`material.dispose()`/texture disposal after each render, GPU memory leaks until the context is lost and every subsequent render silently fails. See `clearModel()` in `thumbnail-entry.ts`.
- **`hash_status='hashing'` / `thumbnail_status='rendering'` can only ever be a leftover from an abrupt shutdown** — there's no in-process recovery otherwise. `resetStuckProcessingStatuses()` runs on every startup for exactly this reason; don't remove it.
- **Thumbnail eligibility must never depend on hash completion.** They look related (thumbnails dedupe via `content_hash`) but are separate concerns — gating thumbnails on `hash_status='done'` silently excludes every uniquely-sized file from ever getting a preview, which was most of a real user's library.
- **The render timeout in `thumbnailWindow.ts` needs headroom for real-world file sizes** (STL/3MF files run into the hundreds of MB); too short a timeout misclassifies slow-but-valid files as `'unsupported'`.
- `ELECTRON_RUN_AS_NODE=1` may be set in the ambient dev shell — if `npm run dev` throws `Cannot read properties of undefined (reading 'isPackaged')`, unset it before relaunching.

## Status vs. plan

M1–M5 all implemented: watched folders, exact-duplicate detection + Recycle Bin cleanup (`shell.trashItem`, never permanent delete), STL/3MF thumbnails + live 3D preview, tags/categories with filtering, list/grid views with sortable + resizable columns, visible-first background rendering priority. Not yet done: worker_threads for hashing (intentionally skipped as unnecessary complexity), corrupt-file UX polish beyond the basic unsupported-placeholder, virtualized grid for very large libraries, packaging/signing pass.
