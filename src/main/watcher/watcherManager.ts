import chokidar, { type FSWatcher } from 'chokidar'
import { extname } from 'path'
import type { WatchedFolderRow, ScanProgressEvent, FileChangedEvent } from '../../shared/types'
import { scanFile, removeFile } from '../scanning/scanner'
import { appEvents } from '../appEvents'
import { scheduleHashSweep } from '../hashing/hashQueue'

const MODEL_EXTENSIONS = new Set(['.stl', '.3mf', '.obj'])
const IGNORED_DIR_PATTERN =
  /[\\/](node_modules|\.git|\$RECYCLE\.BIN|System Volume Information)[\\/]/i

const watchers = new Map<number, FSWatcher>()

export function startWatching(folder: WatchedFolderRow): void {
  if (watchers.has(folder.id)) return

  let ready = false
  let scannedCount = 0

  const watcher = chokidar.watch(folder.path, {
    ignored: (path, stats) => {
      if (IGNORED_DIR_PATTERN.test(path)) return true
      if (stats?.isFile()) return !MODEL_EXTENSIONS.has(extname(path).toLowerCase())
      return false
    },
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: { stabilityThreshold: 1500, pollInterval: 200 }
  })

  const onUpsert = (path: string): void => {
    const file = scanFile(folder.id, path)
    if (!file) return
    appEvents.emit('file-changed', {
      type: ready ? 'updated' : 'added',
      file
    } satisfies FileChangedEvent)
    scheduleHashSweep()
    if (!ready) {
      scannedCount++
      appEvents.emit('progress', {
        folderId: folder.id,
        phase: 'scanning',
        current: scannedCount
      } satisfies ScanProgressEvent)
    }
  }

  watcher
    .on('add', onUpsert)
    .on('change', onUpsert)
    .on('unlink', (path) => {
      if (!removeFile(path)) return
      appEvents.emit('file-changed', { type: 'removed', file: { path } } satisfies FileChangedEvent)
    })
    .on('ready', () => {
      ready = true
      appEvents.emit('progress', {
        folderId: folder.id,
        phase: 'done',
        current: scannedCount
      } satisfies ScanProgressEvent)
    })
    .on('error', (err: unknown) => {
      console.error(`[watcher] folder ${folder.id} (${folder.path}):`, err)
    })

  watchers.set(folder.id, watcher)
}

export async function stopWatching(folderId: number): Promise<void> {
  const watcher = watchers.get(folderId)
  if (!watcher) return
  watchers.delete(folderId)
  await watcher.close()
}

export async function stopAllWatching(): Promise<void> {
  await Promise.all([...watchers.keys()].map(stopWatching))
}
