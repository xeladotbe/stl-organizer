import { useEffect, useState } from 'react';
import * as THREE from 'three';
import type {
  HdriParseRequest,
  HdriParseResponse,
  HdriTexData
} from '../workers/hdriParser.worker';
import HdriParserWorker from '../workers/hdriParser.worker?worker';

interface HdriTextureState {
  texture: THREE.DataTexture | null;
  error: boolean;
}

/** Applies a worker-decoded HDRI's texture data to a fresh THREE.DataTexture, replicating what
 * HDRLoader's/EXRLoader's own `_applyTexData()` + drei's `useEnvironment()` do to a texture loaded
 * the normal (main-thread, Suspense-based) way — same field set, same `EquirectangularReflectionMapping`
 * (required for three's WebGLRenderer to treat this as an environment map at all; see
 * WebGLEnvironments.js's `getPMREM`/`getCube`, which both switch on `texture.mapping`). */
export function buildTexture(texData: HdriTexData): THREE.DataTexture {
  const texture = new THREE.DataTexture();
  texture.image = { width: texData.width ?? 0, height: texData.height ?? 0, data: texData.data! };
  texture.type = texData.type ?? THREE.HalfFloatType;
  if (texData.format !== undefined) texture.format = texData.format;
  texture.colorSpace = texData.colorSpace ?? THREE.LinearSRGBColorSpace;
  texture.minFilter = texData.minFilter ?? THREE.LinearFilter;
  texture.magFilter = texData.magFilter ?? THREE.LinearFilter;
  texture.generateMipmaps = texData.generateMipmaps ?? false;
  texture.flipY = texData.flipY ?? false;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 1;
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Decodes an HDRI (`.hdr`/`.exr`) into a THREE.DataTexture off the main thread. drei's
 * `<Environment>` (via `useEnvironment`/`useLoader`) does its fetch + decode on the main thread,
 * behind a React Suspense boundary — but decoding a large equirectangular float image is
 * synchronous, CPU-heavy work (EXR's compressed scanlines especially so), and Suspense/commit
 * ordering doesn't change *when* that synchronous work runs relative to the browser's own paint
 * scheduling. The result: the whole renderer process would freeze for the entire decode,
 * main-thread JS execution being what actually gates a paint — not which React commit a piece of
 * JSX belongs to. This mirrors useModelParts.ts's fix for the exact same class of problem with
 * STL/3MF/OBJ files (see modelParser.worker.ts and CLAUDE.md's "Model preview: off-main-thread
 * parsing").
 *
 * PMREM prefiltering (converting the equirectangular texture into a roughness-mipped cubemap) is
 * still done by three's WebGLRenderer itself, lazily, the first time a material samples this
 * texture (see WebGLEnvironments.js) — that part can't be moved off-thread (it's real GPU work),
 * but it's fast compared to the decode this hook offloads.
 */
export function useHdriTexture(url: string): HdriTextureState {
  const [state, setState] = useState<HdriTextureState>({ texture: null, error: false });

  useEffect(() => {
    const ext = url.split('.').pop()?.toLowerCase() === 'exr' ? 'exr' : 'hdr';
    const worker = new HdriParserWorker();
    let cancelled = false;
    let currentTexture: THREE.DataTexture | null = null;

    worker.onmessage = (event: MessageEvent<HdriParseResponse>) => {
      if (cancelled) return;
      const data = event.data;
      if (!data.ok) {
        setState({ texture: null, error: true });
        return;
      }
      const texture = buildTexture(data.texData);
      currentTexture = texture;
      setState({ texture, error: false });
    };
    worker.onerror = (event) => {
      console.error('[hdri-preview] worker error', event.message);
      if (!cancelled) setState({ texture: null, error: true });
    };

    const request: HdriParseRequest = { requestId: 1, url, ext };
    worker.postMessage(request);

    return () => {
      cancelled = true;
      worker.terminate();
      currentTexture?.dispose();
      currentTexture = null;
    };
  }, [url]);

  return state;
}
