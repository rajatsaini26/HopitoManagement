import axios from "axios";
import Constants from "./Constants";

/**
 * APIHandler - A utility class for handling all API calls
 * This helper can be used across different screens/components
 */
class APIHandler {
  constructor() {
    this.baseURL = Constants.API;
  }

  /**
   * Generic method to handle API responses and errors
   */
  handleResponse = (response) => {
    return {
      success: true,
      message: response.data?.message || "Operation successful",
      data: response.data,
    };
  };

  handleError = (error) => {
    throw {
      success: false,
      message:
        error.response?.data?.message || error.message || "An error occurred",
      status: error.response?.status || 500,
    };
  };

  // ================== AUTHENTICATION METHODS ==================

  /**
   * Login user
   * @param {Object} data - { mobile, password }
   * @param {Function} setAuthStatus - Auth context setter function
   * @param {Function} fetchAccessibleRoutes - Auth context function
   * @returns {Promise}
   */
  login = async (data, setAuthStatus, fetchAccessibleRoutes) => {
    try {
      const { mobile, password } = data;

      const response = await axios.post(
        `${this.baseURL}auth/login`,
        { mobile, password },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      );

      const { user, userID, role } = response.data;

      localStorage.setItem("user", user);
      localStorage.setItem("userID", userID);
      localStorage.setItem("role", role);

      // Update auth status
      setAuthStatus((prev) => ({
        ...prev,
        isAuthenticated: true,
        user: { id: userID, name: user, role: role },
      }));

      // Fetch accessible routes and determine navigation
      const routes = await fetchAccessibleRoutes(role);
      let navigateTo = "/dashboard";

      if (routes.includes("/admin/transactions") && role === "admin") {
        navigateTo = "/admin";
      } else if (routes.includes("/scan") && role === "employee") {
        navigateTo = "/scan";
      }

      return {
        success: true,
        message: "Login successful",
        navigate: navigateTo,
        data: response.data,
      };
    } catch (error) {
      console.log(error);
      // Reset auth status on error
      setAuthStatus((prev) => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        accessibleRoutes: [],
      }));

      this.handleError(error);
    }
  };

  /**
   * Logout user
   * @param {Function} setAuthStatus - Auth context setter function
   * @returns {Promise}
   */
  logout = async (setAuthStatus) => {
    try {
      const response = await axios.post(
        `${this.baseURL}logout`,
        {},
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      );

      setAuthStatus((prev) => ({
        ...prev,
        isAuthenticated: false,
        user: null,
        accessibleRoutes: [],
      }));

      return {
        success: true,
        message: "Logout successful",
        navigate: "/login",
        data: response.data,
      };
    } catch (error) {
      this.handleError(error);
    }
  };

  getCurrentUser = async () => {
    try {
      const response = await axios.get(`${this.baseURL}current-user`, {
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  validatePin = async (data) => {
    try {
      const { pin } = data;
      const response = await axios.post(
        `${this.baseURL}validatePin`,
        { pin },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      );
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };



  updatePassword = async (data) => {
    try {
      const response = await axios.put(`${this.baseURL}update_pass`, data, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  // ================== EMPLOYEE MANAGEMENT METHODS ==================

  createEmployee = async (data) => {
    try {
      const response = await axios.post(`${this.baseURL}auth/register`, data, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

    // send empId
    fetchEmployee = async (data) => {
    try {
      const response = await axios.post(`${this.baseURL}auth/emp`, data, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

    updateEmployee = async (data) => {
    try {
      const response = await axios.put(`${this.baseURL}auth/update`, data, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  getEmployees = async () => {
    try {
      const response = await axios.get(`${this.baseURL}admin/emp_list`, {
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  // ================== CARD MANAGEMENT METHODS ==================

  checkCard = async (data) => {
    try {
      const response = await axios.post(`${this.baseURL}check-card`, data, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  rechargeCard = async (data) => {
    try {
      const response = await axios.post(`${this.baseURL}recharge`, data, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  issueCard = async (data) => {
    try {
      const response = await axios.post(`${this.baseURL}issue`, data, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  getCardTransactions = async (cardId) => {
    try {
      const response = await axios.get(
        `${this.baseURL}transactions/${cardId}`,
        {
          withCredentials: true,
        }
      );
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  getCardDetails = async (cardId) => {
    try {
      const response = await axios.get(`${this.baseURL}details/${cardId}`, {
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  // ================== GAME MANAGEMENT METHODS ==================

  addGame = async (data) => {
    try {
      const response = await axios.post(`${this.baseURL}add`, data, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  updateGame = async (data) => {
    try {
      const response = await axios.put(`${this.baseURL}update`, data, {
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  deleteGame = async (data) => {
    try {
      const response = await axios.delete(`${this.baseURL}delete`, {
        data: data,
        headers: { "Content-Type": "application/json" },
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  getGames = async () => {
    try {
      const response = await axios.get(`${this.baseURL}gameList`, {
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  getGameDetails = async (data) => {
    try {
      const response = await axios.get(`${this.baseURL}gamedetails`, {
        params: data,
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  // ================== SYSTEM METHODS ==================

  getTransactions = async () => {
    try {
      const response = await axios.get(`${this.baseURL}transactions`, {
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  getHistory = async () => {
    try {
      const response = await axios.get(`${this.baseURL}history`, {
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  getStats = async () => {
    try {
      const response = await axios.get(`${this.baseURL}stats`, {
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };

  checkRoutes = async () => {
    try {
      const response = await axios.get(`${this.baseURL}checkRoutes`, {
        withCredentials: true,
      });
      return this.handleResponse(response);
    } catch (error) {
      this.handleError(error);
    }
  };
}

// Create and export a singleton instance
const apiHandler = new APIHandler();
export default apiHandler;
