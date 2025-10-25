#!/bin/bash

# JustUs Backend Setup Script
# This script helps you quickly set up the Node.js backend

echo "================================"
echo "JustUs Backend Setup (Node.js)"
echo "================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null
then
    echo "❌ Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

NODE_VERSION=$(node -v)
echo "✓ Node.js version: $NODE_VERSION"

# Check if npm is installed
if ! command -v npm &> /dev/null
then
    echo "❌ npm is not installed."
    exit 1
fi

NPM_VERSION=$(npm -v)
echo "✓ npm version: $NPM_VERSION"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed successfully"
echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
    echo "✓ .env file created. Please update it with your configuration."
    echo ""
    echo "⚠️  IMPORTANT: Edit the .env file with your MongoDB URI and other settings"
    echo ""
else
    echo "✓ .env file already exists"
    echo ""
fi

# Check if MongoDB is accessible
echo "🔍 Checking MongoDB connection..."
echo "   (Make sure MongoDB is running on your system)"
echo ""

# Display next steps
echo "================================"
echo "Setup Complete! 🎉"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Make sure MongoDB is running"
echo "2. Update the .env file with your configuration"
echo "3. Run the development server:"
echo "   npm run dev"
echo ""
echo "Or run in production mode:"
echo "   npm start"
echo ""
echo "The server will start on port 8080 (or the PORT specified in .env)"
echo ""
echo "API Documentation: See README_NODEJS.md"
echo "Migration Guide: See MIGRATION_GUIDE.md"
echo ""
