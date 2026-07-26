import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ModelExt } from '@shared/types'
import type { ParseRequest, ParseResponse } from '../workers/modelParser.worker'
import ModelParserWorker from '../workers/modelParser.worker?worker'

export interface ModelPart {
  geometry: THREE.BufferGeometry
  color: THREE.Color | null
  hasVertexColors: boolean
}

interface ModelPartsState {
  parts: ModelPart[] | null
  error: boolean
}

/**
 * Parses an STL/3MF/OBJ file off the main thread. The actual fetch + geometry decode (the part that
 * blocks the UI for large files) runs in a dedicated Worker; this hook only ever touches the
 * small, cheap step of wrapping the transferred typed arrays back into a BufferGeometry.
 */
/**
 * Callers should `key` the component using this hook by `url` — a fresh mount naturally starts
 * at `{ parts: null, error: false }` again, so there's no need to reset state from inside the
 * effect when the model changes (see https://react.dev/learn/you-might-not-need-an-effect).
 */
export function useModelParts(url: string, ext: ModelExt): ModelPartsState {
  const [state, setState] = useState<ModelPartsState>({ parts: null, error: false })
  const currentPartsRef = useRef<ModelPart[] | null>(null)

  useEffect(() => {
    const worker = new ModelParserWorker()
    let cancelled = false

    worker.onmessage = (event: MessageEvent<ParseResponse>) => {
      if (cancelled) return
      const data = event.data
      if (!data.ok) {
        setState({ parts: null, error: true })
        return
      }
      const parts = data.parts.map((part) => {
        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(part.position, 3))
        if (part.normal) geometry.setAttribute('normal', new THREE.BufferAttribute(part.normal, 3))
        if (part.color) geometry.setAttribute('color', new THREE.BufferAttribute(part.color, 3))
        return {
          geometry,
          color: part.materialColor ? new THREE.Color(...part.materialColor) : null,
          hasVertexColors: part.color != null
        }
      })
      currentPartsRef.current = parts
      setState({ parts, error: false })
    }
    worker.onerror = (event) => {
      console.error('[model-preview] worker error', event.message)
      if (!cancelled) setState({ parts: null, error: true })
    }

    const request: ParseRequest = { requestId: 1, url, ext }
    worker.postMessage(request)

    return () => {
      cancelled = true
      worker.terminate()
      for (const part of currentPartsRef.current ?? []) part.geometry.dispose()
      currentPartsRef.current = null
    }
  }, [url, ext])

  return state
}
