import React, { useEffect, useState } from 'react';
import { jwtDecode } from "jwt-decode";

import '../css/scanner.css';
import Footer from "../components/Footer";

const Scanner = ({ user }) => {
    const [rfidData, setRfidData] = useState(null);

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

        // Create WebSocket connection
        const socket = new WebSocket('ws://localhost:8080');

        socket.onopen = () => {
            console.log('Connected to WebSocket server');
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data); // Parse the incoming message
            // Handle the data (e.g., updating UI or logging UID and location)
            if (data.uid && data.location) {
                console.log(`UID: ${data.uid}, Location: ${data.location}`);
            }
        };

        socket.onerror = (error) => {
            console.error('WebSocket Error: ', error);
        };

        return () => {
            socket.close();
        };

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
            <Footer />
        </div>
    );
};

export default Scanner;
