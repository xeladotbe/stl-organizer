import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { buildTexture } from './useHdriTexture';

// Regression tests for issue #58: "HDRI loading blocks model rendering in live preview".
//
// The real fix is architectural (decoding the HDRI in a Worker instead of on the main thread via
// drei's Suspense-based <Environment> — see hdriParser.worker.ts and the ModelPreview.tsx comment
// above HdriEnvironment for the full story, verified with real timing measurements in the PR).
// `buildTexture` is the one piece of that fix that's plain, WebGL-free logic: reconstructing a
// THREE.DataTexture from the worker's transferred texData, matching what HDRLoader's/EXRLoader's
// own `_applyTexData()` + drei's `useEnvironment()` do for a texture loaded the normal way. Getting
// this wrong would silently break environment lighting even after fixing the blocking bug, so it's
// worth pinning down independently of the (untestable per CLAUDE.md) Canvas/Suspense machinery.
describe('buildTexture', () => {
  it('always sets EquirectangularReflectionMapping, regardless of source format', () => {
    // Required for three's WebGLRenderer to treat this as an environment map at all (see
    // WebGLEnvironments.js's getPMREM/getCube, which both switch on `texture.mapping`) — a plain
    // DataTexture defaults to UVMapping, which would silently light nothing.
    const texture = buildTexture({ width: 4, height: 2, data: new Uint16Array(4 * 2 * 4) });
    expect(texture.mapping).toBe(THREE.EquirectangularReflectionMapping);
  });

  it('reproduces HDRLoader.parse()-shaped texData (flipY: true, no explicit format)', () => {
    const data = new Uint16Array(4 * 2 * 4);
    const texture = buildTexture({
      width: 4,
      height: 2,
      data,
      type: THREE.HalfFloatType,
      colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      flipY: true
    });

    expect(texture.image.width).toBe(4);
    expect(texture.image.height).toBe(2);
    expect(texture.image.data).toBe(data);
    expect(texture.type).toBe(THREE.HalfFloatType);
    expect(texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    expect(texture.flipY).toBe(true);
    expect(texture.generateMipmaps).toBe(false);
    expect(texture.wrapS).toBe(THREE.ClampToEdgeWrapping);
    expect(texture.wrapT).toBe(THREE.ClampToEdgeWrapping);
    // `needsUpdate` is a write-only setter (no getter) that bumps `version` as a side effect —
    // that bump is the only observable proof `needsUpdate = true` was actually set.
    expect(texture.version).toBeGreaterThan(0);
  });

  it('reproduces EXRLoader.parse()-shaped texData (flipY: false, explicit format)', () => {
    const texture = buildTexture({
      width: 4,
      height: 2,
      data: new Float32Array(4 * 2 * 4),
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.LinearSRGBColorSpace,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      flipY: false
    });

    expect(texture.type).toBe(THREE.FloatType);
    expect(texture.format).toBe(THREE.RGBAFormat);
    expect(texture.flipY).toBe(false);
  });
});
