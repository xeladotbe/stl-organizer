import { app } from 'electron'
import { join } from 'path'
import { mkdir, writeFile } from 'fs/promises'
import {
  findThumbnailCandidates,
  findThumbnailCandidatesAmong,
  findExistingThumbnailPath,
  getFileById,
  setThumbnailRendering,
  setThumbnailResult,
  setThumbnailError,
  setThumbnailUnsupported
} from '../db/repositories/filesRepo'
import { renderThumbnail } from './thumbnailWindow'
import { appEvents } from '../appEvents'
import { getPriorityFileIds } from '../priorityQueue'
import type { FileChangedEvent, ModelExt } from '../../shared/types'

let running = false
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function thumbnailsDir(): string {
  return join(app.getPath('userData'), 'thumbnails')
}

export function scheduleThumbnailSweep(): void {
  if (debounceTimer) return
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    void runSweep()
  }, 500)
}

async function runSweep(): Promise<void> {
  if (running) return
  running = true
  try {
    await mkdir(thumbnailsDir(), { recursive: true })
    // One at a time — rendering already serializes through a single hidden window/WebGL context.
    for (;;) {
      const priorityIds = getPriorityFileIds()
      const priorityCandidates = priorityIds.length ? findThumbnailCandidatesAmong(priorityIds) : []
      const [candidate] = priorityCandidates.length
        ? priorityCandidates
        : findThumbnailCandidates(1)
      if (!candidate) break
      await processCandidate(candidate.id, candidate.content_hash, candidate.ext)
    }
  } finally {
    running = false
  }
}

async function processCandidate(
  id: number,
  contentHash: string | null,
  ext: ModelExt
): Promise<void> {
  setThumbnailRendering(id)

  if (contentHash) {
    const existingPath = findExistingThumbnailPath(contentHash)
    if (existingPath) {
      setThumbnailResult(id, existingPath)
      notifyChanged(id)
      return
    }
  }

  const png = await renderThumbnail(id, ext)
  if (!png) {
    setThumbnailUnsupported(id)
    notifyChanged(id)
    return
  }

  // Files without a hash yet (unique size, never queued for hashing) key their thumbnail by
  // file id instead — there's no content identity to dedupe against until/unless they get hashed.
  const filePath = join(thumbnailsDir(), `${contentHash ?? `file-${id}`}.png`)
  try {
    await writeFile(filePath, png)
    setThumbnailResult(id, filePath)
  } catch (err) {
    console.error(`[thumbnails] failed to write thumbnail for file ${id}:`, err)
    setThumbnailError(id)
  }
  notifyChanged(id)
}

function notifyChanged(id: number): void {
  const file = getFileById(id)
  if (!file) return
  appEvents.emit('file-changed', { type: 'updated', file } satisfies FileChangedEvent)
}
