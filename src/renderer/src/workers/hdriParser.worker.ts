import type { DataTextureLoaderTexData } from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

// Typed as a plain postMessage/onmessage shape instead of the ambient `WorkerGlobalScope` lib —
// same reasoning as modelParser.worker.ts: this file's tsconfig shares the renderer's DOM lib,
// and DOM + WebWorker ambient globals can't coexist in one TS program.
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<HdriParseRequest>) => void) | null;
  postMessage: (message: HdriParseResponse, transfer: Transferable[]) => void;
};

export interface HdriParseRequest {
  requestId: number;
  url: string;
  ext: 'hdr' | 'exr';
}

// `DataTextureLoaderTexData` (three's own type for what a DataTextureLoader's `parse()` returns)
// is everything `_applyTexData` (three's DataTextureLoader base class) needs to fully configure a
// THREE.DataTexture. HDRLoader's/EXRLoader's `parse()` already bakes in all their `load()`-time
// post-processing (colorSpace/filters/flipY/generateMipmaps) directly into this return value, so
// there's no separate override step to replicate by hand (unlike three-stdlib's older
// split-parse()/load() versions of these same loaders, which useEnvironment/<Environment> use).
export type HdriTexData = DataTextureLoaderTexData;

export type HdriParseResponse =
  { requestId: number; ok: true; texData: HdriTexData } | { requestId: number; ok: false };

const hdrLoader = new HDRLoader();
const exrLoader = new EXRLoader();

ctx.onmessage = (event) => {
  const { requestId, url, ext } = event.data;

  void (async (): Promise<void> => {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`fetch failed with status ${response.status}`);
      const buffer = await response.arrayBuffer();

      // `parse()` is the CPU-heavy step this worker exists to isolate — decoding a large
      // equirectangular float image (especially EXR's compressed scanlines) synchronously on the
      // main thread is exactly the kind of work that froze the whole app for STL/3MF/OBJ files
      // before useModelParts.ts moved that off-thread too (see modelParser.worker.ts).
      const texData = ext === 'hdr' ? hdrLoader.parse(buffer) : exrLoader.parse(buffer);
      if (!texData.data) throw new Error('no pixel data decoded');

      const transfer: ArrayBuffer[] = [texData.data.buffer as ArrayBuffer];
      ctx.postMessage({ requestId, ok: true, texData }, transfer);
    } catch (err) {
      console.error('[hdri-parser-worker] failed', err);
      ctx.postMessage({ requestId, ok: false }, []);
    }
  })();
};
