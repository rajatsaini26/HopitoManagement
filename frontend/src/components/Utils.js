import React, { useState } from 'react';
import Constants from "./Constants";
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const APIHandler = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [apiResponse, setApiResponse] = useState(null);
  const { setAuthStatus, fetchAccessibleRoutes } = useAuth();
  const navigate = useNavigate();
  
  const handleAPICall = (apiType, data) => {
    setLoading(true);
    setError('');
    setSuccess('');
    setApiResponse(null);

    let apiPromise;

    switch (apiType) {
      // Authentication APIs
      case 'LOGIN':
        apiPromise = handleLogin(data);
        break;
      case 'LOGOUT':
        apiPromise = handleLogout();
        break;
      case 'CURRENT_USER':
        apiPromise = handleCurrentUser();
        break;
      case 'VALIDATE_PIN':
        apiPromise = handleValidatePin(data);
        break;
      case 'UPDATE_PROFILE':
        apiPromise = handleUpdateProfile(data);
        break;
      case 'UPDATE_PASSWORD':
        apiPromise = handleUpdatePassword(data);
        break;
      
      // Employee Management APIs
      case 'CREATE_EMPLOYEE':
        apiPromise = handleCreateEmployee(data);
        break;
      case 'GET_EMPLOYEES':
        apiPromise = handleGetEmployees();
        break;
      
      // Card Management APIs
      case 'CHECK_CARD':
        apiPromise = handleCheckCard(data);
        break;
      case 'RECHARGE_CARD':
        apiPromise = handleRechargeCard(data);
        break;
      case 'ISSUE_CARD':
        apiPromise = handleIssueCard(data);
        break;
      case 'CARD_TRANSACTIONS':
        apiPromise = handleCardTransactions(data);
        break;
      case 'CARD_DETAILS':
        apiPromise = handleCardDetails(data);
        break;
      
      // Game Management APIs
      case 'ADD_GAME':
        apiPromise = handleAddGame(data);
        break;
      case 'UPDATE_GAME':
        apiPromise = handleUpdateGame(data);
        break;
      case 'DELETE_GAME':
        apiPromise = handleDeleteGame(data);
        break;
      case 'GET_GAMES':
        apiPromise = handleGetGames();
        break;
      case 'GAME_DETAILS':
        apiPromise = handleGameDetails(data);
        break;
      
      // System APIs
      case 'GET_TRANSACTIONS':
        apiPromise = handleGetTransactions();
        break;
      case 'GET_HISTORY':
        apiPromise = handleGetHistory();
        break;
      case 'GET_STATS':
        apiPromise = handleGetStats();
        break;
      case 'CHECK_ROUTES':
        apiPromise = handleCheckRoutes();
        break;
      
      default:
        setLoading(false);
        setError('Invalid API call type');
        return;
    }

    apiPromise
      .then((response) => {
        setLoading(false);
        setSuccess(response.message || 'Operation successful');
        setApiResponse(response.data);
        if (response.navigate) {
          navigate(response.navigate);
        }
      })
      .catch((error) => {
        setLoading(false);
        setError(error.message || 'An error occurred');
        console.error('API Error:', error);
      });
  };

  // Authentication Methods
  const handleLogin = (data) => {
    const { mobile, password } = data;
    
    return axios.post(`${Constants.API}auth/login`, { mobile, password }, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true
    })
    .then((response) => {
      const { user, userID, role } = response.data;

      setAuthStatus(prev => ({
        ...prev,
        isAuthenticated: true,
        user: { id: userID, name: user, role: role },
      }));

      return fetchAccessibleRoutes(role)
        .then((routes) => {
          let navigateTo = '/dashboard';
          if (routes.includes('/admin/transactions') && role === 'Admin') {
            navigateTo = '/admin';
          } else if (routes.includes('/scan') && role === 'Cashier') {
            navigateTo = '/scan';
          }

          return {
            success: true,
            message: 'Login successful',
            navigate: navigateTo,
            data: response.data
          };
        });
    })
    .catch((error) => {
      setAuthStatus(prev => ({ 
        ...prev, 
        isAuthenticated: false, 
        user: null, 
        accessibleRoutes: [] 
      }));
      
      throw {
        success: false,
        message: error.response?.data?.message || "Failed to log in. Please try again."
      };
    });
  };

  const handleLogout = () => {
    return axios.post(`${Constants.API}logout`, {}, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true
    })
    .then((response) => {
      setAuthStatus(prev => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        accessibleRoutes: []
      }));

      return {
        success: true,
        message: 'Logout successful',
        navigate: '/login',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Logout failed. Please try again."
      };
    });
  };

  const handleCurrentUser = () => {
    return axios.get(`${Constants.API}current-user`, {
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Current user retrieved successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Failed to get current user."
      };
    });
  };

  const handleValidatePin = (data) => {
    const { pin } = data;
    
    return axios.post(`${Constants.API}validatePin`, { pin }, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'PIN validated successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "PIN validation failed."
      };
    });
  };

  const handleUpdateProfile = (data) => {
    return axios.put(`${Constants.API}update`, data, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Profile updated successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Profile update failed."
      };
    });
  };

  const handleUpdatePassword = (data) => {
    return axios.put(`${Constants.API}update_pass`, data, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Password updated successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Password update failed."
      };
    });
  };

  // Employee Management Methods
  const handleCreateEmployee = (data) => {
    return axios.post(`${Constants.API}emp`, data, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Employee created successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Employee creation failed."
      };
    });
  };

  const handleGetEmployees = () => {
    return axios.get(`${Constants.API}emp_list`, {
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Employees retrieved successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Failed to get employees."
      };
    });
  };

  // Card Management Methods
  const handleCheckCard = (data) => {
    return axios.post(`${Constants.API}check-card`, data, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Card checked successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Card check failed."
      };
    });
  };

  const handleRechargeCard = (data) => {
    return axios.post(`${Constants.API}recharge`, data, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Card recharged successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Card recharge failed."
      };
    });
  };

  const handleIssueCard = (data) => {
    return axios.post(`${Constants.API}issue`, data, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Card issued successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Card issue failed."
      };
    });
  };

  const handleCardTransactions = (data) => {
    const { cardId } = data;
    
    return axios.get(`${Constants.API}transactions/${cardId}`, {
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Card transactions retrieved successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Failed to get card transactions."
      };
    });
  };

  const handleCardDetails = (data) => {
    const { cardId } = data;
    
    return axios.get(`${Constants.API}details/${cardId}`, {
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Card details retrieved successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Failed to get card details."
      };
    });
  };

  // Game Management Methods
  const handleAddGame = (data) => {
    return axios.post(`${Constants.API}add`, data, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Game added successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Game addition failed."
      };
    });
  };

  const handleUpdateGame = (data) => {
    return axios.put(`${Constants.API}update`, data, {
      headers: { "Content-Type": "application/json" },
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Game updated successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Game update failed."
      };
    });
  };

  const handleDeleteGame = (data) => {
    return axios.delete(`${Constants.API}delete`, {
      data: data,
      headers: { "Content-Type": "application/json" },
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Game deleted successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Game deletion failed."
      };
    });
  };

  const handleGetGames = () => {
    return axios.get(`${Constants.API}gameList`, {
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Games retrieved successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Failed to get games."
      };
    });
  };

  const handleGameDetails = (data) => {
    return axios.get(`${Constants.API}gamedetails`, {
      params: data,
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Game details retrieved successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Failed to get game details."
      };
    });
  };

  // System Methods
  const handleGetTransactions = () => {
    return axios.get(`${Constants.API}transactions`, {
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Transactions retrieved successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Failed to get transactions."
      };
    });
  };

  const handleGetHistory = () => {
    return axios.get(`${Constants.API}history`, {
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'History retrieved successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Failed to get history."
      };
    });
  };

  const handleGetStats = () => {
    return axios.get(`${Constants.API}stats`, {
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Stats retrieved successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Failed to get stats."
      };
    });
  };

  const handleCheckRoutes = () => {
    return axios.get(`${Constants.API}checkRoutes`, {
      withCredentials: true
    })
    .then((response) => {
      return {
        success: true,
        message: 'Routes checked successfully',
        data: response.data
      };
    })
    .catch((error) => {
      throw {
        success: false,
        message: error.response?.data?.message || "Failed to check routes."
      };
    });
  };

  return (
    <div className="api-handler p-6 max-w-6xl mx-auto">
      {/* Loader */}
      {loading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg flex items-center space-x-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="text-gray-700">Processing...</span>
          </div>
        </div>
      )}

      <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">API Handler Component</h1>

      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
          <strong>Success:</strong> {success}
        </div>
      )}
</div>
  );
};

export default APIHandler;