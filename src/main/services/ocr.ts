import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { OcrResult } from '../../shared/types';
import { ensureDataDir } from './storage';

const execFileAsync = promisify(execFile);

export async function runLocalOcr(imagePath: string): Promise<OcrResult> {
  try {
    const { stdout } = await execFileAsync(
      'tesseract',
      [imagePath, 'stdout', '--psm', '6'],
      { timeout: 15000, maxBuffer: 8 * 1024 * 1024 }
    );

    return {
      text: stdout.trim(),
      engine: 'tesseract-cli'
    };
  } catch {
    const appleVision = await runAppleVisionOcr(imagePath);
    if (appleVision) {
      return appleVision;
    }

    return {
      text: '',
      engine: 'mock',
      warning:
        'Tesseract and Apple Vision OCR fallback were unavailable. Install Tesseract or Xcode Command Line Tools to enable local OCR extraction.'
    };
  }
}

async function runAppleVisionOcr(imagePath: string): Promise<OcrResult | null> {
  if (process.platform !== 'darwin') {
    return null;
  }

  try {
    const dataDir = await ensureDataDir();
    const scriptPath = path.join(dataDir, 'apple-vision-ocr.swift');
    await writeFile(scriptPath, appleVisionScript, 'utf8');
    const { stdout } = await execFileAsync('swift', [scriptPath, imagePath], {
      timeout: 20000,
      maxBuffer: 8 * 1024 * 1024
    });

    return {
      text: stdout.trim(),
      engine: 'apple-vision'
    };
  } catch {
    return null;
  }
}

const appleVisionScript = `
import AppKit
import Foundation
import Vision

let arguments = CommandLine.arguments
guard arguments.count > 1 else {
  exit(1)
}

let imageUrl = URL(fileURLWithPath: arguments[1])
guard
  let image = NSImage(contentsOf: imageUrl),
  let tiff = image.tiffRepresentation,
  let bitmap = NSBitmapImageRep(data: tiff),
  let cgImage = bitmap.cgImage
else {
  exit(1)
}

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true

let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
try handler.perform([request])

let lines = request.results?.compactMap { observation in
  observation.topCandidates(1).first?.string
} ?? []

print(lines.joined(separator: "\\n"))
`;
