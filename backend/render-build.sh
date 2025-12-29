#!/usr/bin/env bash
# Exit on error
set -o errexit

# Install backend dependencies
npm install

# Go to frontend directory
cd ../frontend

# Install frontend dependencies
npm install

# Build frontend
npm run build

# Go back to backend directory
cd ../backend

# Provide the build to backend
# Remove existing build if any
rm -rf build

# Move build from frontend to backend
mv ../frontend/build ./build

echo "Build complete"
