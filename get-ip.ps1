# Simple script to get local IP address for batch file
$allIPs = Get-NetIPAddress -AddressFamily IPv4

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

# Prefer 192.168.x.x or 10.x.x.x addresses
$preferredIP = $validIPs | Where-Object { 
    $ip = $_.IPAddress
    $ip -like "192.168.*" -or $ip -like "10.*" 
} | Select-Object -First 1

if ($preferredIP) {
    Write-Output $preferredIP.IPAddress
} else {
    $firstValid = $validIPs | Select-Object -First 1
    if ($firstValid) {
        Write-Output $firstValid.IPAddress
    }
}

