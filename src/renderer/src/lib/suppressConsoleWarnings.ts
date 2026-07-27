/**
 * Suppresses known dependency-sourced console warnings.
 *
 * This module filters specific deprecation warnings that originate from
 * dependencies (like @react-three/fiber) rather than from this repo's code.
 * These warnings can typically be resolved only via dependency updates.
 *
 * See issue #57: THREE.Clock deprecation warning (three.js r183+)
 * - THREE.Clock was deprecated in three.js r183 in favor of THREE.Timer
 * - @react-three/fiber still uses Clock internally for Canvas/useFrame timing
 * - Will be resolved once @react-three/fiber upgrades to use THREE.Timer
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
    // Emitted by three.js whenever Clock() constructor is called (r183+)
    if (message.includes('THREE.Clock: This module has been deprecated')) {
      return;
    }

    // Call original console.warn for all other messages
    originalWarn.apply(console, args);
  };
}
