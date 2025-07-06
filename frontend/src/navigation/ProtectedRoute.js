import React from 'react';
import { useLocation, Navigate } from 'react-router-dom';
import { useRoleRoutes } from './RoleRoutesContext';

export default function ProtectedRoute({ children, route }) {
  const { isRouteAllowed, loading } = useRoleRoutes();
  const location = useLocation();

  if (loading) return null; // or a loading spinner

  if (!isRouteAllowed(route)) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
} 