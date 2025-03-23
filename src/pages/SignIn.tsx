
import { useState } from "react";
import { SignIn as ClerkSignIn } from "@clerk/clerk-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { motion } from "framer-motion";

const SignIn = () => {
  const [isLoading, setIsLoading] = useState(true);

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
            <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
            <p className="text-muted-foreground">
              Sign in to your account to continue
            </p>
          </div>
          
          <div className="bg-card rounded-lg border shadow-sm p-6">
            {isLoading && (
              <div className="h-[400px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            )}
            
            <ClerkSignIn 
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: "shadow-none p-0 border-0",
                  formButtonPrimary: 
                    "bg-primary hover:bg-primary/90 text-white rounded-md",
                  footerAction: "text-primary hover:text-primary/90",
                }
              }}
              signUpUrl="/sign-up"
              afterSignInUrl="/dashboard"
              onLoad={() => setIsLoading(false)}
            />
          </div>
        </div>
      </motion.main>
      
      <Footer />
    </div>
  );
};

export default SignIn;
