// This script will add the multi-tenant cluster to your application
// Run it using Node.js: node add-multi-tenant-cluster.js

const fs = require('fs');
const YAML = require('yaml');
const { createClient } = require('@supabase/supabase-js');

// Configure Supabase (These should match your application's configuration)
const SUPABASE_URL = 'https://your-supabase-url.supabase.co';
const SUPABASE_KEY = 'your-supabase-service-key';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Get user ID to associate with the cluster
const USER_ID = 'your-user-id';

async function addMultiTenantCluster() {
  try {
    console.log('Reading kubeconfig file...');
    const kubeconfig = fs.readFileSync('./multi-tenant-kubeconfig.yaml', 'utf8');
    
    // Parse the kubeconfig to extract relevant information
    const parsedConfig = YAML.parse(kubeconfig);
    
    // Extract cluster name from the context
    const clusterName = parsedConfig.contexts[0].context.cluster.split('/').pop();
    
    // Extract region from the server URL
    const serverUrl = parsedConfig.clusters[0].cluster.server;
    const regionMatch = serverUrl.match(/eks\.([a-z0-9-]+)\.amazonaws\.com/);
    const region = regionMatch ? regionMatch[1] : 'us-west-2';
    
    // Create cluster payload
    const clusterData = {
      name: clusterName,
      type: 'tenant', // This is crucial for the multi-tenant recognition
      region: region,
      version: '1.28',
      nodes: 6, // Total nodes in the cluster (3 system + 3 tenant)
      status: 'running',
      owner_id: USER_ID,
      kubeconfig: kubeconfig,
      created_at: new Date().toISOString()
    };
    
    console.log('Adding cluster to Supabase...');
    console.log('Cluster data:', {
      ...clusterData,
      kubeconfig: '[REDACTED]' // Don't log sensitive information
    });
    
    // Insert the cluster into Supabase
    const { data, error } = await supabase
      .from('clusters')
      .insert([clusterData])
      .select();
    
    if (error) {
      throw error;
    }
    
    console.log('Multi-tenant cluster added successfully!');
    console.log('Cluster ID:', data[0].id);
    
    return data[0];
  } catch (error) {
    console.error('Error adding multi-tenant cluster:', error);
    throw error;
  }
}

// Execute the function
addMultiTenantCluster().catch(console.error); 