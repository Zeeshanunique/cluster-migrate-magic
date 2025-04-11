
import { cn } from '@/lib/utils';

interface BlurContainerProps {
  children: React.ReactNode;
  className?: string;
  intensity?: 'light' | 'medium' | 'heavy';
}

const BlurContainer = ({
  children,
  className,
  intensity = 'medium'
}: BlurContainerProps) => {
  const intensityClasses = {
    light: 'bg-white/30 dark:bg-gray-900/30 backdrop-blur-sm',
    medium: 'bg-white/50 dark:bg-gray-900/40 backdrop-blur-md',
    heavy: 'bg-white/70 dark:bg-gray-900/60 backdrop-blur-lg'
  };

  return (
    <div className={cn(
      'border border-white/20 dark:border-gray-800/30 rounded-lg',
      intensityClasses[intensity],
      className
    )}>
      {children}
    </div>
  );
};

export default BlurContainer;
