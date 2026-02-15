import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFile } from 'node:fs/promises';
import type { GeminiConfig, ScreenPhase, StructuredScreenContext } from '../../shared/types';
import type { TemplateRule } from './templates';

export async function explainWithGemini(
  context: StructuredScreenContext,
  config: GeminiConfig,
  question?: string
): Promise<string> {
  if (!config.apiKey) {
    throw new Error('Gemini API key is missing.');
  }

  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({ model: config.model });
  const prompt = buildPrompt(context, question);

  const parts: Array<string | { inlineData: { data: string; mimeType: string } }> = [prompt];

  if (config.allowImageUpload && context.imageProcessing.selectedRegion?.path) {
    const image = await readFile(context.imageProcessing.selectedRegion.path);
    parts.push({
      inlineData: {
        mimeType: 'image/png',
        data: image.toString('base64')
      }
    });
  }

  const response = await model.generateContent(parts);
  return response.response.text().trim();
}

function buildPrompt(context: StructuredScreenContext, question?: string): string {
  return [
    'You are ScreenSaver, a privacy-conscious screen assistant.',
    'Explain the visible screen using only the provided redacted context.',
    'Do not invent UI elements. If uncertain, say what is uncertain.',
    'Keep the answer concise and useful.',
    '',
    `User question: ${question || 'Tell me what is on my screen.'}`,
    '',
    `Active app: ${context.activeWindow.appName}`,
    `Window title: ${context.activeWindow.windowTitle}`,
    `Detected app/template: ${context.templateMatch.app}`,
    `Detected phase: ${context.templateMatch.phase}`,
    `Template confidence: ${context.templateMatch.confidence}`,
    `Template source: ${context.templateMatch.source}`,
    `Matched signals: ${context.templateMatch.matchedSignals.join(', ') || 'none'}`,
    `Selected image region: ${context.imageProcessing.selectedRegion?.label ?? 'none'}`,
    `Redactions: ${context.privacy.redactions.map((item) => `${item.type}:${item.count}`).join(', ') || 'none'}`,
    '',
    'Redacted OCR text:',
    context.privacy.redactedText || '[No OCR text extracted]'
  ].join('\n');
}

export async function generateTemplateWithGemini(
  context: StructuredScreenContext,
  config: Pick<GeminiConfig, 'apiKey' | 'model'>
): Promise<Omit<TemplateRule, 'source'> | null> {
  if (!config.apiKey) {
    return null;
  }

  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({ model: config.model });
  const prompt = [
    'Create a reusable UI template for matching this screen locally in the future.',
    'Use only redacted OCR text and app/window metadata. Return JSON only.',
    'Allowed phases: unknown, browser_page, chat_open, chat_list, login, code_editor, terminal, email_inbox, email_open, document.',
    '',
    'Schema:',
    '{"app":"string","phase":"allowed_phase","appSignals":["lowercase strings"],"textSignals":["lowercase strings"]}',
    '',
    `Active app: ${context.activeWindow.appName}`,
    `Window title: ${context.activeWindow.windowTitle}`,
    '',
    'Redacted OCR text:',
    context.privacy.redactedText.slice(0, 2500) || '[No OCR text extracted]'
  ].join('\n');

  const response = await model.generateContent(prompt);
  return parseTemplateJson(response.response.text());
}

function parseTemplateJson(raw: string): Omit<TemplateRule, 'source'> | null {
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  if (!json) return null;

  try {
    const parsed = JSON.parse(json) as {
      app?: unknown;
      phase?: unknown;
      appSignals?: unknown;
      textSignals?: unknown;
    };
    if (typeof parsed.app !== 'string' || typeof parsed.phase !== 'string') return null;
    const allowedPhases = new Set<ScreenPhase>([
      'unknown',
      'browser_page',
      'chat_open',
      'chat_list',
      'login',
      'code_editor',
      'terminal',
      'email_inbox',
      'email_open',
      'document'
    ]);
    if (!allowedPhases.has(parsed.phase as ScreenPhase)) return null;

    return {
      app: parsed.app,
      phase: parsed.phase as ScreenPhase,
      appSignals: normalizeSignals(parsed.appSignals),
      textSignals: normalizeSignals(parsed.textSignals)
    };
  } catch {
    return null;
  }
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
