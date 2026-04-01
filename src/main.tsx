import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ConvexReactClient } from "convex/react";
import { ClerkProvider, useAuth } from "@clerk/clerk-react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { ErrorBoundary } from './shared/ui/ErrorBoundary';
import App from './App';
import './index.css';

const CLERK_PUBLISHABLE_KEY = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY;

function MissingConfig() {
  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6 text-center">
      <div className="max-w-md border border-[#DADCE0] bg-white rounded p-8">
        <h1 className="text-xl font-bold text-red-600 mb-4">Configuration requise</h1>
        <p className="text-sm text-gray-600 mb-6">
          La clé <strong>VITE_CLERK_PUBLISHABLE_KEY</strong> est manquante.
        </p>
        <div className="bg-gray-50 p-4 rounded text-left text-[10px] font-mono text-gray-600">
          1. Allez dans Clerk Dashboard<br />
          2. API Keys → Copy Publishable Key<br />
          3. Ajoutez-la dans .env.local
        </div>
      </div>
    </div>
  );
}

let convexUrl = (import.meta as any).env.VITE_CONVEX_URL || "";
if (convexUrl && !convexUrl.startsWith("http")) convexUrl = `https://${convexUrl}`;
if (!convexUrl) {
  console.warn("VITE_CONVEX_URL is not defined");
  convexUrl = "https://placeholder.convex.cloud";
}

const convex = new ConvexReactClient(convexUrl);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      {!CLERK_PUBLISHABLE_KEY ? (
        <MissingConfig />
      ) : (
        <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
          <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
            <App />
          </ConvexProviderWithClerk>
        </ClerkProvider>
      )}
    </ErrorBoundary>
  </StrictMode>,
);
