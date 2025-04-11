import { useState, useEffect } from "react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import SignUpForm from "@/components/auth/SignUpForm";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

const SignUp = () => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Use useEffect to set a timeout to hide the loading spinner after a reasonable delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000); // Short delay for better UX
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      <motion.main 
        className="flex-grow flex items-center justify-center pt-24 pb-16 px-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
      >
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Create an Account</h1>
            <p className="text-muted-foreground">
              Sign up to get started with KubeMigrate
            </p>
          </div>
          
          <div className="bg-card rounded-lg border shadow-sm p-6">
            {isLoading ? (
              <div className="h-[500px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <SignUpForm />
            )}
          </div>
        </div>
      </motion.main>
      
      <Footer />
    </div>
  );
};

export default SignUp;
