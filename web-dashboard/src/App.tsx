import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import './App.css';

// Lazy load pages for code splitting and performance
// Using dynamic imports to reduce initial bundle size
const Login = lazy(() =>
  import('./pages/Login').then(module => ({ default: module.Login }))
);
const Register = lazy(() =>
  import('./pages/Register').then(module => ({ default: module.Register }))
);
const Dashboard = lazy(() =>
  import('./pages/Dashboard').then(module => ({ default: module.Dashboard }))
);
const Bins = lazy(() =>
  import('./pages/Bins').then(module => ({ default: module.Bins }))
);
const Collections = lazy(() =>
  import('./pages/Collections').then(module => ({ default: module.Collections }))
);
const RoutesPage = lazy(() =>
  import('./pages/Routes').then(module => ({ default: module.Routes }))
);
const Analytics = lazy(() =>
  import('./pages/Analytics').then(module => ({ default: module.Analytics }))
);
const Alerts = lazy(() =>
  import('./pages/Alerts').then(module => ({ default: module.Alerts }))
);
const Settings = lazy(() =>
  import('./pages/Settings').then(module => ({ default: module.Settings }))
);
const NotFound = lazy(() =>
  import('./pages/NotFound').then(module => ({ default: module.NotFound }))
);

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Loading fallback component
const PageLoader: React.FC = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <LoadingSpinner size="lg" />
  </div>
);

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SocketProvider>
            <Router
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <div className="App" style={{ margin: 0, padding: 0 }}>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    {/* Public routes */}
                    <Route
                      path="/login"
                      element={
                        <ErrorBoundary>
                          <Login />
                        </ErrorBoundary>
                      }
                    />
                    <Route
                      path="/register"
                      element={
                        <ErrorBoundary>
                          <Register />
                        </ErrorBoundary>
                      }
                    />

                    {/* Protected routes */}
                    <Route
                      path="/"
                      element={
                        <ProtectedRoute>
                          <Layout />
                        </ProtectedRoute>
                      }
                    >
                      <Route index element={<Navigate to="/dashboard" replace />} />
                      <Route
                        path="dashboard"
                        element={
                          <ErrorBoundary>
                            <Dashboard />
                          </ErrorBoundary>
                        }
                      />
                      <Route
                        path="bins"
                        element={
                          <ErrorBoundary>
                            <Bins />
                          </ErrorBoundary>
                        }
                      />
                      <Route
                        path="collections"
                        element={
                          <ErrorBoundary>
                            <Collections />
                          </ErrorBoundary>
                        }
                      />
                      <Route
                        path="routes"
                        element={
                          <ErrorBoundary>
                            <RoutesPage />
                          </ErrorBoundary>
                        }
                      />
                      <Route
                        path="analytics"
                        element={
                          <ErrorBoundary>
                            <Analytics />
                          </ErrorBoundary>
                        }
                      />
                      <Route
                        path="alerts"
                        element={
                          <ErrorBoundary>
                            <Alerts />
                          </ErrorBoundary>
                        }
                      />
                      <Route
                        path="settings"
                        element={
                          <ErrorBoundary>
                            <Settings />
                          </ErrorBoundary>
                        }
                      />
                    </Route>

                    {/* 404 route */}
                    <Route
                      path="*"
                      element={
                        <ErrorBoundary>
                          <NotFound />
                        </ErrorBoundary>
                      }
                    />
                  </Routes>
                </Suspense>

                {/* Toast notifications */}
                <Toaster
                  position="top-right"
                  toastOptions={{
                    duration: 4000,
                    style: {
                      background: '#363636',
                      color: '#fff',
                    },
                    success: {
                      duration: 3000,
                      iconTheme: {
                        primary: '#22c55e',
                        secondary: '#fff',
                      },
                    },
                    error: {
                      duration: 5000,
                      iconTheme: {
                        primary: '#ef4444',
                        secondary: '#fff',
                      },
                    },
                    // Accessibility
                    ariaProps: {
                      role: 'status',
                      'aria-live': 'polite',
                    },
                  }}
                />
              </div>
            </Router>
          </SocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;

