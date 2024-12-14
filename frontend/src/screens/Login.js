import React, { useEffect, useState } from "react";
import "../css/login.css";
import axios from "axios";
import {jwtDecode} from "jwt-decode"; // Import jwt-decode

const Login = () => {
    const [Phone, setPhone] = useState("");
    const [password, setPassword] = useState("");

    
    const handleSubmit = async (event) => {
        event.preventDefault();
        const body = {
            "mobile": Phone,
            "password": password
        };

        try {
            const response = await axios.post('http://localhost:5000/api/auth/login', body, {
                headers: {
                    'Content-Type': 'application/json',
                },
            })
                .then(response => {
                    const { token, user, userID } = response.data;
                    localStorage.setItem('jwtToken', token);
                    localStorage.setItem('user', user);
                    localStorage.setItem('userID', userID);

                    // Optionally, redirect to a protected page or dashboard
                    window.location.href = '/scan';
                })
                .catch(e => {
                    console.error("error:", e);
                })

        } catch (error) {
            console.error('Error:', error.response?.data || error.message); // Log the error
        }
    };

    return (
        <div className="container">
            <div className="login-container">
                <h1 className="login-title"><i>Login</i></h1>
                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Mobile Number</label>
                        <input
                            type='number'
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
}

export default Login;
