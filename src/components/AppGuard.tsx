import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSettingsStore, useStore } from '../lib';

interface AppGuardProps {
  children: ReactNode;
}

export default function AppGuard({ children }: AppGuardProps) {
  const location = useLocation();
  const initialized = useSettingsStore.getState().isInitialized();
  const instances = useStore.getState().instances;

  console.log('[AppGuard] 🎯 guard decision:', {
    initialized,
    instanceCount: instances.length,
    currentPath: location.pathname,
  });

  if (!initialized && location.pathname !== '/setup') {
    console.log('[AppGuard] 🎯 REDIRECT: not initialized → /setup');
    return <Navigate to="/setup" replace />;
  }

  if (initialized && instances.length === 0 && location.pathname !== '/welcome' && location.pathname !== '/setup') {
    console.log('[AppGuard] 🎯 REDIRECT: no instances → /welcome');
    return <Navigate to="/welcome" replace />;
  }

  if (initialized && instances.length > 0 && (location.pathname === '/setup' || location.pathname === '/welcome')) {
    console.log('[AppGuard] 🎯 REDIRECT: has instances → /');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
