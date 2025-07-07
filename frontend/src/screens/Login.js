// src/components/Login.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // Import useNavigate
import { useAuth } from "../context/AuthContext"; // Import useAuth hook
import "../css/login.css";
// import axios from "axios"; // No longer needed directly in Login component
// import {jwtDecode} from "jwt-decode"; // No longer needed directly in Login component
// import Constants from "../components/Constants"; // No longer needed directly in Login component
// import utils from "../components/Utils"; // No longer needed directly in Login component

const Login = () => {
    const [Phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");
    const { login, authStatus } = useAuth(); // Use the login function from AuthContext
    const navigate = useNavigate(); // Initialize useNavigate

    // Redirect if already authenticated
    useEffect(() => {
        if (authStatus.isAuthenticated && authStatus.accessibleRoutes.length > 0) {
            // Navigate to a default route based on role or accessible routes
            if (authStatus.accessibleRoutes.includes('/admin/transactions') && authStatus.user?.role === 'admin') {
                navigate('/admin');
            } else if (authStatus.accessibleRoutes.includes('/scan') && authStatus.user?.role === 'employee') {
                navigate('/scan');
            } else {
                navigate('/dashboard'); // Generic dashboard
            }
        }
    }, [authStatus.isAuthenticated, authStatus.accessibleRoutes, authStatus.user, navigate]);


    const validateInputs = () => {
        if (!Phone || !/^\d{10}$/.test(Phone)) {
            setErrorMessage("Enter a valid 10-digit mobile number.");
            return false;
        }
        if (!password) {
            setErrorMessage("Password cannot be empty.");
            return false;
        }
        setErrorMessage(""); // Clear error message
        return true;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (!validateInputs()) return;

        setErrorMessage(""); // Clear previous error messages before new attempt

        const result = await login(Phone, password); // Call login from context
        if (!result.success) {
            setErrorMessage(result.message || "Failed to log in. Please try again.");
        }
        // Navigation is now handled inside the login function in AuthContext
    };

    return (
        <div className="container">
            <div className="login-container">
                <h1 className="login-title"><i>Login</i></h1>
                <form className="login-form" onSubmit={handleSubmit}>
                    {errorMessage && <p className="error-message">{errorMessage}</p>}
                    <div className="form-group">
                        <label>Mobile Number</label>
                        <input
                            type="number"
                            placeholder="Mobile Number"
                            value={Phone}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (/^\d{0,10}$/.test(value)) {
                                    setPhone(value);
                                }
                            }}
                            maxLength={10}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="Enter your password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="login-button">Login</button>
                </form>
            </div>
        </div>
    );
};

export default Login;