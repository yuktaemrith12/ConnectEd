@echo off
echo ========================================================
echo   Launching ConnectEd - Local Development
echo ========================================================

:: Kill any existing processes on port 8000 (backend) and 5173 (frontend)
echo Stopping any existing servers...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>&1
ping -n 2 127.0.0.1 >nul 2>&1

:: ── LiveKit Stack: Redis + LiveKit Server + Egress Recorder ──────────────────
echo Checking Docker for LiveKit video stack...
docker info >nul 2>&1
if errorlevel 1 (
    echo [WARNING] Docker is not running.
    echo           Open Docker Desktop and re-run this script to enable live classes and recording.
    goto StartServers
)

echo Starting LiveKit stack (Redis + LiveKit + Egress^)...
docker compose -f "%~dp0docker-compose.yml" up -d
if errorlevel 1 (
    echo [WARNING] docker compose failed - check Docker Desktop is running.
) else (
    echo [OK] LiveKit stack started.
    echo      Waiting 5s for services to initialise...
    ping -n 6 127.0.0.1 >nul 2>&1
)

:StartServers
:: ── Backend ──────────────────────────────────────────────────────────────────
start "ConnectEd Backend" cmd /k "cd /d %~dp0backend && venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"

:: ── Frontend ─────────────────────────────────────────────────────────────────
start "ConnectEd Frontend" cmd /k "cd /d %~dp0frontend && pnpm run dev"

:: ── ngrok (WhatsApp webhook tunnel) ──────────────────────────────────────────
start "ConnectEd ngrok" cmd /k "ngrok http --url=homothetic-kourtney-supportlessly.ngrok-free.dev 8000"

echo.
echo ========================================================
echo   All services are starting!
echo.
echo   Backend API  :  http://127.0.0.1:8000
echo   Frontend UI  :  http://localhost:5173
echo   LiveKit      :  ws://localhost:7880
echo   Egress       :  recording enabled
echo   Redis        :  localhost:6379
echo   ngrok Tunnel :  https://homothetic-kourtney-supportlessly.ngrok-free.dev
echo ========================================================
echo.
pause
