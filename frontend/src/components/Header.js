import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Header.css";
import logo from "../assests/logo.svg";
import { useAuth } from "../context/AuthContext"; // Correctly import useAuth hook

const Header = () => {
  // Access authStatus and logout function from the AuthContext
  const { authStatus, logout } = useAuth();

  // Use state from authStatus directly, or local state if needed for initial render
  const [role, setRole] = useState(authStatus.user?.role || localStorage.getItem("role") || "");
  const [user, setUser] = useState(authStatus.user?.name || localStorage.getItem("user") || "");
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const activeScreen = location.pathname;

  // Update local state when authStatus changes (e.g., after login/logout)
  useEffect(() => {
    setRole(authStatus.user?.role || localStorage.getItem("role") || "");
    setUser(authStatus.user?.name || localStorage.getItem("user") || "");
  }, [authStatus.user]); // Depend on authStatus.user

  const toggleDropdown = () => {
    setDropdownOpen((prev) => !prev);
  };

  const jumpToScanner = () => {
    navigate("/scan");
  };

  return (
    <div className="container">
      {/* General navbar for non-login/admin pages */}
      {activeScreen !== "/" && role !== "Admin" && (
        <nav className="navbar">
          <img
            className="brandLogo"
            src={logo}
            onClick={jumpToScanner}
            alt="Company Logo"
            width="120"
            height="60"
          />
          <div className="nav-links">
            {activeScreen !== "/scan" && activeScreen !== "/register" &&  (
              <button className="user-btn" onClick={jumpToScanner}>
                Scan Card
              </button>
            )}
            {activeScreen !== "/register" && user && (
              <button className="user-btn" onClick={toggleDropdown}>
                {user}
              </button>
            )}
            {isDropdownOpen && (
              <div className="dropdown open">
                <a onClick={logout} className="dropdown-item"> {/* Use logout from useAuth */}
                  Logout
                </a>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Admin-specific navbar */}
      {role === "Admin" && activeScreen !== "/" && (
        <nav className="navbar">
          <img
            className="brandLogo"
            src={logo}
            onClick={jumpToScanner}
            alt="Company Logo"
            width="120"
            height="60"
          />
            <div className="nav-links">
              <button className="user-btn" onClick={logout}> {/* Use logout from useAuth */}
                Logout
              </button>
            </div>
        </nav>
      )}
    </div>
  );
};

export default Header;
