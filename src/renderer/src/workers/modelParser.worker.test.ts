import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { ThreeMFLoader } from 'three/addons/loaders/3MFLoader.js'

// Regression tests for issue #17: "3MF live preview is broken".
//
// Three separate bugs were found and fixed here:
// 1. ThreeMFLoader.parse() calls `new DOMParser()` internally to read the 3MF's embedded XML, but
//    a dedicated Worker's global scope has no DOMParser (it's a Window-only API) -
//    modelParser.worker.ts polyfills it via `linkedom/worker`. Verified below by removing the real
//    DOMParser and installing the linkedom one in its place, exactly like the worker does.
// 2. Once parsing itself worked, multi-part 3MF files (using `<item>`/`<component>` `transform`
//    attributes) still rendered wrong: ThreeMFLoader applies those transforms to each mesh's
//    position/quaternion/scale, not to the geometry's vertex data - `extractPartsFromObject` was
//    reading `mesh.geometry` directly and silently dropping them. Verified below with a build item
//    that translates its object by (5, 0, 0).
// 3. Even a single, untransformed part still rendered as a garbled/holey mesh: 3MF meshes are
//    indexed by default (a unique vertex list plus a separate triangle index), but `extractPart`
//    only ever read `position`/`normal`/`color` - the index was silently dropped, so the
//    reconstructed geometry on the main thread treated every 3 consecutive *vertices* as a
//    triangle instead of following the real index, producing wrong connectivity wherever vertices
//    are shared between triangles. Verified below with a two-triangle quad that reuses vertices.

const RELS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`

const MODEL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="1" y="0" z="0"/>
          <vertex x="0" y="1" z="0"/>
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2"/>
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" transform="1 0 0 0 1 0 0 0 1 5 0 0"/>
  </build>
</model>`

const MIRRORED_MODEL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="1" y="0" z="0"/>
          <vertex x="0" y="1" z="0"/>
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2"/>
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1" transform="-1 0 0 0 1 0 0 0 1 0 0 0"/>
  </build>
</model>`

const QUAD_MODEL_XML = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <resources>
    <object id="1" type="model">
      <mesh>
        <vertices>
          <vertex x="0" y="0" z="0"/>
          <vertex x="1" y="0" z="0"/>
          <vertex x="1" y="1" z="0"/>
          <vertex x="0" y="1" z="0"/>
        </vertices>
        <triangles>
          <triangle v1="0" v2="1" v3="2"/>
          <triangle v1="0" v2="2" v3="3"/>
        </triangles>
      </mesh>
    </object>
  </resources>
  <build>
    <item objectid="1"/>
  </build>
</model>`

function zip3mf(modelXml: string): ArrayBuffer {
  const zipped = zipSync({
    '_rels/.rels': strToU8(RELS_XML),
    '3D/3dmodel.model': strToU8(modelXml)
  })
  return zipped.buffer.slice(zipped.byteOffset, zipped.byteOffset + zipped.byteLength) as ArrayBuffer
}

function buildMinimal3mf(): ArrayBuffer {
  return zip3mf(MODEL_XML)
}

describe('modelParser.worker 3MF handling', () => {
  const originalDOMParser = globalThis.DOMParser

  beforeEach(async () => {
    // @ts-expect-error - simulating the real Worker global scope, where DOMParser doesn't exist
    delete globalThis.DOMParser
    const { DOMParser } = await import('linkedom/worker')
    globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser
  })

  afterEach(() => {
    globalThis.DOMParser = originalDOMParser
  })

  it('parses a minimal 3MF archive into a mesh without a native DOMParser available', async () => {
    const { extractPartsFromObject } = await import('./modelParser.worker')
    const buffer = buildMinimal3mf()

    const group = new ThreeMFLoader().parse(buffer)
    const parts = extractPartsFromObject(group)

    expect(parts).toHaveLength(1)
    expect(parts[0].position).toHaveLength(9)
  })

  it("bakes a build item's transform into the extracted geometry instead of dropping it", async () => {
    const { extractPartsFromObject } = await import('./modelParser.worker')
    const buffer = buildMinimal3mf()

    const group = new ThreeMFLoader().parse(buffer)
    const parts = extractPartsFromObject(group)

    // Untransformed vertices are (0,0,0),(1,0,0),(0,1,0); the build item translates by (5,0,0).
    const [x0, y0, z0, x1, y1, z1, x2, y2, z2] = parts[0].position
    expect([x0, y0, z0]).toEqual([5, 0, 0])
    expect([x1, y1, z1]).toEqual([6, 0, 0])
    expect([x2, y2, z2]).toEqual([5, 1, 0])
  })

  it('preserves the triangle index instead of flattening to one triangle per 3 vertices', async () => {
    const { extractPartsFromObject } = await import('./modelParser.worker')
    const buffer = zip3mf(QUAD_MODEL_XML)

    const group = new ThreeMFLoader().parse(buffer)
    const parts = extractPartsFromObject(group)

    // 4 unique vertices, not 6 (which is what a de-indexed/flattened 2-triangle mesh would have).
    expect(parts[0].position).toHaveLength(12)
    expect(parts[0].index).not.toBeNull()
    expect(Array.from(parts[0].index ?? [])).toEqual([0, 1, 2, 0, 2, 3])
  })

  // Regression test for issue #36: a build item with a mirrored transform (negative-determinant
  // matrixWorld, e.g. a -1 scale on one axis) had its vertex positions correctly flipped by
  // applyMatrix4, but kept its original triangle winding order - three.js's own compensation for
  // mirrored geometry only kicks in for a mirror baked into the *mesh's* transform, not one baked
  // into the geometry ahead of time (see reverseWindingOrder's doc comment in the worker), so the
  // resulting faces got backface-culled and rendered as missing/see-through instead of solid.
  it('reverses triangle winding order for a mirrored (negative-determinant) build-item transform', async () => {
    const { extractPartsFromObject } = await import('./modelParser.worker')
    const buffer = zip3mf(MIRRORED_MODEL_XML)

    const group = new ThreeMFLoader().parse(buffer)
    const parts = extractPartsFromObject(group)

    // Positions mirror across x as expected: (0,0,0),(1,0,0),(0,1,0) -> (0,0,0),(-1,0,0),(0,1,0).
    const [x0, y0, z0, x1, y1, z1, x2, y2, z2] = parts[0].position
    expect([x0, y0, z0]).toEqual([0, 0, 0])
    expect([x1, y1, z1]).toEqual([-1, 0, 0])
    expect([x2, y2, z2]).toEqual([0, 1, 0])

    // Winding order (0,1,2) must be reversed to (0,2,1) to compensate for the mirror.
    expect(Array.from(parts[0].index ?? [])).toEqual([0, 2, 1])
  })
})
