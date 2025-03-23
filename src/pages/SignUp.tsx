
import { useState, useEffect } from "react";
import { SignUp as ClerkSignUp } from "@clerk/clerk-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { motion } from "framer-motion";

const SignUp = () => {
  const [isLoading, setIsLoading] = useState(true);
  
  // Use useEffect to set a timeout to hide the loading spinner after a reasonable delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500); // Adjust the timeout as needed
    
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
            {isLoading && (
              <div className="h-[400px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
            
            <div className={isLoading ? "hidden" : "block"}>
              <ClerkSignUp 
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none p-0 border-0",
                    formButtonPrimary: 
                      "bg-primary hover:bg-primary/90 text-white rounded-md",
                    footerAction: "text-primary hover:text-primary/90",
                  }
                }}
                signInUrl="/sign-in"
                afterSignUpUrl="/dashboard"
              />
            </div>
          </div>
        </div>
      </motion.main>
      
      <Footer />
    </div>
  );
};

export default SignUp;
