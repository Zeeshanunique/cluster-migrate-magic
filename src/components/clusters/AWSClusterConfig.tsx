import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EKSClusterConfig, generateKubeconfig } from '@/utils/aws';
import { Loader2, Upload, RefreshCw, Check } from 'lucide-react';
import { toast } from "sonner";
import { Cluster } from '@/utils/dynamodb';

interface AWSClusterConfigProps {
  title: string;
  config: EKSClusterConfig;
  onChange: (config: EKSClusterConfig) => void;
  readOnly?: boolean;
  clusterData?: Cluster | null;
}

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

const AWSClusterConfig: React.FC<AWSClusterConfigProps> = ({
  title,
  config,
  onChange,
  readOnly = false,
  clusterData
}) => {
  const [generatingKubeconfig, setGeneratingKubeconfig] = useState(false);
  const [showKubeconfig, setShowKubeconfig] = useState(!!config.kubeconfig);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Initialize from cluster data if available
  useEffect(() => {
    if (clusterData && !readOnly) {
      onChange({
        ...config,
        clusterName: clusterData.name,
        region: clusterData.region,
        kubeconfig: clusterData.kubeconfig || config.kubeconfig
      });
      
      if (clusterData.kubeconfig) {
        setShowKubeconfig(true);
      }
    }
  }, [clusterData]);

  const handleGenerateKubeconfig = async () => {
    if (!config.clusterName) {
      toast.error("Please enter a cluster name first");
      return;
    }

    setGeneratingKubeconfig(true);
    try {
      const kubeconfig = await generateKubeconfig(config);
      onChange({ ...config, kubeconfig });
      setShowKubeconfig(true);
      toast.success("Kubeconfig generated successfully");
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (error) {
      toast.error("Failed to generate kubeconfig");
    } finally {
      setGeneratingKubeconfig(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const kubeconfig = event.target?.result as string;
        onChange({ ...config, kubeconfig });
        toast.success("Kubeconfig file uploaded successfully");
        setShowKubeconfig(true);
      } catch (error) {
        toast.error("Invalid kubeconfig file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      {readOnly && clusterData && (
        <div className="bg-blue-50 dark:bg-blue-950/30 px-3 py-2 rounded-md text-sm text-blue-700 dark:text-blue-300 flex items-center">
          <Check className="h-4 w-4 mr-2" />
          Connected to {config.clusterName}
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`${title}-cluster-name`}>Cluster Name</Label>
          <Input
            id={`${title}-cluster-name`}
            placeholder="eks-cluster-name"
            value={config.clusterName}
            onChange={(e) => onChange({ ...config, clusterName: e.target.value })}
            disabled={readOnly}
            className={readOnly ? "opacity-80" : ""}
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor={`${title}-region`}>AWS Region</Label>
          <Select
            value={config.region}
            onValueChange={(value) => onChange({ ...config, region: value })}
            disabled={readOnly}
          >
            <SelectTrigger id={`${title}-region`} className={readOnly ? "opacity-80" : ""}>
              <SelectValue placeholder="Select AWS Region" />
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
      </div>
      
      <div className="flex items-center space-x-2">
        <Switch
          id={`${title}-use-iam-role`}
          checked={config.useIAMRole}
          onCheckedChange={(checked) => onChange({ ...config, useIAMRole: checked })}
          disabled={readOnly}
        />
        <Label 
          htmlFor={`${title}-use-iam-role`} 
          className={readOnly ? "opacity-80" : ""}
        >
          Use IAM Role for authentication
        </Label>
      </div>
      
      <div className="border rounded-md p-4 bg-muted/30">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-medium">Kubeconfig</h4>
          {!readOnly && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleGenerateKubeconfig}
                disabled={generatingKubeconfig || !config.clusterName}
              >
                {generatingKubeconfig ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Generate
              </Button>
              
              <div className="relative">
                <Button variant="outline" size="sm" asChild>
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
          )}
        </div>
        
        {(showKubeconfig && config.kubeconfig) ? (
          <Textarea
            value={config.kubeconfig}
            onChange={(e) => onChange({ ...config, kubeconfig: e.target.value })}
            rows={5}
            className="font-mono text-xs"
            disabled={readOnly}
          />
        ) : (
          <div className="text-center py-8 text-sm text-muted-foreground border border-dashed rounded">
            {readOnly ? "No kubeconfig available" : "No kubeconfig available. Generate or upload one."}
          </div>
        )}
      </div>
    </div>
  );
};

export default AWSClusterConfig;
