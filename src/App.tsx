import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Migration from "./pages/Migration";
import CreateCluster from "./pages/CreateCluster";
import AddCluster from "./pages/AddCluster";
import ClusterDetails from "./pages/ClusterDetails";
import MultiTenant from "./pages/MultiTenant";
import SignIn from "./pages/SignIn";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";
import MigrationLogs from "./pages/MigrationLogs";

const queryClient = new QueryClient();

// Protected route component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>;
  }

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AnimatePresence mode="wait">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/sign-in" element={<SignIn />} />
              <Route path="/sign-up" element={<SignUp />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/migration" element={<ProtectedRoute><Migration /></ProtectedRoute>} />
              <Route path="/create-cluster" element={<Navigate to="/add-cluster" replace />} />
              <Route path="/add-cluster" element={<ProtectedRoute><AddCluster /></ProtectedRoute>} />
              <Route path="/cluster/:id" element={<ProtectedRoute><ClusterDetails /></ProtectedRoute>} />
              <Route path="/multi-tenant" element={<ProtectedRoute><MultiTenant /></ProtectedRoute>} />
              <Route path="/logs" element={<ProtectedRoute><MigrationLogs /></ProtectedRoute>} />
              <Route path="/migration-logs" element={<ProtectedRoute><MigrationLogs /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AnimatePresence>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
