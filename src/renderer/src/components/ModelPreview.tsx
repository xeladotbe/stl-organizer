import { Component, useEffect, useMemo, type ReactNode } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bounds, OrbitControls, useBounds } from '@react-three/drei'
import { modelFileUrl } from '@shared/modelFileUrl'
import { useModelParts } from '../hooks/useModelParts'
import type { FileRow } from '@shared/types'

function ParsedModel({ url, ext }: { url: string; ext: FileRow['ext'] }): React.JSX.Element | null {
  const { parts, error } = useModelParts(url, ext)
  const bounds = useBounds()

  // `Bounds`' own auto-fit runs once on <Canvas> mount, keyed off canvas size — not off when
  // this async-loaded geometry actually shows up. It fires before the worker has resolved
  // anything, sees an empty scene, and frames a meaningless default box. Refit for real once the
  // parsed mesh is actually in the scene graph.
  useEffect(() => {
    if (parts) bounds.refresh().fit().clip()
  }, [parts, bounds])

  // Thrown during render (not inside an effect/callback), so ModelErrorBoundary below catches it.
  if (error) throw new Error('failed to parse model')
  if (!parts) return null

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
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
  fallback: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

class ModelErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: unknown): void {
    console.error('[preview] failed to load model', error)
  }

  render(): ReactNode {
    return this.state.hasError ? this.props.fallback : this.props.children
  }
}

function UnsupportedPlaceholder(): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center text-xs text-neutral-500">
      Preview unavailable
    </div>
  )
}

export function ModelPreview({ file }: { file: FileRow }): React.JSX.Element {
  const url = useMemo(() => modelFileUrl(file.id, file.filename), [file.id, file.filename])

  return (
    <div className="h-64 w-full overflow-hidden rounded border border-neutral-800 bg-neutral-950">
      <ModelErrorBoundary key={file.id} fallback={<UnsupportedPlaceholder />}>
        <Canvas camera={{ position: [40, 40, 40], fov: 45 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[5, 8, 5]} intensity={0.8} />
          <Bounds fit clip observe margin={1.3}>
            <ParsedModel key={url} url={url} ext={file.ext} />
          </Bounds>
          <OrbitControls makeDefault />
        </Canvas>
      </ModelErrorBoundary>
    </div>
  )
}
