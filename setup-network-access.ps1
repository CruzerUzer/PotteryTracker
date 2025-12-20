# PotteryTracker Network Access Setup Script
# This script helps configure Windows Firewall to allow network access

Write-Host "PotteryTracker Network Access Setup" -ForegroundColor Green
Write-Host "====================================" -ForegroundColor Green
Write-Host ""

# Get local IP address (exclude loopback, APIPA, WSL, and Hyper-V adapters)
$localIP = $null

# Get all IPv4 addresses
$allIPs = Get-NetIPAddress -AddressFamily IPv4

# Filter out unwanted IPs
$validIPs = $allIPs | Where-Object {
    $ip = $_.IPAddress
    $ip -notlike "127.*" -and 
    $ip -notlike "169.254.*" -and
    $ip -notlike "172.16.*" -and
    $ip -notlike "172.17.*" -and
    $ip -notlike "172.18.*" -and
    $ip -notlike "172.19.*" -and
    $ip -notlike "172.20.*" -and
    $ip -notlike "172.21.*" -and
    $ip -notlike "172.22.*" -and
    $ip -notlike "172.23.*" -and
    $ip -notlike "172.24.*" -and
    $ip -notlike "172.25.*" -and
    $ip -notlike "172.26.*" -and
    $ip -notlike "172.27.*" -and
    $ip -notlike "172.28.*" -and
    $ip -notlike "172.29.*" -and
    $ip -notlike "172.30.*" -and
    $ip -notlike "172.31.*"
}

# Prefer 192.168.x.x or 10.x.x.x addresses (common local network ranges)
$preferredIP = $validIPs | Where-Object { 
    $ip = $_.IPAddress
    $ip -like "192.168.*" -or $ip -like "10.*" 
} | Select-Object -First 1

if ($preferredIP) {
    $localIP = $preferredIP.IPAddress
} else {
    $firstValid = $validIPs | Select-Object -First 1
    if ($firstValid) {
        $localIP = $firstValid.IPAddress
    }
}

if (-not $localIP) {
    Write-Host "Could not determine local IP address." -ForegroundColor Red
    Write-Host "Please find your IP address manually using: ipconfig" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Available IP addresses:" -ForegroundColor Yellow
    Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike "127.*" } | ForEach-Object {
        Write-Host "  - $($_.IPAddress)" -ForegroundColor White
    }
    exit 1
}

Write-Host "Your local IP address: $localIP" -ForegroundColor Cyan
Write-Host ""

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "WARNING: This script needs administrator privileges to configure the firewall." -ForegroundColor Yellow
    Write-Host "You can either:" -ForegroundColor Yellow
    Write-Host "  1. Run PowerShell as Administrator and run this script again" -ForegroundColor White
    Write-Host "  2. Manually allow ports 3000 and 3001 in Windows Firewall" -ForegroundColor White
    Write-Host ""
    Write-Host "To manually configure:" -ForegroundColor Yellow
    Write-Host "  1. Open Windows Defender Firewall" -ForegroundColor White
    Write-Host "  2. Click 'Advanced settings'" -ForegroundColor White
    Write-Host "  3. Click 'Inbound Rules' -> 'New Rule'" -ForegroundColor White
    Write-Host "  4. Select 'Port' -> TCP -> Specific ports: 3000,3001" -ForegroundColor White
    Write-Host "  5. Allow the connection -> Apply to all profiles -> Name it 'PotteryTracker'" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "Configuring Windows Firewall..." -ForegroundColor Yellow
    
    # Add firewall rules for ports 3000 and 3001
    try {
        $rule1 = Get-NetFirewallRule -Name "PotteryTracker-Frontend" -ErrorAction SilentlyContinue
        if (-not $rule1) {
            $null = New-NetFirewallRule -Name "PotteryTracker-Frontend" -DisplayName "PotteryTracker Frontend (Port 3000)" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
            Write-Host "  [OK] Added firewall rule for port 3000 (Frontend)" -ForegroundColor Green
        } else {
            Write-Host "  [OK] Firewall rule for port 3000 already exists" -ForegroundColor Green
        }
        
        $rule2 = Get-NetFirewallRule -Name "PotteryTracker-Backend" -ErrorAction SilentlyContinue
        if (-not $rule2) {
            $null = New-NetFirewallRule -Name "PotteryTracker-Backend" -DisplayName "PotteryTracker Backend (Port 3001)" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
            Write-Host "  [OK] Added firewall rule for port 3001 (Backend)" -ForegroundColor Green
        } else {
            Write-Host "  [OK] Firewall rule for port 3001 already exists" -ForegroundColor Green
        }
    } catch {
        Write-Host "  [ERROR] Error configuring firewall: $_" -ForegroundColor Red
        Write-Host "  Please configure manually using the instructions above." -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Network Access Information:" -ForegroundColor Cyan
Write-Host "==========================" -ForegroundColor Cyan
Write-Host ""
Write-Host "From other devices on your network, access:" -ForegroundColor Yellow
Write-Host "  Frontend: http://$localIP:3000" -ForegroundColor White
Write-Host "  Backend:  http://$localIP:3001" -ForegroundColor White
Write-Host ""
Write-Host "Note: Make sure all devices are on the same network (same Wi-Fi/router)" -ForegroundColor Yellow
Write-Host ""

