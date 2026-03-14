import { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  Eye,
  KeyRound,
  Loader2,
  Send,
  Settings,
  ShieldAlert,
  ShieldCheck,
  X
} from 'lucide-react';
import type { AnalysisResult, AppSettings, PermissionStatus } from '../../shared/types';

const defaultSettings: AppSettings = {
  geminiApiKey: '',
  geminiModel: 'gemini-1.5-flash',
  useGemini: false,
  allowImageUpload: false,
  autoGenerateTemplates: false
};

export function App(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [permissions, setPermissions] = useState<PermissionStatus | null>(null);

  useEffect(() => {
    window.screenSaver.loadSettings().then(setSettings).catch(() => undefined);
    refreshPermissions();
    const disposeTrigger = window.screenSaver.onTriggered(() => {
      void runAnalysis();
    });
    const disposeError = window.screenSaver.onError((_event, message) => setError(message));
    return () => {
      disposeTrigger();
      disposeError();
    };
  }, []);

  const redactionLabel = useMemo(() => {
    const redactions = result?.context.privacy.redactions ?? [];
    if (!redactions.length) return 'No redactions';
    return redactions.map((item) => `${item.count} ${item.type}`).join(', ');
  }, [result]);

  async function runAnalysis(customQuestion = question): Promise<void> {
    setLoading(true);
    setError('');
    try {
      await refreshPermissions();
      const analysis = await window.screenSaver.analyzeScreen({
        question: customQuestion.trim() || undefined,
        useGemini: settings.useGemini,
        allowImageUpload: settings.allowImageUpload
      });
      setResult(analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  async function refreshPermissions(): Promise<void> {
    try {
      setPermissions(await window.screenSaver.getPermissionStatus());
    } catch {
      setPermissions(null);
    }
  }

  async function persistSettings(next: AppSettings): Promise<void> {
    setSettings(next);
    const saved = await window.screenSaver.saveSettings(next);
    setSettings(saved);
  }

  return (
    <main className="shell">
      <section className="panel">
        <header className="titlebar">
          <div className="brand">
            <div className="brandMark">
              <Eye size={18} />
            </div>
            <div>
              <h1>ScreenSaver</h1>
              <p>AI screen assistant</p>
            </div>
          </div>
          <div className="windowActions">
            <button className="iconButton" title="Settings" onClick={() => setShowSettings((value) => !value)}>
              <Settings size={18} />
            </button>
            <button className="iconButton" title="Close" onClick={() => window.screenSaver.hideWindow()}>
              <X size={18} />
            </button>
          </div>
        </header>

        {showSettings && (
          <section className="settingsBlock">
            <label className="field">
              <span>Gemini API key</span>
              <input
                type="password"
                value={settings.geminiApiKey}
                placeholder="AIza..."
                onChange={(event) => persistSettings({ ...settings, geminiApiKey: event.target.value })}
              />
            </label>
            <label className="field">
              <span>Gemini model</span>
              <input
                value={settings.geminiModel}
                onChange={(event) => persistSettings({ ...settings, geminiModel: event.target.value })}
              />
            </label>
            <div className="switchGrid">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.useGemini}
                  onChange={(event) => persistSettings({ ...settings, useGemini: event.target.checked })}
                />
                <span>Use Gemini</span>
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.allowImageUpload}
                  onChange={(event) => persistSettings({ ...settings, allowImageUpload: event.target.checked })}
                />
                <span>Allow image upload</span>
              </label>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={settings.autoGenerateTemplates}
                  onChange={(event) =>
                    persistSettings({ ...settings, autoGenerateTemplates: event.target.checked })
                  }
                />
                <span>Auto-learn templates</span>
              </label>
            </div>
          </section>
        )}

        <section className="statusRow">
          <div>
            <KeyRound size={15} />
            <span>Alt + Space</span>
          </div>
          <div>
            <ShieldCheck size={15} />
            <span>{settings.allowImageUpload ? 'Vision upload enabled' : 'OCR-first privacy mode'}</span>
          </div>
        </section>

        {permissions?.platform === 'darwin' && permissions.screen !== 'granted' && (
          <section className="permissionBlock">
            <div className="permissionTitle">
              <ShieldAlert size={18} />
              <strong>Screen Recording permission needed</strong>
            </div>
            <ol>
              <li>Open System Settings.</li>
              <li>Go to Privacy &amp; Security → Screen Recording.</li>
              <li>Enable Terminal, Codex, Electron, or the app that launched ScreenSaver.</li>
              <li>Quit and rerun ScreenSaver after enabling it.</li>
            </ol>
            <div className="permissionActions">
              <button
                type="button"
                onClick={() => window.screenSaver.openScreenRecordingSettings()}
              >
                <ExternalLink size={16} />
                Open Settings
              </button>
              <button type="button" onClick={() => refreshPermissions()}>
                Check Again
              </button>
            </div>
          </section>
        )}

        <section className="answer">
          {loading ? (
            <div className="loadingState">
              <Loader2 size={26} className="spin" />
              <span>Reading your screen...</span>
            </div>
          ) : result ? (
            <pre>{result.summary}</pre>
          ) : (
            <div className="emptyState">
              <Eye size={30} />
              <p>Press the shortcut or ask a question to inspect the current screen.</p>
            </div>
          )}
        </section>

        {error && <div className="errorBox">{error}</div>}

        <form
          className="prompt"
          onSubmit={(event) => {
            event.preventDefault();
            void runAnalysis();
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Ask about the current screen..."
          />
          <button disabled={loading} title="Analyze screen">
            {loading ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
          </button>
        </form>

        {result && (
          <section className="debug">
            <div>
              <span>Source</span>
              <strong>{result.source}</strong>
            </div>
            <div>
              <span>App</span>
              <strong>{result.context.activeWindow.appName}</strong>
            </div>
            <div>
              <span>Phase</span>
              <strong>{result.context.templateMatch.phase}</strong>
            </div>
            <div>
              <span>Template</span>
              <strong>{result.context.templateMatch.source}</strong>
            </div>
            <div>
              <span>OCR</span>
              <strong>{result.context.ocr.engine}</strong>
            </div>
            <div>
              <span>Crop</span>
              <strong>{result.context.imageProcessing.selectedRegion?.id ?? 'none'}</strong>
            </div>
            <div>
              <span>Redaction</span>
              <strong>{redactionLabel}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{result.timings.totalMs}ms</strong>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
