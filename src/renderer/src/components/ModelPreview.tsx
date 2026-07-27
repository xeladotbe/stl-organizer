import { Component, Suspense, useEffect, useMemo, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Environment, OrbitControls, useBounds } from '@react-three/drei';
import { modelFileUrl } from '@shared/modelFileUrl';
import { hdriFileUrl } from '@shared/hdriFileUrl';
import { useModelParts } from '../hooks/useModelParts';
import { useLibraryStore } from '../store/useLibraryStore';
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

const DEFAULT_PREVIEW_WIDTH = 288; // w-80 minus padding = 320 - 32
const PREVIEW_ASPECT_RATIO = DEFAULT_PREVIEW_WIDTH / 256; // width / default height

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

  // Scale height proportionally based on sidebar width
  // Account for padding (p-3 = 0.75rem = 12px on each side) and borders/margins
  const previewAreaWidth = Math.max(width - 24, 100); // Subtract padding
  const previewHeight = Math.round(previewAreaWidth / PREVIEW_ASPECT_RATIO);

  return (
    <div
      className="relative overflow-hidden rounded border border-neutral-800 bg-neutral-950"
      style={{ width: '100%', height: previewHeight }}
    >
      <ModelErrorBoundary key={file.id} fallback={<UnsupportedPlaceholder />}>
        <Canvas camera={{ position: [40, 40, 40], fov: 45 }}>
          {hdriUrl ? (
            <HdriErrorBoundary key={hdriUrl}>
              <Suspense fallback={null}>
                <Environment files={hdriUrl} />
              </Suspense>
            </HdriErrorBoundary>
          ) : (
            <>
              <ambientLight intensity={0.6} />
              <directionalLight position={[5, 8, 5]} intensity={0.8} />
            </>
          )}
          <Bounds fit clip observe margin={1.3}>
            <ParsedModel key={url} url={url} ext={file.ext} />
          </Bounds>
          <OrbitControls makeDefault />
        </Canvas>
      </ModelErrorBoundary>
      <HdriControls />
    </div>
  );
}
