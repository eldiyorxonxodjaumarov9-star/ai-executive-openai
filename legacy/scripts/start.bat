@echo off
setlocal
cd /d "%~dp0.."

if not exist "venv\Scripts\python.exe" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Installing dependencies...
call venv\Scripts\pip install -r requirements.txt -q

if not exist ".env" (
    echo Creating .env from .env.example...
    copy /Y .env.example .env >nul
)

REM Prevent stale shell variables from overriding .env
set BITRIX24_WEBHOOK_URL=
set ANTHROPIC_API_KEY=
set TELEGRAM_BOT_TOKEN=
set TELEGRAM_CHAT_ID=
set DAILY_REPORT_ENABLED=

echo Starting FastAPI server on http://127.0.0.1:8000
call venv\Scripts\uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
