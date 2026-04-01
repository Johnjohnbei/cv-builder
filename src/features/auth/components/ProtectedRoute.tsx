import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@clerk/clerk-react';
import { Loader2 } from 'lucide-react';
import { SyncUser } from './SyncUser';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isLoaded, isSignedIn } = useAuth();
  const isGuest = sessionStorage.getItem('guest_access') === 'true';

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!isSignedIn && !isGuest) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <>
      {isSignedIn && <SyncUser />}
      {children}
    </>
  );
}
