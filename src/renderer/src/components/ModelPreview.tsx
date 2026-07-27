import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Environment, OrbitControls, useBounds } from '@react-three/drei';
import { modelFileUrl } from '@shared/modelFileUrl';
import { hdriFileUrl } from '@shared/hdriFileUrl';
import { useModelParts } from '../hooks/useModelParts';
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

// Separate from ModelErrorBoundary: a bad/missing HDRI file should fall back to the default
// lighting rig, not hide the whole model behind "Preview unavailable". Clearing `hdriPath` makes
// ModelPreview re-render onto the default-lighting branch instead of retrying the same URL.
class HdriErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown): void {
    console.error('[preview] failed to load HDRI, falling back to default lighting', error);
    useLibraryStore.getState().clearHdri();
  }

  render(): ReactNode {
    return this.state.hasError ? null : this.props.children;
  }
}

function DefaultLights(): React.JSX.Element {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={0.8} />
    </>
  );
}

// A sibling of <Environment>, inside the *same* Suspense boundary — Suspense treats its whole
// subtree as one atomic unit, so this only mounts (and fires its effect) once Environment's own
// texture load has actually resolved, never before. That gives ModelPreview a precise "HDRI is
// ready" signal without having to reimplement any of drei's Environment/useEnvironment internals
// (there's no onLoad prop to hook into directly).
function HdriReadySignal({ onReady }: { onReady: () => void }): null {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return null;
}

// @react-three/fiber wraps a <Canvas>'s entire children tree in one Suspense boundary of its own
// (see `CanvasImpl` in @react-three/fiber — anything that suspends without being caught by a
// nested boundary bubbles out to a `Block` that suspends the whole <Canvas> host component).
// Mounting the HDRI's own Suspense boundary in the very same commit as the rest of the scene
// risks that first commit — which also contains the parsed model mesh — getting held back until
// the HDRI resolves, even though the two are otherwise unrelated (see issue #58). Deferring this
// subtree's mount to a follow-up render, after the model's own first paint has already committed
// on its own, guarantees the model is never gated behind it: at the moment of that very first
// commit there is no Suspense-bearing content in the tree at all yet.
function HdriEnvironment({
  hdriUrl,
  onReady
}: {
  hdriUrl: string;
  onReady: () => void;
}): React.JSX.Element | null {
  const [deferred, setDeferred] = useState(false);
  // Deliberate exception to react-hooks/set-state-in-effect: that rule exists for state that's
  // redundant with something already known during render, which isn't the case here — the whole
  // point is to distinguish the very first commit from any later one, which is only observable
  // from an effect (an effect body, by definition, only runs after a commit has already happened).
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setDeferred(true), []);

  if (!deferred) return null;

  return (
    <HdriErrorBoundary>
      <Suspense fallback={null}>
        <Environment files={hdriUrl} />
        <HdriReadySignal onReady={onReady} />
      </Suspense>
    </HdriErrorBoundary>
  );
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

  // Whether the current `hdriUrl` has actually finished loading (see HdriEnvironment/
  // HdriReadySignal above). `hdriReady` is reset "adjusted during render" whenever `hdriUrl`
  // itself changes, rather than via an effect (see rerender-derived-state-no-effect) — this is
  // the React-documented pattern for resetting state when a prop changes, and correctly covers
  // every transition (on -> off, off -> on, on -> a different file), not just "different URL".
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
