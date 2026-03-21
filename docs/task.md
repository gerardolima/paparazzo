# News Screenshot & Translation Tool (Agile Plan)

## Milestone 1: Basic Setup ("Hello World")
- [x] Initialize `package.json` with basic metadata.
- [x] Install Dev Dependencies: `typescript`, `@types/node`, `@biomejs/biome`.
- [x] Configure `tsconfig.json` (nodenext, noEmit).
- [x] Configure Biome.
- [x] Setup NPM Scripts.
- [x] Create `src/bin/index.ts` with "Hello World" logic.
- [x] Create basic `tests/unit/index.spec.ts` to verify the runner.
- [x] Setup GitHub Actions (`.github/workflows/ci.yml`) for PR gating.

## Milestone 2: Capture Printscreens
- [x] Install `playwright`.
- [x] Implement `StorageAdapter` interface and `local-storage.ts`.
- [x] Write `tests/unit/storage.spec.ts` and `tests/unit/screenshotter.spec.ts`.
- [x] Implement `screenshotter.ts` (Playwright launch, capture, save).
- [x] Write `tests/integration/screenshotter.test.ts`.

## Milestone 3: Extract Text into Markdown Files
- [x] Write `tests/unit/extractor.spec.ts` (mocking page evaluation).
- [x] Update Playwright logic to extract `innerText` from the page before closing.
- [x] Save extracted raw text as `output/{date}/translations/{site}.md`.

## Milestone 4: Translate Text to English (using AI)
- [x] Install `@google/generative-ai`.
- [x] Implement `ai-structurer.ts` for vision-based layout analysis and translation.
- [x] Integrate AI step into the orchestrator pipeline.

## Milestone 5: Create the Gallery
- [x] Write `tests/unit/report-generator.spec.ts`.
- [x] Implement `report-generator.ts` to read output dir and generate `index.html`.
- [x] Hook HTML generation into `src/index.ts` after processing.

## Milestone 6: AWS Deployment (CDK + Node 24)
- [x] Implement `S3StorageAdapter`.
- [x] Create `Dockerfile` using `public.ecr.aws/lambda/nodejs:24`.
- [x] Implement unified Lambda handler (`src/bin/lambda.ts`) — single Lambda replaces dual-Lambda + Step Functions.
- [x] Setup AWS CDK App (Stack, S3, EventBridge daily cron → single Lambda).
- [x] Configure GitHub Actions for `cdk deploy`.

