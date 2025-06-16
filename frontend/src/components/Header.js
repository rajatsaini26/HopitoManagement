import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./Header.css";
import logo from "../assests/logo.svg";
import { Logout } from "./API";

const Header = () => {
  const [role, setRole] = useState(localStorage.getItem("role") || "");
  const [user, setUser] = useState(localStorage.getItem("user") || "");
  const [isDropdownOpen, setDropdownOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const activeScreen = location.pathname;

  useEffect(() => {
    setRole(localStorage.getItem("role") || "");
    setUser(localStorage.getItem("user") || "");
  }, []);

  const toggleDropdown = () => {
    setDropdownOpen((prev) => !prev);
  };

  const jumpToScanner = () => {
    navigate("/scan");
  };

  return (
    <div>
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
            {activeScreen !== "/scan" && activeScreen !== "/register" && (
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
                <a onClick={Logout} className="dropdown-item">
                  Logout
                </a>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* Admin-specific navbar */}
      {role === "Admin" && activeScreen!="/" && (
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
              <button className="user-btn" onClick={Logout}>
                Logout
              </button>
            </div>
        </nav>
      )}
    </div>
  );
};

export default Header;
