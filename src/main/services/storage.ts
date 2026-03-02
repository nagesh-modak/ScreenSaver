import { app } from 'electron';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppSettings, AnalysisResult } from '../../shared/types';
import { getDatabase, persistDatabase } from './database';

const defaultSettings: AppSettings = {
  geminiApiKey: '',
  geminiModel: 'gemini-1.5-flash',
  useGemini: false,
  allowImageUpload: false,
  autoGenerateTemplates: false
};

export function getDataDir(): string {
  return path.join(app.getPath('userData'), 'screensaver-data');
}

export async function ensureDataDir(): Promise<string> {
  const dir = getDataDir();
  await mkdir(path.join(dir, 'screenshots'), { recursive: true });
  await mkdir(path.join(dir, 'history'), { recursive: true });
  return dir;
}

export async function saveSettings(settings: AppSettings): Promise<AppSettings> {
  const dir = await ensureDataDir();
  const merged = { ...defaultSettings, ...settings };
  const db = await getDatabase();
  db.run(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['appSettings', JSON.stringify(merged)]
  );
  await persistDatabase(db);
  await writeFile(path.join(dir, 'settings.json'), JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

export async function loadSettings(): Promise<AppSettings> {
  const dir = await ensureDataDir();
  const db = await getDatabase();
  const rows = db.exec("SELECT value FROM settings WHERE key = 'appSettings' LIMIT 1");
  const dbValue = rows[0]?.values[0]?.[0];
  if (typeof dbValue === 'string') {
    return { ...defaultSettings, ...JSON.parse(dbValue) };
  }

  try {
    const raw = await readFile(path.join(dir, 'settings.json'), 'utf8');
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return saveSettings(defaultSettings);
  }
}

export async function saveAnalysisResult(result: AnalysisResult): Promise<void> {
  const dir = await ensureDataDir();
  const filename = `${result.context.capture.capturedAt.replace(/[:.]/g, '-')}.json`;
  const db = await getDatabase();
  db.run(
    `INSERT INTO analyses (
      captured_at,
      app_name,
      window_title,
      phase,
      source,
      screenshot_path,
      selected_region_path,
      redaction_count,
      total_ms,
      result_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      result.context.capture.capturedAt,
      result.context.activeWindow.appName,
      result.context.activeWindow.windowTitle,
      result.context.templateMatch.phase,
      result.source,
      result.context.capture.screenshotPath,
      result.context.imageProcessing.selectedRegion?.path ?? '',
      result.context.privacy.redactions.reduce((total, item) => total + item.count, 0),
      result.timings.totalMs ?? 0,
      JSON.stringify(result)
    ]
  );
  await persistDatabase(db);
  await writeFile(path.join(dir, 'history', filename), JSON.stringify(result, null, 2), 'utf8');
}
