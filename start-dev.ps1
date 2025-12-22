Write-Host "Starting PotteryTracker Development Servers..." -ForegroundColor Cyan
Write-Host ""

# Get local IP address
$LOCAL_IP = $null
try {
    $LOCAL_IP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*" } | Select-Object -First 1).IPAddress
} catch {
    Write-Host "WARNING: Could not determine local IP address automatically." -ForegroundColor Yellow
    Write-Host "Please find your IP address manually using: ipconfig" -ForegroundColor Yellow
    Write-Host "Look for 'IPv4 Address' under your active network adapter (usually Wi-Fi or Ethernet)" -ForegroundColor Yellow
}

Write-Host "Starting backend server on port 3001..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm start" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "Starting frontend server on port 3000..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Both servers are starting!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Local access:" -ForegroundColor White
Write-Host "  Backend:  http://localhost:3001" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:3000" -ForegroundColor Yellow
Write-Host ""

if ($LOCAL_IP) {
    Write-Host "Network access (from other devices):" -ForegroundColor White
    Write-Host "  Frontend: http://$LOCAL_IP`:3000" -ForegroundColor Yellow
    Write-Host "  Backend:  http://$LOCAL_IP`:3001" -ForegroundColor Yellow
    Write-Host ""
} else {
    Write-Host "Network access: Find your IP address using 'ipconfig' command" -ForegroundColor White
    Write-Host "  Then access: http://YOUR_IP:3000" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Make sure Windows Firewall allows connections on ports 3000 and 3001" -ForegroundColor White
Write-Host ""
Write-Host "Close the server windows to stop the servers." -ForegroundColor White
Write-Host ""
Write-Host "Press any key to exit this window (servers will continue running)..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
