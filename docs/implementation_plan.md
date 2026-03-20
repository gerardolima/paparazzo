# News Screenshot & Translation Tool

An automated TypeScript (Node.js) tool to capture daily full-page screenshots of ~40 news websites, translate content to English, generate a browseable HTML gallery, and send an email notification.

---

## Part 1: Architecture & Key Decisions

This section outlines the final technical decisions that guide the project.

| Decision | Choice | Rationale |
|---|---|---|
| **Language** | TypeScript (Node.js 24) | Native TS execution (via `--strip-types` or `nodenext`), no build step required. Best ecosystem for browser automation. |
| **Testing** | Node 24 native (`node:test`) | Built-in mocking, assertions, and coverage. When writing tests, `it` descriptions MUST NOT use the word "should" (e.g., use `it('returns Hello World')`). |
| **Linting/Types** | Biome + `tsc` | Fast formatting and linting with Biome. Native type-checking with `tsc`. |
| **Methodology** | Agile / TDD | Milestone-driven incremental delivery. Tests (`*.spec.ts` for unit, `*.test.ts` for integration) are written before implementation. |
| **CI/CD** | GitHub Actions | Feature-branch development. Enforces typecheck, linting, and tests (with ≥80% coverage) on every changeset. |
| **Browser Runner** | Playwright | Robust full-page capturing and text extraction. Introduced only in Milestone 2. |
| **Translation** | `google-translate-api-x` | Unofficial but free Google Translate endpoint. Markdown output prevents complex CSS/DOM manipulation. |
| **Email** | Nodemailer | Standard SMTP client for the final notification. |
| **Cloud Adapter** | `StorageAdapter` | An interface abstracting file system operations. Starts with local disk, allowing seamless migration to GCS/S3 later. |
| **Deployment** | Local POC first | Prove the logic locally with macOS `cron`. Cloud deployment (GCP Cloud Run or AWS Lambda) is deferred to a future phase. |
| **Source layout** | `src/bin/` + `src/lib/` | Entrypoints (CLI, Lambda handlers) live in `bin/`; library code (capturer, structurer, report generator, storage, config) lives in `lib/`. |

---

## Part 2: Code management

- Don't make irreversible changes without asking me first.
- Commit often in the feature branches, with small and incremental changes.
- Actively verify code before each commit:
  - Always run typecheck, lint and tests after making changes to the code.
  - Use the feedback accordingly.

### Instructions

#### Before starting work on a new milestone:
1. Create a new branch, based on `main` (e.g., `chore-setup`, `feat-1-capture-printscreens`, ...).
2. Change context to this newly created branch

#### When work on a milestone is completed:
1. Push the feature branch to GitHub.
2. Merge the current branch into master
   - use squash and fast forward only, to ensure a linear and clean git history
   - use a good commit message, that summarizes the changes in the branch
3. Return to the main branch.

### Modes

1. Regular mode (pairing with me)
   - when in this mode, ask for feedback before committing code
2. Autonomous mode (only you)
   - when in this mode, you can make commit code without asking for feedback;
   - the rule "Don't make irreversible changes without asking me first." is very important in this mode;
   - if you commit something wrong, I can always revert it, after manual inspection;
   - this mode is intended for when I'm not available to provide feedback.

---

## Part 3: Project Plan (Agile Milestones)

The project is built incrementally. Each milestone delivers a working, testable feature. **Dependencies are only imported and installed when their specific milestone begins.**

### Milestone 1: Basic Setup & Project Skeleton
**Goal**: The most basic working version. Implements a "Hello World" orchestrator, establishes the testing/linting baseline, and ensures all npm scripts work perfectly (including `--watch` modes).

- **New Dependencies**: `typescript`, `eslint`, `@types/node`, `@typescript-eslint/*` (Dev only).
- **Features**:
  - `package.json` with scripts: `start`, `typecheck`, `linter`, `test:unit`, `test:int`, `test`, `test:coverage`.
  - Minimal `tsconfig.json` and Biome config (`biome.json`).
  - Basic `src/bin/index.ts` executing a "Hello World" log.
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

### Milestone 4: AI-Powered Layout-Aware Extraction & Translation
**Goal**: Use a Multimodal LLM to analyze the screenshot, generating a structured Markdown report that preserves the visual hierarchy of the news and translates the content to English.

- **New Dependencies**: `@google/generative-ai`
- **Features**:
  - `AIStructurer` (`src/lib/ai-structurer.ts`): A service that takes the Screenshot (buffer) as the primary source of truth.
  - Vision Reasoning: AI identifies headlines, priority stories, and sections based on the visual layout.
  - Unified Pass: Performs both layout structuring and English translation in a single pass.
  - Output: Updates `{site}.md` in the current daily folder with high-fidelity structured content.
  - Tests: Integration tests verifying the integrity and quality of the generated Markdown.

### Milestone 5: Create the Gallery (Browsing Contents)
**Goal**: Generate a static, browseable HTML report for the day's execution.

- **New Dependencies**: None.
- **Features**:
  - Implement `src/lib/report-generator.ts`.
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
