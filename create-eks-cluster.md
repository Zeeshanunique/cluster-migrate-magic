# Creating a Multi-Tenant EKS Cluster

This guide provides step-by-step instructions to create a multi-tenant EKS cluster on AWS.

## Prerequisites

- AWS CLI installed and configured with appropriate credentials
- kubectl installed
- eksctl installed (optional but recommended)

## Option 1: Using eksctl (Recommended)

eksctl is the easiest way to create EKS clusters. Here's how to create a multi-tenant cluster:

```bash
# Create a config file for the cluster
cat > multi-tenant-cluster.yaml << EOF
apiVersion: eksctl.io/v1alpha5
kind: ClusterConfig

metadata:
  name: multi-tenant-eks
  region: us-west-2
  version: "1.28"

# IAM configuration
iam:
  withOIDC: true
  serviceAccounts:
    - metadata:
        name: cluster-autoscaler
        namespace: kube-system
      wellKnownPolicies:
        autoScaler: true

# Networking
vpc:
  cidr: 10.0.0.0/16
  nat:
    gateway: Single

# Managed node groups
managedNodeGroups:
  - name: system-ng
    instanceType: t3.medium
    minSize: 2
    maxSize: 5
    desiredCapacity: 3
    volumeSize: 80
    labels:
      role: system
    tags:
      nodegroup-role: system
    iam:
      withAddonPolicies:
        autoScaler: true
  
  - name: tenant-ng
    instanceType: t3.large
    minSize: 2
    maxSize: 10
    desiredCapacity: 3
    volumeSize: 100
    labels:
      role: tenant
    tags:
      nodegroup-role: tenant
    iam:
      withAddonPolicies:
        autoScaler: true

# Add-ons
addons:
  - name: vpc-cni
    version: latest
  - name: coredns
    version: latest
  - name: kube-proxy
    version: latest
EOF

# Create the cluster using the config file
eksctl create cluster -f multi-tenant-cluster.yaml
```

## Option 2: Using AWS CLI

If you prefer to use AWS CLI, follow these steps:

### 1. Create IAM roles

```bash
# Create EKS cluster role
cat > eks-cluster-role.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "eks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role --role-name EKSClusterRole --assume-role-policy-document file://eks-cluster-role.json

# Attach required policies
aws iam attach-role-policy --role-name EKSClusterRole --policy-arn arn:aws:iam::aws:policy/AmazonEKSClusterPolicy

# Create node role
cat > eks-node-role.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role --role-name EKSNodeRole --assume-role-policy-document file://eks-node-role.json

# Attach required policies
aws iam attach-role-policy --role-name EKSNodeRole --policy-arn arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
aws iam attach-role-policy --role-name EKSNodeRole --policy-arn arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy
aws iam attach-role-policy --role-name EKSNodeRole --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
```

### 2. Create VPC and subnets

Use AWS CloudFormation to create the VPC. Download and use the Amazon EKS VPC template from:
https://s3.us-west-2.amazonaws.com/amazon-eks/cloudformation/2020-10-29/amazon-eks-vpc-private-subnets.yaml

```bash
aws cloudformation create-stack \
  --stack-name EKS-VPC \
  --template-url https://s3.us-west-2.amazonaws.com/amazon-eks/cloudformation/2020-10-29/amazon-eks-vpc-private-subnets.yaml
```

### 3. Create the EKS cluster

```bash
# Get subnet IDs from the VPC stack
SUBNET_IDS=$(aws cloudformation describe-stacks --stack-name EKS-VPC --query "Stacks[0].Outputs[?OutputKey=='SubnetIds'].OutputValue" --output text)
SECURITY_GROUP=$(aws cloudformation describe-stacks --stack-name EKS-VPC --query "Stacks[0].Outputs[?OutputKey=='SecurityGroups'].OutputValue" --output text)

# Create the EKS cluster
aws eks create-cluster \
  --name multi-tenant-eks \
  --role-arn $(aws iam get-role --role-name EKSClusterRole --query "Role.Arn" --output text) \
  --resources-vpc-config subnetIds=$SUBNET_IDS,securityGroupIds=$SECURITY_GROUP \
  --kubernetes-version 1.28
```

### 4. Create node groups

