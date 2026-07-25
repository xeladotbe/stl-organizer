import { Component, Suspense, useMemo, type ReactNode } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import { Bounds, OrbitControls } from '@react-three/drei'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js'
import { modelFileUrl } from '@shared/modelFileUrl'
import type { FileRow } from '@shared/types'

function StlMesh({ url }: { url: string }): React.JSX.Element {
  const geometry = useLoader(STLLoader, url)
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#a3a3a3" metalness={0.1} roughness={0.6} />
    </mesh>
  )
}

function ThreeMfObject({ url }: { url: string }): React.JSX.Element {
  const object = useLoader(ThreeMFLoader, url)
  return <primitive object={object} />
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
          <Suspense fallback={null}>
            <Bounds fit clip observe margin={1.3}>
              {file.ext === 'stl' ? <StlMesh url={url} /> : <ThreeMfObject url={url} />}
            </Bounds>
          </Suspense>
          <OrbitControls makeDefault />
        </Canvas>
      </ModelErrorBoundary>
    </div>
  )
}
