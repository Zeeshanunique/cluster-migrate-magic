# PowerShell script to create and configure a multi-tenant EKS cluster

# Step 1: Create the EKS cluster using eksctl
Write-Host "Creating EKS cluster with eksctl (this can take 15-20 minutes)..." -ForegroundColor Green
eksctl create cluster -f multi-tenant-cluster.yaml

# Step 2: Update kubeconfig
Write-Host "Updating kubeconfig..." -ForegroundColor Green
aws eks update-kubeconfig --name multi-tenant-eks --region us-west-2

# Step 3: Create tenant namespaces
Write-Host "Creating tenant namespaces..." -ForegroundColor Green
kubectl create namespace tenant-a
kubectl create namespace tenant-b

# Step 4: Apply RBAC roles
Write-Host "Applying RBAC roles for tenants..." -ForegroundColor Green
kubectl apply -f tenant-admin-role.yaml

# Step 5: Create service accounts and bind roles
Write-Host "Creating service accounts and role bindings..." -ForegroundColor Green
kubectl create serviceaccount tenant-a-admin -n tenant-a
kubectl create serviceaccount tenant-b-admin -n tenant-b

kubectl create rolebinding tenant-a-admin-binding -n tenant-a --serviceaccount=tenant-a:tenant-a-admin --role=tenant-admin
kubectl create rolebinding tenant-b-admin-binding -n tenant-b --serviceaccount=tenant-b:tenant-b-admin --role=tenant-admin

# Step 6: Apply resource quotas
Write-Host "Applying resource quotas..." -ForegroundColor Green
kubectl apply -f tenant-quotas.yaml

# Step 7: Apply network policies
Write-Host "Applying network policies..." -ForegroundColor Green
kubectl apply -f tenant-network-policies.yaml

# Step 8: Verify cluster
Write-Host "Verifying cluster setup..." -ForegroundColor Green
Write-Host "Nodes:" -ForegroundColor Cyan
kubectl get nodes --show-labels

Write-Host "Namespaces:" -ForegroundColor Cyan
kubectl get namespaces

Write-Host "Resource Quotas:" -ForegroundColor Cyan
kubectl describe quota -n tenant-a
kubectl describe quota -n tenant-b

# Step 9: Export kubeconfig for application
Write-Host "Exporting kubeconfig file for your application..." -ForegroundColor Green
aws eks update-kubeconfig --name multi-tenant-eks --region us-west-2 --kubeconfig ./multi-tenant-kubeconfig

Write-Host "Multi-tenant EKS cluster setup complete!" -ForegroundColor Green
Write-Host "You can now import the kubeconfig file (multi-tenant-kubeconfig) into your application." -ForegroundColor Yellow 