/**
 * Suppresses known dependency-sourced console warnings.
 *
 * This module filters specific deprecation warnings that originate from
 * dependencies (like @react-three/fiber) rather than from this repo's code.
 * These warnings cannot be fixed at the application level because they stem
 * from internal third-party implementations without exposed extension points.
 *
 * See issue #57: THREE.Clock deprecation warning (three.js r183+)
 *
 * Upstream: pmndrs/react-three-fiber#3741 / #3773
 * - THREE.Clock was deprecated in three.js r183 in favor of THREE.Timer
 * - @react-three/fiber still uses Clock internally for Canvas/useFrame timing
 * - Clock instance is created inside r3f's store initialization (before any app code runs)
 * - No public Canvas prop or extension point exists to inject a custom clock
 * - The only fix is @react-three/fiber v10+ (unreleased), which removes the
 *   Clock/Timer concept from the public API entirely (breaking change)
 *
 * This suppression is temporary and scoped narrowly to this one message.
 * Remove once @react-three/fiber v10 stabilizes and is adopted as a dependency.
 */

/**
 * Install console warning filters to suppress known dependency-sourced warnings.
 * Called once at app startup.
 */
export function suppressKnownConsoleWarnings(): void {
  const originalWarn = console.warn;

  console.warn = function (...args: unknown[]) {
    const message = String(args[0] ?? '');

    // Suppress THREE.Clock deprecation warning from @react-three/fiber
    // Pattern: "THREE.Clock: This module has been deprecated. Please use THREE.Timer instead."
    // Emitted by three.js r183+ whenever Clock() constructor is called
    // Upstream tracker: pmndrs/react-three-fiber#3741
    if (message.includes('THREE.Clock: This module has been deprecated')) {
      return;
    }

    // Call original console.warn for all other messages
    originalWarn.apply(console, args);
  };
}
