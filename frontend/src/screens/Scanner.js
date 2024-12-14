import React,{useEffect} from 'react';
import { jwtDecode } from "jwt-decode";

import '../css/scanner.css';
import Footer from "../components/Footer";

const Scanner = ({ user }) => {
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
    return (
        <div className="scanner-container">
            <div className="scanner-card">
                <div className="scanner-text">
                    <i className="fas fa-id-card fa-3x"></i>
                    <p>Scanning...</p>
                </div>
            </div>

            <p className="scanner-instructions">Please Scan Your Card</p>

            <div className="btn-container" id="action-buttons">
            </div>
        <Footer/>
        </div>
    );
};

export default Scanner;
