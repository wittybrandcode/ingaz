@echo off
title Ingaz - Staging Environment

cd /d "%~dp0"

echo ========================================
echo    Ingaz - Staging Environment
echo    (Mimics production via Docker)
echo ========================================
echo.

where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Docker is not installed or not in PATH.
    echo Install Docker Desktop from https://www.docker.com/products/docker-desktop/
    pause
    exit /b 1
)

echo [1/3] Killing old processes on ports 80, 3001, 5432...
echo.
powershell -Command "$p=Get-NetTCPConnection -LocalPort 80 -ErrorAction SilentlyContinue; if($p){Stop-Process -Id $p.OwningProcess -Force}"
powershell -Command "$p=Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue; if($p){Stop-Process -Id $p.OwningProcess -Force}"

echo [2/3] Building and starting (Docker Compose)...
echo.
docker compose down --remove-orphans 2>nul
docker compose up --build -d

echo [3/3] Waiting for server to be ready...
echo.
:wait
timeout /t 3 /nobreak >nul
powershell -Command "try{$r=Invoke-WebRequest -Uri http://localhost/api/health -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1}}catch{exit 1}" >nul 2>nul
if errorlevel 1 goto wait

echo.
echo ========================================
echo      Staging Environment Ready!
echo ========================================
echo.
echo   App:        http://localhost
echo   Server:     http://localhost:3001
echo   Database:   localhost:5432
echo.
echo =========== Test Accounts ===========
echo.
echo   Admin:  admin@ingaz.com / admin123
echo   User:   emp@ingaz.com / emp123
echo.
echo =====================================
echo.
echo To view logs:
echo   docker compose logs -f server
echo   docker compose logs -f client
echo.
echo To stop:
echo   docker compose down
echo.
pause
