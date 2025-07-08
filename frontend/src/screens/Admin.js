import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "../context/AuthContext"; // Import useAuth hook

import "../css/admin.css"; // Assuming you want to style the cards
import Footer from "../components/Footer";
import Header from "../components/Header";

const AdminPanel = () => {
  // Use authStatus directly from context, no need for separate user/role state here
  const { authStatus, loading } = useAuth(); // Access loading state too
  const navigate = useNavigate();

  // Define all possible cards with their corresponding required backend route paths
  // Use 'requiredRoute' to match entries in authStatus.accessibleRoutes
  const allCards = [
    { title: "Transactions", link: "/admin/reports", requiredRoute: "/admin/transactions" }, // Backend path for reports
    { title: "Individual Transaction", link: "/admin/history", requiredRoute: "/admin/history" }, // Backend path for history
    { title: "Manage Employee", link: "/admin/emps", requiredRoute: "/admin/emps" }, // Backend path for employee list
    { title: "Manage Ports", link: "/manage-ports", requiredRoute: "/manage-games-api-endpoint" }, // Placeholder, ensure this matches a backend API path if protected
    { title: "Manage Games", link: "/admin/games", requiredRoute: "/admin/games" }, // Backend path for games list
    { title: "Check Card", link: "/scan", requiredRoute: "/scan" }, // Backend path for scan/check card functionality
    // Add more cards for other admin functions as needed
  ];

  // Filter cards based on accessibleRoutes
  const accessibleCards = allCards.filter(card => {
    if (loading) return false;

    // If a card doesn't have a requiredRoute, assume it's always accessible (or handle appropriately)
    if (!card.requiredRoute) return true;

    // Check if the user's accessibleRoutes includes the card's requiredRoute
    return authStatus.accessibleRoutes.includes(card.requiredRoute);
  });

  // Effect to handle initial user state and potential redirects
  useEffect(() => {
    if (!loading && !authStatus.isAuthenticated && authStatus.accessibleRoutes) {
      navigate('/login');
    }
    // You might also want to check if the user is an 'admin' specifically
    // if this panel should *only* be visible to admins.
    // This is handled by PrivateRoute in App.js usually, but a double check here is fine.
    if (!loading && authStatus.isAuthenticated && authStatus.user?.role !== 'admin') {
        navigate('/unauthorized'); // Or '/dashboard'
    }
  }, [loading, authStatus.isAuthenticated, authStatus.user, navigate]);


  // Show loading state if authStatus is still loading
  if (loading) {
    return <div className="admin-panel-loading">Loading Admin Panel...</div>;
  }

  // Optionally, show a message if not authenticated (though PrivateRoute should handle this)
  if (!authStatus.isAuthenticated || authStatus.user?.role !== 'admin') {
      return <div className="admin-panel-unauthorized">Redirecting...</div>; // Should be caught by PrivateRoute
  }


  return (
    <div>
      <Header/>

      <div className="admin-panel">
        <h1>Welcome to Admin Panel, {authStatus.user?.name || authStatus.user?.username}!</h1>
        <div className="card-container">
          {accessibleCards.map((card, index) => (
            <div className="card" key={index} onClick={() => navigate(card.link)}>
              <h2>{card.title}</h2>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;