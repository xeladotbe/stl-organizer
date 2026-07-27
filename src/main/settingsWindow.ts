import { BrowserWindow } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';

let settingsWindow: BrowserWindow | null = null;

/** Small standalone window for managing watched folders. Singleton — focuses the existing window instead of opening a second one. */
export function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus();
    return;
  }

  const created = new BrowserWindow({
    width: 480,
    height: 600,
    autoHideMenuBar: true,
    title: 'Watched Folders',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  });
  settingsWindow = created;

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    created.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/settings.html`);
  } else {
    created.loadFile(join(__dirname, '../renderer/settings.html'));
  }

  created.on('closed', () => {
    if (settingsWindow === created) settingsWindow = null;
  });
}
