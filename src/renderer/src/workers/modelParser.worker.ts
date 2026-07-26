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
}

export interface ParseRequest {
  requestId: number
  url: string
  ext: ModelExt
}

export interface PartPayload {
  position: Float32Array
  normal: Float32Array | null
  color: Float32Array | null
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

function extractPart(
  geometry: THREE.BufferGeometry,
  materialColor: [number, number, number] | null
): PartPayload {
  if (!geometry.attributes.normal) geometry.computeVertexNormals()
  const position = geometry.attributes.position.array as Float32Array
  const normal = geometry.attributes.normal
    ? (geometry.attributes.normal.array as Float32Array)
    : null
  const color = geometry.attributes.color ? (geometry.attributes.color.array as Float32Array) : null
  return { position, normal, color, materialColor }
}

/** Both ThreeMFLoader and OBJLoader return a multi-part `Object3D`/`Group` (one mesh per
 * part/named object), unlike STLLoader which parses directly to a single geometry. */
function extractPartsFromObject(object: THREE.Object3D): PartPayload[] {
  const parts: PartPayload[] = []
  object.traverse((child) => {
    if (!(child as THREE.Mesh).isMesh) return
    const mesh = child as THREE.Mesh
    parts.push(extractPart(mesh.geometry, materialColorOf(mesh.material)))
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
      }
      ctx.postMessage({ requestId, ok: true, parts }, transfer)
    } catch (err) {
      console.error('[model-parser-worker] failed', err)
      ctx.postMessage({ requestId, ok: false }, [])
    }
  })()
}
