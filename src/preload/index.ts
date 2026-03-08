import { contextBridge, ipcRenderer } from 'electron';
import type { AnalysisOptions, AnalysisResult, AppSettings, PermissionStatus } from '../shared/types';

const api = {
  analyzeScreen: (options: AnalysisOptions): Promise<AnalysisResult> =>
    ipcRenderer.invoke('screen:analyze', options),
  getPermissionStatus: (): Promise<PermissionStatus> => ipcRenderer.invoke('permissions:status'),
  openScreenRecordingSettings: (): Promise<void> =>
    ipcRenderer.invoke('permissions:openScreenRecording'),
  loadSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: AppSettings): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:save', settings),
  hideWindow: (): Promise<void> => ipcRenderer.invoke('window:hide'),
  onTriggered: (callback: () => void): (() => void) => {
    ipcRenderer.on('assistant:triggered', callback);
    return () => ipcRenderer.removeListener('assistant:triggered', callback);
  },
  onError: (callback: (_event: unknown, message: string) => void): (() => void) => {
    ipcRenderer.on('assistant:error', callback);
    return () => ipcRenderer.removeListener('assistant:error', callback);
  }
};

contextBridge.exposeInMainWorld('screenSaver', api);

export type ScreenSaverApi = typeof api;
