import type { ThumbnailApi } from './thumbnail';

declare global {
  interface Window {
    thumbnailApi: ThumbnailApi;
  }
}

export {};
