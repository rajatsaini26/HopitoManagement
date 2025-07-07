// src/App.js (Example)
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext'; // Import AuthProvider and useAuth
import Login from './screens/Login'; // Assuming Login is in components
import AdminDashboard from './screens/Admin'; // Create an AdminDashboard component
import ScanPage from './screens/Scanner'; // Create a ScanPage component
// Import other components as needed

// A simple PrivateRoute component to protect routes
const PrivateRoute = ({ children, allowedRoles, requiredRoute }) => {
  const { authStatus, loading } = useAuth();

  if (loading) {
    return <div>Loading authentication...</div>; // Or a spinner
  }

  if (!authStatus.isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(authStatus.user?.role)) {
    return <Navigate to="/unauthorized" replace />; // Redirect to an unauthorized page
  }

  // Check if the user has access to this specific route path from the backend
  if (requiredRoute && !authStatus.accessibleRoutes.includes(requiredRoute)) {
      return <Navigate to="/unauthorized" replace />; // Redirect if route not in accessibleRoutes
  }

  return children;
};

const App = () => {
  return (
    <Router>
      <AuthProvider> {/* Wrap your entire app with AuthProvider */}
        <AppContent />
      </AuthProvider>
    </Router>
  );
};

// Separate component to use useAuth hook
const AppContent = () => {
    const { authStatus } = useAuth(); // Access authStatus here

    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<Navigate to="/login" replace />} /> {/* Default redirect */}

            {/* Protected routes */}
            {/* <Route path="/scan" element={
                <PrivateRoute>
                    <ScanPage />
                </PrivateRoute>
            } /> */}
            <Route path="/scan" element={
                <PrivateRoute allowedRoles={['employee']} requiredRoute="/scan">
                    <ScanPage />
                </PrivateRoute>
            } />
            <Route path="/admin" element={
                <PrivateRoute allowedRoles={['admin']} requiredRoute="/admin/transactions"> {/* Assuming /admin/transactions is the default admin route */}
                    <AdminDashboard />
                </PrivateRoute>
            } />
            {/* Add more protected routes here */}
            <Route path="/unauthorized" element={<div>You are not authorized to view this page.</div>} />
            <Route path="*" element={<div>404 Not Found</div>} />
        </Routes>
    );
};

export default App;