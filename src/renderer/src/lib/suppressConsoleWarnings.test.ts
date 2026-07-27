import { describe, it, expect, beforeEach, vi } from 'vitest';
import { suppressKnownConsoleWarnings } from './suppressConsoleWarnings';

describe('suppressConsoleWarnings', () => {
  let mockOriginalWarn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Create a mock to track calls to the original warn
    mockOriginalWarn = vi.fn();

    // Replace console.warn with mock before suppression is installed
    console.warn = mockOriginalWarn as any;

    // Install suppression, which will wrap the current console.warn
    suppressKnownConsoleWarnings();
  });

  it('suppresses THREE.Clock deprecation warnings', () => {
    const message = 'Clock: This module has been deprecated. Please use THREE.Timer instead.';
    console.warn(message);

    expect(mockOriginalWarn).not.toHaveBeenCalled();
  });

  it('allows other warnings through', () => {
    const message = 'Some other warning message';
    console.warn(message);

    expect(mockOriginalWarn).toHaveBeenCalledWith(message);
  });

  it('suppresses the deprecation warning even with multiple arguments', () => {
    const message = 'Clock: This module has been deprecated. Please use THREE.Timer instead.';
    console.warn(message, 'extra', 'args');

    expect(mockOriginalWarn).not.toHaveBeenCalled();
  });

  it('allows warnings with similar text but not exact deprecation message', () => {
    const message = 'Clock is deprecated';
    console.warn(message);

    expect(mockOriginalWarn).toHaveBeenCalledWith(message);
  });

  it('preserves original console.warn behavior for non-suppressed warnings', () => {
    const message = 'This should be visible';
    console.warn(message);

    expect(mockOriginalWarn).toHaveBeenCalledWith(message);
  });
});
