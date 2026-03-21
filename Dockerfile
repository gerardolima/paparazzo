# -----------------------------------------------------------------------------
# builder
# -----------------------------------------------------------------------------
FROM --platform=linux/arm64 node:24-slim AS builder
WORKDIR /build
COPY package*.json ./
RUN npm ci
COPY src/ src/
COPY tsconfig*.json ./
RUN npm run build

# -----------------------------------------------------------------------------
# runner
# -----------------------------------------------------------------------------
FROM --platform=linux/arm64 public.ecr.aws/lambda/nodejs:24 AS runner
# Install system dependencies for Playwright
RUN microdnf update -y && \
    microdnf install -y \
    nss \
    atk \
    at-spi2-atk \
    cups-libs \
    libdrm \
    libXcomposite \
    libXdamage \
    libXext \
    libXfixes \
    libXrandr \
    libgbm \
    pango \
    cairo \
    alsa-lib \
    mesa-libgbm \
    libxshmfence \
    libX11-xcb \
    libxkbcommon && \
    microdnf clean all

# Install production dependencies (fresh, for Linux)
COPY package*.json ./
RUN npm ci --omit=dev

# Install Playwright browser to a stable path (independent of HOME)
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/browsers
RUN npx playwright@1.58.2 install chromium

# Copy compiled JS from builder (no source, no macOS artifacts)
COPY --from=builder /build/out/ ./out/

# Set environment variables
ENV NODE_ENV=production
ENV HOME=/tmp

CMD [ "out/bin/lambda.handler" ]
