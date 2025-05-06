import { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, Clock, ArrowRightLeft, Server, Package, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react';
import { formatDistance } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { MigrationLog, migrationLogService } from '@/utils/dynamodb';

const MigrationLogs = () => {
  const [logs, setLogs] = useState<MigrationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Add refresh interval reference to clean up on unmount
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to fetch migration logs
  const fetchLogs = useCallback(async () => {
    try {
      if (!user?.id) {
        return;
      }
      
      const migrationLogs = await migrationLogService.getMigrationLogs(user.id);
      setLogs(migrationLogs);
      
      // Check if we have any in-progress migrations that need periodic updates
      const hasInProgress = migrationLogs.some(log => 
        log.status === 'in-progress' && log.resourcesMigrated !== log.resourcesTotal
      );
      
      // Set up periodic refresh if we have in-progress migrations
      if (hasInProgress) {
        if (!refreshIntervalRef.current) {
          console.log('Setting up refresh interval for in-progress migrations');
          refreshIntervalRef.current = setInterval(() => {
            fetchLogs();
          }, 10000); // Refresh every 10 seconds
        }
      } else {
        // Clear interval if no in-progress migrations
        if (refreshIntervalRef.current) {
          console.log('Clearing refresh interval - no in-progress migrations');
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
        }
      }
    } catch (error) {
      console.error('Failed to fetch migration logs:', error);
      toast.error('Failed to load migration logs');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Initial fetch
    fetchLogs();
    
    // Clean up interval on unmount
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [user, fetchLogs]);

  const getStatusBadge = (status: MigrationLog['status'], log: MigrationLog) => {
    // Consider a migration complete if all resources are migrated, regardless of status field
    if (log.resourcesMigrated === log.resourcesTotal && log.resourcesTotal > 0) {
      return <Badge className="bg-green-500">Completed</Badge>;
    }

    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Completed</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-500">In Progress</Badge>;
      default:
        return <Badge>Unknown</Badge>;
    }
  };

  const getStatusIcon = (status: MigrationLog['status'], log: MigrationLog) => {
    // Consider a migration complete if all resources are migrated, regardless of status field
    if (log.resourcesMigrated === log.resourcesTotal && log.resourcesTotal > 0) {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }

    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case 'in-progress':
        return (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
        );
      default:
        return null;
    }
  };

  const handleViewDetails = (log: MigrationLog) => {
    // For now, just navigate to the source cluster details
    navigate(`/cluster/${log.sourceCluster.id}`);
  };

  const handleRetryMigration = (log: MigrationLog) => {
    // Navigate to migration page with source and target clusters pre-selected
    navigate(`/migration?source=${log.sourceCluster.id}&target=${log.targetCluster.id}`);
  };

  const groupResourcesByType = (resources: any[]) => {
    const grouped: { [key: string]: any[] } = {};
    resources.forEach((resource) => {
      if (!grouped[resource.kind]) {
        grouped[resource.kind] = [];
      }
      grouped[resource.kind].push(resource);
    });
    return grouped;
  };

  // Calculate an estimated duration for completed migrations that don't have a duration field
  const getEstimatedDuration = (log: MigrationLog): number | null => {
    if (log.duration) return log.duration;
    
    // If no duration but migration is complete (all resources migrated), estimate from the creation timestamp
    if (log.resourcesMigrated === log.resourcesTotal && log.resourcesTotal > 0) {
      try {
        const createdAt = new Date(log.created_at).getTime();
        // If timestamp is in the ID, use that to calculate duration
        const idParts = log.id.split('-');
        if (idParts.length > 1 && !isNaN(Number(idParts[1]))) {
          const startTimestamp = Number(idParts[1]);
          // If reasonable startTimestamp from ID (after 2020), use that
          if (startTimestamp > 1577836800000) { // Jan 1, 2020
            return Math.floor((Date.now() - startTimestamp) / 1000);
          }
        }
        
        // Fallback: estimate 1 second per migrated resource with minimum 5 seconds
        return Math.max(log.resourcesMigrated, 5);
      } catch (e) {
        console.error('Error calculating estimated duration:', e);
        return null;
      }
    }
    
    return null;
  };

  return (
    <>
      <Navbar />
      <div className="container px-4 py-20 mx-auto max-w-7xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Migration Logs</h1>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setLoading(true);
              fetchLogs().then(() => setLoading(false));
            }}
            disabled={loading}
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Refresh
          </Button>
        </div>

        {loading ? (
          // Skeleton loading state
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-8 w-2/3" />
                  <Skeleton className="h-4 w-1/3 mt-2" />
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-4 w-1/4" />
                  </div>
                </CardContent>
                <CardFooter>
                  <Skeleton className="h-4 w-1/2" />
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : logs.length > 0 ? (
          <div className="grid grid-cols-1 gap-6">
            {logs.map((log) => (
              <Card key={log.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <ArrowRightLeft className="h-5 w-5" />
                      Migration {log.id.split('-')[1]}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(log.status, log)}
                      {getStatusBadge(log.status, log)}
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(log.created_at).toLocaleString()}
                    <span className="text-muted-foreground">
                      ({formatDistance(new Date(log.created_at), new Date(), { addSuffix: true })})
                    </span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-2 items-center">
                        <Server className="h-4 w-4 text-orange-500" />
                        <span className="font-medium">Source:</span> {log.sourceCluster.name}
                      </div>
                      <div className="flex gap-2 items-center">
                        <Server className="h-4 w-4 text-green-500" />
                        <span className="font-medium">Target:</span> {log.targetCluster.name}
                      </div>
                      <div className="flex gap-2 items-center mt-1">
                        <span className="font-medium">User:</span> 
                        {log.owner_id ? log.owner_id.split('-')[0] : 'Unknown'}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex gap-2 items-center">
                        <Package className="h-4 w-4" />
                        <span className="font-medium">Resources:</span> 
                        <div className="flex items-center">
                          <span className="font-mono bg-green-100 dark:bg-green-900/30 px-1.5 py-0.5 rounded text-sm">
                            {log.resourcesMigrated}/{log.resourcesTotal}
                          </span>
                          {log.resourcesFailed > 0 && (
                            <span className="text-red-500 ml-2 font-mono bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded text-sm">
                              {log.resourcesFailed} failed
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 items-center">
                        <Clock className="h-4 w-4" />
                        <span className="font-medium">Duration:</span> 
                        {log.resourcesMigrated === log.resourcesTotal && log.resourcesTotal > 0
                          ? (log.duration || getEstimatedDuration(log)
                              ? <span className="font-mono">
                                  {Math.floor((log.duration || getEstimatedDuration(log) || 0) / 60)}m {(log.duration || getEstimatedDuration(log) || 0) % 60}s
                                </span>
                              : <span className="font-mono">Completed</span>)
                          : log.status === 'in-progress' 
                            ? <span className="text-blue-500">In progress</span>
                            : log.duration 
                              ? <span className="font-mono">
                                  {Math.floor(log.duration / 60)}m {log.duration % 60}s
                                </span>
                              : <span className="text-gray-500">N/A</span>
                        }
                      </div>
                    </div>
                  </div>
                  
                  {/* Resource breakdown */}
                  {log.completedResources && log.completedResources.length > 0 && (
                    <div className="mt-4 border-t pt-3">
                      <h4 className="text-sm font-semibold mb-2">Resources by Type:</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(groupResourcesByType(log.completedResources)).map(([type, resources]) => (
                          <div key={type} className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded-full">
                            {type}: <span className="font-semibold">{resources.length}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {log.error && (
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-md text-sm">
                      <div className="font-semibold mb-1">Error:</div>
                      {log.error}
                    </div>
                  )}
                  
                  {log.failedResources && log.failedResources.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">Failed Resources:</h4>
                      <ul className="text-sm space-y-1">
                        {log.failedResources.slice(0, 3).map((resource, index) => (
                          <li key={index} className="text-red-600">
                            {resource.kind}/{resource.namespace}/{resource.name}: {resource.error}
                          </li>
                        ))}
                        {log.failedResources.length > 3 && (
                          <li className="text-sm text-muted-foreground">
                            +{log.failedResources.length - 3} more failed resources
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-between border-t pt-4">
                  <div>
                    {/* No badges needed here */}
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleViewDetails(log)}
                    >
                      View Details
                    </Button>
                    {log.status === 'failed' && (
                      <Button 
                        size="sm"
                        variant="default"
                        onClick={() => handleRetryMigration(log)}
                      >
                        Retry Migration
                      </Button>
                    )}
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium mb-2">No migration logs found</h3>
            <p className="text-muted-foreground mb-4">
              Once you migrate resources between clusters, the history will appear here.
            </p>
            <Button onClick={() => navigate('/migration')}>
              Start a Migration
            </Button>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default MigrationLogs; 