# PotteryTracker Development Startup Script
# This script starts both the backend and frontend servers

Write-Host "Starting PotteryTracker development servers..." -ForegroundColor Green
Write-Host ""

# Start backend server
Write-Host "Starting backend server on port 3001..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    Set-Location backend
    npm start
}

# Wait a moment for backend to start
Start-Sleep -Seconds 2

# Start frontend server
Write-Host "Starting frontend server on port 3000..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    Set-Location $using:PWD
    Set-Location frontend
    npm run dev
}

Write-Host ""
Write-Host "Both servers are starting in the background!" -ForegroundColor Green
Write-Host "Backend: http://localhost:3001" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "To view server output, run:" -ForegroundColor Yellow
Write-Host "  Receive-Job -Job `$backendJob" -ForegroundColor White
Write-Host "  Receive-Job -Job `$frontendJob" -ForegroundColor White
Write-Host ""
Write-Host "To stop the servers, run:" -ForegroundColor Yellow
Write-Host "  Stop-Job -Job `$backendJob, `$frontendJob" -ForegroundColor White
Write-Host "  Remove-Job -Job `$backendJob, `$frontendJob" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to exit (servers will continue running)" -ForegroundColor Yellow

# Keep script running
try {
    while ($true) {
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host "`nStopping servers..." -ForegroundColor Yellow
    Stop-Job -Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob, $frontendJob -ErrorAction SilentlyContinue
    Write-Host "Servers stopped." -ForegroundColor Green
}

