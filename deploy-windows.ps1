# PowerShell deployment script for Kube-Migrate on Windows
# This script deploys both frontend and backend components

# Stop on any error
$ErrorActionPreference = "Stop"

Write-Host "Starting Kube-Migrate deployment on Windows..." -ForegroundColor Green

# Configuration
$AppName = "KubeMigrate"
$AppDir = $PSScriptRoot
$BackendPort = 8089
$FrontendPort = 3009
$NodeExe = "C:\Program Files\nodejs\node.exe"

# Check if Node.js is installed
if (-not (Test-Path $NodeExe)) {
    $NodeExe = (Get-Command node -ErrorAction SilentlyContinue).Source
    if (-not $NodeExe) {
        Write-Host "Node.js is not installed or not in PATH. Please install Node.js first." -ForegroundColor Red
        exit 1
    }
}

# Check if running as administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "This script requires administrator privileges. Please run as administrator." -ForegroundColor Red
    exit 1
}

# Fix Express version compatibility issue
Write-Host "Fixing Express version compatibility..." -ForegroundColor Green
npm uninstall express
npm install express@4.18.2 --save

# Install dependencies
Write-Host "Installing dependencies..." -ForegroundColor Green
npm ci

# Build frontend
Write-Host "Building frontend for production..." -ForegroundColor Green
npm run build:prod

# Copy .env file
Write-Host "Setting up environment..." -ForegroundColor Green
Copy-Item -Path ".env.production" -Destination ".env" -Force

# Check if NSSM is installed
$nssm = (Get-Command nssm -ErrorAction SilentlyContinue).Source
if (-not $nssm) {
    # Download NSSM if not installed
    Write-Host "NSSM not found, downloading..." -ForegroundColor Yellow
    $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
    $nssmZip = "$env:TEMP\nssm.zip"
    $nssmDir = "$env:TEMP\nssm"
    
    Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip
    Expand-Archive -Path $nssmZip -DestinationPath $nssmDir -Force
    
    # Find the correct architecture
    if ([Environment]::Is64BitOperatingSystem) {
        $nssm = "$nssmDir\nssm-2.24\win64\nssm.exe"
    } else {
        $nssm = "$nssmDir\nssm-2.24\win32\nssm.exe"
    }
}

# Setup Windows Service
Write-Host "Creating Windows Service..." -ForegroundColor Green

# Remove existing service if it exists
& $nssm stop $AppName 2>$null
& $nssm remove $AppName confirm 2>$null

# Create new service
& $nssm install $AppName $NodeExe "$AppDir\server\proxy.js"
& $nssm set $AppName AppDirectory $AppDir
& $nssm set $AppName DisplayName "Kube Migrate Application"
& $nssm set $AppName Description "Kubernetes cluster migration tool"
& $nssm set $AppName AppEnvironmentExtra "NODE_ENV=production" "DEPLOYMENT=production" "PORT=$BackendPort" "BACKEND_PORT=$BackendPort" "FRONTEND_PORT=$FrontendPort"
& $nssm set $AppName Start SERVICE_AUTO_START
& $nssm set $AppName AppStdout "$AppDir\logs\service-output.log"
& $nssm set $AppName AppStderr "$AppDir\logs\service-error.log"

# Start the service
Write-Host "Starting the service..." -ForegroundColor Green
& $nssm start $AppName

# Check if IIS is installed
$iisExists = Get-Service W3SVC -ErrorAction SilentlyContinue
if (-not $iisExists) {
    Write-Host "IIS is not installed. Please install IIS and URL Rewrite module manually." -ForegroundColor Yellow
    Write-Host "Then create a site or application in IIS with the following configuration:" -ForegroundColor Yellow
    Write-Host "1. Physical path: $AppDir\dist" -ForegroundColor Yellow
    Write-Host "2. Add URL Rewrite rules for:" -ForegroundColor Yellow
    Write-Host "   - Frontend: /kube-migrate/(.*) to dist/$1" -ForegroundColor Yellow
    Write-Host "   - API: /kube-migrate/api/(.*) to http://localhost:$BackendPort/$1" -ForegroundColor Yellow
} else {
    Write-Host "IIS is installed. Setting up website..." -ForegroundColor Green
    
    # Create logs directory if it doesn't exist
    if (-not (Test-Path "$AppDir\logs")) {
        New-Item -ItemType Directory -Path "$AppDir\logs" | Out-Null
    }
    
    # Import the WebAdministration module
    Import-Module WebAdministration -ErrorAction SilentlyContinue
    
    if (-not (Get-Module WebAdministration)) {
        Write-Host "WebAdministration module not found. Please setup IIS manually." -ForegroundColor Yellow
    } else {
        # Check if the Default Web Site exists
        if (Test-Path "IIS:\Sites\Default Web Site") {
            # Check if the application already exists
            if (Test-Path "IIS:\Sites\Default Web Site\kube-migrate") {
                Remove-WebApplication -Name "kube-migrate" -Site "Default Web Site"
            }
            
            # Create the application
            New-WebApplication -Name "kube-migrate" -Site "Default Web Site" -PhysicalPath "$AppDir\dist" -ApplicationPool "DefaultAppPool"
            
            Write-Host "Application created successfully under Default Web Site." -ForegroundColor Green
            Write-Host "You need to manually configure URL Rewrite rules for API proxying." -ForegroundColor Yellow
        } else {
            Write-Host "Default Web Site not found. Please create a site or application in IIS manually." -ForegroundColor Yellow
        }
    }
}

Write-Host "Deployment complete!" -ForegroundColor Green
Write-Host "Service status:" -ForegroundColor Green
& $nssm status $AppName

Write-Host "`nAccess the application at: http://localhost/kube-migrate/" -ForegroundColor Cyan
 