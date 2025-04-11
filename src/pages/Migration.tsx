
import { useEffect } from 'react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import MigrationWizard from '@/components/clusters/MigrationWizard';

const Migration = () => {
  // Simulate smooth scroll to top on page load
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-20">
        <div className="container px-4 mx-auto py-8">
          <div className="flex items-center mb-6">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground flex items-center">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Dashboard
            </Link>
          </div>
          
          <div className="max-w-5xl mx-auto mb-10">
            <h1 className="text-3xl font-bold text-center mb-2">Cluster Migration Wizard</h1>
            <p className="text-muted-foreground text-center max-w-2xl mx-auto">
              This wizard will guide you through the process of migrating your Kubernetes cluster 
              from a single cluster to a multi-cluster environment, preserving all metadata and authentication.
            </p>
          </div>
          
          <MigrationWizard />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default Migration;
