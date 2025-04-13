import React, { useState } from 'react';
import { Box, Button, Checkbox, Collapse, Divider, FormControlLabel, IconButton, List, ListItem, ListItemText, Paper, Typography } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { ResourceToMigrate, MigrationService } from '../services/MigrationService';
import { Cluster } from '../types/cluster';
import { toast } from 'react-toastify';

interface MigrationPanelProps {
  cluster: Cluster;
  resources: {
    pods: any[];
    services: any[];
    deployments: any[];
    statefulSets: any[];
    daemonSets: any[];
    configMaps: any[];
    secrets: any[];
    // Add other resource types as needed
  };
}

const MigrationPanel: React.FC<MigrationPanelProps> = ({ cluster, resources }) => {
  const [selectedResources, setSelectedResources] = useState<ResourceToMigrate[]>([]);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    pods: true,
    services: true,
    deployments: true,
    statefulSets: false,
    daemonSets: false,
    configMaps: false,
    secrets: false,
  });
  const [generatedYaml, setGeneratedYaml] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Map resources to the format needed for migration
  const mapResourcesToMigrateFormat = () => {
    const mappedResources: ResourceToMigrate[] = [];

    // Map pods
    resources.pods?.forEach(pod => {
      mappedResources.push({
        kind: 'Pod',
        name: pod.name,
        namespace: pod.namespace,
        apiVersion: 'v1',
      });
    });

    // Map services
    resources.services?.forEach(service => {
      mappedResources.push({
        kind: 'Service',
        name: service.name,
        namespace: service.namespace,
        apiVersion: 'v1',
      });
    });

    // Map deployments
    resources.deployments?.forEach(deployment => {
      mappedResources.push({
        kind: 'Deployment',
        name: deployment.name,
        namespace: deployment.namespace,
        apiVersion: 'apps/v1',
      });
    });

    // Map statefulSets
    resources.statefulSets?.forEach(statefulSet => {
      mappedResources.push({
        kind: 'StatefulSet',
        name: statefulSet.name,
        namespace: statefulSet.namespace,
        apiVersion: 'apps/v1',
      });
    });

    // Map daemonSets
    resources.daemonSets?.forEach(daemonSet => {
      mappedResources.push({
        kind: 'DaemonSet',
        name: daemonSet.name,
        namespace: daemonSet.namespace,
        apiVersion: 'apps/v1',
      });
    });

    // Map configMaps
    resources.configMaps?.forEach(configMap => {
      mappedResources.push({
        kind: 'ConfigMap',
        name: configMap.name,
        namespace: configMap.namespace,
        apiVersion: 'v1',
      });
    });

    // Map secrets
    resources.secrets?.forEach(secret => {
      mappedResources.push({
        kind: 'Secret',
        name: secret.name,
        namespace: secret.namespace,
        apiVersion: 'v1',
      });
    });

    return mappedResources;
  };

  // All available resources for migration
  const availableResources = mapResourcesToMigrateFormat();
  
  // Resources grouped by kind for display
  const groupedResources = MigrationService.groupResourcesByType(availableResources);

  // Toggle section expansion
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Handle resource selection
  const handleResourceToggle = (resource: ResourceToMigrate) => {
    setSelectedResources(prev => {
      const resourceKey = `${resource.kind}:${resource.namespace}:${resource.name}`;
      const isSelected = prev.some(r => 
        r.kind === resource.kind && 
        r.namespace === resource.namespace && 
        r.name === resource.name
      );

      if (isSelected) {
        return prev.filter(r => 
          !(r.kind === resource.kind && 
            r.namespace === resource.namespace && 
            r.name === resource.name)
        );
      } else {
        return [...prev, resource];
      }
    });
  };

  // Generate YAML for selected resources
  const handleGenerateYaml = async () => {
    if (!selectedResources.length) {
      toast.warning("Please select at least one resource to generate YAML");
      return;
    }

    if (!cluster?.kubeconfig) {
      toast.error("Missing kubeconfig for cluster");
      return;
    }

    setIsGenerating(true);
    try {
      const yaml = await MigrationService.generateYaml(
        cluster.kubeconfig, 
        selectedResources
      );
      setGeneratedYaml(yaml);
      toast.success("YAML generated successfully");
    } catch (error) {
      console.error("Error generating YAML:", error);
      toast.error(`Failed to generate YAML: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Download YAML as file
  const handleDownloadYaml = () => {
    if (!generatedYaml) {
      toast.warning("No YAML has been generated yet");
      return;
    }

    const blob = new Blob([generatedYaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `migration-${Date.now()}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Select all resources of a specific kind
  const handleSelectAllOfKind = (kind: string) => {
    const resourcesOfKind = groupedResources[kind] || [];
    
    // Check if all resources of this kind are already selected
    const allSelected = resourcesOfKind.every(resource => 
      selectedResources.some(r => 
        r.kind === resource.kind && 
        r.namespace === resource.namespace && 
        r.name === resource.name
      )
    );

    if (allSelected) {
      // Deselect all of this kind
      setSelectedResources(prev => 
        prev.filter(r => r.kind !== kind)
      );
    } else {
      // Select all of this kind that aren't already selected
      const newSelectedResources = [...selectedResources];
      
      resourcesOfKind.forEach(resource => {
        const isAlreadySelected = selectedResources.some(r => 
          r.kind === resource.kind && 
          r.namespace === resource.namespace && 
          r.name === resource.name
        );
        
        if (!isAlreadySelected) {
          newSelectedResources.push(resource);
        }
      });
      
      setSelectedResources(newSelectedResources);
    }
  };

  // Check if a resource is selected
  const isResourceSelected = (resource: ResourceToMigrate) => {
    return selectedResources.some(r => 
      r.kind === resource.kind && 
      r.namespace === resource.namespace && 
      r.name === resource.name
    );
  };

  return (
    <Box sx={{ mt: 2 }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Resource Migration
        </Typography>
        <Typography variant="body2" gutterBottom>
          Select resources to migrate and generate YAML manifests.
        </Typography>
        
        <Box sx={{ mt: 2, mb: 2 }}>
          <Typography variant="subtitle1">
            Selected Resources: {selectedResources.length}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Button 
              variant="contained" 
              color="primary"
              onClick={handleGenerateYaml}
              disabled={selectedResources.length === 0 || isGenerating}
            >
              {isGenerating ? 'Generating...' : 'Generate YAML'}
            </Button>
            
            <Button 
              variant="outlined"
              onClick={handleDownloadYaml}
              disabled={!generatedYaml}
            >
              Download YAML
            </Button>
          </Box>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Box>
          {Object.entries(groupedResources).map(([kind, resources]) => (
            <Box key={kind} sx={{ mb: 1 }}>
              <Box 
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  bgcolor: 'background.paper',
                  p: 1,
                  borderRadius: 1,
                  cursor: 'pointer'
                }}
                onClick={() => toggleSection(kind.toLowerCase())}
              >
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={resources.every(r => isResourceSelected(r))}
                        indeterminate={
                          resources.some(r => isResourceSelected(r)) && 
                          !resources.every(r => isResourceSelected(r))
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectAllOfKind(kind);
                        }}
                      />
                    }
                    label={`${kind} (${resources.length})`}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Box>
                <IconButton size="small" onClick={(e) => {
                  e.stopPropagation();
                  toggleSection(kind.toLowerCase());
                }}>
                  {expandedSections[kind.toLowerCase()] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                </IconButton>
              </Box>
              
              <Collapse in={expandedSections[kind.toLowerCase()]} timeout="auto" unmountOnExit>
                <List dense component="div" disablePadding>
                  {resources.map((resource, idx) => (
                    <ListItem 
                      key={`${resource.kind}-${resource.namespace}-${resource.name}-${idx}`}
                      dense
                      button
                      onClick={() => handleResourceToggle(resource)}
                      sx={{ pl: 4 }}
                    >
                      <Checkbox
                        edge="start"
                        checked={isResourceSelected(resource)}
                        tabIndex={-1}
                        disableRipple
                      />
                      <ListItemText 
                        primary={resource.name}
                        secondary={resource.namespace}
                      />
                    </ListItem>
                  ))}
                </List>
              </Collapse>
            </Box>
          ))}
        </Box>
      </Paper>

      {generatedYaml && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Generated YAML
          </Typography>
          <Box 
            component="pre" 
            sx={{ 
              mt: 2, 
              p: 2, 
              bgcolor: '#f5f5f5', 
              borderRadius: 1, 
              overflow: 'auto',
              maxHeight: '400px',
              fontSize: '0.875rem'
            }}
          >
            {generatedYaml}
          </Box>
        </Paper>
      )}
    </Box>
  );
};

export default MigrationPanel; 