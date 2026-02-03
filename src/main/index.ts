import { app, BrowserWindow, globalShortcut, ipcMain, screen, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeScreen } from './services/analysis';
import { loadSettings, saveSettings } from './services/storage';
import type { AnalysisOptions, AppSettings } from '../shared/types';
import { getScreenPermissionStatus } from './services/screenCapture';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let assistantWindow: BrowserWindow | null = null;

function createAssistantWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const width = 500;
  const height = 680;
  const x = Math.round(display.workArea.x + display.workArea.width / 2 + 90);
  const y = Math.round(display.workArea.y + (display.workArea.height - height) / 2);

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: 420,
    minHeight: 560,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) {
      win.hide();
    }
  });

  return win;
}

function toggleAssistant(): void {
  if (!assistantWindow) {
    assistantWindow = createAssistantWindow();
  }

  if (assistantWindow.isVisible()) {
    assistantWindow.hide();
    return;
  }

  assistantWindow.show();
  assistantWindow.focus();
  assistantWindow.webContents.send('assistant:triggered');
}

function registerIpc(): void {
  ipcMain.handle('screen:analyze', (_event, options: AnalysisOptions) => analyzeScreen(options));
  ipcMain.handle('permissions:status', () => getScreenPermissionStatus());
  ipcMain.handle('permissions:openScreenRecording', () =>
    shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')
  );
  ipcMain.handle('settings:load', () => loadSettings());
  ipcMain.handle('settings:save', (_event, settings: AppSettings) => saveSettings(settings));
  ipcMain.handle('window:hide', () => assistantWindow?.hide());
}

app.whenReady().then(() => {
  registerIpc();
  assistantWindow = createAssistantWindow();

  const registered =
    globalShortcut.register('Alt+Space', toggleAssistant) ||
    globalShortcut.register('CommandOrControl+Shift+Space', toggleAssistant);

  if (!registered) {
    assistantWindow.webContents.once('did-finish-load', () => {
      assistantWindow?.show();
      assistantWindow?.webContents.send(
        'assistant:error',
        'Could not register global shortcut. Open the app manually and try Command/Ctrl+Shift+Space.'
      );
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      assistantWindow = createAssistantWindow();
    }
    toggleAssistant();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
