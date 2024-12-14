import React, { useState, useEffect } from "react";
import axios from 'axios';
import "../css/employee_reg.css";
import { jwtDecode } from "jwt-decode";

const Registration = () => {
    const [mobile, setMobile] = useState("");
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [password, setPassword] = useState("");
    const [pin, setPin] = useState("");

    const handleSubmit = (event) => {
        event.preventDefault();
        console.log("Mobile:", mobile);
        console.log("Name:", name);
        console.log("Address:", address);
        console.log("Password:", password);
        console.log("PIN:", pin);
        // Add your registration logic here
    };

    useEffect(() => {
        const isTokenExpired = () => {
            const token = localStorage.getItem('jwtToken');
            if (!token) return true;
            const decoded = jwtDecode(token, { complete: true });
            const currentTime = Date.now() / 1000; // Current time in seconds

        };

        if (isTokenExpired()) {
            localStorage.removeItem('jwtToken');
            window.location.href = '/'; // Redirect to login if the token is expired
        }
    }, []);

    async function handleRegistration() {
        const body = {
            mobile: mobile,
            name: name,
            address: address,
            password: password,
            otp: pin,
        };

        try {
            const response = await axios.post('http://localhost:5000/api/auth/register', body, {
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            console.log('Success:', response.data); // Process the response data
        } catch (error) {
            console.error('Error:', error.response?.data || error.message); // Log the error
        }
    }

    return (
        <div className="container">
            <div className="registration-container">
                <h1 className="registration-title"><i>Employee Registration</i></h1>
                <form className="registration-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Mobile Number</label>
                        <input
                            type="number"
                            placeholder="Mobile Number"
                            value={mobile}
                            onChange={(e) => {
                                const value = e.target.value;
                                if (/^\d{0,10}$/.test(value)) {
                                    setMobile(value);
                                }
                            }}
                            maxLength={10}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Name</label>
                        <input
                            type="text"
                            placeholder="Full Name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Address</label>
                        <input
                            type="text"
                            placeholder="Address"
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>PIN</label>
                        <input
                            type="text"
                            placeholder="PIN"
                            value={pin}
                            onChange={(e) => setPin(e.target.value)}
                            maxLength={6}
                            required
                        />
                    </div>
                    <button type="submit" className="registration-button" onClick={handleRegistration}>Register</button>
                </form>
            </div>
        </div>
    );
};

export default Registration;
