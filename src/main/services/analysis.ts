import type { AnalysisOptions, AnalysisResult, StructuredScreenContext } from '../../shared/types';
import { getActiveWindowInfo } from './activeWindow';
import { capturePrimaryScreen } from './screenCapture';
import { explainWithGemini, generateTemplateWithGemini } from './gemini';
import { matchTemplate, saveGeneratedTemplate } from './templates';
import { processScreenshotForAnalysis, selectRegionForPhase } from './imageProcessing';
import { runLocalOcr } from './ocr';
import { redactSensitiveText } from './privacy';
import { loadSettings, saveAnalysisResult } from './storage';

export async function analyzeScreen(options: AnalysisOptions): Promise<AnalysisResult> {
  const timings: Record<string, number> = {};
  const startedAt = performance.now();

  const captureStart = performance.now();
  const capture = await capturePrimaryScreen();
  timings.captureMs = Math.round(performance.now() - captureStart);

  const imageStart = performance.now();
  let imageProcessing = await processScreenshotForAnalysis(capture.screenshotPath, capture.capturedAt);
  timings.imageProcessingMs = Math.round(performance.now() - imageStart);

  const activeStart = performance.now();
  const activeWindow = await getActiveWindowInfo();
  timings.activeWindowMs = Math.round(performance.now() - activeStart);

  const ocrStart = performance.now();
  const ocr = await runLocalOcr(imageProcessing.preprocessedPath);
  timings.ocrMs = Math.round(performance.now() - ocrStart);

  const privacyStart = performance.now();
  const privacy = redactSensitiveText(ocr.text);
  timings.privacyMs = Math.round(performance.now() - privacyStart);

  const templateStart = performance.now();
  let templateMatch = await matchTemplate(activeWindow, privacy);
  timings.templateMs = Math.round(performance.now() - templateStart);

  let context: StructuredScreenContext = {
    capture: {
      screenshotPath: capture.screenshotPath,
      width: capture.width,
      height: capture.height,
      capturedAt: capture.capturedAt
    },
    imageProcessing,
    activeWindow,
    ocr,
    privacy,
    templateMatch
  };

  const settings = await loadSettings();
  const shouldUseGemini = options.useGemini && settings.useGemini && Boolean(settings.geminiApiKey);

  if (
    shouldUseGemini &&
    settings.autoGenerateTemplates &&
    (templateMatch.phase === 'unknown' || templateMatch.confidence < 0.2)
  ) {
    const generateTemplateStart = performance.now();
    const generated = await generateTemplateWithGemini(context, {
      apiKey: settings.geminiApiKey,
      model: settings.geminiModel
    });
    if (generated) {
      await saveGeneratedTemplate(generated);
      templateMatch = await matchTemplate(activeWindow, privacy);
      context = { ...context, templateMatch };
    }
    timings.templateGenerationMs = Math.round(performance.now() - generateTemplateStart);
  }

  imageProcessing = selectRegionForPhase(imageProcessing, templateMatch.phase);
  context = { ...context, imageProcessing };

  let summary = createLocalSummary(context, options.question);
  let source: AnalysisResult['source'] = 'local';
  let geminiPayloadPreview: AnalysisResult['geminiPayloadPreview'] | undefined;

  if (shouldUseGemini) {
    const geminiStart = performance.now();
    summary = await explainWithGemini(
      context,
      {
        apiKey: settings.geminiApiKey,
        model: settings.geminiModel,
        allowImageUpload: options.allowImageUpload && settings.allowImageUpload
      },
      options.question
    );
    timings.geminiMs = Math.round(performance.now() - geminiStart);
    source = 'gemini';
    geminiPayloadPreview = {
      model: settings.geminiModel,
      textLength: context.privacy.redactedText.length,
      imageIncluded: options.allowImageUpload && settings.allowImageUpload
    };
  }

  timings.totalMs = Math.round(performance.now() - startedAt);

  const result: AnalysisResult = {
    summary,
    source,
    context,
    geminiPayloadPreview,
    timings
  };

  await saveAnalysisResult(result);
  return result;
}

function createLocalSummary(context: StructuredScreenContext, question?: string): string {
  const lines = [
    `I detected ${context.activeWindow.appName || 'an unknown app'}${context.activeWindow.windowTitle ? ` (${context.activeWindow.windowTitle})` : ''}.`,
    context.templateMatch.phase !== 'unknown'
      ? `The screen looks like ${context.templateMatch.app} in the "${context.templateMatch.phase}" state from a ${context.templateMatch.source} template.`
      : 'I could not confidently classify this screen yet.',
    context.imageProcessing.selectedRegion
      ? `For privacy-aware vision requests, I selected the ${context.imageProcessing.selectedRegion.label.toLowerCase()} crop.`
      : 'No optimized image region was selected.',
    context.privacy.redactedText
      ? `Visible text starts with: ${context.privacy.redactedText.slice(0, 360)}${context.privacy.redactedText.length > 360 ? '...' : ''}`
      : context.ocr.warning || 'No OCR text was extracted.',
    context.privacy.redactions.length
      ? `I redacted ${context.privacy.redactions.map((item) => `${item.count} ${item.type}`).join(', ')} before cloud use.`
      : 'No sensitive text patterns were detected by the local filter.'
  ];

  if (question) {
    lines.unshift(`Question: ${question}`);
  }

  return lines.join('\n\n');
}
