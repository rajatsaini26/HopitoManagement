// src/context/AuthContext.js
import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom'; // Use useNavigate for navigation
import Constants from '../components/Constants'; // Assuming Constants is available

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [authStatus, setAuthStatus] = useState({
    isAuthenticated: false,
    user: null, // Stores { id, name, role }
    accessibleRoutes: [], // Stores array of route paths
    loading: true, // To indicate initial loading/auth check
  });
  const navigate = useNavigate();

  // Function to fetch accessible routes from backend
  const fetchAccessibleRoutes = async (role) => {
    try {
      // Ensure the correct API path for routes, based on your backend setup
      // If it's /api/games/routes, use that. If it's just /api/routes, adjust.
      const response = await axios.get(`${Constants.API}nav/checkRoutes`, { // Assuming /api/games/routes
        withCredentials: true // Crucial for sending session cookie
      });
      console.log('Fetched accessible routes:', response.data.routes);
      if (response.status === 200) {
        setAuthStatus(prev => ({
          ...prev,
          accessibleRoutes: response.data.routes // Store the array of routes
        }));
        return response.data.routes;
      }
      return [];
    } catch (error) {
      console.error('Failed to fetch accessible routes:', error.response?.data || error.message);
      setAuthStatus(prev => ({ ...prev, accessibleRoutes: [] }));
      return [];
    }
  };

  // Login function
  const login = async (mobile, password) => {
    try {
      const response = await axios.post(`${Constants.API}auth/login`, { mobile, password }, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true // Crucial for receiving and sending session cookie
      });

      const { user, userID, role } = response.data; // Backend sends 'user' (name), 'userID', 'role'

      // Update local storage (if still using JWT for some reason, otherwise remove)
      // For pure session-based auth, these localStorage items are often not needed
      // as the session cookie handles persistence.
      // However, if your backend also sends a JWT for other purposes, keep it.
      // localStorage.setItem("jwtToken", token); // Token is not in response.data in your backend login
      localStorage.setItem("user", user);
      localStorage.setItem("userID", userID);
      localStorage.setItem("role", role);

      setAuthStatus(prev => ({
        ...prev,
        isAuthenticated: true,
        user: { id: userID, name: user, role: role },
      }));

      // Fetch accessible routes immediately after successful login
      const routes = await fetchAccessibleRoutes(role);

      // Navigate based on role or a default route from accessible routes
      if (routes.includes('/admin/transactions') && role === 'admin') { // Check if Admin has access to Admin dashboard
        navigate('/admin');
      } else if (routes.includes('/scan') && role === 'employee') { // Check if Employee has access to scan
        navigate('/scan');
      } else {
        // Fallback or navigate to a general dashboard/home if no specific route matches
        navigate('/dashboard'); // Or any default route
      }

      return { success: true };

    } catch (error) {
      console.error("Login failed:", error.response?.data || error.message);
      setAuthStatus(prev => ({ ...prev, isAuthenticated: false, user: null, accessibleRoutes: [] }));
      return { success: false, message: error.response?.data?.message || "Failed to log in. Please try again." };
    }
  };

  // Logout function
   const logout = async () => {
    try {
      await axios.post(`${Constants.API}auth/logout`, {}, {
        withCredentials: true // Crucial for sending session cookie to destroy it
      });
    } catch (error) {
      console.error("Logout failed:", error.response?.data || error.message);
      // Even if API fails, clear local state for UX to ensure user can try logging in again
    } finally {
      // Clear all local storage items related to auth
      localStorage.removeItem("jwtToken");
      localStorage.removeItem("user");
      localStorage.removeItem("userID");
      localStorage.removeItem("role");

      setAuthStatus({
        isAuthenticated: false,
        user: null,
        accessibleRoutes: [],
        loading: false, // Not loading after logout
      });
      navigate('/login'); // Redirect to login page
    }
  };

  // Initial authentication check on component mount (e.g., on page reload)
  useEffect(() => {
    const checkAuthStatusOnLoad = async () => {
      try {
        // This endpoint should return user info if session is valid, else 401
        const response = await axios.get(`${Constants.API}auth/current-user`, { // You need to create this endpoint in auth.js
          withCredentials: true
        });

        if (response.status === 200) {
          const { user, userID, role } = response.data;
          setAuthStatus(prev => ({
            ...prev,
            isAuthenticated: true,
            user: { id: userID, name: user, role: role },
          }));
          await fetchAccessibleRoutes(role); // Fetch routes for the re-authenticated user
        } else {
          // Session invalid
          setAuthStatus(prev => ({ ...prev, isAuthenticated: false, user: null, accessibleRoutes: [] }));
        }
      } catch (error) {
        console.error("Initial auth check failed:", error.response?.data || error.message);
        setAuthStatus(prev => ({ ...prev, isAuthenticated: false, user: null, accessibleRoutes: [] }));
      } finally {
        setAuthStatus(prev => ({ ...prev, loading: false }));
      }
    };

    checkAuthStatusOnLoad();
  }, []); // Run once on component mount

  return (
    <AuthContext.Provider value={{ authStatus, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);