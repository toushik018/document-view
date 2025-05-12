#!/bin/bash
# Install dependencies
npm ci --include=dev

# Build client
npx vite build

# Build server
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist 