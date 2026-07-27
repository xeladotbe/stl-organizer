import { create } from 'zustand';
import type {
  FileRow,
  WatchedFolderRow,
  ScanProgressEvent,
  TagRow,
  CategoryRow,
  FileTagLink,
  ModelGroupRow
} from '@shared/types';
import { insertSearchToken } from '../lib/searchQuery';

export type LibraryView = 'all' | 'duplicates';

// A display preference for the live 3D preview, not library data - kept in localStorage rather
// than the SQLite DB (which has no settings/key-value table yet) so it survives app restarts.
const HDRI_STORAGE_KEY = 'stl-organizer:hdriPath';

export type Selection = { type: 'file'; id: number } | { type: 'group'; id: number } | null;

interface LibraryState {
  folders: WatchedFolderRow[];
  files: FileRow[];
  duplicates: FileRow[];
  duplicateIds: Set<number>;
  tags: TagRow[];
  categories: CategoryRow[];
  groups: ModelGroupRow[];
  fileTagIds: Map<number, number[]>;
  selection: Selection;
  selectedFileIds: Set<number>;
  selectionAnchorId: number | null;
  scanProgress: Record<number, ScanProgressEvent>;
  view: LibraryView;
  searchQuery: string;
  hdriPath: string | null;
  foldersLoading: boolean;
  filesLoading: boolean;
  duplicatesLoading: boolean;
  groupsLoading: boolean;
  init: () => void;
  loadFolders: () => Promise<void>;
  loadFiles: () => Promise<void>;
  loadDuplicates: () => Promise<void>;
  loadTags: () => Promise<void>;
  loadCategories: () => Promise<void>;
  loadGroups: () => Promise<void>;
  loadFileTagLinks: () => Promise<void>;
  addFolder: () => Promise<void>;
  removeFolder: (id: number) => Promise<void>;
  selectFile: (id: number | null) => void;
  selectGroup: (id: number) => void;
  collapseSelectionTo: (id: number) => void;
  toggleFileSelection: (id: number) => void;
  selectFileRange: (orderedIds: number[], toId: number) => void;
  clearFileSelection: () => void;
  setView: (view: LibraryView) => void;
  setSearchQuery: (query: string) => void;
  addSearchToken: (token: string) => void;
  pickHdri: () => Promise<void>;
  clearHdri: () => void;
  moveToTrash: (id: number) => Promise<void>;
  renameFile: (id: number, newBaseName: string) => Promise<void>;
  createTag: (name: string) => Promise<TagRow | undefined>;
  renameTag: (id: number, name: string) => Promise<void>;
  deleteTag: (id: number) => Promise<void>;
  createCategory: (name: string) => Promise<CategoryRow | undefined>;
  renameCategory: (id: number, name: string) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
  setFileTags: (fileId: number, tagIds: number[]) => Promise<void>;
  setFileCategory: (fileId: number, categoryId: number | null) => Promise<void>;
  createGroup: (name: string, fileIds: number[]) => Promise<void>;
  renameGroup: (id: number, name: string) => Promise<void>;
  setGroupCategory: (id: number, categoryId: number | null) => Promise<void>;
  addFilesToGroup: (id: number, fileIds: number[]) => Promise<void>;
  removeFileFromGroup: (fileId: number) => Promise<void>;
  deleteGroup: (id: number) => Promise<void>;
}

let initialized = false;
let refetchTimer: ReturnType<typeof setTimeout> | null = null;

