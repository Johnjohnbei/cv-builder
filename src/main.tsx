import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import App from './App.tsx';
import './index.css';

const CLERK_PUBLISHABLE_KEY = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY;

function MissingConfig() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6 text-center">
      <div className="max-w-md stitch-panel p-8">
        <h1 className="text-xl font-bold text-red-600 mb-4">Configuration Requise</h1>
        <p className="text-sm text-gray-600 mb-6">
          La clé <strong>VITE_CLERK_PUBLISHABLE_KEY</strong> est manquante. 
          Veuillez l'ajouter dans le menu <strong>Settings</strong> d'AI Studio pour activer l'authentification.
        </p>
        <div className="bg-gray-100 p-4 rounded text-left text-[10px] font-mono">
          1. Allez dans Clerk Dashboard<br/>
          2. API Keys -&gt; Copy Publishable Key<br/>
          3. AI Studio -&gt; Settings -&gt; Add Variable
        </div>
      </div>
    </div>
  );
}

let convexUrl = (import.meta as any).env.VITE_CONVEX_URL || "";

if (convexUrl && !convexUrl.startsWith("http")) {
  convexUrl = `https://${convexUrl}`;
}

if (!convexUrl) {
  console.warn("⚠️ VITE_CONVEX_URL is not defined. Please set it in the AI Studio Settings.");
  convexUrl = "https://placeholder.convex.cloud";
}

const convex = new ConvexReactClient(convexUrl);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {!CLERK_PUBLISHABLE_KEY ? (
      <MissingConfig />
    ) : (
      <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <App />
        </ConvexProviderWithClerk>
      </ClerkProvider>
    )}
  </StrictMode>,
);
