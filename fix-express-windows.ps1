# PowerShell script to fix Express version compatibility issues on Windows

# Stop on any error
$ErrorActionPreference = "Stop"

Write-Host "Running Express.js version compatibility fix..." -ForegroundColor Green

# Check if running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "This script requires administrator privileges. Please run as administrator." -ForegroundColor Red
    exit 1
}

# Detect installation directory
$installDir = $null

if (Test-Path "C:\Program Files\kube-migrate") {
    $installDir = "C:\Program Files\kube-migrate"
} elseif (Test-Path "C:\kube-migrate") {
    $installDir = "C:\kube-migrate"
} elseif (Test-Path $PSScriptRoot) {
    $installDir = $PSScriptRoot
} else {
    Write-Host "Installation directory not found. Please specify the path:" -ForegroundColor Yellow
    $installDir = Read-Host "Installation path"
}

if (-not (Test-Path $installDir)) {
    Write-Host "Directory $installDir does not exist. Aborting." -ForegroundColor Red
    exit 1
}

Write-Host "Found installation at $installDir" -ForegroundColor Green
Set-Location $installDir

# Stop the service if running
Write-Host "Stopping the KubeMigrate service..." -ForegroundColor Yellow
Stop-Service -Name "KubeMigrate" -ErrorAction SilentlyContinue

# Fix Express version compatibility issue
Write-Host "Downgrading Express.js to version 4.18.2..." -ForegroundColor Green
npm uninstall express
npm install express@4.18.2 --save

# Check current version
$expressVersion = npm list express
Write-Host "Current Express version: $expressVersion" -ForegroundColor Cyan

# Check if package.json was updated correctly
$packageJson = Get-Content -Path "package.json" -Raw
if ($packageJson -match '"express": "\^4.18.2"') {
    Write-Host "package.json updated successfully." -ForegroundColor Green
} else {
    Write-Host "Warning: package.json doesn't show express@4.18.2. Manual edit may be required." -ForegroundColor Yellow
}

# Restart the service
Write-Host "Restarting the KubeMigrate service..." -ForegroundColor Yellow
Start-Service -Name "KubeMigrate" -ErrorAction SilentlyContinue

# Check service status
Write-Host "Checking service status..." -ForegroundColor Green
Get-Service -Name "KubeMigrate" -ErrorAction SilentlyContinue | Format-List

Write-Host "Fix completed. If the service is still failing, please check the Windows Event Logs." -ForegroundColor Green 