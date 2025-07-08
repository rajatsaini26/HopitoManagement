import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import apiHandler from "./apiHandler";

/**
 * Custom hook for API operations with loading, error, and success states
 * This hook wraps the APIHandler and provides React-specific functionality
 */
export const useAPI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [apiResponse, setApiResponse] = useState(null);

   const authContext = useAuth();
  const navigate = useNavigate();
  

  // Check if auth context is properly initialized
  if (!authContext) {
    throw new Error("useAPI must be used within an AuthProvider");
  }

  const { setAuthStatus, fetchAccessibleRoutes } = authContext;

  /**
   * Reset all states
   */
  const resetStates = () => {
    setError("");
    setSuccess("");
    setApiResponse(null);
  };

  /**
   * Generic API call wrapper with loading states
   * @param {Function} apiCall - The API function to call
   * @param {any} data - Data to pass to the API function
   * @param {Object} options - Additional options
   * @returns {Promise}
   */
  const callAPI = async (apiCall, data = null, options = {}) => {
    setLoading(true);
    resetStates();

    try {
      let result;

      // Handle different API calls that need context functions
      if (apiCall === apiHandler.login) {
        result = await apiCall(data, setAuthStatus, fetchAccessibleRoutes);
      } else if (apiCall === apiHandler.logout) {
        result = await apiCall(setAuthStatus);
      } else {
        result = await apiCall(data);
      }

      setLoading(false);
      setSuccess(result.message || "Operation successful");
      setApiResponse(result.data);

      // Handle navigation if specified
      if (result.navigate && !options.preventNavigation) {
        navigate(result.navigate);
      }

      return result;
    } catch (error) {
      setLoading(false);
      setError(error.message || "An error occurred");
      console.error("API Error:", error);
      throw error;
    }
  };

  // ================== AUTHENTICATION METHODS ==================

  const login = (data, options) => callAPI(apiHandler.login, data, options);
  const logout = (options) => callAPI(apiHandler.logout, null, options);
  const getCurrentUser = (options) =>
    callAPI(apiHandler.getCurrentUser, null, options);
  const validatePin = (data, options) =>
    callAPI(apiHandler.validatePin, data, options);

  const updatePassword = (data, options) =>
    callAPI(apiHandler.updatePassword, data, options);

  // ================== EMPLOYEE MANAGEMENT METHODS ==================

  const createEmployee = (data, options) =>
    callAPI(apiHandler.createEmployee, data, options);
  const updateEmployee = (data, options) =>
    callAPI(apiHandler.updateEmployee, data, options);
  const fetchEmployee = (data, options) =>
    callAPI(apiHandler.fetchEmployee, data, options);
  const getEmployees = (options) =>
    callAPI(apiHandler.getEmployees, null, options);

  // ================== CARD MANAGEMENT METHODS ==================

  const checkCard = (data, options) =>
    callAPI(apiHandler.checkCard, data, options);
  const rechargeCard = (data, options) =>
    callAPI(apiHandler.rechargeCard, data, options);
  const issueCard = (data, options) =>
    callAPI(apiHandler.issueCard, data, options);
  const getCardTransactions = (cardId, options) =>
    callAPI(apiHandler.getCardTransactions, cardId, options);
  const getCardDetails = (cardId, options) =>
    callAPI(apiHandler.getCardDetails, cardId, options);

  // ================== GAME MANAGEMENT METHODS ==================

  const addGame = (data, options) => callAPI(apiHandler.addGame, data, options);
  const updateGame = (data, options) =>
    callAPI(apiHandler.updateGame, data, options);
  const deleteGame = (data, options) =>
    callAPI(apiHandler.deleteGame, data, options);
  const getGames = (options) => callAPI(apiHandler.getGames, null, options);
  const getGameDetails = (data, options) =>
    callAPI(apiHandler.getGameDetails, data, options);

  // ================== SYSTEM METHODS ==================

  const getTransactions = (options) =>
    callAPI(apiHandler.getTransactions, null, options);
  const getHistory = (options) => callAPI(apiHandler.getHistory, null, options);
  const getStats = (options) => callAPI(apiHandler.getStats, null, options);
  const checkRoutes = (options) =>
    callAPI(apiHandler.checkRoutes, null, options);

  return {
    // States
    loading,
    error,
    success,
    apiResponse,

    // Utility functions
    resetStates,
    callAPI,

    // Authentication
    login,
    logout,
    getCurrentUser,
    validatePin,
    updateEmployee,
    fetchEmployee,

    updatePassword,

    // Employee Management
    createEmployee,
    getEmployees,

    // Card Management
    checkCard,
    rechargeCard,
    issueCard,
    getCardTransactions,
    getCardDetails,

    // Game Management
    addGame,
    updateGame,
    deleteGame,
    getGames,
    getGameDetails,

    // System
    getTransactions,
    getHistory,
    getStats,
    checkRoutes,
  };
};
