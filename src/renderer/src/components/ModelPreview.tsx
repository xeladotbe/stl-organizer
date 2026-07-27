import { Component, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Bounds, OrbitControls, useBounds } from '@react-three/drei';
import { modelFileUrl } from '@shared/modelFileUrl';
import { hdriFileUrl } from '@shared/hdriFileUrl';
import { useModelParts } from '../hooks/useModelParts';
import { useHdriTexture } from '../hooks/useHdriTexture';
import { useLibraryStore } from '../store/useLibraryStore';
import { DEFAULT_PREVIEW_WIDTH, calculatePreviewHeight } from '../lib/previewDimensions';
import type { FileRow } from '@shared/types';

function ParsedModel({ url, ext }: { url: string; ext: FileRow['ext'] }): React.JSX.Element | null {
  const { parts, error } = useModelParts(url, ext);
  const bounds = useBounds();

  // `Bounds`' own auto-fit runs once on <Canvas> mount, keyed off canvas size — not off when
  // this async-loaded geometry actually shows up. It fires before the worker has resolved
  // anything, sees an empty scene, and frames a meaningless default box. Refit for real once the
  // parsed mesh is actually in the scene graph.
  useEffect(() => {
    if (parts) bounds.refresh().fit().clip();
  }, [parts, bounds]);

  // Thrown during render (not inside an effect/callback), so ModelErrorBoundary below catches it.
  if (error) throw new Error('failed to parse model');
  if (!parts) return null;

  return (
    <>
      {parts.map((part, index) => (
        <mesh key={index} geometry={part.geometry}>
          <meshStandardMaterial
            color={part.hasVertexColors ? '#ffffff' : (part.color ?? '#a3a3a3')}
            vertexColors={part.hasVertexColors}
            metalness={0.1}
            roughness={0.6}
          />
        </mesh>
      ))}
    </>
  );
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback: ReactNode;
  // Fires synchronously from componentDidCatch, in addition to (not instead of) the boundary's own
  // hasError state — lets ModelPreview surface a DOM "Preview unavailable" overlay *outside* the
  // Canvas without needing the whole Canvas/Environment subtree to unmount just to render it.
  onError?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ModelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('[preview] failed to load model', error);
    this.props.onError?.();
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function UnsupportedPlaceholder(): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center text-xs text-neutral-500">
      Preview unavailable
    </div>
  );
}

function DefaultLights(): React.JSX.Element {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} />
    </>
  );
}

// Renders nothing itself — it decodes the HDRI off the main thread (see useHdriTexture.ts) and
// assigns the result directly to the scene's `environment`, entirely outside of React Suspense.
//
// An earlier version of this fix wrapped drei's <Environment> (which loads via `useLoader`/
// Suspense) and tried to work around the model being gated behind the HDRI's load by deferring
// *when* that Suspense boundary mounted relative to React's commits. That didn't address the
// actual cause: decoding a large equirectangular float image (especially EXR's compressed
// scanlines) is synchronous, CPU-heavy work, and it blocks the renderer's *entire* main thread —
// including painting whatever the model's own commit already produced — for as long as it runs
// (measured: >6s for a real 8k EXR, likely more in practice; see PR discussion for numbers).
// Which React commit a piece of JSX belongs to doesn't change when that synchronous work runs or
// how long it blocks the thread; only actually moving the decode off-thread does (mirroring
// useModelParts.ts's fix for the same class of problem with STL/3MF/OBJ files).
function HdriEnvironment({ hdriUrl, onReady }: { hdriUrl: string; onReady: () => void }): null {
  const { texture, error } = useHdriTexture(hdriUrl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    if (!error) return;
    console.error('[preview] failed to load HDRI, falling back to default lighting');
    useLibraryStore.getState().clearHdri();
  }, [error]);

  useEffect(() => {
    if (!texture) return;
    // Deliberate exception to react-hooks/immutability: `scene` is the live THREE.Scene instance
    // from r3f's store, and mutating three.js objects obtained via `useThree`/`useFrame` is
    // idiomatic, required r3f usage (this is exactly what drei's own <Environment> does
    // internally to the same `scene.environment` field) — not the kind of React-value mutation
    // the rule exists to catch.
    // eslint-disable-next-line react-hooks/immutability
    scene.environment = texture;
    onReady();
    return () => {
      if (scene.environment === texture) scene.environment = null;
    };
  }, [texture, scene, onReady]);

  return null;
}

