import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ChevronDown, User, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const Navbar = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

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

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  // Get user initials for avatar
  const getUserInitials = () => {
    if (!user?.email) return '?';
    
    // Try to get initials from user metadata if available
    const userName = user.user_metadata?.name;
    if (userName) {
      return userName.split(' ')
        .map((name: string) => name[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
    }
    
    // Fallback to first letter of email
    return user.email[0].toUpperCase();
  };

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
          
          {user && (
            <Link 
              to="/dashboard" 
              className={`text-sm font-medium transition-colors hover:text-primary ${
                location.pathname === '/dashboard' ? 'text-primary' : 'text-foreground/80'
              }`}
            >
              Dashboard
            </Link>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="text-sm font-medium transition-colors hover:text-primary flex items-center">
                Solutions <ChevronDown size={16} className="ml-1" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild onClick={() => navigate('/migration')}>
                <Link to="/migration" className="w-full cursor-pointer">
                  Cluster Migration
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild onClick={() => navigate('/checkpoints')}>
                <Link to="/checkpoints" className="w-full cursor-pointer">
                  Checkpoints
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild onClick={() => navigate('/multi-tenant')}>
                <Link to="/multi-tenant" className="w-full cursor-pointer">
                  Multi-Tenant Management
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild onClick={() => navigate('/gitops')}>
                <Link to="/gitops" className="w-full cursor-pointer">
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
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Avatar className="h-9 w-9 cursor-pointer hover:opacity-80">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.email}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user.user_metadata?.name || 'User'}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/dashboard" className="cursor-pointer">Dashboard</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/create-cluster" className="cursor-pointer">Create Cluster</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-red-500 focus:text-red-500 cursor-pointer"
                  onClick={handleSignOut}
                >
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => navigate('/sign-in')}>
                Sign In
              </Button>
              <Button size="sm" onClick={() => navigate('/sign-up')}>
                Get Started
              </Button>
            </>
          )}
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
            
            {user && (
              <>
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
                  to="/checkpoints" 
                  className="text-sm font-medium py-2 transition-colors hover:text-primary"
                >
                  Checkpoints
                </Link>
                <Link 
                  to="/multi-tenant" 
                  className="text-sm font-medium py-2 transition-colors hover:text-primary"
                >
                  Multi-Tenant Management
                </Link>
                <Link 
                  to="/gitops" 
                  className="text-sm font-medium py-2 transition-colors hover:text-primary"
                >
                  GitOps Delivery
                </Link>
              </>
            )}
            
            <Link 
              to="/" 
              className="text-sm font-medium py-2 transition-colors hover:text-primary"
            >
              Documentation
            </Link>
            
            <div className="pt-4 flex flex-col space-y-2">
              {user ? (
                <>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getUserInitials()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="text-sm font-medium">
                        {user.user_metadata?.name || user.email}
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="destructive" 
                    className="w-full mt-4"
                    onClick={handleSignOut}
                  >
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate('/sign-in')}
                  >
                    Sign In
                  </Button>
                  <Button 
                    className="w-full"
                    onClick={() => navigate('/sign-up')}
                  >
                    Get Started
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
