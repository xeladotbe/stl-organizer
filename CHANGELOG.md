## v0.0.2-rc.1

Release candidate — testing build ahead of a v0.0.2 stable release.

**New**

- `.obj` model support alongside STL/3MF
- `type:` search filter (`type:stl`, `type:3mf`, `type:obj`, `type:virtual`) — "model group" is now called "virtual file" throughout the UI
- Glob pattern support (`*`, `?`, leading `!` negation) in filename search, with a shorter search placeholder
- Typeahead tag/category chip input in the detail pane, with inline "create new" and Backspace-to-remove-last-chip

**Improved**

- Virtual files now sort in place instead of always trailing at the end of the list, and always show their members expanded
- The Modified column shows date **and** time, formatted using the OS's own locale/format settings
- Right-clicking a file outside the current selection no longer opens the detail pane/live preview — it only updates the multi-selection, matching Explorer/Finder
- 3MF live preview: fixed a missing `DOMParser` polyfill, per-part transforms being silently dropped, and the triangle index being dropped — together these were causing `.3mf` files to fail to preview entirely or render as a garbled/holey mesh

**Housekeeping**

- Added unit test infrastructure (`vitest`), including full React component test coverage (jsdom + Testing Library) for the app's non-WebGL/non-virtualized UI

**Known issues**

- Some 3MF models can still render a handful of faces incorrectly in edge cases (tracked separately, still under investigation)

## v0.0.1

First downloadable build. stl-organizer is a Windows/macOS desktop app that watches folders full of scattered `.stl`/`.3mf` files and helps you rediscover, dedupe, and organize them with real 3D previews instead of cryptic filenames.

**Library & organization**

- Watch one or more folders; new/changed/removed files are picked up automatically
- Exact-duplicate detection (content hash) with one-click cleanup to the Recycle Bin — never a permanent delete
- Tags and categories, filterable and creatable directly from a file's detail panel
- **Model groups** — bundle several files that belong to one multi-part print into a single "virtual model," shown as one tile with a thumbnail mosaic
- Rename files from within the app (renames the real file on disk)
- Search box supports `tag:name` and `category:name` alongside plain filename text, and also matches model group names

**Browsing**

- List view (sortable, resizable columns) and grid view (thumbnail cards), both virtualized to stay fast with thousands of files
- Live, interactive 3D preview (orbit/zoom) for the selected file, decoded off the main thread so large files don't freeze the UI
- Background-rendered thumbnails, deduplicated by content hash
- Explorer-style multi-select (Shift/Ctrl-click) with a right-click menu to group or delete the selection

**Housekeeping**

- Dedicated settings window for managing watched folders
- Accessible dialogs/menus/dropdowns (Radix UI)

**Known limitations**

- Unsigned builds: Windows SmartScreen and macOS Gatekeeper will warn on first launch ("unknown publisher") — this is expected for a hobby project without a paid code-signing certificate; choose "Run anyway" (Windows) or right-click → Open (macOS).
- No packaging for Linux yet in this release.
