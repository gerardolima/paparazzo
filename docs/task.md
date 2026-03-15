# News Screenshot & Translation Tool (Agile Plan)

## Milestone 1: Basic Setup ("Hello World")
- [ ] Initialize `package.json` with basic metadata.
- [ ] Install Dev Dependencies: `typescript`, `@types/node`, `@biomejs/biome`.
- [ ] Configure `tsconfig.json` (nodenext, noEmit).
- [ ] Configure Biome.
- [ ] Setup NPM Scripts:
  - `typecheck` (`tsc --noEmit`, watch supported)
  - `linter` (`biome check .`)
  - `format` (`biome format --write .`)
  - `test:unit` (`node --test tests/unit/**/*.spec.ts`)
  - `test:int` (`node --test tests/integration/**/*.test.ts`)
  - `test` (combines unit and int)
  - `test:coverage` (with `--experimental-test-coverage`)
  - `start` (`node src/index.ts`)
- [ ] Create `src/index.ts` with "Hello World" logic.
- [ ] Create basic `tests/unit/index.spec.ts` to verify the runner.
- [ ] Setup GitHub Actions (`.github/workflows/ci.yml`) for PR gating.

## Milestone 2: Capture Printscreens
- [ ] Install `playwright`.
- [ ] Implement `StorageAdapter` interface and `local-storage.ts`.
- [ ] Write `tests/unit/storage.spec.ts` and `tests/unit/screenshotter.spec.ts`.
- [ ] Implement `screenshotter.ts` (Playwright launch, capture, save).
- [ ] Write `tests/integration/screenshotter.test.ts`.

## Milestone 3: Extract Text into Markdown Files
- [ ] Write `tests/unit/extractor.spec.ts` (mocking page evaluation).
- [ ] Update Playwright logic to extract `innerText` from the page before closing.
- [ ] Save extracted raw text as `output/{date}/translations/{site}.md`.

## Milestone 4: Translate Text to English
- [ ] Install `google-translate-api-x`.
- [ ] Write `tests/unit/translator.spec.ts` (mocking translation API).
- [ ] Implement `translator.ts`.
- [ ] Integrate translation step into the orchestrator pipeline.

## Milestone 5: Create the Gallery
- [ ] Write `tests/unit/report-viewer.spec.ts`.
- [ ] Implement `report-viewer.ts` to read output dir and generate `index.html`.
- [ ] Hook HTML generation into `src/index.ts` after processing.

## Milestone 6: Send the Email
- [ ] Install `nodemailer` and `@types/nodemailer`.
- [ ] Write `tests/unit/notifier.spec.ts`.
- [ ] Implement `notifier.ts` (SMTP setup via env vars).
- [ ] Update CI and local orchestrator to trigger email (with `--no-email` flag for dev).
