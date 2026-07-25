import { hashFile } from './hasher'
import {
  findHashCandidates,
  findHashCandidatesAmong,
  setHashing,
  setHashResult,
  setHashError
} from '../db/repositories/filesRepo'
import { appEvents } from '../appEvents'
import { scheduleThumbnailSweep } from '../thumbnails/thumbnailQueue'
import { getPriorityFileIds } from '../priorityQueue'
import type { FileChangedEvent } from '../../shared/types'

const CONCURRENCY = 3

let activeCount = 0
let debounceTimer: ReturnType<typeof setTimeout> | null = null

/** Debounced entry point — call after scan events so a burst of file adds doesn't trigger a query per file. */
export function scheduleHashSweep(): void {
  if (debounceTimer) return
  debounceTimer = setTimeout(() => {
    debounceTimer = null
    runSweep()
  }, 500)
}

function runSweep(): void {
  const slots = CONCURRENCY - activeCount
  if (slots <= 0) return

  const priorityIds = getPriorityFileIds()
  const priorityCandidates = priorityIds.length
    ? findHashCandidatesAmong(priorityIds).slice(0, slots)
    : []
  for (const file of priorityCandidates) {
    activeCount++
    setHashing(file.id)
    void processFile(file.id, file.path)
  }

  const remainingSlots = slots - priorityCandidates.length
  if (remainingSlots <= 0) return
  for (const file of findHashCandidates(remainingSlots)) {
    activeCount++
    setHashing(file.id)
    void processFile(file.id, file.path)
  }
}

async function processFile(id: number, path: string): Promise<void> {
  try {
    const hash = await hashFile(path)
    setHashResult(id, hash)
    scheduleThumbnailSweep()
  } catch (err) {
    console.error(`[hashing] failed to hash file ${id} (${path}):`, err)
    setHashError(id)
  } finally {
    activeCount--
    appEvents.emit('file-changed', { type: 'updated', file: { path } } satisfies FileChangedEvent)
    runSweep()
  }
}
