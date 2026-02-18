import { Jimp } from 'jimp';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { ensureDataDir } from './storage';
import type { ImageProcessingResult, ImageRegion } from '../../shared/types';

interface RegionPlan {
  id: ImageRegion['id'];
  label: string;
  xRatio: number;
  yRatio: number;
  wRatio: number;
  hRatio: number;
  reason: string;
}

const regionPlans: RegionPlan[] = [
  {
    id: 'full',
    label: 'Full screen',
    xRatio: 0,
    yRatio: 0,
    wRatio: 1,
    hRatio: 1,
    reason: 'Baseline full-screen context'
  },
  {
    id: 'left_sidebar',
    label: 'Left sidebar',
    xRatio: 0,
    yRatio: 0,
    wRatio: 0.34,
    hRatio: 1,
    reason: 'Common chat list, inbox, navigation, and file explorer area'
  },
  {
    id: 'main_content',
    label: 'Main content',
    xRatio: 0.28,
    yRatio: 0.08,
    wRatio: 0.72,
    hRatio: 0.84,
    reason: 'Primary reading or work area'
  },
  {
    id: 'bottom_input',
    label: 'Bottom input',
    xRatio: 0.25,
    yRatio: 0.78,
    wRatio: 0.75,
    hRatio: 0.22,
    reason: 'Common message composer, terminal prompt, or form action area'
  },
  {
    id: 'center_focus',
    label: 'Center focus',
    xRatio: 0.18,
    yRatio: 0.16,
    wRatio: 0.64,
    hRatio: 0.68,
    reason: 'Central modal, document, or content focus area'
  }
];

export async function processScreenshotForAnalysis(
  screenshotPath: string,
  capturedAt: string
): Promise<ImageProcessingResult> {
  const dataDir = await ensureDataDir();
  const imageDir = path.join(dataDir, 'processed', capturedAt.replace(/[:.]/g, '-'));
  await mkdir(imageDir, { recursive: true });

  const image = await Jimp.read(screenshotPath);
  const { width, height } = image.bitmap;

  const preprocessedPath = path.join(imageDir, 'preprocessed.png');
  await image
    .clone()
    .greyscale()
    .contrast(0.18)
    .normalize()
    .write(preprocessedPath as `${string}.${string}`);

  const regions: ImageRegion[] = [];
  for (const plan of regionPlans) {
    const crop = getRegionBounds(plan, width, height);
    const regionPath = path.join(imageDir, `${plan.id}.png`);
    await image
      .clone()
      .crop({ x: crop.x, y: crop.y, w: crop.width, h: crop.height })
      .write(regionPath as `${string}.${string}`);
    regions.push({
      id: plan.id,
      label: plan.label,
      path: regionPath,
      x: crop.x,
      y: crop.y,
      width: crop.width,
      height: crop.height,
      reason: plan.reason
    });
  }

  return {
    preprocessedPath,
    regions,
    notes: [
      'Generated greyscale/contrast-normalized OCR image',
      'Generated reusable region crops for privacy-aware vision requests'
    ]
  };
}

export function selectRegionForPhase(
  result: ImageProcessingResult,
  phase: string
): ImageProcessingResult {
  const preferredRegionId =
    phase === 'chat_open' || phase === 'email_open'
      ? 'main_content'
      : phase === 'chat_list' || phase === 'email_inbox'
        ? 'left_sidebar'
        : phase === 'login'
          ? 'center_focus'
          : phase === 'terminal'
            ? 'bottom_input'
            : 'main_content';

  return {
    ...result,
    selectedRegion:
      result.regions.find((region) => region.id === preferredRegionId) ??
      result.regions.find((region) => region.id === 'main_content') ??
      result.regions[0],
    notes: [...result.notes, `Selected ${preferredRegionId} as the best cloud/vision region`]
  };
}

function getRegionBounds(plan: RegionPlan, width: number, height: number) {
  const x = Math.max(0, Math.round(width * plan.xRatio));
  const y = Math.max(0, Math.round(height * plan.yRatio));
  const cropWidth = Math.min(width - x, Math.max(1, Math.round(width * plan.wRatio)));
  const cropHeight = Math.min(height - y, Math.max(1, Math.round(height * plan.hRatio)));
  return { x, y, width: cropWidth, height: cropHeight };
}
