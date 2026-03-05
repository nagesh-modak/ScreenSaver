import type { ActiveWindowInfo, PrivacyReport, TemplateMatch } from '../../shared/types';
import { getDatabase, persistDatabase } from './database';

export interface TemplateRule {
  app: string;
  phase: TemplateMatch['phase'];
  appSignals: string[];
  textSignals: string[];
  source: TemplateMatch['source'];
}

const templateRules: TemplateRule[] = [
  {
    app: 'WhatsApp Web',
    phase: 'chat_open',
    appSignals: ['chrome', 'safari', 'arc', 'brave', 'edge'],
    textSignals: ['message', 'search', 'type a message', 'online'],
    source: 'builtin'
  },
  {
    app: 'WhatsApp Web',
    phase: 'login',
    appSignals: ['chrome', 'safari', 'arc', 'brave', 'edge'],
    textSignals: ['use whatsapp on your computer', 'qr code', 'linked devices'],
    source: 'builtin'
  },
  {
    app: 'Gmail',
    phase: 'email_inbox',
    appSignals: ['chrome', 'safari', 'arc', 'brave', 'edge'],
    textSignals: ['inbox', 'compose', 'primary', 'promotions'],
    source: 'builtin'
  },
  {
    app: 'Gmail',
    phase: 'email_open',
    appSignals: ['chrome', 'safari', 'arc', 'brave', 'edge'],
    textSignals: ['reply', 'forward', 'to me', 'archive'],
    source: 'builtin'
  },
  {
    app: 'Code Editor',
    phase: 'code_editor',
    appSignals: ['visual studio code', 'cursor', 'xcode'],
    textSignals: ['function', 'const', 'import', 'error', 'terminal'],
    source: 'builtin'
  },
  {
    app: 'Terminal',
    phase: 'terminal',
    appSignals: ['terminal', 'iterm'],
    textSignals: ['error', 'npm', 'git', 'zsh', 'bash'],
    source: 'builtin'
  }
];

export async function matchTemplate(
  activeWindow: ActiveWindowInfo,
  privacy: PrivacyReport
): Promise<TemplateMatch> {
  const rules = [...templateRules, ...(await loadStoredTemplates())];
  const haystack = `${activeWindow.appName} ${activeWindow.windowTitle} ${privacy.redactedText}`.toLowerCase();
  const appHaystack = `${activeWindow.appName} ${activeWindow.windowTitle}`.toLowerCase();

  const scored = rules.map((rule) => {
    const matchedSignals = [
      ...rule.appSignals.filter((signal) => appHaystack.includes(signal)),
      ...rule.textSignals.filter((signal) => haystack.includes(signal))
    ];
    const confidence = matchedSignals.length / (rule.appSignals.length + rule.textSignals.length);
    return { rule, matchedSignals, confidence };
  });

  const best = scored.sort((a, b) => b.confidence - a.confidence)[0];

  if (!best || best.confidence === 0) {
    return {
      app: activeWindow.appName || 'Unknown',
      phase: 'unknown',
      confidence: 0,
      matchedSignals: [],
      source: 'builtin'
    };
  }

  return {
    app: best.rule.app,
    phase: best.rule.phase,
    confidence: Number(best.confidence.toFixed(2)),
    matchedSignals: best.matchedSignals,
    source: best.rule.source
  };
}

export async function saveGeneratedTemplate(rule: Omit<TemplateRule, 'source'>): Promise<void> {
  const appSignals = normalizeSignals(rule.appSignals);
  const textSignals = normalizeSignals(rule.textSignals);

  if (!rule.app || !rule.phase || (!appSignals.length && !textSignals.length)) {
    return;
  }

  const db = await getDatabase();
  db.run(
    `INSERT OR REPLACE INTO templates
      (app, phase, app_signals, text_signals, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    [
      rule.app,
      rule.phase,
      JSON.stringify(appSignals),
      JSON.stringify(textSignals),
      'generated',
      new Date().toISOString()
    ]
  );
  await persistDatabase(db);
}

async function loadStoredTemplates(): Promise<TemplateRule[]> {
  const db = await getDatabase();
  const rows = db.exec('SELECT app, phase, app_signals, text_signals, source FROM templates');
  return (rows[0]?.values ?? []).flatMap((row: unknown[]) => {
    const [app, phase, appSignals, textSignals, source] = row;
    if (
      typeof app !== 'string' ||
      typeof phase !== 'string' ||
      typeof appSignals !== 'string' ||
      typeof textSignals !== 'string' ||
      typeof source !== 'string'
    ) {
      return [];
    }

    return [
      {
        app,
        phase: phase as TemplateMatch['phase'],
        appSignals: normalizeSignals(JSON.parse(appSignals)),
        textSignals: normalizeSignals(JSON.parse(textSignals)),
        source: source === 'generated' ? 'generated' : 'sqlite'
      }
    ];
  });
}

function normalizeSignals(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
        .slice(0, 12)
    : [];
}
