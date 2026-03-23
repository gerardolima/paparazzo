# Paparazzo

Paparazzo is an automated news monitoring tool that captures daily full-page screenshots of 50+ news agency websites across Europe and beyond, uses Google Gemini to extract and translate headlines into English, and produces a browseable HTML report grouped by country.

It runs daily at 08:00 UTC as a scheduled AWS Lambda, but can also run locally for development and ad-hoc captures.

## How it works

```
  ┌──────────────┐    Playwright    ┌──────────────┐   Gemini   ┌───────────────┐
  │  News sites  │ ──screenshot───> │ScreenCapturer│ ──vision──>│  Translated   │
  │  (51 pages)  │                  │              │            │  HTML chunks  │
  └──────────────┘                  └──────┬───────┘            └──────┬────────┘
                                           │                           │
                                           V                           V
                                    ┌──────────────┐           ┌──────────────┐
                                    │   Storage    │◂──────────│   Storage    │
                                    │  (.png)      │           │  (.md)       │
                                    └──────┬───────┘           └──────┬───────┘
                                           │                          │
                                           V                          V
                                    ┌────────────────────────────────────┐
                                    │         ReportGenerator            │
                                    │  (groups by country → index.html)  │
                                    └────────────────────────────────────┘
```

For each enabled site the **ScreenCapturer**:

1. Launches a headless Chromium instance via Playwright
2. Blocks ad/tracking domains (Google Ads, Facebook Pixel, etc.)
3. Dismisses cookie-consent banners using known button selectors
4. Takes a full-page screenshot and saves it as `.png`
5. Sends the screenshot to Google Gemini (vision), which extracts headlines, translates them to English, and returns an HTML fragment
6. Saves the translated content as `.md`

After all sites are processed, the **ReportGenerator** reads the screenshots and extracted text, groups them by country, and writes an `index.html` report.

## Prerequisites

- **Node.js 24+**
- **Playwright Chromium** — installed automatically via `npx playwright install chromium`
- **Google Gemini API key** — get one at [Google AI Studio](https://aistudio.google.com/apikey)
- **AWS account** (only for deployment) — with CDK bootstrapped

## Getting started

```bash
# install dependencies
npm install
npx playwright install chromium

# create .env with your API key
echo 'GOOGLE_GENERATIVE_AI_API_KEY=your-key-here' > .env

# run locally against all enabled sites
npm start
```

Output is written to `out/media/<date>/` with one `.png` + `.md` per site and an `index.html` report.

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Run locally — captures all enabled sites and generates the report |
| `npm test` | Run all tests (unit + integration) |
| `npm run test:unit` | Run unit tests only (`.spec.ts`) |
| `npm run test:int` | Run integration tests only (`.test.ts`) — requires `.env` |
| `npm run test:coverage` | Run tests with coverage reporting |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | Type-check with `tsc --noEmit` |
| `npm run lint` | Lint with Biome |
| `npm run build` | Compile TypeScript to `out/` |

## Project structure

```
src/
  bin/
    index.ts              # Local CLI entrypoint
    lambda.ts             # AWS Lambda handler
  lib/
    data/
      sites.ts            # Site catalog (slug, name, country, url, version)
    ia-client/
      ai-client.ts        # AIClient interface
      ai-client-google.ts # Google Gemini implementation
    storage/
      storage.ts          # Storage interface
      local-storage.ts    # Writes to local filesystem (out/media/)
      s3-storage.ts       # Writes to S3
    screen-capturer.ts    # Chromium screenshot + AI extraction
    report-generator.ts   # HTML report builder
infra/
  paparazzo-stack.ts      # CDK stack (Lambda, S3, SSM, EventBridge schedule)
```

## AWS deployment

The infrastructure is defined with AWS CDK and deployed automatically on every push to `main` via GitHub Actions.

### First-time setup

```bash
source .env

# bootstrap CDK in your AWS account
cdk bootstrap "aws://$CDK_DEFAULT_ACCOUNT/$CDK_DEFAULT_REGION"

# store the Gemini API key in SSM Parameter Store
aws ssm put-parameter \
  --name /paparazzo/google-api-key \
  --type SecureString \
  --value "$GOOGLE_GENERATIVE_AI_API_KEY"
```

### GitHub repository secrets and variables

```bash
# secrets
echo "$AWS_ROLE_ARN"                   | gh secret set AWS_ROLE_ARN
echo "$CDK_DEFAULT_ACCOUNT"            | gh secret set CDK_DEFAULT_ACCOUNT
echo "$GOOGLE_GENERATIVE_AI_API_KEY"   | gh secret set GOOGLE_GENERATIVE_AI_API_KEY

# variables
gh variable set CDK_DEFAULT_REGION --body "$CDK_DEFAULT_REGION"
```

### Infrastructure

| Resource | Purpose |
|----------|---------|
| **Lambda** (Docker, ARM64, 2 GB RAM, 15 min timeout) | Runs the capture + report pipeline daily |
| **S3 Bucket** | Stores screenshots, extracted text, and HTML reports |
| **SSM Parameter** (`/paparazzo/google-api-key`) | Securely stores the Gemini API key |
| **EventBridge Rule** | Triggers Lambda daily at 08:00 UTC |

## Environment variables

| Variable | Required | Context | Description |
|----------|----------|---------|-------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | yes | local | Gemini API key |
| `S3_BUCKET` | yes | Lambda | Target S3 bucket (set by CDK) |
| `SSM_API_KEY_NAME` | yes | Lambda | SSM parameter name for the API key (set by CDK) |

## License

ISC
