
import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ChevronDown } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  return (
    <header
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled 
          ? 'py-3 backdrop-blur-lg bg-white/80 dark:bg-gray-900/80 shadow-sm' 
          : 'py-5 bg-transparent'
      }`}
    >
      <div className="container px-4 mx-auto flex items-center justify-between">
        <Link 
          to="/" 
          className="flex items-center space-x-2"
          aria-label="Homepage"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-cluster-blue to-cluster-indigo text-white font-bold">
            <span>K</span>
          </div>
          <span className="text-xl font-bold tracking-tight">KubeMigrate</span>
        </Link>
        
        <nav className="hidden md:flex items-center space-x-8">
          <Link 
            to="/" 
            className={`text-sm font-medium transition-colors hover:text-primary ${
              location.pathname === '/' ? 'text-primary' : 'text-foreground/80'
            }`}
          >
            Home
          </Link>
          
          <Link 
            to="/dashboard" 
            className={`text-sm font-medium transition-colors hover:text-primary ${
              location.pathname === '/dashboard' ? 'text-primary' : 'text-foreground/80'
            }`}
          >
            Dashboard
          </Link>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-sm font-medium transition-colors hover:text-primary flex items-center">
                Solutions <ChevronDown size={16} className="ml-1" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/migration" className="w-full cursor-pointer">
                  Cluster Migration
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/" className="w-full cursor-pointer">
                  Multi-Cluster Management
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/" className="w-full cursor-pointer">
                  GitOps Delivery
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Link 
            to="/" 
            className="text-sm font-medium transition-colors hover:text-primary text-foreground/80"
          >
            Documentation
          </Link>
        </nav>
        
        <div className="hidden md:flex items-center space-x-4">
          <Button variant="outline" size="sm">
            Sign In
          </Button>
          <Button size="sm">Get Started</Button>
        </div>
        
        <button 
          className="md:hidden" 
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      
      {isMobileMenuOpen && (
        <div className="md:hidden glass-panel absolute top-full left-0 w-full p-4 animate-in slide-in">
          <div className="flex flex-col space-y-4">
            <Link 
              to="/" 
              className="text-sm font-medium py-2 transition-colors hover:text-primary"
            >
              Home
            </Link>
            <Link 
              to="/dashboard" 
              className="text-sm font-medium py-2 transition-colors hover:text-primary"
            >
              Dashboard
            </Link>
            <Link 
              to="/migration" 
              className="text-sm font-medium py-2 transition-colors hover:text-primary"
            >
              Cluster Migration
            </Link>
            <Link 
              to="/" 
              className="text-sm font-medium py-2 transition-colors hover:text-primary"
            >
              Documentation
            </Link>
            <div className="pt-4 flex flex-col space-y-2">
              <Button variant="outline" className="w-full">
                Sign In
              </Button>
              <Button className="w-full">
                Get Started
              </Button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
