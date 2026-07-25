import { contextBridge, ipcRenderer } from 'electron'
import type { ThumbnailJob } from '../shared/types'

const thumbnailApi = {
  onJob: (callback: (job: ThumbnailJob) => void): void => {
    ipcRenderer.on('thumbnail:job', (_event, job: ThumbnailJob) => callback(job))
  },
  sendResult: (jobId: number, pngBase64: string | null): void => {
    ipcRenderer.send('thumbnail:result', { jobId, pngBase64 })
  }
}

export type ThumbnailApi = typeof thumbnailApi

contextBridge.exposeInMainWorld('thumbnailApi', thumbnailApi)
