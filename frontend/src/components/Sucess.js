import React, { useEffect } from 'react';
import '../css/Success.css'; // Optional, for custom styling

const SuccessMessage = ({ message, onClose }) => {
    useEffect(() => {
        setTimeout(() => {
          window.location.href = "/scan";
        }, 1850); // Redirect after 5 seconds
      }, []);
    return (
        <div className="success-message-container">
            <div className="success-message">
                <span className="success-icon">✔</span>
                <span className="success-text">{message}</span>
                <button className="close-btn" onClick={onClose}>X</button>
            </div>
        </div>
    );
};

export default SuccessMessage;