function buildFileTagIds(links: FileTagLink[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const link of links) {
    const list = map.get(link.file_id) ?? [];
    list.push(link.tag_id);
    map.set(link.file_id, list);
  }
  return map;
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  folders: [],
  files: [],
  duplicates: [],
  duplicateIds: new Set(),
  tags: [],
  categories: [],
  groups: [],
  fileTagIds: new Map(),
  selection: null,
  selectedFileIds: new Set(),
  selectionAnchorId: null,
  scanProgress: {},
  view: 'all',
  searchQuery: '',
  hdriPath: localStorage.getItem(HDRI_STORAGE_KEY),
  foldersLoading: false,
  filesLoading: false,
  duplicatesLoading: false,
  groupsLoading: false,

  init: () => {
    if (initialized) return;
    initialized = true;

    void get().loadFolders();
    void get().loadFiles();
    void get().loadDuplicates();
    void get().loadTags();
    void get().loadCategories();
    void get().loadGroups();
    void get().loadFileTagLinks();

    const scheduleRefetch = (): void => {
      if (refetchTimer) return;
      refetchTimer = setTimeout(() => {
        refetchTimer = null;
        void get().loadFiles();
        void get().loadDuplicates();
        // Scanning can silently create/grow model groups (auto-grouping files created together
        // within a few seconds of each other - see maybeAutoGroupFile), not just files, so the
        // groups list needs to stay in sync with the same refetch that follows a scan.
        void get().loadGroups();
      }, 300);
    };

    window.api.onScanProgress((event) => {
      set((state) => ({ scanProgress: { ...state.scanProgress, [event.folderId]: event } }));
      scheduleRefetch();
    });
    window.api.onFilesChanged(() => {
      scheduleRefetch();
    });
  },

  loadFolders: async () => {
    set({ foldersLoading: true });
    const folders = await window.api.folders.list();
    set({ folders, foldersLoading: false });
  },

  loadFiles: async () => {
    set({ filesLoading: true });
    const files = await window.api.files.list();
    set({ files, filesLoading: false });
  },

  loadDuplicates: async () => {
    set({ duplicatesLoading: true });
    const duplicates = await window.api.duplicates.list();
    set({
      duplicates,
      duplicateIds: new Set(duplicates.map((file) => file.id)),
      duplicatesLoading: false
    });
  },

  loadTags: async () => {
    const tags = await window.api.tags.list();
    set({ tags });
  },

  loadCategories: async () => {
    const categories = await window.api.categories.list();
    set({ categories });
  },

  loadGroups: async () => {
    set({ groupsLoading: true });
    const groups = await window.api.groups.list();
    set({ groups, groupsLoading: false });
  },

  loadFileTagLinks: async () => {
    const links = await window.api.tags.fileLinks();
    set({ fileTagIds: buildFileTagIds(links) });
  },

  addFolder: async () => {
    const folder = await window.api.folders.add();
    if (folder) await get().loadFolders();
  },

  removeFolder: async (id) => {
    await window.api.folders.remove(id);
    // The three refetches are independent reads of already-committed state (the removal above
    // already finished) - awaiting them one at a time serializes 3 IPC round trips for no reason.
    await Promise.all([get().loadFolders(), get().loadFiles(), get().loadDuplicates()]);
  },

  // A plain "select this one file" click always collapses any active multi-selection down to
  // just this file — matches standard file-explorer behavior (ctrl/shift are the only ways to
  // build up a multi-selection). selectFile(null) only closes the detail pane and deliberately
  // leaves an in-progress multi-selection alone.
  selectFile: (id) =>
    set({
      selection: id == null ? null : { type: 'file', id },
      ...(id != null ? { selectedFileIds: new Set([id]), selectionAnchorId: id } : {})
    }),
  selectGroup: (id) => set({ selection: { type: 'group', id } }),

  // Right-clicking (or opening the ⋮ menu for) a file outside the current selection should
  // still collapse the selection down to just that file - so the context menu acts on the right
  // target and it reads as "selected" via the multi-select highlight - but must NOT touch
  // `selection` itself, since that's what opens the detail pane / live preview. Only a plain
  // left-click (selectFile) is allowed to do that.
  collapseSelectionTo: (id) => set({ selectedFileIds: new Set([id]), selectionAnchorId: id }),

  toggleFileSelection: (id) => {
    set((state) => {
      const next = new Set(state.selectedFileIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedFileIds: next, selectionAnchorId: id };
    });
  },

  // Range from the current anchor to `toId`, within the caller's currently-displayed file order.
  // Leaves the anchor itself unchanged so repeated shift-clicks keep extending/shrinking from the
  // same starting point instead of drifting.
  selectFileRange: (orderedIds, toId) => {
    set((state) => {
      const anchor = state.selectionAnchorId ?? toId;
      const fromIndex = orderedIds.indexOf(anchor);
      const toIndex = orderedIds.indexOf(toId);
      if (fromIndex === -1 || toIndex === -1) return { selectedFileIds: new Set([toId]) };
      const [start, end] = fromIndex <= toIndex ? [fromIndex, toIndex] : [toIndex, fromIndex];
      return { selectedFileIds: new Set(orderedIds.slice(start, end + 1)) };
    });
  },

  clearFileSelection: () => set({ selectedFileIds: new Set(), selectionAnchorId: null }),

  setView: (view) => set({ view }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  // Used when a tag/category badge (list row, or a chip in the detail pane) is clicked - narrows
  // the list to that tag/category without discarding whatever the user already typed, and jumps
  // to the "All files" view since that's the only view the search field actually filters.
  addSearchToken: (token) =>
    set((state) => ({ view: 'all', searchQuery: insertSearchToken(state.searchQuery, token) })),

  pickHdri: async () => {
    const path = await window.api.app.pickHdriFile();
    if (!path) return;
    localStorage.setItem(HDRI_STORAGE_KEY, path);
    set({ hdriPath: path });
  },

  clearHdri: () => {
    localStorage.removeItem(HDRI_STORAGE_KEY);
    set({ hdriPath: null });
  },

  moveToTrash: async (id) => {
    await window.api.files.moveToTrash(id);
    // Independent refetches - run them concurrently instead of one after the other.
    await Promise.all([get().loadFiles(), get().loadDuplicates()]);
  },

  renameFile: async (id, newBaseName) => {
    if (!newBaseName.trim()) return;
    await window.api.files.rename(id, newBaseName.trim());
    await get().loadFiles();
  },

  createTag: async (name) => {
    if (!name.trim()) return undefined;
    const tag = await window.api.tags.create(name);
    await get().loadTags();
    return tag;
  },

  renameTag: async (id, name) => {
    if (!name.trim()) return;
    await window.api.tags.rename(id, name);
    await get().loadTags();
  },

  deleteTag: async (id) => {
    await window.api.tags.delete(id);
    // Independent refetches - run them concurrently instead of one after the other.
    await Promise.all([get().loadTags(), get().loadFileTagLinks()]);
  },

  createCategory: async (name) => {
    if (!name.trim()) return undefined;
    const category = await window.api.categories.create(name);
    await get().loadCategories();
    return category;
  },

  renameCategory: async (id, name) => {
    if (!name.trim()) return;
    await window.api.categories.rename(id, name);
    await get().loadCategories();
  },

  deleteCategory: async (id) => {
    await window.api.categories.delete(id);
    // Independent refetches - run them concurrently instead of one after the other.
    await Promise.all([get().loadCategories(), get().loadFiles()]);
  },

  setFileTags: async (fileId, tagIds) => {
    await window.api.files.setTags(fileId, tagIds);
    await get().loadFileTagLinks();
  },

  setFileCategory: async (fileId, categoryId) => {
    await window.api.files.setCategory(fileId, categoryId);
    await get().loadFiles();
  },

  createGroup: async (name, fileIds) => {
    if (!name.trim() || fileIds.length < 2) return;
    const group = await window.api.groups.create(name.trim(), fileIds);
    get().clearFileSelection();
    set({ selection: { type: 'group', id: group.id } });
    // Independent refetches - run them concurrently instead of one after the other.
    await Promise.all([get().loadGroups(), get().loadFiles()]);
  },

  renameGroup: async (id, name) => {
    if (!name.trim()) return;
    await window.api.groups.rename(id, name.trim());
    await get().loadGroups();
  },

  setGroupCategory: async (id, categoryId) => {
    await window.api.groups.setCategory(id, categoryId);
    await get().loadGroups();
  },

  addFilesToGroup: async (id, fileIds) => {
    await window.api.groups.addFiles(id, fileIds);
    get().clearFileSelection();
    // Independent refetches - run them concurrently instead of one after the other.
    await Promise.all([get().loadGroups(), get().loadFiles()]);
  },

  removeFileFromGroup: async (fileId) => {
    await window.api.groups.removeFile(fileId);
    set({ selection: { type: 'file', id: fileId } });
    // Independent refetches - run them concurrently instead of one after the other.
    await Promise.all([get().loadGroups(), get().loadFiles()]);
  },

  deleteGroup: async (id) => {
    await window.api.groups.delete(id);
    set((state) =>
      state.selection?.type === 'group' && state.selection.id === id ? { selection: null } : {}
    );
    // Independent refetches - run them concurrently instead of one after the other.
    await Promise.all([get().loadGroups(), get().loadFiles()]);
  }
}));
