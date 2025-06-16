import React, { useEffect } from 'react';
import '../css/unsucess.css'; // Optional, for custom styling

const UnsuccessfulModal = ({ message, onClose }) => {
    useEffect(() => {
        setTimeout(() => {
          window.location.href = "/scan";
        }, 1850); // Redirect after 5 seconds
      }, []);
    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <span className="modal-title">{message}</span>
                <div className="modal-footer">
                    {/* <button className="close-button" onClick={handleclose}>Close</button> */}
                </div>
            </div>
        </div>
    );
};
export default UnsuccessfulModal;
