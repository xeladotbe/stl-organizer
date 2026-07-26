import { BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { ModelExt, ThumbnailJob } from '../../shared/types'

const DEBUG_CONSOLE = is.dev

// Some real-world STL/3MF/OBJ files run to hundreds of MB; parsing that much geometry
// (unzip + XML for 3MF especially) can legitimately take a while in the background.
const JOB_TIMEOUT_MS = 90000

let win: BrowserWindow | null = null
let readyPromise: Promise<void> | null = null
let nextJobId = 1
const pending = new Map<number, (buffer: Buffer | null) => void>()
let resultHandlerRegistered = false
let chain: Promise<unknown> = Promise.resolve()

function registerResultHandler(): void {
  if (resultHandlerRegistered) return
  resultHandlerRegistered = true
  ipcMain.on('thumbnail:result', (_event, payload: { jobId: number; pngBase64: string | null }) => {
    const resolve = pending.get(payload.jobId)
    if (!resolve) return
    pending.delete(payload.jobId)
    resolve(payload.pngBase64 ? Buffer.from(payload.pngBase64, 'base64') : null)
  })
}

function ensureWindow(): { win: BrowserWindow; ready: Promise<void> } {
  if (win && !win.isDestroyed()) return { win, ready: readyPromise! }

  const created = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/thumbnail.js'),
      sandbox: false
    }
  })
  win = created
  readyPromise = new Promise((resolve) => {
    created.webContents.once('did-finish-load', () => resolve())
  })

  if (DEBUG_CONSOLE) {
    created.webContents.on('console-message', (_event, level, message, line, sourceId) => {
      console.log(`[thumbnail-renderer:${level}] ${message} (${sourceId}:${line})`)
    })
    created.webContents.on('did-fail-load', (_event, errorCode, errorDescription, url) => {
      console.error(`[thumbnail-renderer] failed to load ${url}: ${errorCode} ${errorDescription}`)
    })
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    created.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/thumbnail.html`)
  } else {
    created.loadFile(join(__dirname, '../renderer/thumbnail.html'))
  }

  created.on('closed', () => {
    if (win === created) win = null
  })

  return { win: created, ready: readyPromise }
}

/** Renders one model to a PNG via the hidden thumbnail window. Jobs are serialized — there's only one WebGL context. */
export function renderThumbnail(fileId: number, ext: ModelExt): Promise<Buffer | null> {
  registerResultHandler()

  const run = async (): Promise<Buffer | null> => {
    const { win: w, ready } = ensureWindow()
    await ready

    const jobId = nextJobId++
    const resultPromise = new Promise<Buffer | null>((resolve) => {
      pending.set(jobId, resolve)
    })
    const job: ThumbnailJob = { jobId, fileId, ext }
    w.webContents.send('thumbnail:job', job)

    const timeoutPromise = new Promise<Buffer | null>((resolve) => {
      setTimeout(() => {
        if (pending.delete(jobId)) resolve(null)
      }, JOB_TIMEOUT_MS)
    })
    return Promise.race([resultPromise, timeoutPromise])
  }

  const result = chain.then(run)
  chain = result.catch(() => undefined)
  return result
}
