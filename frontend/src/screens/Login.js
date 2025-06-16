import React, { useEffect, useState } from "react";
import "../css/login.css";
import axios from "axios";
import {jwtDecode} from "jwt-decode"; // Correct import for jwt-decode
import Constants from "../components/Constants";
import utils from "../components/Utils";

const Login = () => {
    const [Phone, setPhone] = useState("");
    const [password, setPassword] = useState("");
    const [errorMessage, setErrorMessage] = useState("");

    // Check if the user is already logged in
    useEffect(() => {
            utils.checkLoginCredentials();
    }, []);

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

        const body = {
            mobile: Phone,
            password: password,
        };

        try {
           
            const response = await axios.post(`${Constants.API}auth/login`, body, {
                headers: { "Content-Type": "application/json" },
            });
            const { token, user, userID, role  } = response.data;
            localStorage.setItem("jwtToken", token);
            localStorage.setItem("user", user);
            localStorage.setItem("userID", userID);
            localStorage.setItem("role", role);

            console.log(response.data);
            if(response.data.role === 'Employee'){
                window.location.href = "/scan";
            } else if (response.data.role === 'Admin'){
                window.location.href = "/admin";
            }
        } catch (error) {
            console.error("Login error:", error.response?.data || error.message);
            setErrorMessage(
                 "Failed to log in. Please try again."
            );
        }
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
