import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Upload, Server, FileText } from 'lucide-react';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { CreateClusterPayload, clusterService } from '@/utils/dynamodb';
import { toast } from 'sonner';

const AddCluster = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  
  const [clusterName, setClusterName] = useState('');
  const [clusterType, setClusterType] = useState<'single' | 'tenant'>('single');
  const [kubeconfig, setKubeconfig] = useState('');
  const [configFile, setConfigFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [parsedConfig, setParsedConfig] = useState<{
    region?: string;
    nodes?: number;
    version?: string;
    awsAccountId?: string;
    roleName?: string;
    eksClusterName?: string;
  } | null>(null);
  
  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      toast.error("You must be signed in to add a cluster");
      navigate('/sign-in');
    }
  }, [user, loading, navigate]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setConfigFile(file);
    
    // Read the file content
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        if (event.target?.result) {
          const content = event.target.result as string;
          setKubeconfig(content);
          
          // Try to parse the YAML file to extract cluster information
          parseClusterInfo(content);
        }
      } catch (error) {
        console.error("Error reading file:", error);
        toast.error("Failed to read config file");
      }
    };
    
    reader.readAsText(file);
  };
  
  const parseClusterInfo = (yamlContent: string) => {
    try {
      // This is a simplified parsing logic for kubeconfig YAML
      // In a real app, you'd use a proper YAML parser like js-yaml
      
      // Extract cluster name from different possible locations
      let extractedName = '';
      
      // Try to get from current-context first
      const currentContextMatch = yamlContent.match(/current-context:\s+"?([\w-]+)"?/);
      if (currentContextMatch && currentContextMatch[1]) {
        extractedName = currentContextMatch[1];
      }
      
      // Try to get from clusters section if not found
      if (!extractedName) {
        const clusterNameMatch = yamlContent.match(/clusters:[\s\S]*?-\s+name:\s+"?([\w-]+)"?/);
        if (clusterNameMatch && clusterNameMatch[1]) {
          extractedName = clusterNameMatch[1];
        }
      }
      
      // Extract EKS cluster name from the args section if available
      let eksClusterName = '';
      const eksClusterMatch = yamlContent.match(/--cluster-name\s*\n\s*-\s*([\w-]+)/);
      if (eksClusterMatch && eksClusterMatch[1]) {
        eksClusterName = eksClusterMatch[1];
        // If we have the EKS cluster name, use it as the primary name
        extractedName = eksClusterMatch[1];
      }
      
      // Set the cluster name from our extracted name
      if (extractedName) {
        setClusterName(extractedName);
      }
      
      // Extract region from server URL
      // Format is typically: https://ENDPOINT.REGION.eks.amazonaws.com
      let extractedRegion = '';
      const serverMatch = yamlContent.match(/server:\s+https:\/\/[\w.-]+\.([a-z0-9-]+)\.eks\.amazonaws\.com/);
      if (serverMatch && serverMatch[1]) {
        extractedRegion = serverMatch[1];
      }
      
      // Try to extract AWS profile if available
      let awsProfile = '';
      const profileMatch = yamlContent.match(/AWS_PROFILE[\s\S]*?value:\s*([\w-]+)/);
      if (profileMatch && profileMatch[1]) {
        awsProfile = profileMatch[1];
      }
      
      // Try to extract Kubernetes version - this is harder from kubeconfig
      // Most kubeconfig files don't include version info directly
      
      // Set parsed config with all the extracted info
      setParsedConfig({
        region: extractedRegion || "us-west-2", // Default to us-west-2 if not detected
        nodes: 1, // Default assumption
        version: "1.27", // Default assumption for K8s version
        awsAccountId: "", // This is generally not in kubeconfig
        roleName: awsProfile || "", // Use AWS profile as role name if available
        eksClusterName: eksClusterName || "", // Store the actual EKS cluster name
      });
      
      // Show success message based on what we extracted
      if (extractedName || extractedRegion || awsProfile) {
        toast.success("Config file loaded successfully");
        
        // Log extracted info for debugging
        console.log("Extracted from kubeconfig:", {
          clusterName: extractedName,
          region: extractedRegion,
          awsProfile: awsProfile,
          eksClusterName: eksClusterName,
        });
      } else {
        toast.info("Config file loaded but limited information was extracted");
      }
    } catch (error) {
      console.error("Error parsing config:", error);
      toast.warning("Could not automatically extract cluster information");
      
      // Still set the config so the user can proceed
      setParsedConfig({
        region: "us-west-2", // Changed default to match example
        nodes: 1,
        version: "1.27",
        awsAccountId: "",
        roleName: "",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!clusterName.trim()) {
      toast.error("No cluster name could be extracted from the config file");
      return;
    }

    if (!configFile) {
      toast.error("Kubeconfig file is required");
      return;
    }

    if (!user) {
      toast.error("You must be logged in to add a cluster");
      return;
    }

    setIsLoading(true);

    try {
      const clusterData: CreateClusterPayload = {
        name: clusterName,
        type: clusterType,
        region: parsedConfig?.region || "us-west-2", // Use the region from config or default to us-west-2
        version: parsedConfig?.version || "1.27", // Default if not detected
        nodes: parsedConfig?.nodes || 1, // Default if not detected
        kubeconfig: kubeconfig,
        aws_account_id: parsedConfig?.awsAccountId,
        aws_role_arn: parsedConfig?.roleName ? `arn:aws:iam::${parsedConfig.awsAccountId || 'unknown'}:role/${parsedConfig.roleName}` : undefined,
        eks_cluster_name: clusterName, // Use the same name as the cluster name
      };
      
      console.log("Adding cluster with data:", {
        ...clusterData,
        kubeconfig: "[REDACTED]", // Don't log the sensitive kubeconfig
      });
      
      const result = await clusterService.createCluster(clusterData, user.id);
      
      if (result) {
        toast.success("Cluster added successfully");
        navigate('/dashboard');
      } else {
        toast.error("Failed to add cluster");
      }
    } catch (error) {
      console.error("Error adding cluster:", error);
      toast.error("An error occurred while adding the cluster");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-20">
        <div className="container px-4 mx-auto py-8">
          <div className="mb-8 flex flex-col">
            <h1 className="text-3xl font-bold">Add Existing Cluster</h1>
            <p className="text-muted-foreground mt-2">
              Add your existing EKS cluster by uploading its kubeconfig file
            </p>
          </div>
          
          <Card className="w-full max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Add Cluster</CardTitle>
              <CardDescription>
                Upload your EKS cluster configuration file to automatically extract all cluster details
              </CardDescription>
            </CardHeader>
            
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <Label htmlFor="config-file" className="block">Upload Kubeconfig File</Label>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center">
                    <Input
                      id="config-file"
                      type="file"
                      accept=".yml,.yaml"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <Label 
                      htmlFor="config-file" 
                      className="flex flex-col items-center cursor-pointer"
                    >
                      {configFile ? (
                        <>
                          <FileText className="h-10 w-10 text-green-500 mb-2" />
                          <span className="font-medium text-green-600 dark:text-green-400">{configFile.name}</span>
                          <span className="text-sm text-muted-foreground mt-1">Click to change file</span>
                        </>
                      ) : (
                        <>
                          <Upload className="h-10 w-10 text-muted-foreground mb-2" />
                          <span className="font-medium">Upload your kubeconfig file</span>
                          <span className="text-sm text-muted-foreground mt-1">
                            YAML format (.yml or .yaml)
                          </span>
                        </>
                      )}
                    </Label>
                  </div>
                  {parsedConfig && (
                    <div className="text-sm space-y-2">
                      <p className="text-green-600 dark:text-green-400">✅ Successfully parsed configuration</p>
                      <p className="text-muted-foreground">Kubeconfig loaded securely (content hidden for security)</p>
                      
                      <div className="mt-3 p-3 bg-muted/50 rounded-md">
                        <h4 className="font-medium mb-2">Extracted Configuration:</h4>
                        <ul className="space-y-1">
                          <li><span className="font-medium">Cluster Name:</span> {clusterName}</li>
                          {parsedConfig.region && (
                            <li><span className="font-medium">Region:</span> {parsedConfig.region}</li>
                          )}
                          {parsedConfig.roleName && (
                            <li><span className="font-medium">AWS Profile/Role:</span> {parsedConfig.roleName}</li>
                          )}
                          <li><span className="font-medium">Node Count:</span> {parsedConfig.nodes} (default)</li>
                          <li><span className="font-medium">Kubernetes Version:</span> {parsedConfig.version} (assumed)</li>
                        </ul>
                      </div>
                    </div>
                  )}
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
                      <TabsTrigger value="single">Single Cluster</TabsTrigger>
                      <TabsTrigger value="tenant">Multi-Tenant Cluster</TabsTrigger>
                    </TabsList>
                    <TabsContent value="single" className="mt-2">
                      <p className="text-sm text-muted-foreground">
                        Single cluster configuration for standard workloads. Can be upgraded to multi-tenant later.
                      </p>
                    </TabsContent>
                    <TabsContent value="tenant" className="mt-2">
                      <p className="text-sm text-muted-foreground">
                        Multi-tenant setup for resource isolation and shared infrastructure across namespaces.
                      </p>
                    </TabsContent>
                  </Tabs>
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
                <Button type="submit" disabled={isLoading || !configFile}>
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding Cluster...
                    </>
                  ) : (
                    <>
                      <Server className="mr-2 h-4 w-4" />
                      Add Cluster
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default AddCluster; 