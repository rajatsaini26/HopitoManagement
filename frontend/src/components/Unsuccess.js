import React from 'react';
import '../css/unsucess.css'; // Optional, for custom styling

const UnsuccessfulModal = ({ message, onClose }) => {
    const handleclose=()=>{
        window.location.href = `/scan`;
    }
    return (
        <div className="modal-overlay">
            <div className="modal-container">
                <span className="modal-title">{message}</span>
                <div className="modal-footer">
                    <button className="close-button" onClick={handleclose}>Close</button>
                </div>
            </div>
        </div>
    );
};
export default UnsuccessfulModal;
