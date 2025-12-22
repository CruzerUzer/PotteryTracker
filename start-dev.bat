@echo off
setlocal enabledelayedexpansion
echo Starting PotteryTracker Development Servers...
echo.

REM Get local IP address using PowerShell (more reliable)
for /f "delims=" %%i in ('powershell -ExecutionPolicy Bypass -File "%~dp0get-ip.ps1"') do set LOCAL_IP=%%i

if not defined LOCAL_IP (
    echo WARNING: Could not determine local IP address automatically.
    echo Please find your IP address manually using: ipconfig
    echo Look for "IPv4 Address" under your active network adapter (usually Wi-Fi or Ethernet)
    set LOCAL_IP=YOUR_IP_HERE
)

echo Starting backend server on port 3001...
start "PotteryTracker Backend" cmd /k "cd backend && npm start"

timeout /t 2 /nobreak >nul

echo Starting frontend server on port 3000...
start "PotteryTracker Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo ========================================
echo Both servers are starting!
echo ========================================
echo.
echo Local access:
echo   Backend:  http://localhost:3001
echo   Frontend: http://localhost:3000
echo.
if not "%LOCAL_IP%"=="YOUR_IP_HERE" (
    echo Network access (from other devices):
    echo   Frontend: http://%LOCAL_IP%:3000
    echo   Backend:  http://%LOCAL_IP%:3001
    echo.
) else (
    echo Network access: Find your IP address using ipconfig command
    echo   Then access: http://YOUR_IP:3000
    echo.
)
echo Make sure Windows Firewall allows connections on ports 3000 and 3001
echo.
echo Close the server windows to stop the servers.
pause
