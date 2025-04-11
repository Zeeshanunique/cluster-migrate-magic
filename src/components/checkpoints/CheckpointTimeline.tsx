
import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Circle, Clock, AlertTriangle } from 'lucide-react';
import { CheckpointStatus } from './CheckpointCard';
import { cn } from '@/lib/utils';

interface TimelineStep {
  id: string;
  name: string;
  description: string;
  status: CheckpointStatus;
}

interface CheckpointTimelineProps {
  steps: TimelineStep[];
  currentStepId: string;
}

const CheckpointTimeline = ({ steps, currentStepId }: CheckpointTimelineProps) => {
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);
  
  const statusIcons = {
    'completed': <CheckCircle className="h-5 w-5" />,
    'in-progress': <Clock className="h-5 w-5 animate-pulse" />,
    'pending': <Circle className="h-5 w-5" />,
    'failed': <AlertTriangle className="h-5 w-5" />
  };
  
  const getStepClasses = (status: CheckpointStatus, isActive: boolean) => {
    const baseClasses = "transition-colors duration-200";
    
    switch (status) {
      case 'completed':
        return cn(baseClasses, "text-green-500 border-green-500");
      case 'in-progress':
        return cn(baseClasses, "text-blue-500 border-blue-500");
      case 'failed':
        return cn(baseClasses, "text-red-500 border-red-500");
      default:
        return cn(
          baseClasses, 
          isActive ? "text-blue-500 border-blue-500" : "text-gray-400 border-gray-300"
        );
    }
  };
  
  return (
    <div className="py-6">
      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-5 left-5 h-full w-0.5 bg-gray-200 dark:bg-gray-700" />
        
        {/* Steps */}
        <div className="relative space-y-8">
          {steps.map((step, index) => {
            const isActive = step.id === currentStepId;
            const isHovered = step.id === hoveredStep;
            
            return (
              <motion.div
                key={step.id}
                className="relative pl-14"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onMouseEnter={() => setHoveredStep(step.id)}
                onMouseLeave={() => setHoveredStep(null)}
              >
                {/* Step indicator */}
                <div 
                  className={cn(
                    "absolute left-0 flex items-center justify-center w-10 h-10 rounded-full border-2",
                    getStepClasses(step.status, isActive)
                  )}
                >
                  <div className={getStepClasses(step.status, isActive)}>
                    {statusIcons[step.status]}
                  </div>
                </div>
                
                {/* Step content */}
                <div>
                  <h4 className={cn(
                    "text-base font-medium transition-colors",
                    isActive || isHovered ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {step.name}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CheckpointTimeline;
