
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from "@clerk/clerk-react";
import App from './App.tsx'
import './index.css'

// Get the publishable key from environment variables
// For this to work, you need to add your Clerk publishable key to your environment
// Create a .env file with VITE_CLERK_PUBLISHABLE_KEY=your_key or set it in your environment
const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Show a console warning if the key is missing, but allow the app to load for development
if (!PUBLISHABLE_KEY) {
  console.warn("⚠️ Clerk Publishable Key is missing. Authentication won't work properly.");
  console.info("To fix this, add your Clerk publishable key as VITE_CLERK_PUBLISHABLE_KEY in your environment.");
}

createRoot(document.getElementById("root")!).render(
  <ClerkProvider 
    publishableKey={PUBLISHABLE_KEY || "pk_test_placeholder_for_development"}
    clerkJSVersion="5.56.0-snapshot.v20250312225817"
    signInUrl="/sign-in"
    signUpUrl="/sign-up"
    signInFallbackRedirectUrl="/dashboard"
    signUpFallbackRedirectUrl="/"
    signInForceRedirectUrl="/dashboard"
    signUpForceRedirectUrl="/"
    afterSignOutUrl="/"
  >
    <App />
  </ClerkProvider>
);
