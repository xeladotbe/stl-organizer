import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SIDEBAR_WIDTH_STORAGE_KEY,
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  loadStoredSidebarWidth
} from '../lib/sidebarStorage';

describe('DetailPane sidebar width utilities', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('loadStoredSidebarWidth', () => {
    it('should return default width when localStorage is empty', () => {
      expect(loadStoredSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
    });

    it('should return stored width if valid', () => {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '400');
      expect(loadStoredSidebarWidth()).toBe(400);
    });

    it('should return default width if stored value is below minimum', () => {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '150');
      expect(loadStoredSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
    });

    it('should return default width if stored value equals minimum', () => {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(MIN_SIDEBAR_WIDTH));
      expect(loadStoredSidebarWidth()).toBe(MIN_SIDEBAR_WIDTH);
    });

    it('should return default width if stored value is not a number', () => {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, 'invalid');
      expect(loadStoredSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
    });

    it('should return default width if stored value is negative', () => {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '-100');
      expect(loadStoredSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);
    });

    it('should handle localStorage errors gracefully', () => {
      const getItemSpy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Storage error');
      });

      expect(loadStoredSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH);

      getItemSpy.mockRestore();
    });
  });

  describe('sidebar width persistence', () => {
    it('should persist width to localStorage when set', () => {
      const width = 350;
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width));

      expect(loadStoredSidebarWidth()).toBe(width);
      expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe(String(width));
    });

    it('should handle fractional widths', () => {
      const width = 314.5;
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(width));

      expect(loadStoredSidebarWidth()).toBe(314.5);
    });
  });
});
