import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Import the test user utility only in development mode
if (import.meta.env.DEV) {
  import('./utils/create-test-user');
}

createRoot(document.getElementById("root")!).render(<App />);
