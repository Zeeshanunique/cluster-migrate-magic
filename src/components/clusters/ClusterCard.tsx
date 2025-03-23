
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, Server, MoreHorizontal, Download, RefreshCw, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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
  cluster: {
    id: string;
    name: string;
    type: 'single' | 'multi';
    status: 'running' | 'pending' | 'failed';
    nodes: number;
    region: string;
    version: string;
    lastUpdated: string;
  };
}

const ClusterCard = ({ cluster }: ClusterCardProps) => {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  
  const statusColors = {
    running: 'bg-green-500',
    pending: 'bg-amber-500',
    failed: 'bg-red-500'
  };
  
  const typeColors = {
    single: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
    multi: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
  };

  const handleMigrate = () => {
    navigate(`/migration?cluster=${cluster.id}`);
  };
  
  const handleAction = (action: string) => {
    toast(`${action} cluster: ${cluster.name}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-subtle overflow-hidden"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center">
            <Server className="h-5 w-5 text-primary mr-2" />
            <h3 className="font-medium text-lg">{cluster.name}</h3>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${statusColors[cluster.status]}`} />
            <span className="text-xs font-medium capitalize">{cluster.status}</span>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleAction('Details')}>
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction('Download config')}>
                  <Download className="mr-2 h-4 w-4" /> 
                  Download Config
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleAction('Restart')}>
                  <RefreshCw className="mr-2 h-4 w-4" /> 
                  Restart
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={() => handleAction('Delete')}
                  className="text-red-600 dark:text-red-400"
                >
                  <Trash2 className="mr-2 h-4 w-4" /> 
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <Badge variant="outline" className={`${typeColors[cluster.type]} mb-4`}>
          {cluster.type === 'single' ? 'Single Cluster' : 'Multi Cluster'}
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
            <p className="font-medium">{cluster.version}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Updated</p>
            <p className="font-medium">{cluster.lastUpdated}</p>
          </div>
        </div>
      </div>
      
      <div className="px-6 py-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
        {cluster.type === 'single' ? (
          <Button 
            onClick={handleMigrate} 
            className="w-full"
          >
            Migrate to Multi-Cluster <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button 
            variant="outline" 
            onClick={() => handleAction('Manage')} 
            className="w-full"
          >
            Manage Cluster
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default ClusterCard;
