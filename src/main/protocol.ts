import { protocol } from 'electron';
import { readFile } from 'fs/promises';
import { getFileById } from './db/repositories/filesRepo';
import { MODEL_FILE_SCHEME } from '../shared/modelFileUrl';
import { HDRI_FILE_SCHEME, parseHdriFileUrl } from '../shared/hdriFileUrl';

/** Must run before `app.whenReady()` — Electron requires privileged schemes registered at module
 * load time. Covers both custom schemes this app uses (`stl-file://` for watched library files,
 * `hdri-file://` for user-picked HDRI files). */
export function registerCustomSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: MODEL_FILE_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: true
      }
    },
    {
      scheme: HDRI_FILE_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
        bypassCSP: true
      }
    }
  ]);
}

/** Serves a watched library file's bytes (or its cached thumbnail) to the renderer, keyed by DB id so pages never see filesystem layout. */
export function registerModelFileProtocolHandler(): void {
  protocol.handle(MODEL_FILE_SCHEME, async (request) => {
    const url = new URL(request.url);
    // Host is `f<id>` — see modelFileUrl.ts for why the leading letter matters.
    const id = Number(url.hostname.slice(1));
    const file = Number.isFinite(id) ? getFileById(id) : undefined;
    if (!file) return new Response(null, { status: 404 });

    const wantsThumbnail = url.pathname === '/thumb.png';
    const targetPath = wantsThumbnail ? file.thumbnail_path : file.path;
    if (!targetPath) return new Response(null, { status: 404 });

    try {
      const data = await readFile(targetPath);
      const contentType = wantsThumbnail ? 'image/png' : 'application/octet-stream';
      return new Response(data, { headers: { 'content-type': contentType } });
    } catch (err) {
      console.error(`[protocol] failed to read ${targetPath} for ${request.url}:`, err);
      return new Response(null, { status: 404 });
    }
  });
}

/** Serves an arbitrary local HDRI file (picked via a native file dialog, not part of the watched
 * library) to the renderer, so `<Environment>` can `fetch()` it by URL like any other asset. */
export function registerHdriFileProtocolHandler(): void {
  protocol.handle(HDRI_FILE_SCHEME, async (request) => {
    const absolutePath = parseHdriFileUrl(request.url);

    try {
      const data = await readFile(absolutePath);
      return new Response(data, { headers: { 'content-type': 'application/octet-stream' } });
    } catch (err) {
      console.error(`[protocol] failed to read HDRI ${absolutePath}:`, err);
      return new Response(null, { status: 404 });
    }
  });
}
