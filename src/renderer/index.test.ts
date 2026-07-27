import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

describe('renderer index.html', () => {
  it('sets a real app name as the window title, not the electron-vite default', () => {
    const html = readFileSync(join(__dirname, 'index.html'), 'utf-8');
    const match = html.match(/<title>(.*?)<\/title>/);

    expect(match?.[1]).toBe('STL Organizer');
  });
});
