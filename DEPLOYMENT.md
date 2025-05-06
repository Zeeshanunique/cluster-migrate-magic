# Deployment Guide for Kube-Migrate Application

This guide provides instructions for deploying the Kube-Migrate application, including both frontend and backend components.

## Deployment Options

There are three main methods to deploy the application:

1. [Docker Compose Deployment](#docker-compose-deployment) - Easiest method for containerized deployment
2. [Manual Deployment](#manual-deployment) - Step-by-step deployment on a Linux server
3. [Windows Deployment](#windows-deployment) - For deployment on Windows servers

## Prerequisites

- Node.js v18 or later
- npm v8 or later
- For Docker deployment: Docker and Docker Compose
- For Linux deployment: Nginx

## Docker Compose Deployment

This is the recommended method for deploying in a containerized environment.

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/cluster-migrate-magic.git
   cd cluster-migrate-magic
   ```

2. Configure environment variables:
   ```bash
   cp .env.example .env.production
   # Edit .env.production with your configuration
   ```

3. Deploy with Docker Compose:
   ```bash
   docker-compose up -d
   ```

4. Access the application at:
   - http://your-server-ip/kube-migrate/

## Manual Deployment

For deploying on a Linux server without Docker:

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/cluster-migrate-magic.git
   cd cluster-migrate-magic
   ```

2. Install dependencies:
   ```bash
   npm ci
   ```

3. Build the frontend:
   ```bash
   npm run build:prod
   ```

4. Configure environment:
   ```bash
   cp .env.example .env.production
   # Edit .env.production with your configuration
   cp .env.production .env
   ```

5. Set up Nginx configuration:
   ```bash
   sudo nano /etc/nginx/conf.d/kube-migrate.conf
   ```

   Add the following configuration:
   ```nginx
   server {
       listen 80;
       listen [::]:80;
       
       # Frontend static files
       location /kube-migrate/ {
           alias /path/to/cluster-migrate-magic/dist/;
           try_files $uri $uri/ /kube-migrate/index.html;
           add_header Cache-Control "public, max-age=3600";
       }
       
       # Backend API proxy
       location /kube-migrate/api/ {
           proxy_pass http://127.0.0.1:8089/;
           proxy_redirect off;
           proxy_read_timeout 3600s;
           proxy_send_timeout 3600s;
           proxy_http_version 1.1;
           proxy_set_header Host $http_host;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection "upgrade";
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           client_max_body_size 0;
       }
   }
   ```

6. Setup systemd service:
   ```bash
   sudo nano /etc/systemd/system/kube-migrate.service
   ```

   Add the following service definition:
   ```ini
   [Unit]
   Description=Kube Migrate Application
   After=network.target

   [Service]
   User=root
   WorkingDirectory=/path/to/cluster-migrate-magic
   ExecStart=/usr/bin/node server/proxy.js
   Restart=always
   RestartSec=10
   StandardOutput=journal
   StandardError=journal
   SyslogIdentifier=kube-migrate
   Environment=NODE_ENV=production
   Environment=DEPLOYMENT=production
   Environment=PORT=8089
   Environment=BACKEND_PORT=8089
   Environment=FRONTEND_PORT=3009

   [Install]
   WantedBy=multi-user.target
   ```

7. Reload and start services:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable kube-migrate
   sudo systemctl start kube-migrate
   sudo systemctl reload nginx
   ```

8. Access the application at:
   - http://your-server-ip/kube-migrate/

## Windows Deployment

For Windows servers:

1. Clone the repository:
   ```powershell
   git clone https://github.com/yourusername/cluster-migrate-magic.git
   cd cluster-migrate-magic
   ```

2. Install dependencies:
   ```powershell
   npm ci
   ```

3. Build the frontend:
   ```powershell
   npm run build:prod
   ```

4. Configure environment:
   ```powershell
   copy .env.example .env.production
   # Edit .env.production with your configuration
   copy .env.production .env
   ```

5. Create a Windows Service:
   - Install [nssm](https://nssm.cc/) (Non-Sucking Service Manager)
   - Run:
     ```powershell
     nssm install KubeMigrate "C:\Program Files\nodejs\node.exe" "C:\path\to\cluster-migrate-magic\server\proxy.js"
     nssm set KubeMigrate AppDirectory "C:\path\to\cluster-migrate-magic"
     nssm set KubeMigrate DisplayName "Kube Migrate Application"
     nssm set KubeMigrate Description "Kubernetes cluster migration tool"
     nssm set KubeMigrate AppEnvironmentExtra "NODE_ENV=production" "DEPLOYMENT=production" "PORT=8089" "BACKEND_PORT=8089" "FRONTEND_PORT=3009"
     nssm start KubeMigrate
     ```

6. Configure IIS:
   - Install IIS and URL Rewrite module
   - Create a new site or application under an existing site
   - Point the physical path to the `dist` folder
   - Add URL Rewrite rules for:
     - Frontend: `/kube-migrate/(.*)` to `dist/$1`
     - API: `/kube-migrate/api/(.*)` to `http://localhost:8089/$1`

7. Access the application at:
   - http://your-server/kube-migrate/

## Troubleshooting

- **Frontend 404 errors**: Ensure the frontend is properly built and the nginx/IIS configuration is correct
- **Backend connection issues**: Verify the server is running with `systemctl status kube-migrate` or checking Windows services
- **API errors**: Check the server logs with `journalctl -u kube-migrate -f` or Windows Event Viewer

## Express.js Compatibility Issues

When deploying Kube-Migrate, you may encounter the following error related to Express.js version:

```
TypeError: Missing parameter name at XX: https://git.new/pathToRegexpError
```

This occurs because the application uses Express.js 5.x (alpha), which has stricter route parameter validation than the stable 4.x versions. Here's how to fix it:

### For New Deployments

The updated deployment scripts now automatically fix this issue by downgrading Express.js to version 4.18.2.

### For Existing Deployments

If you're experiencing this error on an already deployed instance, use one of these fix scripts:

#### Linux/EC2 Fix

Run this command to download and execute the fix script:

```bash
curl -O https://raw.githubusercontent.com/yourusername/cluster-migrate-magic/main/fix-express-version.sh
chmod +x fix-express-version.sh
sudo ./fix-express-version.sh
```

#### Windows Fix

Run these PowerShell commands as Administrator:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/yourusername/cluster-migrate-magic/main/fix-express-windows.ps1" -OutFile "fix-express-windows.ps1"
.\fix-express-windows.ps1
```

### Manual Fix

If the scripts don't work for your environment:

1. Stop the service:
   ```bash
   # Linux
   sudo systemctl stop kube-migrate
   
   # Windows PowerShell
   Stop-Service KubeMigrate
   ```

2. Navigate to your installation directory and run:
   ```bash
   npm uninstall express
   npm install express@4.18.2 --save
   ```

3. Start the service:
   ```bash
   # Linux
   sudo systemctl start kube-migrate
   
   # Windows PowerShell
   Start-Service KubeMigrate
   ```

## Upgrading

1. Pull the latest changes:
   ```bash
   git pull origin main
   ```

2. Rebuild the frontend:
   ```bash
   npm ci
   npm run build:prod
   ```

3. Restart the service:
   ```bash
   sudo systemctl restart kube-migrate
   # or on Windows
   nssm restart KubeMigrate
   ``` 