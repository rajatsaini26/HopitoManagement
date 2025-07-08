// import React, { useEffect, useState } from "react";
// import "../css/pinModal.css";  // Add custom styling for the modal
// import { ValidatePIN } from "./API";

// const PinConfirmationModal = ({ show, onClose, onConfirm, userID }) => {
//     const [upin, setuPin] = useState("");   // pin from database
//     const [error, setError] = useState("");

//     const handlePinChange = (e) => {
//         setuPin(e.target.value);
//     };
    
//     const handleSubmit = async () => {
//         console.log(userID, upin);
//         if (await ValidatePIN(upin, userID)) {
//             onConfirm();
//             setuPin("");
//             setError("");
//         } else {
//             setError("Invalid PIN. Please try again.");
//         }
//     };

//     return (
//         show && (
//             <div className="modal-overlay">
//                 <div className="modal-content">
//                     <h2>Enter PIN</h2>
//                     <input
//                         type="password"
//                         placeholder="Enter your PIN"
//                         value={upin}
//                         onChange={handlePinChange}
//                         maxLength="4"
//                         className="modal-input"
//                     />

//                     {error && <p className="error-message">{error}</p>}
//                     <div className="modal-actions">
//                         <button onClick={handleSubmit} className="confirm-btn">Confirm</button>
//                         <button onClick={onClose} className="cancel-btn">Cancel</button>
//                     </div>
//                 </div>
//             </div>
//         )
//     );
// };

// export default PinConfirmationModal;
