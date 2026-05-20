@echo off
title Ingaz - Start Project
cd /d "%~dp0"

if /i "%1"=="setup" goto setup
if /i "%1"=="seed" goto seed

:start
echo ========================================
echo    Ingaz - Starting Server ^& Client
echo ========================================
echo.
echo Arguments:
echo   start.bat setup    Run one-time DB setup then start
echo   start.bat seed     Run seed only   (refresh permissions)
echo   start.bat          Normal startup  (daily use)
echo.

echo Killing old processes on ports 3001 and 5173...

powershell -Command "$p=Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue; if($p){Stop-Process -Id $p.OwningProcess -Force}"
powershell -Command "$p=Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue; if($p){Stop-Process -Id $p.OwningProcess -Force}"

timeout /t 2 /nobreak >nul

if exist "%~dp0server\node_modules\.cache" rmdir /s /q "%~dp0server\node_modules\.cache" >nul 2>nul

echo [1/3] Starting server on port 3001...
start "Server - Ingaz" cmd /c "cd /d "%~dp0server" && npm run dev"

echo [2/3] Waiting for server to be ready...
:wait
timeout /t 2 /nobreak >nul
powershell -Command "try{$r=Invoke-WebRequest -Uri http://localhost:3001/api/health -UseBasicParsing -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1}}catch{exit 1}" >nul 2>nul
if errorlevel 1 goto wait

echo   Server is ready ^(http://localhost:3001^)

echo [3/3] Starting client on port 5173...
start "Client - Ingaz" cmd /c "cd /d "%~dp0client" && npm run dev"

timeout /t 3 /nobreak >nul

echo Opening browser...
start http://localhost:5173

echo.
echo ========================================
echo        Application Started!
echo ========================================
echo.
echo   Server:  http://localhost:3001
echo   Client:  http://localhost:5173
echo.
echo =========== Test Accounts ===========
echo.
echo   Admin:    admin@ingaz.com / admin123
echo   Deputy:   deputy@ingaz.com / deputy123
echo   Employee: emp@ingaz.com / emp123
echo.
echo =====================================
echo.
pause
exit /b

:seed
echo ========================================
echo    Ingaz - Running Seed Script
echo ========================================
echo.
echo This refreshes permissions only.
echo Safe to run anytime, even with live data.
echo.
cd /d "%~dp0server"
npm run seed
echo.
echo Seed complete.
pause
exit /b

:setup
echo ========================================
echo    Ingaz - One-Time Database Setup
echo ========================================
echo.
echo This will:
echo   1. Update DB schema (constraints, columns)
echo   2. Run seed script (permissions)
echo.
echo NOTE: Only needed after schema changes.
echo For daily startup, run without arguments.
echo.
pause

cd /d "%~dp0server"

echo [1/2] Applying schema changes...
npx tsx src/setup.ts 2>&1
if errorlevel 1 (
  echo.
  echo Schema migration failed. Check:
  echo   - Is PostgreSQL running?
  echo   - Does .env have the correct DATABASE_URL?
  pause
  exit /b 1
)

echo [2/2] Running seed...
npm run seed
if errorlevel 1 (
  echo Seed failed.
  pause
  exit /b 1
)

echo.
echo ========================================
echo     Setup Complete! Starting App...
echo ========================================
echo.
goto start
