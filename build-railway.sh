#!/bin/bash
# Simple build script for Railway

# Install dependencies
echo "Installing dependencies..."
npm install --no-fund --legacy-peer-deps

# Build the client and server
echo "Building client..."
npm run client:build

echo "Building server..."
npm run server:build

echo "Build completed successfully!" 