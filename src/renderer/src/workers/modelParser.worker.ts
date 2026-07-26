import { DOMParser } from 'linkedom/worker'
import * as THREE from 'three'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js'
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js'
import type { ModelExt } from '@shared/types'

// Typed as a plain postMessage/onmessage shape instead of the ambient `WorkerGlobalScope` lib —
// this file's tsconfig pulls in the DOM lib (shared with the rest of the renderer), and DOM +
// WebWorker ambient globals can't coexist in one TS program. This is what `self` really is at
// runtime inside a dedicated worker.
const ctx = self as unknown as {
  onmessage: ((event: MessageEvent<ParseRequest>) => void) | null
  postMessage: (message: ParseResponse, transfer: Transferable[]) => void
  DOMParser: typeof DOMParser
}

// `DOMParser` is a Window-only API - it doesn't exist in a dedicated Worker's global scope.
// `ThreeMFLoader.parse()` uses it internally to read the 3MF's embedded XML (STL/OBJ don't hit
// this, neither of their loaders parses XML), so without this polyfill every .3mf file fails with
// "DOMParser is not defined". `linkedom/worker` is a pure-JS DOM implementation with no Node
// built-ins, so it works inside a real (non-Node-integrated) Worker; its querySelector/
// querySelectorAll support the descendant-combinator selectors (e.g. 'vertices vertex') the loader
// relies on.
ctx.DOMParser = DOMParser

export interface ParseRequest {
  requestId: number
  url: string
  ext: ModelExt
}

export interface PartPayload {
  position: Float32Array
  normal: Float32Array | null
  color: Float32Array | null
  index: Uint32Array | Uint16Array | null
  materialColor: [number, number, number] | null
}

export type ParseResponse =
  { requestId: number; ok: true; parts: PartPayload[] } | { requestId: number; ok: false }

const stlLoader = new STLLoader()
const mfLoader = new ThreeMFLoader()
const objLoader = new OBJLoader()

function materialColorOf(
  material: THREE.Material | THREE.Material[] | undefined
): [number, number, number] | null {
  const single = Array.isArray(material) ? material[0] : material
  const color = (single as THREE.MeshStandardMaterial | undefined)?.color
  return color ? [color.r, color.g, color.b] : null
}

export function extractPart(
  geometry: THREE.BufferGeometry,
  materialColor: [number, number, number] | null
): PartPayload {
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  const position = geometry.attributes.position.array as Float32Array
  const normal = geometry.attributes.normal
    ? (geometry.attributes.normal.array as Float32Array)
    : null
  const color = geometry.attributes.color ? (geometry.attributes.color.array as Float32Array) : null
  // 3MF meshes are indexed by default (unique vertices + a separate triangle index) - dropping
  // the index here and reconstructing a non-indexed geometry from `position` alone treats every
  // 3 consecutive vertices as a triangle, which is wrong connectivity for an indexed source and
  // rendered as a garbled, holey mesh. STL is always non-indexed, so `index` is null for it.
  const index = geometry.index ? (geometry.index.array as Uint32Array | Uint16Array) : null
  return { position, normal, color, index, materialColor }
}

/** A mirrored transform (negative-determinant `matrixWorld` - e.g. a 3MF `<item>`/`<component>`
 * with a -1 scale on one axis) flips vertex positions correctly via `applyMatrix4`, but leaves
 * each triangle's vertex/index order exactly as authored. Three.js normally compensates for a
 * mirrored mesh by flipping the GL front-face winding it expects at render time - but it keys that
 * off the rendered *mesh's own* `matrixWorld` determinant (see `WebGLRenderer.renderBufferDirect`),
 * and here the mirror has already been baked into the geometry while the `<mesh>` itself renders
 * with an identity transform. That compensation never fires, so the mirrored part's faces read as
 * back-facing under the default front-face convention and get culled - showing through to whatever
 * is behind them instead of the actual (correctly positioned) surface. Reversing the winding order
 * ourselves keeps the geometry self-consistent regardless of the mesh's own transform. See #36. */
function reverseWindingOrder(geometry: THREE.BufferGeometry): void {
  const index = geometry.index
  if (index) {
    const array = index.array as Uint16Array | Uint32Array
    for (let i = 0; i + 2 < array.length; i += 3) {
      const tmp = array[i + 1]
      array[i + 1] = array[i + 2]
      array[i + 2] = tmp
    }
    index.needsUpdate = true
    return
  }
  for (const attribute of Object.values(geometry.attributes)) {
    const itemSize = attribute.itemSize
    const array = attribute.array as Float32Array
    for (let vertex = 0; vertex + 2 < array.length / itemSize; vertex += 3) {
      const bOffset = (vertex + 1) * itemSize
      const cOffset = (vertex + 2) * itemSize
      for (let k = 0; k < itemSize; k++) {
        const tmp = array[bOffset + k]
        array[bOffset + k] = array[cOffset + k]
        array[cOffset + k] = tmp
      }
    }
    attribute.needsUpdate = true
  }
}

/** Both ThreeMFLoader and OBJLoader return a multi-part `Object3D`/`Group` (one mesh per
 * part/named object), unlike STLLoader which parses directly to a single geometry.
 *
 * 3MF `<item>`/`<component>` elements can carry their own `transform` (position/rotation/scale) -
 * ThreeMFLoader applies these to each mesh's `position`/`quaternion`/`scale`, not to the geometry's
 * vertex data itself. Reading `mesh.geometry` directly (as before) silently dropped every one of
 * those transforms, so multi-part 3MF models rendered with all parts collapsed on top of each
 * other at the origin instead of assembled correctly. OBJ has no per-part transform concept, so
 * baking `matrixWorld` in here is a no-op for it (identity matrix). */
export function extractPartsFromObject(object: THREE.Object3D): PartPayload[] {
  object.updateWorldMatrix(true, true)
  const parts: PartPayload[] = []
  object.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    const mesh = child as THREE.Mesh
    const geometry = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld)
    if (mesh.matrixWorld.determinant() < 0) reverseWindingOrder(geometry)
    parts.push(extractPart(geometry, materialColorOf(mesh.material)))
  })
  return parts
}

ctx.onmessage = (event) => {
  const { requestId, url, ext } = event.data

  void (async (): Promise<void> => {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`fetch failed with status ${response.status}`)

      let parts: PartPayload[]
      if (ext === 'stl') {
        const buffer = await response.arrayBuffer()
        parts = [extractPart(stlLoader.parse(buffer), null)]
      } else if (ext === '3mf') {
        const buffer = await response.arrayBuffer()
        parts = extractPartsFromObject(mfLoader.parse(buffer))
      } else {
        // OBJLoader.parse takes text, unlike the binary formats above.
        const text = await response.text()
        parts = extractPartsFromObject(objLoader.parse(text))
      }

      if (parts.length === 0) throw new Error('no mesh data found')

      const transfer: ArrayBuffer[] = []
      for (const part of parts) {
        transfer.push(part.position.buffer as ArrayBuffer)
        if (part.normal) transfer.push(part.normal.buffer as ArrayBuffer)
        if (part.color) transfer.push(part.color.buffer as ArrayBuffer)
        if (part.index) transfer.push(part.index.buffer as ArrayBuffer)
      }
      ctx.postMessage({ requestId, ok: true, parts }, transfer)
    } catch (err) {
      console.error('[model-parser-worker] failed', err)
      ctx.postMessage({ requestId, ok: false }, [])
    }
  })()
}
