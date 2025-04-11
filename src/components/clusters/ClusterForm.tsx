import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Server, Upload, RefreshCw } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { CreateClusterPayload, clusterService } from '@/utils/supabase';
import { generateKubeconfig } from '@/utils/aws';
import { toast } from 'sonner';

// List of AWS regions
const awsRegions = [
  { value: "us-east-1", label: "US East (N. Virginia)" },
  { value: "us-east-2", label: "US East (Ohio)" },
  { value: "us-west-1", label: "US West (N. California)" },
  { value: "us-west-2", label: "US West (Oregon)" },
  { value: "eu-west-1", label: "EU West (Ireland)" },
  { value: "eu-central-1", label: "EU Central (Frankfurt)" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney)" },
];

// K8s versions
const kubernetesVersions = [
  { value: "1.28", label: "v1.28" },
  { value: "1.27", label: "v1.27" },
  { value: "1.26", label: "v1.26" },
  { value: "1.25", label: "v1.25" },
  { value: "1.24", label: "v1.24" },
];

const ClusterForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [clusterType, setClusterType] = useState<'single' | 'tenant'>('single');
  
  // Form state
  const [clusterName, setClusterName] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [version, setVersion] = useState('1.27');
  const [nodes, setNodes] = useState(3);
  const [kubeconfig, setKubeconfig] = useState('');
  const [awsAccountId, setAwsAccountId] = useState('');
  const [awsRoleArn, setAwsRoleArn] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = event.target?.result as string;
        setKubeconfig(config);
        toast.success("Kubeconfig file uploaded successfully");
      } catch (error) {
        toast.error("Invalid kubeconfig file");
      }
    };
    reader.readAsText(file);
  };

  const handleGenerateKubeconfig = async () => {
    if (!clusterName) {
      toast.error("Please enter a cluster name first");
      return;
    }

    try {
      const config = await generateKubeconfig({
        clusterName,
        region,
      });
      setKubeconfig(config);
      toast.success("Sample kubeconfig generated");
    } catch (error) {
      toast.error("Failed to generate kubeconfig");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clusterName.trim()) {
      toast.error("Cluster name is required");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to create a cluster");
      return;
    }

    setIsLoading(true);

    try {
      const clusterData: CreateClusterPayload = {
        name: clusterName,
        type: clusterType,
        region,
        version,
        nodes: Number(nodes),
        kubeconfig: kubeconfig || undefined,
        aws_account_id: awsAccountId || undefined,
        aws_role_arn: awsRoleArn || undefined,
      };
      
      const result = await clusterService.createCluster(clusterData, user.id);
      
      if (result) {
        toast.success("Cluster created successfully");
        navigate('/dashboard');
      } else {
        toast.error("Failed to create cluster");
      }
    } catch (error) {
      console.error("Error creating cluster:", error);
      toast.error("An error occurred while creating the cluster");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl">Create New Cluster</CardTitle>
        <CardDescription>
          Configure your new Kubernetes cluster
        </CardDescription>
      </CardHeader>
      
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="cluster-name">Cluster Name</Label>
            <Input
              id="cluster-name"
              placeholder="production-cluster"
              value={clusterName}
              onChange={(e) => setClusterName(e.target.value)}
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label>Cluster Type</Label>
            <Tabs 
              defaultValue="single" 
              value={clusterType}
              onValueChange={(value) => setClusterType(value as 'single' | 'tenant')}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="single">Single Tenant</TabsTrigger>
                <TabsTrigger value="tenant">Multi-Tenant</TabsTrigger>
              </TabsList>
              <TabsContent value="single" className="mt-2">
                <p className="text-sm text-muted-foreground">
                  Single tenant configuration for standard workloads. Can be upgraded to multi-tenant later.
                </p>
              </TabsContent>
              <TabsContent value="tenant" className="mt-2">
                <p className="text-sm text-muted-foreground">
                  Multi-tenant setup for high availability and cross-region deployments.
                </p>
              </TabsContent>
            </Tabs>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="region">AWS Region</Label>
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger id="region">
                  <SelectValue placeholder="Select region" />
                </SelectTrigger>
                <SelectContent>
                  {awsRegions.map((region) => (
                    <SelectItem key={region.value} value={region.value}>
                      {region.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="version">Kubernetes Version</Label>
              <Select value={version} onValueChange={setVersion}>
                <SelectTrigger id="version">
                  <SelectValue placeholder="Select version" />
                </SelectTrigger>
                <SelectContent>
                  {kubernetesVersions.map((version) => (
                    <SelectItem key={version.value} value={version.value}>
                      {version.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="nodes">Number of Nodes</Label>
            <Input
              id="nodes"
              type="number"
              min="1"
              max="20"
              value={nodes}
              onChange={(e) => setNodes(parseInt(e.target.value))}
            />
          </div>
          
          <div className="space-y-4 border rounded-md p-4 bg-muted/30">
            <h3 className="font-medium">AWS Configuration</h3>
            
            <div className="space-y-2">
              <Label htmlFor="aws-account-id">AWS Account ID (Optional)</Label>
              <Input
                id="aws-account-id"
                placeholder="123456789012"
                value={awsAccountId}
                onChange={(e) => setAwsAccountId(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="aws-role-arn">AWS Role ARN (Optional)</Label>
              <Input
                id="aws-role-arn"
                placeholder="arn:aws:iam::123456789012:role/EKS-Cluster-Role"
                value={awsRoleArn}
                onChange={(e) => setAwsRoleArn(e.target.value)}
              />
            </div>
          </div>
          
          <div className="border rounded-md p-4 bg-muted/30">
            <div className="flex items-center justify-between mb-4">
              <Label htmlFor="kubeconfig">Kubeconfig</Label>
              <div className="flex gap-2">
                <Button 
                  type="button"
                  variant="outline" 
                  size="sm" 
                  onClick={handleGenerateKubeconfig}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate Sample
                </Button>
                
                <div className="relative">
                  <Button variant="outline" size="sm" type="button" asChild>
                    <label>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                      <input
                        type="file"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        accept="*"
                        onChange={handleFileUpload}
                      />
                    </label>
                  </Button>
                </div>
              </div>
            </div>
            
            <Textarea
              id="kubeconfig"
              value={kubeconfig}
              onChange={(e) => setKubeconfig(e.target.value)}
              rows={6}
              className="font-mono text-xs"
              placeholder="Paste your kubeconfig content here or upload a file"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Your kubeconfig file is stored securely and encrypted at rest.
            </p>
          </div>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate('/dashboard')}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating Cluster...
              </>
            ) : (
              <>
                <Server className="mr-2 h-4 w-4" />
                Create Cluster
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

export default ClusterForm;
