import React, { useState, useEffect } from "react";
import axios from "axios";
import "../css/employee_reg.css";
import SuccessMessage from "../components/Sucess";
import UnsuccessfulModal from "../components/Unsuccess";
import utils from "../components/Utils";

const Registration = () => {
    const [ShowSuccess, setShowSuccess] = useState(false);
    const [showUnsuccessModal, setshowUnsuccessModal] = useState(false);
    const [message, setMessage] = useState();
    const [mobile, setMobile] = useState("");
    const [name, setName] = useState("");
    const [address, setAddress] = useState("");
    const [password, setPassword] = useState("");
    const [pin, setPin] = useState("");
    const [role, setRole] = useState("Employee");

    const handleSubmit = (event) => {
        event.preventDefault();
    };

    useEffect(() => {
          utils.checkLoginCredentials();
      
    }, []);

    async function handleRegistration() {
        
        const body = {
            mobile: mobile,
            name: name,
            address: address,
            password: password,
            otp: pin,
            role: role,
        };

        try {
            const response = await axios.post(
                "http://localhost:5000/api/auth/register",
                body,
                {
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );
            setMessage(response.data.message);
            setShowSuccess(true);
            window.location.href = "/admin";
            console.log("Success:", response.data); // Process the response data
        } catch (error) {
            setMessage(error.message);
            setshowUnsuccessModal(true);
            console.error("Error:", error.response?.data || error.message); // Log the error
        }
    }

    return (
        <div className="container">
            <div className="registration-container">
                <h1 className="registration-title">
                    <i>Employee Registration</i>
                </h1>
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
                            type="number"
                            placeholder="PIN"
                            value={pin}
                            maxLength={4}
                            onChange={(e) => setPin(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Role</label>
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            required
                        >
                            <option value="" disabled>
                                Select Role
                            </option>
                            <option value="Manager">Manager</option>
                            <option value="Employee">Employee</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        className="registration-button"
                        onClick={handleRegistration}
                    >
                        Register
                    </button>
                </form>
                {ShowSuccess && message && (
                    <SuccessMessage
                        message={message}
                        onClose={() => setShowSuccess(false)}
                    />
                )}
                {showUnsuccessModal && message && (
                    <UnsuccessfulModal
                        message={message}
                        onClose={() => setshowUnsuccessModal(false)}
                    />
                )}
            </div>
        </div>
    );
};

export default Registration;
