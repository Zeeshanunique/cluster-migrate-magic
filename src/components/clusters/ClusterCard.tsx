import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Server, MoreHorizontal, Download, RefreshCw, Trash2, CheckSquare, AlertTriangle, Globe } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Cluster, clusterService } from '@/utils/dynamodb';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

interface ClusterCardProps {
  cluster: Cluster;
  onDelete: (clusterId: string) => void;
  onRestart: (clusterId: string) => void;
}

const ClusterCard = ({ cluster, onDelete, onRestart }: ClusterCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  
  const statusColors = {
    running: 'bg-green-500',
    pending: 'bg-amber-500',
    failed: 'bg-red-500'
  };
  
  const typeColors = {
    single: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    tenant: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const differenceInMs = now.getTime() - date.getTime();
    const differenceInHours = differenceInMs / (1000 * 60 * 60);
    
    if (differenceInHours < 1) {
      return 'Just now';
    } else if (differenceInHours < 24) {
      return `${Math.floor(differenceInHours)} hours ago`;
    } else {
      return `${Math.floor(differenceInHours / 24)} days ago`;
    }
  };

  const handleMigrate = () => {
    navigate(`/migration?cluster=${cluster.id}`);
  };
  
  const handleViewCheckpoints = () => {
    navigate('/checkpoints');
  };
  
  const handleViewDetails = (e: React.MouseEvent) => {
    // Prevent event from bubbling up to the card's onClick
    e.stopPropagation();
    navigate(`/cluster/${cluster.id}`);
  };
  
  const handleAction = (action: string) => {
    toast(`${action} cluster: ${cluster.name}`);
  };

  const handleDelete = async (e: React.MouseEvent) => {
    // Prevent navigation to cluster details
    e.stopPropagation();
    
    if (!user) return;
    
    if (window.confirm(`Are you sure you want to delete ${cluster.name}?`)) {
      setIsDeleting(true);
      try {
        const success = await clusterService.deleteCluster(cluster.id);
        if (success) {
          onDelete(cluster.id);
          toast.success(`Cluster "${cluster.name}" deleted successfully`);
        }
      } catch (error) {
        console.error('Error deleting cluster:', error);
        toast.error(`Failed to delete cluster ${cluster.name}`);
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const handleRestart = async () => {
    if (!user) return;
    
    setIsRestarting(true);
    try {
      // First, set status to pending
      await clusterService.updateCluster(cluster.id, { status: 'pending' });
      onRestart(cluster.id);
      
      // Simulate restart process
      setTimeout(async () => {
        await clusterService.updateCluster(cluster.id, { status: 'running' });
        onRestart(cluster.id);
        toast.success(`Cluster "${cluster.name}" restarted successfully`);
      }, 3000);
    } catch (error) {
      console.error('Error restarting cluster:', error);
      toast.error(`Failed to restart cluster ${cluster.name}`);
    } finally {
      setIsRestarting(false);
    }
  };

  const handleDownloadConfig = () => {
    if (cluster.kubeconfig) {
      const blob = new Blob([cluster.kubeconfig], { type: 'text/yaml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cluster.name}-kubeconfig.yaml`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Kubeconfig for "${cluster.name}" downloaded`);
    } else {
      toast.error(`No kubeconfig available for "${cluster.name}"`);
    }
  };

  const handleCheckConnectivity = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/cluster/${cluster.id}?check=connectivity`);
  };

  // Improve status label display
  const getStatusDisplay = (status: string) => {
    if (status === 'failed') {
      return {
        label: 'Unreachable',
        className: 'text-red-600 dark:text-red-400 font-semibold'
      };
    } else if (status === 'pending') {
      return {
        label: 'Pending',
        className: 'text-amber-600 dark:text-amber-400'
      };
    } else {
      return {
        label: status,
        className: ''
      };
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-white dark:bg-gray-800 rounded-lg border ${cluster.status === 'failed' ? 'border-red-300 dark:border-red-700' : 'border-gray-200 dark:border-gray-700'} shadow-subtle overflow-hidden transition-all duration-200 cursor-pointer ${isHovered ? 'shadow-md border-primary/30 scale-[1.01] dark:border-primary/40' : ''} ${cluster.status === 'failed' ? 'opacity-90' : ''}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => navigate(`/cluster/${cluster.id}`)}
    >
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center">
            <Server className={`h-5 w-5 ${cluster.status === 'failed' ? 'text-red-500' : 'text-primary'} mr-2`} />
            <h3 className="font-medium text-lg">{cluster.name}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${statusColors[cluster.status]} ${cluster.status === 'failed' ? 'animate-pulse' : ''}`} />
            <span className={`text-xs font-medium capitalize ${getStatusDisplay(cluster.status).className}`}>
              {getStatusDisplay(cluster.status).label}
            </span>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => e.stopPropagation()}>
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleViewDetails}>
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleCheckConnectivity}>
                  <Globe className="mr-2 h-4 w-4" /> 
                  Check Connectivity
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleViewCheckpoints}>
                  <CheckSquare className="mr-2 h-4 w-4" /> 
                  View Checkpoints
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleDownloadConfig}>
                  <Download className="mr-2 h-4 w-4" /> 
                  Download Config
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleRestart}
                  disabled={isRestarting || cluster.status === 'pending'}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${isRestarting ? 'animate-spin' : ''}`} /> 
                  {isRestarting ? 'Restarting...' : 'Restart'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> 
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {cluster.status === 'failed' && (
          <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 text-xs rounded border border-red-200 dark:border-red-800 flex items-center">
            <AlertTriangle className="h-3 w-3 mr-1 flex-shrink-0" />
            <span>This cluster is unreachable or may have been deleted</span>
          </div>
        )}
        
        <Badge variant="outline" className={`${typeColors[cluster.type]} mb-4`}>
          {cluster.type === 'single' ? 'Single Tenant' : 'Multi-Tenant'}
        </Badge>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-muted-foreground">Nodes</p>
            <p className="font-medium">{cluster.nodes}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Region</p>
            <p className="font-medium">{cluster.region}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Version</p>
            <p className="font-medium">v{cluster.version}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Updated</p>
            <p className="font-medium">{formatDate(cluster.created_at)}</p>
          </div>
        </div>
      </div>
      
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
        {cluster.type === 'single' ? (
          <Button 
            onClick={(e) => {
              e.stopPropagation();
              handleMigrate();
            }} 
            className="w-full"
          >
            Migrate to Multi-Tenant <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button 
            variant="outline" 
            onClick={(e) => {
              e.stopPropagation();
              handleAction('Manage');
            }} 
            className="w-full"
          >
            Manage Tenant Cluster
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default ClusterCard;
