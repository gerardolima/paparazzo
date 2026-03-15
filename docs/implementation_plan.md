# News Screenshot & Translation Tool

An automated TypeScript (Node.js) tool to capture daily full-page screenshots of ~40 news websites, translate content to English, generate a browseable HTML gallery, and send an email notification.

---

## Part 1: Architecture & Key Decisions

This section outlines the final technical decisions that guide the project.

| Decision | Choice | Rationale |
|---|---|---|
| **Language** | TypeScript (Node.js 24) | Native TS execution (via `--strip-types` or `nodenext`), no build step required. Best ecosystem for browser automation. |
| **Testing** | Node 24 native (`node:test`) | Zero extra dependencies. Built-in mocking, assertions, and coverage (`--experimental-test-coverage`). |
| **Linting/Types** | Biome + `tsc` | Fast formatting and linting with Biome. Native type-checking with `tsc`. |
| **Methodology** | Agile / TDD | Milestone-driven incremental delivery. Tests (`*.spec.ts` for unit, `*.test.ts` for integration) are written before implementation. |
| **CI/CD** | GitHub Actions | Feature-branch development. Main branch is protected. Feature branches must be merged into main via PR flow. Enforces typecheck, linting, and tests (with ≥80% coverage) on every PR. |
| **Browser Runner** | Playwright | Robust full-page capturing and text extraction. Introduced only in Milestone 2. |
| **Translation** | `google-translate-api-x` | Unofficial but free Google Translate endpoint. Markdown output prevents complex CSS/DOM manipulation. |
| **Email** | Nodemailer | Standard SMTP client for the final notification. |
| **Cloud Adapter** | `StorageAdapter` | An interface abstracting file system operations. Starts with local disk, allowing seamless migration to GCS/S3 later. |
| **Deployment** | Local POC first | Prove the logic locally with macOS `cron`. Cloud deployment (GCP Cloud Run or AWS Lambda) is deferred to a future phase. |

---

## Part 2: Project Plan (Agile Milestones)

The project is built incrementally. Each milestone delivers a working, testable feature. **Dependencies are only imported and installed when their specific milestone begins.**

### Milestone 1: Basic Setup & Project Skeleton
**Goal**: The most basic working version. Implements a "Hello World" orchestrator, establishes the testing/linting baseline, and ensures all npm scripts work perfectly (including `--watch` modes).

- **New Dependencies**: `typescript`, `eslint`, `@types/node`, `@typescript-eslint/*` (Dev only).
- **Features**:
  - `package.json` with scripts: `start`, `typecheck`, `linter`, `test:unit`, `test:int`, `test`, `test:coverage`.
  - Minimal `tsconfig.json` and Biome config (`biome.json`).
  - Basic `src/index.ts` executing a "Hello World" log.
  - Setup GitHub Actions CI pipeline (`.github/workflows/ci.yml`).

### Milestone 2: Capture Printscreens
**Goal**: Visit target sites, handle timeouts/retries, and save full-page images locally.

- **New Dependencies**: `playwright`
- **Features**:
  - Implement `StorageAdapter` (local file system implementation).
  - Implement `screenshotter.ts`.
  - Auto-dismiss common cookie banners.
  - Integration test capturing a real webpage.

### Milestone 3: Extract Text into Markdown Files
**Goal**: Pull visible text from the page before translating, saving the original text as a Markdown document.

- **New Dependencies**: None.
- **Features**:
  - Uses Playwright's `page.evaluate()` to extract visible `innerText`.
  - Formats the raw text into a daily Markdown file alongside the screenshot.
  - Unit tests mocking the page content.

### Milestone 4: Translate Text to English
**Goal**: Pass the extracted text through the translation API and update the Markdown files with English content.

- **New Dependencies**: `google-translate-api-x`
- **Features**:
  - Implement `translator.ts`.
  - Detect original language and append translated headlines/body to the Markdown output.
  - Unit tests mocking the translation API response.

### Milestone 5: Create the Gallery (Browsing Contents)
**Goal**: Generate a static, browseable HTML report for the day's execution.

- **New Dependencies**: None.
- **Features**:
  - Implement `report-viewer.ts`.
  - Generates `output/{date}/index.html` with a grid of thumbnails.
  - Links to full screenshots and translated Markdown files.
  - Minimal inline CSS for standalone viewing.

### Milestone 6: Send the Email Notification
**Goal**: Conclude the daily run by emailing a summary and a link to the gallery.

- **New Dependencies**: `nodemailer`, `@types/nodemailer`
- **Features**:
  - Implement `notifier.ts`.
  - Connect via SMTP using environment variables.
  - Email contains success/failure counts and the link to the generated gallery.

---

## User Review Required

> [!IMPORTANT]
> The plan is now structured as an Agile project with clear, sequential milestones. Dependencies are strictly deferred until needed. Please review this approach. If approved, we will begin executing Milestone 1.
