@echo off
REM JustUs Backend Setup Script for Windows
REM This script helps you quickly set up the Node.js backend

echo ================================
echo JustUs Backend Setup (Node.js)
echo ================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Node.js is not installed. Please install Node.js 18 or higher.
    exit /b 1
)

for /f "delims=" %%i in ('node -v') do set NODE_VERSION=%%i
echo √ Node.js version: %NODE_VERSION%

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X npm is not installed.
    exit /b 1
)

for /f "delims=" %%i in ('npm -v') do set NPM_VERSION=%%i
echo √ npm version: %NPM_VERSION%
echo.

REM Install dependencies
echo Installing dependencies...
call npm install

if %ERRORLEVEL% NEQ 0 (
    echo X Failed to install dependencies
    exit /b 1
)

echo √ Dependencies installed successfully
echo.

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file...
    copy .env.example .env
    echo √ .env file created. Please update it with your configuration.
    echo.
    echo ! IMPORTANT: Edit the .env file with your MongoDB URI and other settings
    echo.
) else (
    echo √ .env file already exists
    echo.
)

REM Display next steps
echo ================================
echo Setup Complete! 🎉
echo ================================
echo.
echo Next steps:
echo 1. Make sure MongoDB is running
echo 2. Update the .env file with your configuration
echo 3. Run the development server:
echo    npm run dev
echo.
echo Or run in production mode:
echo    npm start
echo.
echo The server will start on port 8080 (or the PORT specified in .env)
echo.
echo API Documentation: See README_NODEJS.md
echo Migration Guide: See MIGRATION_GUIDE.md
echo.

pause
