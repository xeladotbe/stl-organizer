import { create } from 'zustand'
import type {
  FileRow,
  WatchedFolderRow,
  ScanProgressEvent,
  TagRow,
  CategoryRow,
  FileTagLink
} from '@shared/types'

export type LibraryView = 'all' | 'duplicates'

interface LibraryState {
  folders: WatchedFolderRow[]
  files: FileRow[]
  duplicates: FileRow[]
  duplicateIds: Set<number>
  tags: TagRow[]
  categories: CategoryRow[]
  fileTagIds: Map<number, number[]>
  selectedFileId: number | null
  scanProgress: Record<number, ScanProgressEvent>
  view: LibraryView
  activeTagIds: number[]
  activeCategoryId: number | null | undefined
  foldersLoading: boolean
  filesLoading: boolean
  duplicatesLoading: boolean
  init: () => void
  loadFolders: () => Promise<void>
  loadFiles: () => Promise<void>
  loadDuplicates: () => Promise<void>
  loadTags: () => Promise<void>
  loadCategories: () => Promise<void>
  loadFileTagLinks: () => Promise<void>
  addFolder: () => Promise<void>
  removeFolder: (id: number) => Promise<void>
  selectFile: (id: number | null) => void
  setView: (view: LibraryView) => void
  moveToTrash: (id: number) => Promise<void>
  createTag: (name: string) => Promise<void>
  renameTag: (id: number, name: string) => Promise<void>
  deleteTag: (id: number) => Promise<void>
  createCategory: (name: string) => Promise<void>
  renameCategory: (id: number, name: string) => Promise<void>
  deleteCategory: (id: number) => Promise<void>
  setFileTags: (fileId: number, tagIds: number[]) => Promise<void>
  setFileCategory: (fileId: number, categoryId: number | null) => Promise<void>
  toggleTagFilter: (id: number) => void
  setCategoryFilter: (id: number | null | undefined) => void
}

let initialized = false
let refetchTimer: ReturnType<typeof setTimeout> | null = null

function buildFileTagIds(links: FileTagLink[]): Map<number, number[]> {
  const map = new Map<number, number[]>()
  for (const link of links) {
    const list = map.get(link.file_id) ?? []
    list.push(link.tag_id)
    map.set(link.file_id, list)
  }
  return map
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  folders: [],
  files: [],
  duplicates: [],
  duplicateIds: new Set(),
  tags: [],
  categories: [],
  fileTagIds: new Map(),
  selectedFileId: null,
  scanProgress: {},
  view: 'all',
  activeTagIds: [],
  activeCategoryId: undefined,
  foldersLoading: false,
  filesLoading: false,
  duplicatesLoading: false,

  init: () => {
    if (initialized) return
    initialized = true

    void get().loadFolders()
    void get().loadFiles()
    void get().loadDuplicates()
    void get().loadTags()
    void get().loadCategories()
    void get().loadFileTagLinks()

    const scheduleRefetch = (): void => {
      if (refetchTimer) return
      refetchTimer = setTimeout(() => {
        refetchTimer = null
        void get().loadFiles()
        void get().loadDuplicates()
      }, 300)
    }

    window.api.onScanProgress((event) => {
      set((state) => ({ scanProgress: { ...state.scanProgress, [event.folderId]: event } }))
      scheduleRefetch()
    })
    window.api.onFilesChanged(() => {
      scheduleRefetch()
    })
  },

  loadFolders: async () => {
    set({ foldersLoading: true })
    const folders = await window.api.folders.list()
    set({ folders, foldersLoading: false })
  },

  loadFiles: async () => {
    set({ filesLoading: true })
    const { activeTagIds, activeCategoryId } = get()
    const files = await window.api.files.list({
      tagIds: activeTagIds.length > 0 ? activeTagIds : undefined,
      categoryId: activeCategoryId
    })
    set({ files, filesLoading: false })
  },

  loadDuplicates: async () => {
    set({ duplicatesLoading: true })
    const duplicates = await window.api.duplicates.list()
    set({
      duplicates,
      duplicateIds: new Set(duplicates.map((file) => file.id)),
      duplicatesLoading: false
    })
  },

  loadTags: async () => {
    const tags = await window.api.tags.list()
    set({ tags })
  },

  loadCategories: async () => {
    const categories = await window.api.categories.list()
    set({ categories })
  },

  loadFileTagLinks: async () => {
    const links = await window.api.tags.fileLinks()
    set({ fileTagIds: buildFileTagIds(links) })
  },

  addFolder: async () => {
    const folder = await window.api.folders.add()
    if (folder) await get().loadFolders()
  },

  removeFolder: async (id) => {
    await window.api.folders.remove(id)
    await get().loadFolders()
    await get().loadFiles()
    await get().loadDuplicates()
  },

  selectFile: (id) => set({ selectedFileId: id }),
  setView: (view) => set({ view }),

  moveToTrash: async (id) => {
    await window.api.files.moveToTrash(id)
    await get().loadFiles()
    await get().loadDuplicates()
  },

  createTag: async (name) => {
    if (!name.trim()) return
    await window.api.tags.create(name)
    await get().loadTags()
  },

  renameTag: async (id, name) => {
    if (!name.trim()) return
    await window.api.tags.rename(id, name)
    await get().loadTags()
  },

  deleteTag: async (id) => {
    await window.api.tags.delete(id)
    await get().loadTags()
    await get().loadFileTagLinks()
    set((state) => ({ activeTagIds: state.activeTagIds.filter((tagId) => tagId !== id) }))
    await get().loadFiles()
  },

  createCategory: async (name) => {
    if (!name.trim()) return
    await window.api.categories.create(name)
    await get().loadCategories()
  },

  renameCategory: async (id, name) => {
    if (!name.trim()) return
    await window.api.categories.rename(id, name)
    await get().loadCategories()
  },

  deleteCategory: async (id) => {
    await window.api.categories.delete(id)
    await get().loadCategories()
    if (get().activeCategoryId === id) set({ activeCategoryId: undefined })
    await get().loadFiles()
  },

  setFileTags: async (fileId, tagIds) => {
    await window.api.files.setTags(fileId, tagIds)
    await get().loadFileTagLinks()
  },

  setFileCategory: async (fileId, categoryId) => {
    await window.api.files.setCategory(fileId, categoryId)
    await get().loadFiles()
  },

  toggleTagFilter: (id) => {
    set((state) => ({
      activeTagIds: state.activeTagIds.includes(id)
        ? state.activeTagIds.filter((tagId) => tagId !== id)
        : [...state.activeTagIds, id]
    }))
    void get().loadFiles()
  },

  setCategoryFilter: (id) => {
    set({ activeCategoryId: id })
    void get().loadFiles()
  }
}))
