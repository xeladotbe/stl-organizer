import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { suppressKnownConsoleWarnings } from './suppressConsoleWarnings';

describe('suppressConsoleWarnings', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Create a spy on console.warn before suppression is installed
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Mock implementation - tracks calls but doesn't actually print
    });

    // Install suppression, which will wrap the current console.warn
    suppressKnownConsoleWarnings();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('suppresses THREE.Clock deprecation warnings', () => {
    const message = 'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.';
    console.warn(message);

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('allows other warnings through', () => {
    const message = 'Some other warning message';
    console.warn(message);

    expect(warnSpy).toHaveBeenCalledWith(message);
  });

  it('suppresses the deprecation warning even with multiple arguments', () => {
    const message = 'THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.';
    console.warn(message, 'extra', 'args');

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('allows warnings with similar text but not exact deprecation message', () => {
    const message = 'Clock is deprecated';
    console.warn(message);

    expect(warnSpy).toHaveBeenCalledWith(message);
  });

  it('preserves original console.warn behavior for non-suppressed warnings', () => {
    const message = 'This should be visible';
    console.warn(message);

    expect(warnSpy).toHaveBeenCalledWith(message);
  });
});
