import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ActiveWindowInfo } from '../../shared/types';

const execFileAsync = promisify(execFile);

export async function getActiveWindowInfo(): Promise<ActiveWindowInfo> {
  if (process.platform !== 'darwin') {
    return {
      appName: 'Unknown',
      windowTitle: 'Active window detection is currently implemented for macOS.'
    };
  }

  const script = `
    tell application "System Events"
      set frontApp to first application process whose frontmost is true
      set appName to name of frontApp
      set winTitle to ""
      try
        set winTitle to name of front window of frontApp
      end try
      return appName & "||" & winTitle
    end tell
  `;

  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 2000 });
    const [appName, windowTitle] = stdout.trim().split('||');
    return {
      appName: appName || 'Unknown',
      windowTitle: windowTitle || ''
    };
  } catch {
    return {
      appName: 'Unknown',
      windowTitle: 'Grant Accessibility permission for active-window detection.'
    };
  }
}
