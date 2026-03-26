export type ScreenPhase =
  | 'unknown'
  | 'browser_page'
  | 'chat_open'
  | 'chat_list'
  | 'login'
  | 'code_editor'
  | 'terminal'
  | 'email_inbox'
  | 'email_open'
  | 'document';

export interface ActiveWindowInfo {
  appName: string;
  windowTitle: string;
  bundleId?: string;
}

export interface CaptureResult {
  screenshotPath: string;
  dataUrl: string;
  width: number;
  height: number;
  capturedAt: string;
}

export interface ImageRegion {
  id: 'full' | 'left_sidebar' | 'main_content' | 'bottom_input' | 'center_focus';
  label: string;
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  reason: string;
}

export interface ImageProcessingResult {
  preprocessedPath: string;
  regions: ImageRegion[];
  selectedRegion?: ImageRegion;
  notes: string[];
}

export interface OcrResult {
  text: string;
  engine: 'tesseract-cli' | 'apple-vision' | 'mock';
  confidence?: number;
  warning?: string;
}

export interface PrivacyReport {
  redactedText: string;
  redactions: Array<{
    type: 'email' | 'phone' | 'otp' | 'credit_card' | 'api_key' | 'url_token';
    count: number;
  }>;
}

export interface TemplateMatch {
  app: string;
  phase: ScreenPhase;
  confidence: number;
  matchedSignals: string[];
  source: 'builtin' | 'sqlite' | 'generated';
}

export interface StructuredScreenContext {
  capture: Omit<CaptureResult, 'dataUrl'>;
  imageProcessing: ImageProcessingResult;
  activeWindow: ActiveWindowInfo;
  ocr: OcrResult;
  privacy: PrivacyReport;
  templateMatch: TemplateMatch;
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  allowImageUpload: boolean;
}

export interface AnalysisOptions {
  question?: string;
  useGemini: boolean;
  allowImageUpload: boolean;
}

export interface AnalysisResult {
  summary: string;
  source: 'local' | 'gemini';
  context: StructuredScreenContext;
  geminiPayloadPreview?: {
    model: string;
    textLength: number;
    imageIncluded: boolean;
  };
  timings: Record<string, number>;
}

export interface AppSettings {
  geminiApiKey: string;
  geminiModel: string;
  useGemini: boolean;
  allowImageUpload: boolean;
  autoGenerateTemplates: boolean;
}

export interface PermissionStatus {
  screen: 'not-determined' | 'granted' | 'denied' | 'restricted' | 'unknown';
  platform: NodeJS.Platform;
}
