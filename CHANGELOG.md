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
