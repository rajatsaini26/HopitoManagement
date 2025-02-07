import React, { useEffect, useState } from "react";
import axios from "axios";
import "../css/scanner.css";
import Footer from "../components/Footer";
import Constants from "../components/Constants";
import utils from "../components/Utils";

const Scanner = () => {

    useEffect(() => {
        utils.checkLoginCredentials();

        // Create WebSocket connection
        const socket = new WebSocket("ws://localhost:8080");

        socket.onopen = () => {
            console.log("Connected to WebSocket server");
        };

        socket.onmessage = async (event) => {
            const data = JSON.parse(event.data);
            console.log(data); // Parse the incoming message
            if (data.uid && data.location) {
                console.log(`UID: ${data.uid}, Location: ${data.location}`);
                await handleCard(data.uid, data.location); // Handle scanned card data
            } else {
                console.error("Received data in unexpected format:", data);
            }
        };

        socket.onerror = (error) => {
            console.error("WebSocket Error:", error);
        };

        return () => {
            socket.close(); // Clean up WebSocket on component unmount
        };
    }, []);

    const handleCard = async (uid, location) => {
        try {
            const userID = localStorage.getItem("userID");
            if (!userID) {
                console.error("User ID not found. Redirecting to login.");
                window.location.href = "/";
                return;
            }

            const body = {
                card: uid,
                // userID,
            };

            const response = await axios.post(`${Constants.API}card/check-card`, body, {
                headers: { "Content-Type": "application/json" },
            });

            const { status, route, balance } = response.data;
            console.log(status, route, balance);
            if (status == "1003" && route == "AddCard") {
                window.location.href = `/add?card=${uid}`;
            } else if (status === "1001" && route === "RechargeScreen") {
                window.location.href = `/recharge?card=${uid}&balance=${balance}`;
            } else {
                console.error("Card handling failed:", response.data.message || "Unknown issue.");
            }
        } catch (error) {
            console.error("Error during card handling:", error.response?.data || error.message);
        }
    };

    return (
        <div className="scanner-container">
            <div className="scanner-card">
                <div className="scanner-text">
                    <i className="fas fa-id-card fa-3x"></i>
                    <p>Scanning...</p>
                </div>
            </div>

            <p className="scanner-instructions">Please Scan Your Card</p>

            <div className="btn-container" id="action-buttons"></div>
            <Footer />
        </div>
    );
};

export default Scanner;
