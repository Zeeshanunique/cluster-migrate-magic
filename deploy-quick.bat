@echo off
echo Building and starting Kube-Migrate (frontend + backend)...

:: Build the frontend
call npm run build:prod

:: Create logs directory if it doesn't exist
if not exist logs mkdir logs

:: Run the server in production mode
set NODE_ENV=production
set DEPLOYMENT=production
set PORT=8089
set BACKEND_PORT=8089
set FRONTEND_PORT=3009

echo.
echo Application built successfully!
echo.
echo Frontend will be available at: http://localhost:8089/kube-migrate/
echo API will be available at: http://localhost:8089/
echo.
echo Press Ctrl+C to stop the server
echo.

:: Start the server
node server\proxy.js > logs\server.log 2>&1 