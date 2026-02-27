import { desktopCapturer, screen, systemPreferences } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ensureDataDir } from './storage';
import type { CaptureResult, PermissionStatus } from '../../shared/types';

export function getScreenPermissionStatus(): PermissionStatus {
  return {
    screen:
      process.platform === 'darwin'
        ? systemPreferences.getMediaAccessStatus('screen')
        : 'unknown',
    platform: process.platform
  };
}

export async function capturePrimaryScreen(): Promise<CaptureResult> {
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  const scaleFactor = display.scaleFactor || 1;
  const thumbnailSize = {
    width: Math.round(display.size.width * scaleFactor),
    height: Math.round(display.size.height * scaleFactor)
  };

  let sources: Electron.DesktopCapturerSource[];
  try {
    sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize
    });
  } catch (error) {
    throw new Error(createScreenPermissionMessage(error));
  }

  const source =
    sources.find((item) => item.display_id === String(display.id)) ??
    sources[0];

  if (!source || source.thumbnail.isEmpty()) {
    throw new Error(createScreenPermissionMessage());
  }

  const capturedAt = new Date().toISOString();
  const dir = await ensureDataDir();
  const screenshotPath = path.join(
    dir,
    'screenshots',
    `${capturedAt.replace(/[:.]/g, '-')}.png`
  );
  const png = source.thumbnail.toPNG();
  await writeFile(screenshotPath, png);

  return {
    screenshotPath,
    dataUrl: `data:image/png;base64,${png.toString('base64')}`,
    width: source.thumbnail.getSize().width,
    height: source.thumbnail.getSize().height,
    capturedAt
  };
}

function createScreenPermissionMessage(error?: unknown): string {
  const detail = error instanceof Error ? ` (${error.message})` : '';
  if (process.platform === 'darwin') {
    return [
      `Screen Recording permission is required before ScreenSaver can read your screen${detail}.`,
      'Open System Settings → Privacy & Security → Screen Recording.',
      'Enable permission for the app that launched ScreenSaver, usually Terminal, Codex, Electron, or your IDE.',
      'After enabling it, quit and rerun ScreenSaver.'
    ].join('\n');
  }

  return `Screen capture failed${detail}. Check your operating system screen capture permissions.`;
}
