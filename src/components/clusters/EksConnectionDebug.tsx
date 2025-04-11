import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  checkK8sToken,
  getK8sNodes,
  getClusterInfo,
  debugKubeconfig
} from '@/utils/kubernetes';
import { AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';

const EksConnectionDebug = () => {
  const [kubeconfig, setKubeconfig] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<{ valid: boolean; error?: string } | null>(null);
  const [nodesData, setNodesData] = useState<any>(null);
  const [clusterInfo, setClusterInfo] = useState<any>(null);
  const [debugResult, setDebugResult] = useState<any>(null);
  const [activeTest, setActiveTest] = useState<string | null>(null);

  const handlePasteConfig = () => {
    navigator.clipboard.readText()
      .then((text) => {
        setKubeconfig(text);
        resetResults();
      })
      .catch((err) => {
        console.error('Failed to read clipboard contents: ', err);
      });
  };

  const handleLoadFromFile = () => {
    // Load the file from the config.yml in the project root
    fetch('/config.yml')
      .then(response => response.text())
      .then(text => {
        setKubeconfig(text);
        resetResults();
      })
      .catch(error => {
        console.error('Error loading config.yml:', error);
      });
  };

  const resetResults = () => {
    setTokenStatus(null);
    setNodesData(null);
    setClusterInfo(null);
    setDebugResult(null);
    setActiveTest(null);
  };

  const validateToken = async () => {
    if (!kubeconfig.trim()) {
      setTokenStatus({
        valid: false,
        error: 'Please provide a kubeconfig file'
      });
      return;
    }

    setIsLoading(true);
    setActiveTest('token');
    setTokenStatus(null);

    try {
      const isValid = await checkK8sToken(kubeconfig);
      setTokenStatus({
        valid: isValid,
        error: isValid ? undefined : 'Invalid token or could not extract token from kubeconfig'
      });
    } catch (error) {
      setTokenStatus({
        valid: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchNodes = async () => {
    if (!kubeconfig.trim()) {
      setNodesData({
        success: false,
        error: 'Please provide a kubeconfig file'
      });
      return;
    }

    setIsLoading(true);
    setActiveTest('nodes');
    setNodesData(null);

    try {
      const result = await getK8sNodes(kubeconfig);
      setNodesData({
        success: true,
        data: result
      });
    } catch (error) {
      setNodesData({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClusterInfo = async () => {
    if (!kubeconfig.trim()) {
      setClusterInfo({
        success: false,
        error: 'Please provide a kubeconfig file'
      });
      return;
    }

    setIsLoading(true);
    setActiveTest('clusterInfo');
    setClusterInfo(null);

    try {
      const result = await getClusterInfo(kubeconfig);
      setClusterInfo({
        success: true,
        data: result
      });
    } catch (error) {
      setClusterInfo({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runDebug = async () => {
    if (!kubeconfig.trim()) {
      setDebugResult({
        success: false,
        error: 'Please provide a kubeconfig file'
      });
      return;
    }

    setIsLoading(true);
    setActiveTest('debug');
    setDebugResult(null);

    try {
      const result = await debugKubeconfig(kubeconfig);
      setDebugResult({
        success: true,
        data: result
      });
    } catch (error) {
      setDebugResult({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      setIsLoading(false);
    }
  };

  const runAllTests = async () => {
    resetResults();
    setIsLoading(true);
    setActiveTest('all');
    
    try {
      // Run tests sequentially
      const tokenValid = await checkK8sToken(kubeconfig);
      setTokenStatus({ valid: tokenValid });
      
      if (tokenValid) {
        try {
          const nodes = await getK8sNodes(kubeconfig);
          setNodesData({ success: true, data: nodes });
        } catch (error) {
          setNodesData({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
        
        try {
          const info = await getClusterInfo(kubeconfig);
          setClusterInfo({ success: true, data: info });
        } catch (error) {
          setClusterInfo({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
        
        try {
          const debug = await debugKubeconfig(kubeconfig);
          setDebugResult({ success: true, data: debug });
        } catch (error) {
          setDebugResult({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }
    } catch (error) {
      console.error("Error running all tests:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStatusIcon = (success: boolean | null | undefined) => {
    if (success === null || success === undefined) return null;
    if (success) return <CheckCircle className="text-green-500 h-5 w-5" />;
    return <XCircle className="text-red-500 h-5 w-5" />;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>EKS Connection Debugging</CardTitle>
        <CardDescription>
          Debug your Amazon EKS cluster connection by validating kubeconfig and testing API access
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium">Kubeconfig</label>
              <div className="space-x-2">
                <Button variant="outline" size="sm" onClick={handlePasteConfig}>
                  Paste from Clipboard
                </Button>
                <Button variant="outline" size="sm" onClick={handleLoadFromFile}>
                  Load Sample Config
                </Button>
              </div>
            </div>
            <Textarea 
              value={kubeconfig} 
              onChange={(e) => setKubeconfig(e.target.value)}
              placeholder="Paste your kubeconfig YAML here..."
              className="font-mono text-xs h-48"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={validateToken} 
              disabled={isLoading || !kubeconfig.trim()}
              variant="outline"
            >
              Validate Token
            </Button>
            <Button 
              onClick={fetchNodes} 
              disabled={isLoading || !kubeconfig.trim()}
              variant="outline"
            >
              Check Nodes
            </Button>
            <Button 
              onClick={fetchClusterInfo} 
              disabled={isLoading || !kubeconfig.trim()}
              variant="outline"
            >
              Get Cluster Info
            </Button>
            <Button 
              onClick={runDebug} 
              disabled={isLoading || !kubeconfig.trim()}
              variant="outline"
            >
              Run Debug
            </Button>
            <Button 
              onClick={runAllTests} 
              disabled={isLoading || !kubeconfig.trim()}
            >
              Run All Tests
            </Button>
          </div>
          
          {isLoading && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Running tests...</span>
            </div>
          )}

          <Separator />
          
          {/* Results Section */}
          <div className="space-y-4">
            {/* Token Status */}
            {tokenStatus && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium">Token Check</h3>
                  {renderStatusIcon(tokenStatus.valid)}
                </div>
                
                {tokenStatus.valid ? (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertTitle>Valid Token</AlertTitle>
                    <AlertDescription>
                      The kubeconfig contains a valid EKS authentication token.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Token Issue</AlertTitle>
                    <AlertDescription>
                      {tokenStatus.error || 'Could not validate the token in the kubeconfig.'}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            
            {/* Nodes Data */}
            {nodesData && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium">Cluster Nodes</h3>
                  {renderStatusIcon(nodesData.success)}
                </div>
                
                {nodesData.success ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Successfully retrieved node information from the cluster.
                    </p>
                    <div className="bg-muted p-3 rounded-md">
                      <pre className="text-xs overflow-auto max-h-40">
                        {JSON.stringify(nodesData.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Failed to retrieve nodes</AlertTitle>
                    <AlertDescription>
                      {nodesData.error || 'Unknown error occurred while fetching node information.'}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            
            {/* Cluster Info */}
            {clusterInfo && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium">Cluster Info</h3>
                  {renderStatusIcon(clusterInfo.success)}
                </div>
                
                {clusterInfo.success ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Successfully retrieved cluster information.
                    </p>
                    <div className="bg-muted p-3 rounded-md">
                      <pre className="text-xs overflow-auto max-h-40">
                        {JSON.stringify(clusterInfo.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Failed to retrieve cluster information</AlertTitle>
                    <AlertDescription>
                      {clusterInfo.error || 'Unknown error occurred while fetching cluster information.'}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
            
            {/* Debug Results */}
            {debugResult && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium">Detailed Debug Information</h3>
                  {renderStatusIcon(debugResult.success)}
                </div>
                
                {debugResult.success ? (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Successfully gathered debug information for kubeconfig.
                    </p>
                    <div className="bg-muted p-3 rounded-md">
                      <pre className="text-xs overflow-auto max-h-40">
                        {JSON.stringify(debugResult.data, null, 2)}
                      </pre>
                    </div>
                  </div>
                ) : (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Debug Information Error</AlertTitle>
                    <AlertDescription>
                      {debugResult.error || 'Unknown error occurred while gathering debug information.'}
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-xs text-muted-foreground">
          Connection debugging tests use your kubeconfig to validate EKS cluster access.
        </p>
      </CardFooter>
    </Card>
  );
};

export default EksConnectionDebug;