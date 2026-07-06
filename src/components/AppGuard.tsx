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

  if (!initialized && location.pathname !== '/setup') {
    return <Navigate to="/setup" replace />;
  }

  if (initialized && instances.length === 0 && location.pathname !== '/welcome' && location.pathname !== '/setup') {
    return <Navigate to="/welcome" replace />;
  }

  if (initialized && instances.length > 0 && (location.pathname === '/setup' || location.pathname === '/welcome')) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
