
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUser } from '@clerk/clerk-react';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import ClusterForm from '@/components/clusters/ClusterForm';
import { toast } from 'sonner';

const CreateCluster = () => {
  const { isSignedIn, isLoaded } = useUser();
  const navigate = useNavigate();
  
  // Redirect to sign in if not authenticated
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      toast.error("You must be signed in to create a cluster");
      navigate('/sign-in');
    }
  }, [isSignedIn, isLoaded, navigate]);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <main className="flex-grow pt-20">
        <div className="container px-4 mx-auto py-8">
          <div className="mb-8 flex flex-col">
            <h1 className="text-3xl font-bold">Create New Cluster</h1>
            <p className="text-muted-foreground mt-2">
              Configure and deploy a new Kubernetes cluster on AWS
            </p>
          </div>
          
          <ClusterForm />
        </div>
      </main>
      
      <Footer />
    </div>
  );
};

export default CreateCluster;
