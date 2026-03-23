/// <reference types="vite/client" />

import type { ScreenSaverApi } from '../../preload';

declare global {
  interface Window {
    screenSaver: ScreenSaverApi;
  }
}
