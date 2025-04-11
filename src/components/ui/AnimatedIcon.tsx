
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface AnimatedIconProps {
  icon: React.ReactNode;
  className?: string;
  animationClass?: string;
  initialDelay?: number;
  onAnimationComplete?: () => void;
}

const AnimatedIcon = ({
  icon,
  className,
  animationClass = 'animate-scale',
  initialDelay = 0,
  onAnimationComplete
}: AnimatedIconProps) => {
  const [isVisible, setIsVisible] = useState(initialDelay === 0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (initialDelay > 0) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, initialDelay);
      return () => clearTimeout(timer);
    }
  }, [initialDelay]);

  useEffect(() => {
    if (isVisible && !hasAnimated && onAnimationComplete) {
      const timer = setTimeout(() => {
        setHasAnimated(true);
        onAnimationComplete();
      }, 300); // Match this to your animation duration
      return () => clearTimeout(timer);
    }
  }, [isVisible, hasAnimated, onAnimationComplete]);

  return (
    <div
      className={cn(
        'transition-all transform',
        isVisible ? animationClass : 'opacity-0 scale-95',
        className
      )}
    >
      {icon}
    </div>
  );
};

export default AnimatedIcon;