```bash
# System node group
aws eks create-nodegroup \
  --cluster-name multi-tenant-eks \
  --nodegroup-name system-ng \
  --node-role $(aws iam get-role --role-name EKSNodeRole --query "Role.Arn" --output text) \
  --subnets $SUBNET_IDS \
  --scaling-config minSize=2,maxSize=5,desiredSize=3 \
  --instance-types t3.medium \
  --disk-size 80 \
  --labels role=system

# Tenant node group
aws eks create-nodegroup \
  --cluster-name multi-tenant-eks \
  --nodegroup-name tenant-ng \
  --node-role $(aws iam get-role --role-name EKSNodeRole --query "Role.Arn" --output text) \
  --subnets $SUBNET_IDS \
  --scaling-config minSize=2,maxSize=10,desiredSize=3 \
  --instance-types t3.large \
  --disk-size 100 \
  --labels role=tenant
```

## 5. Configure Cluster for Multi-Tenancy

After your cluster is created, you need to set up multi-tenancy tools:

### Install Kubernetes Namespaces and RBAC

```bash
# Update kubeconfig
aws eks update-kubeconfig --name multi-tenant-eks --region us-west-2

# Create tenant namespaces
kubectl create namespace tenant-a
kubectl create namespace tenant-b

# Create admin role for each tenant
cat > tenant-admin-role.yaml << EOF
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: tenant-admin
  namespace: tenant-a
rules:
- apiGroups: ["", "extensions", "apps", "networking.k8s.io", "batch"]
  resources: ["*"]
  verbs: ["*"]
---
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: tenant-admin
  namespace: tenant-b
rules:
- apiGroups: ["", "extensions", "apps", "networking.k8s.io", "batch"]
  resources: ["*"]
  verbs: ["*"]
EOF

kubectl apply -f tenant-admin-role.yaml

# Create service accounts and bind roles
kubectl create serviceaccount tenant-a-admin -n tenant-a
kubectl create serviceaccount tenant-b-admin -n tenant-b

kubectl create rolebinding tenant-a-admin-binding -n tenant-a --serviceaccount=tenant-a:tenant-a-admin --role=tenant-admin
kubectl create rolebinding tenant-b-admin-binding -n tenant-b --serviceaccount=tenant-b:tenant-b-admin --role=tenant-admin
```

### Install Resource Quotas

```bash
cat > tenant-quotas.yaml << EOF
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-a-quota
  namespace: tenant-a
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
    services: "10"
    persistentvolumeclaims: "5"
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: tenant-b-quota
  namespace: tenant-b
spec:
  hard:
    requests.cpu: "4"
    requests.memory: 8Gi
    limits.cpu: "8"
    limits.memory: 16Gi
    pods: "20"
    services: "10"
    persistentvolumeclaims: "5"
EOF

kubectl apply -f tenant-quotas.yaml
```

### Install Network Policies

```bash
cat > tenant-network-policies.yaml << EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-other-namespaces
  namespace: tenant-a
spec:
  podSelector: {}
  ingress:
  - from:
    - podSelector: {}
---
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-other-namespaces
  namespace: tenant-b
spec:
  podSelector: {}
  ingress:
  - from:
    - podSelector: {}
EOF

kubectl apply -f tenant-network-policies.yaml
```

## 6. Advanced Multi-Tenancy with Tools (Optional)

For more advanced multi-tenancy, consider installing:

### Kiosk

```bash
kubectl apply -f https://raw.githubusercontent.com/kiosk-sh/kiosk/master/manifests/kiosk.yaml
```

### Hierarchical Namespace Controller

```bash
kubectl apply -f https://github.com/kubernetes-sigs/hierarchical-namespaces/releases/download/v1.0.0/hnc-manager.yaml
```

## 7. Verify Your Cluster

```bash
# List nodes and check labels
kubectl get nodes --show-labels

# Check tenant namespaces
kubectl get namespaces

# Verify resource quotas
kubectl describe quota -n tenant-a
kubectl describe quota -n tenant-b
```

## 8. Connect Your EKS Cluster to Your Application

After creating the cluster, get the kubeconfig:

```bash
aws eks update-kubeconfig --name multi-tenant-eks --region us-west-2 --kubeconfig ./multi-tenant-kubeconfig
```

Then import this kubeconfig file into your application's cluster management interface. 