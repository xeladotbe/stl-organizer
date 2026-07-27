import { describe, expect, it } from 'vitest';
import { hdriFileUrl, parseHdriFileUrl } from './hdriFileUrl';

describe('hdriFileUrl / parseHdriFileUrl', () => {
  it('round-trips a Windows absolute path', () => {
    const path = 'C:\\Users\\alex\\Pictures\\hdris\\studio.hdr';
    expect(parseHdriFileUrl(hdriFileUrl(path))).toBe(path);
  });

  it('round-trips a POSIX absolute path with spaces', () => {
    const path = '/Users/alex/My HDRIs/outdoor scene.exr';
    expect(parseHdriFileUrl(hdriFileUrl(path))).toBe(path);
  });

  it("keeps the real file extension as the URL string's trailing characters", () => {
    // <Environment> (drei) sniffs the HDRI format via `url.split('.').pop()` - the encoded path
    // must still literally end in `.hdr`/`.exr` for that to work.
    expect(hdriFileUrl('C:\\hdris\\studio.hdr')).toMatch(/\.hdr$/);
    expect(hdriFileUrl('/hdris/outdoor.exr')).toMatch(/\.exr$/);
  });
});
