import { useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, CheckCircle, AlertTriangle, ChevronRight, MoreHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import BlurContainer from '@/components/ui/BlurContainer';

export type CheckpointStatus = 'completed' | 'in-progress' | 'pending' | 'failed';

interface CheckpointCardProps {
  checkpoint: {
    id: string;
    name: string;
    description: string;
    status: CheckpointStatus;
    progress: number;
    lastUpdated: string;
    clusterId: string;
    clusterName: string;
  };
  onDelete: (checkpointId: string) => void;
  onRestart: (checkpointId: string) => void;
}

const CheckpointCard = ({ checkpoint, onDelete, onRestart }: CheckpointCardProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);
  
  const statusIcons = {
    'completed': <CheckCircle className="h-5 w-5 text-green-500" />,
    'in-progress': <Clock className="h-5 w-5 text-blue-500 animate-pulse" />,
    'pending': <Clock className="h-5 w-5 text-gray-400" />,
    'failed': <AlertTriangle className="h-5 w-5 text-red-500" />
  };
  
  const statusColors = {
    'completed': 'bg-green-500',
    'in-progress': 'bg-blue-500',
    'pending': 'bg-gray-400',
    'failed': 'bg-red-500'
  };
  
  const statusText = {
    'completed': 'Completed',
    'in-progress': 'In Progress',
    'pending': 'Pending',
    'failed': 'Failed'
  };

  const handleResumeCheckpoint = () => {
    navigate(`/migration?checkpoint=${checkpoint.id}`);
  };
  
  const handleAction = (action: string) => {
    toast(`${action} checkpoint: ${checkpoint.name}`);
  };

  const handleDelete = async () => {
    if (!user) return;
    
    setIsDeleting(true);
    try {
      await onDelete(checkpoint.id);
    } catch (error) {
      console.error('Error in delete handler:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestart = async () => {
    if (!user || checkpoint.status === 'completed') return;
    
    setIsRestarting(true);
    try {
      await onRestart(checkpoint.id);
    } catch (error) {
      console.error('Error in restart handler:', error);
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <BlurContainer className="h-full p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center">
            {statusIcons[checkpoint.status]}
            <h3 className="font-medium text-lg ml-2">{checkpoint.name}</h3>
          </div>
          
          <div className="flex items-center space-x-1">
            <Badge variant={checkpoint.status === 'failed' ? 'destructive' : 'secondary'}>
              {statusText[checkpoint.status]}
            </Badge>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">More options</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Checkpoint Actions</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleAction('View details')}>
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleRestart} disabled={isRestarting || checkpoint.status === 'completed'}>
                  {isRestarting ? 'Restarting...' : 'Restart Checkpoint'}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="text-red-600 dark:text-red-400"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Checkpoint'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        <p className="text-sm text-muted-foreground mb-4">{checkpoint.description}</p>
        
        <div className="mb-6">
          <div className="flex justify-between text-sm mb-1">
            <span>Migration Progress</span>
            <span>{checkpoint.progress}%</span>
          </div>
          <Progress value={checkpoint.progress} className="h-2" />
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm mb-6">
          <div>
            <p className="text-muted-foreground">Cluster</p>
            <p className="font-medium">{checkpoint.clusterName}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Last Updated</p>
            <p className="font-medium">{checkpoint.lastUpdated}</p>
          </div>
        </div>
        
        <Button 
          onClick={handleResumeCheckpoint} 
          className="w-full"
          disabled={checkpoint.status === 'completed'}
        >
          {checkpoint.status === 'completed' ? 'Completed' : 'Resume Migration'} 
          <ChevronRight className="ml-2 h-4 w-4" />
        </Button>
      </BlurContainer>
      
      {isHovered && checkpoint.status === 'in-progress' && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute -top-2 -right-2 h-4 w-4 rounded-full bg-blue-500"
        />
      )}
    </motion.div>
  );
};

export default CheckpointCard;
