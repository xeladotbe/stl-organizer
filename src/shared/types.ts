/** Types shared across main, preload and renderer — the IPC wire format. */

export type HashStatus = 'pending' | 'hashing' | 'done' | 'error'
export type ThumbnailStatus = 'pending' | 'rendering' | 'done' | 'error' | 'unsupported'
export type ModelExt = 'stl' | '3mf' | 'obj'

export interface WatchedFolderRow {
  id: number
  path: string
  added_at: number
  enabled: number
}

export interface FileRow {
  id: number
  folder_id: number
  path: string
  filename: string
  ext: ModelExt
  size: number
  mtime_ms: number
  content_hash: string | null
  hash_status: HashStatus
  thumbnail_path: string | null
  thumbnail_status: ThumbnailStatus
  category_id: number | null
  group_id: number | null
  missing: number
  created_at: number
  updated_at: number
}

export interface ListFilesFilter {
  search?: string
  folderId?: number
  includeMissing?: boolean
  tagIds?: number[]
  categoryId?: number | null
}

export interface ModelGroupRow {
  id: number
  name: string
  category_id: number | null
  created_at: number
  updated_at: number
}

export interface TagRow {
  id: number
  name: string
  color: string | null
}

export interface CategoryRow {
  id: number
  name: string
  color: string | null
}

export interface FileTagLink {
  file_id: number
  tag_id: number
}

export type ScanPhase = 'scanning' | 'done'

export interface ScanProgressEvent {
  folderId: number
  phase: ScanPhase
  current: number
}

export interface FileChangedEvent {
  type: 'added' | 'updated' | 'removed'
  file: FileRow | { path: string }
}

export interface ThumbnailJob {
  jobId: number
  fileId: number
  ext: ModelExt
}
