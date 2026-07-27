export const SIDEBAR_WIDTH_STORAGE_KEY = 'stl-organizer:sidebarWidth';
export const DEFAULT_SIDEBAR_WIDTH = 320; // w-80
export const MIN_SIDEBAR_WIDTH = 200;

export function loadStoredSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (raw) {
      const parsed = Number(raw);
      if (!isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH) return parsed;
    }
  } catch {
    // ignore malformed storage, fall back to default
  }
  return DEFAULT_SIDEBAR_WIDTH;
}
