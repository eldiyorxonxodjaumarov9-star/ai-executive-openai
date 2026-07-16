# Start FastAPI server with a clean environment (loads .env reliably).
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

if (-not (Test-Path "venv\Scripts\python.exe")) {
    Write-Host "Creating virtual environment..."
    python -m venv venv
}

Write-Host "Installing dependencies..."
& .\venv\Scripts\pip install -r requirements.txt -q

if (-not (Test-Path ".env")) {
    Write-Host "Creating .env from .env.example..."
    Copy-Item ".env.example" ".env"
}

# Prevent stale shell variables from overriding .env
Remove-Item Env:BITRIX24_WEBHOOK_URL -ErrorAction SilentlyContinue
Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue
Remove-Item Env:TELEGRAM_BOT_TOKEN -ErrorAction SilentlyContinue
Remove-Item Env:TELEGRAM_CHAT_ID -ErrorAction SilentlyContinue
Remove-Item Env:DAILY_REPORT_ENABLED -ErrorAction SilentlyContinue

Write-Host "Starting FastAPI server on http://127.0.0.1:8000"
& .\venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
