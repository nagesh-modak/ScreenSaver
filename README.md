# ScreenSaver

ScreenSaver is a local-first AI screen assistant. It appears with a global shortcut, captures the current screen locally, extracts screen context with OCR, filters sensitive text, optionally asks Gemini for an explanation, and shows the result in a floating assistant panel.

## Architecture

```txt
Hotkey
→ Electron assistant window
→ local screen capture
→ local screenshot storage
→ image preprocessing + region crop generation
→ local OCR adapter
→ active app/window detection
→ privacy redaction
→ SQLite-backed template matching
→ optional Gemini reasoning/template generation
→ assistant response + debug metrics
```

## Setup

```bash
npm install
npm run dev
```

On macOS, grant Screen Recording permission when prompted. Active-window detection also needs Accessibility permission for the app/terminal launching it.

## Gemini

Gemini is optional. Open settings in the assistant, add your API key, and enable `Use Gemini`.

By default, ScreenSaver sends only filtered OCR/context. Enable `Allow image upload` only when you want Gemini vision to receive an optimized cropped region. Full screenshots remain local unless future code explicitly changes that behavior.

Enable `Auto-learn templates` to let Gemini generate reusable UI-matching templates when local matching is uncertain. Generated templates are cached locally in SQLite.

## Local OCR

The OCR adapter uses the `tesseract` CLI when available:

```bash
brew install tesseract
```

If Tesseract is missing on macOS, ScreenSaver falls back to Apple Vision OCR through the local Swift runtime when available.

## Local Storage

ScreenSaver stores local state under Electron's user data directory in `screensaver-data`:

- `screenshots/`: original local screenshots
- `processed/`: OCR-enhanced images and region crops
- `screensaver.sqlite`: settings, analysis index, and generated templates
- `history/`: readable JSON snapshots of analysis results

## Quality Testing

Use the debug strip at the bottom of the assistant to inspect:

- source: local or Gemini
- active app
- detected screen phase
- OCR engine
- selected crop
- template source
- redactions
- total latency
