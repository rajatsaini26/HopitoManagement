import React, { createContext, useContext, useState, useEffect } from 'react';

const RoleRoutesContext = createContext();

export function useRoleRoutes() {
  return useContext(RoleRoutesContext);
}

export function RoleRoutesProvider({ children }) {
  const [allowedRoutes, setAllowedRoutes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/routes', {
      credentials: 'include', // Use cookie for auth
    })
      .then(res => res.json())
      .then(data => {
        setAllowedRoutes(data.routes || []);
        setLoading(false);
      })
      .catch(() => {
        setAllowedRoutes([]);
        setLoading(false);
      });
  }, []);

  const isRouteAllowed = (route) => allowedRoutes.includes(route);

  return (
    <RoleRoutesContext.Provider value={{ allowedRoutes, isRouteAllowed, loading }}>
      {children}
    </RoleRoutesContext.Provider>
  );
} 