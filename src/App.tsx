import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import { ProtectedRoute } from './features/auth';
import { Layout } from './features/landing';
import { PageLoader } from './shared/ui/Spinner';

const HomePage = lazy(() => import('./features/landing/components/HomePage'));
const AuthPage = lazy(() => import('./features/auth/components/AuthPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EditorPage = lazy(() => import('./pages/EditorPage'));
const CoverLetterPage = lazy(() => import('./features/cover-letter/components/CoverLetterPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

export default function App() {
  return (
    <Router>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Layout><HomePage /></Layout>} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/sso-callback" element={<AuthenticateWithRedirectCallback />} />

          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <DashboardPage />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/editor/:id?"
            element={
              <ProtectedRoute>
                <EditorPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/cover-letter"
            element={
              <ProtectedRoute>
                <CoverLetterPage />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
