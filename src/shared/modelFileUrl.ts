export const MODEL_FILE_SCHEME = 'stl-file'

/**
 * The host segment must not be purely numeric: Chromium's URL parser treats an
 * all-digit host on a "standard" scheme as an IPv4 address and silently rewrites it
 * (e.g. `3812` -> `0.0.14.228`), which breaks the id-based lookup on the main-process
 * side. Prefixing with a letter keeps it a normal opaque hostname.
 */
function hostFor(fileId: number): string {
  return `f${fileId}`
}

/** Builds a URL three.js loaders can `fetch()` for a given library file, served by the main-process protocol handler. */
export function modelFileUrl(fileId: number, filename: string): string {
  return `${MODEL_FILE_SCHEME}://${hostFor(fileId)}/${encodeURIComponent(filename)}`
}

/** Builds a URL an <img> can load for a file's cached thumbnail, served by the same protocol handler. */
export function modelThumbnailUrl(fileId: number): string {
  return `${MODEL_FILE_SCHEME}://${hostFor(fileId)}/thumb.png`
}
