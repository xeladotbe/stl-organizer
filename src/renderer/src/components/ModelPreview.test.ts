import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PREVIEW_WIDTH,
  PREVIEW_ASPECT_RATIO,
  calculatePreviewHeight
} from '../lib/previewDimensions';

describe('ModelPreview width scaling', () => {
  describe('calculatePreviewHeight', () => {
    it('should calculate height based on width maintaining aspect ratio', () => {
      const width = DEFAULT_PREVIEW_WIDTH;
      const height = calculatePreviewHeight(width);
      // With padding removed: (288 - 24) / (288/256) = 264 / 1.125 = 235
      const expectedWidth = Math.max(width - 24, 100);
      const expectedHeight = Math.round(expectedWidth / PREVIEW_ASPECT_RATIO);
      expect(height).toBe(expectedHeight);
    });

    it('should scale height proportionally when width increases', () => {
      const defaultHeight = calculatePreviewHeight(DEFAULT_PREVIEW_WIDTH);
      const largerHeight = calculatePreviewHeight(DEFAULT_PREVIEW_WIDTH + 100);
      expect(largerHeight).toBeGreaterThan(defaultHeight);
    });

    it('should scale height proportionally when width decreases', () => {
      const defaultHeight = calculatePreviewHeight(DEFAULT_PREVIEW_WIDTH);
      const smallerHeight = calculatePreviewHeight(DEFAULT_PREVIEW_WIDTH - 50);
      expect(smallerHeight).toBeLessThan(defaultHeight);
    });

    it('should maintain aspect ratio within reasonable bounds', () => {
      const widths = [200, 250, 300, 350, 400, 500];
      for (const width of widths) {
        const height = calculatePreviewHeight(width);
        const actualWidth = Math.max(width - 24, 100);
        const expectedHeight = actualWidth / PREVIEW_ASPECT_RATIO;
        expect(height).toBe(Math.round(expectedHeight));
      }
    });

    it('should enforce minimum width constraint', () => {
      // Very small width should still result in reasonable height
      const tinyHeight = calculatePreviewHeight(50); // Less than MIN_SIDEBAR_WIDTH
      expect(tinyHeight).toBe(Math.round(100 / PREVIEW_ASPECT_RATIO));
    });

    it('should handle exact default dimensions', () => {
      const height = calculatePreviewHeight(320); // Standard sidebar width
      const expectedHeight = Math.round(296 / PREVIEW_ASPECT_RATIO); // 320 - 24 = 296
      expect(height).toBe(expectedHeight);
    });
  });

  describe('aspect ratio preservation', () => {
    it('should maintain consistent aspect ratio at different widths', () => {
      const widths = [250, 300, 350, 400];
      const ratios = widths.map((w) => {
        const height = calculatePreviewHeight(w);
        const actualWidth = Math.max(w - 24, 100);
        return actualWidth / height;
      });

      // All ratios should be approximately equal (within rounding error)
      const firstRatio = ratios[0];
      for (const ratio of ratios) {
        // Allow small rounding error tolerance
        expect(Math.abs(ratio - firstRatio)).toBeLessThan(0.01);
      }
    });
  });
});
