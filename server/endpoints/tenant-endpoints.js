/**
 * Multi-tenant cluster endpoints for Kubernetes resources
 */

// Function to attach tenant endpoints to express app
export function attachTenantEndpoints(app, makeK8sRequestWithRetry) {
  // Get all tenant namespaces
  app.post('/kube-migrate/k8s/tenant/namespaces', async (req, res) => {
    try {
      const { kubeconfig } = req.body;
      
      if (!kubeconfig) {
        return res.status(400).json({ error: 'Missing kubeconfig in request body' });
      }
      
      // Get all namespaces
      const namespaces = await makeK8sRequestWithRetry(kubeconfig, '/api/v1/namespaces');
      
      // Filter to only include tenant namespaces
      // In a real implementation, you might use labels to identify tenant namespaces
      // For now, return all namespaces as tenant namespaces
      const tenantNamespaces = namespaces.items;
      
      // Return in the same format as the regular endpoint
      res.json({
        items: tenantNamespaces
      });
    } catch (error) {
      console.error('Error getting tenant namespaces:', error);
      res.status(500).json({ error: error.message || 'Failed to get tenant namespaces' });
    }
  });
  
  // Get all pods across all tenant namespaces
  app.post('/kube-migrate/k8s/tenant/pods', async (req, res) => {
    try {
      const { kubeconfig } = req.body;
      
      if (!kubeconfig) {
        return res.status(400).json({ error: 'Missing kubeconfig in request body' });
      }
      
      // Get all namespaces first
      const namespaces = await makeK8sRequestWithRetry(kubeconfig, '/api/v1/namespaces');
      
      // In a real implementation, filter for tenant namespaces
      // For now, use all namespaces
      const tenantNamespaces = namespaces.items.map(ns => ns.metadata.name);
      
      // Fetch pods for each tenant namespace and combine results
      const allTenantPods = { items: [] };
      
      for (const namespace of tenantNamespaces) {
        try {
          const pods = await makeK8sRequestWithRetry(
            kubeconfig, 
            `/api/v1/namespaces/${namespace}/pods`
          );
          
          if (pods.items && pods.items.length > 0) {
            allTenantPods.items = [...allTenantPods.items, ...pods.items];
          }
        } catch (error) {
          console.error(`Error getting pods for namespace ${namespace}:`, error);
          // Continue with other namespaces
        }
      }
      
      res.json(allTenantPods);
    } catch (error) {
      console.error('Error getting tenant pods:', error);
      res.status(500).json({ error: error.message || 'Failed to get tenant pods' });
    }
  });
  
  // Similar endpoints for other resources like deployments, services, etc.
  // Example for deployments
  app.post('/kube-migrate/k8s/tenant/deployments', async (req, res) => {
    try {
      const { kubeconfig } = req.body;
      
      if (!kubeconfig) {
        return res.status(400).json({ error: 'Missing kubeconfig in request body' });
      }
      
      // Get all namespaces first
      const namespaces = await makeK8sRequestWithRetry(kubeconfig, '/api/v1/namespaces');
      
      // In a real implementation, filter for tenant namespaces
      // For now, use all namespaces
      const tenantNamespaces = namespaces.items.map(ns => ns.metadata.name);
      
      // Fetch deployments for each tenant namespace and combine results
      const allTenantDeployments = { items: [] };
      
      for (const namespace of tenantNamespaces) {
        try {
          const deployments = await makeK8sRequestWithRetry(
            kubeconfig, 
            `/apis/apps/v1/namespaces/${namespace}/deployments`
          );
          
          if (deployments.items && deployments.items.length > 0) {
            allTenantDeployments.items = [...allTenantDeployments.items, ...deployments.items];
          }
        } catch (error) {
          console.error(`Error getting deployments for namespace ${namespace}:`, error);
          // Continue with other namespaces
        }
      }
      
      res.json(allTenantDeployments);
    } catch (error) {
      console.error('Error getting tenant deployments:', error);
      res.status(500).json({ error: error.message || 'Failed to get tenant deployments' });
    }
  });
  
  // Endpoint to get resource usage across all tenant namespaces
  app.post('/kube-migrate/k8s/tenant/resource-usage', async (req, res) => {
    try {
      const { kubeconfig } = req.body;
      
      if (!kubeconfig) {
        return res.status(400).json({ error: 'Missing kubeconfig in request body' });
      }
      
      // Get all namespaces first
      const namespaces = await makeK8sRequestWithRetry(kubeconfig, '/api/v1/namespaces');
      
      // In a real implementation, filter for tenant namespaces
      // For now, use all namespaces
      const tenantNamespaces = namespaces.items.map(ns => ns.metadata.name);
      
      // For each namespace, get the resource usage from resource quotas
      const resourceUsage = [];
      
      for (const namespace of tenantNamespaces) {
        try {
          const quotas = await makeK8sRequestWithRetry(
            kubeconfig, 
            `/api/v1/namespaces/${namespace}/resourcequotas`
          );
          
          if (quotas.items && quotas.items.length > 0) {
            const namespaceUsage = {
              namespace,
              quotas: quotas.items.map(quota => ({
                name: quota.metadata.name,
                used: quota.status?.used || {},
                hard: quota.status?.hard || {}
              }))
            };
            
            resourceUsage.push(namespaceUsage);
          }
        } catch (error) {
          console.error(`Error getting resource quotas for namespace ${namespace}:`, error);
          // Continue with other namespaces
        }
      }
      
      res.json({ namespaces: resourceUsage });
    } catch (error) {
      console.error('Error getting tenant resource usage:', error);
      res.status(500).json({ error: error.message || 'Failed to get tenant resource usage' });
    }
  });
} 