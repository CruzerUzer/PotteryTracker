@echo off
echo Starting PotteryTracker Development Servers...
echo.

echo Starting backend server on port 3001...
start "PotteryTracker Backend" cmd /k "cd backend && npm start"

timeout /t 2 /nobreak >nul

echo Starting frontend server on port 3000...
start "PotteryTracker Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Both servers are starting in separate windows!
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3000
echo.
echo Close the server windows to stop the servers.
pause

