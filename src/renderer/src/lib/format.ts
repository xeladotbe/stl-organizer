export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Formats a timestamp as a combined date+time string using the runtime's locale - in Electron
 * this reflects the OS's regional format settings (e.g. `05.03.2026, 14:07` on a German-region
 * system, `03/05/2026, 02:07 PM` on a US one), the same way the file's date/time would appear in
 * the OS's own file explorer, rather than a format hardcoded by this app.
 *
 * `locale` is only ever passed explicitly by tests, to get a deterministic result regardless of
 * the machine running them - real callers omit it so the environment's own locale decides.
 */
export function formatDateTime(ms: number, locale?: string): string {
  return new Date(ms).toLocaleString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