function HdriControls(): React.JSX.Element {
  const hdriPath = useLibraryStore((state) => state.hdriPath);
  const pickHdri = useLibraryStore((state) => state.pickHdri);
  const clearHdri = useLibraryStore((state) => state.clearHdri);

  return (
    <button
      type="button"
      onClick={() => void (hdriPath ? clearHdri() : pickHdri())}
      title={hdriPath ?? 'Use an HDRI for lighting/reflections'}
      className="absolute right-1 top-1 z-10 rounded bg-neutral-950/70 px-1.5 py-0.5 text-[10px] text-neutral-300 hover:text-neutral-100"
    >
      {hdriPath ? 'HDRI ✕' : 'HDRI…'}
    </button>
  );
}

export function ModelPreview({
  file,
  width = DEFAULT_PREVIEW_WIDTH
}: {
  file: FileRow;
  width?: number;
}): React.JSX.Element {
  const url = useMemo(() => modelFileUrl(file.id, file.filename), [file.id, file.filename]);
  const hdriPath = useLibraryStore((state) => state.hdriPath);
  const hdriUrl = useMemo(() => (hdriPath ? hdriFileUrl(hdriPath) : null), [hdriPath]);

  // Tracks *which* file last failed to parse, rather than a plain boolean — comparing it against
  // the current `file.id` below derives a fresh "no error yet" state for free on every file switch,
  // with no separate reset effect needed (see rerender-derived-state-no-effect).
  const [erroredFileId, setErroredFileId] = useState<number | null>(null);
  const hasModelError = erroredFileId === file.id;

  // Whether the current `hdriUrl` has actually finished loading (see HdriEnvironment above).
  // `hdriReady` is reset "adjusted during render" whenever `hdriUrl` itself changes, rather than
  // via an effect (see rerender-derived-state-no-effect) — this is the React-documented pattern
  // for resetting state when a prop changes, and correctly covers every transition (on -> off,
  // off -> on, on -> a different file), not just "different URL".
  const [hdriReady, setHdriReady] = useState(false);
  const [prevHdriUrl, setPrevHdriUrl] = useState(hdriUrl);
  if (hdriUrl !== prevHdriUrl) {
    setPrevHdriUrl(hdriUrl);
    setHdriReady(false);
  }
  const handleHdriReady = useCallback(() => setHdriReady(true), []);

  const previewHeight = calculatePreviewHeight(width);

  return (
    <div
      className="relative overflow-hidden rounded border border-neutral-800 bg-neutral-950"
      style={{ width: '100%', height: previewHeight }}
    >
      {/* No `key={file.id}` on the Canvas itself (there used to be one, via the error boundary that
          wrapped it) — remounting the whole Canvas per file switch also tore down <Environment>,
          discarding its PMREM-generated HDRI texture (tied to that specific WebGLRenderer) and
          forcing a full re-fetch + re-decode of the HDRI on every single file switch. Keeping the
          Canvas/renderer/Environment alive across switches and only remounting the part that
          actually needs a per-file reset (ParsedModel, keyed by `url` below) fixes that. */}
      <Canvas camera={{ position: [40, 40, 40], fov: 45 }}>
        {hdriUrl ? (
          <>
            {!hdriReady && <DefaultLights />}
            <HdriEnvironment key={hdriUrl} hdriUrl={hdriUrl} onReady={handleHdriReady} />
          </>
        ) : (
          <DefaultLights />
        )}
        <Bounds fit clip observe margin={1.3}>
          {/* `fallback={null}`: a DOM node can't be a child of <Canvas>. The actual "Preview
              unavailable" message renders as a plain DOM overlay below, outside the Canvas. */}
          <ModelErrorBoundary key={url} fallback={null} onError={() => setErroredFileId(file.id)}>
            <ParsedModel url={url} ext={file.ext} />
          </ModelErrorBoundary>
        </Bounds>
        <OrbitControls makeDefault />
      </Canvas>
      {hasModelError && (
        <div className="absolute inset-0 bg-neutral-950">
          <UnsupportedPlaceholder />
        </div>
      )}
      <HdriControls />
    </div>
  );
}
