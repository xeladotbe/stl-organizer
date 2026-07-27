export const HDRI_FILE_SCHEME = 'hdri-file';

const HDRI_FILE_PREFIX = `${HDRI_FILE_SCHEME}://local/`;

/**
 * Builds a URL RGBELoader/EXRLoader (via drei's `<Environment>`) can `fetch()` for an arbitrary
 * local HDRI file the user picked via a native file dialog - it lives outside the watched
 * library, so it can't use the id-based `stl-file://` scheme. The absolute path is opaque-encoded
 * as the whole "path" segment rather than parsed as a real URL path (drive letters/backslashes
 * don't round-trip cleanly through URL parsing otherwise). `<Environment>` sniffs the HDRI format
 * from the URL's trailing `.hdr`/`.exr`, which survives here because `encodeURIComponent` never
 * escapes letters or dots.
 */
export function hdriFileUrl(absolutePath: string): string {
  return `${HDRI_FILE_PREFIX}${encodeURIComponent(absolutePath)}`;
}

/** Inverse of `hdriFileUrl` - recovers the absolute path from a request URL in the main-process protocol handler. */
export function parseHdriFileUrl(url: string): string {
  return decodeURIComponent(url.slice(HDRI_FILE_PREFIX.length));
}
