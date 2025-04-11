
import { useState, useEffect } from 'react';
import { ChevronRight, Box, Layers, RefreshCw, GitBranch, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import AnimatedIcon from '@/components/ui/AnimatedIcon';
import BlurContainer from '@/components/ui/BlurContainer';

const Hero = () => {
  const [animateStep, setAnimateStep] = useState(0);
  
  useEffect(() => {
    // Auto advance the animation steps
    if (animateStep < 4) {
      const timer = setTimeout(() => {
        setAnimateStep(prev => prev + 1);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [animateStep]);

  return (
    <div className="relative pt-20 lg:pt-24 overflow-hidden">
      {/* Background elements */}
      <div className="absolute inset-0 bg-grid opacity-30"></div>
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-cluster-blue/10 rounded-full blur-3xl"></div>
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-cluster-purple/10 rounded-full blur-3xl"></div>
      
      <div className="container px-4 mx-auto relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-12 py-10 lg:py-20">
          {/* Hero content */}
          <div className="w-full lg:w-1/2 space-y-6 text-center lg:text-left animate-in">
            <div className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-2">
              Kubernetes Cluster Migration Made Simple
            </div>
            
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              Seamlessly Migrate From <span className="text-gradient">Single to Multi-Cluster</span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto lg:mx-0">
              Transfer your Kubernetes clusters with all their metadata and authentication intact. 
              Our platform automates complex migration processes for robust multi-cluster environments.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4 justify-center lg:justify-start">
              <Button size="lg" asChild>
                <Link to="/dashboard">
                  Get Started <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to="/migration">
                  View Demo
                </Link>
              </Button>
            </div>
            
            <div className="flex items-center justify-center lg:justify-start pt-6 space-x-8">
              <div className="flex -space-x-4">
                <div className="w-12 h-12 rounded-full border-2 border-background bg-gray-100" />
                <div className="w-12 h-12 rounded-full border-2 border-background bg-gray-300" />
                <div className="w-12 h-12 rounded-full border-2 border-background bg-gray-200" />
                <div className="w-12 h-12 rounded-full border-2 border-background bg-white flex items-center justify-center text-xs font-medium">
                  +5K
                </div>
              </div>
              <div>
                <p className="text-sm font-medium">Trusted by 5,000+ DevOps teams</p>
              </div>
            </div>
          </div>
          
          {/* Hero graphic */}
          <div className="w-full lg:w-1/2 flex justify-center">
            <BlurContainer className="w-full max-w-lg p-8 h-[400px] animate-in-delay-1">
              <div className="relative h-full w-full">
                {/* Base cluster circle */}
                <div className="absolute top-1/2 left-1/4 transform -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full border-2 border-dashed border-cluster-blue/50 flex items-center justify-center">
                  <AnimatedIcon 
                    icon={<Box className="w-12 h-12 text-cluster-blue" />}
                    className="absolute" 
                  />
                  <span className="absolute -bottom-8 text-sm font-medium">Single Cluster</span>
                </div>
                
                {/* Multi cluster circle */}
                <div className="absolute top-1/2 right-1/4 transform translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full border-2 border-dashed border-cluster-purple/50 flex items-center justify-center">
                  <AnimatedIcon 
                    icon={<Layers className="w-14 h-14 text-cluster-purple" />}
                    className="absolute"
                    initialDelay={1000}
                  />
                  <span className="absolute -bottom-8 text-sm font-medium">Multi-Cluster</span>
                </div>
                
                {/* Migration arrow */}
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-24">
                  <AnimatedIcon 
                    icon={<RefreshCw className="w-10 h-10 text-primary animate-spin-slow" />}
                    initialDelay={800}
                  />
                </div>
                
                {/* Floating icons */}
                <AnimatedIcon 
                  icon={<GitBranch className="w-6 h-6 text-cluster-teal" />}
                  className="absolute top-1/4 left-1/3"
                  animationClass="animate-float"
                  initialDelay={1200}
                />
                
                <AnimatedIcon 
                  icon={<Shield className="w-6 h-6 text-cluster-amber" />}
                  className="absolute bottom-1/4 right-1/3"
                  animationClass="animate-float"
                  initialDelay={1400}
                />
              </div>
            </BlurContainer>
          </div>
        </div>
        
        {/* Logos section */}
        <div className="py-10 lg:py-16 border-t border-gray-200 dark:border-gray-800">
          <p className="text-center text-sm font-medium text-muted-foreground mb-8">
            TRUSTED BY INNOVATIVE COMPANIES
          </p>
          <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16">
            {['Google', 'Microsoft', 'Amazon', 'IBM', 'Red Hat', 'Digital Ocean'].map((company) => (
              <div key={company} className="text-gray-400 dark:text-gray-500 font-medium text-lg">
                {company}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero;
