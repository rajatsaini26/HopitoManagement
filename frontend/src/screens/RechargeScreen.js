import React, { useEffect, useState } from "react";
import axios from "axios";
import PinConfirmationModal from "../components/pinModal";
import SuccessMessage from "../components/Sucess";
import UnsuccessfulModal from "../components/Unsuccess";
import Constants from "../components/Constants";
import "../css/recharge.css"; // Import the updated CSS
import utils from "../components/Utils";

const Recharge = () => {
  const [showModal, setShowModal] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showUnsuccessModal, setShowUnsuccessModal] = useState(false);
  const [message, setMessage] = useState("");
  const [userID, setUserID] = useState("");
  const [pin, setPin] = useState("");
  const [emp, setEmp] = useState("");
  const [card, setCard] = useState("");
  const [balance, setBalance] = useState(0);
  const [rechargeAmount, setRechargeAmount] = useState(500);
  const [paymentMethod, setPaymentMethod] = useState("CASH");

  useEffect(() => {
    try {
          utils.checkLoginCredentials();

      const storedUserID = localStorage.getItem("userID");
      const storedEmp = localStorage.getItem("user");
      const params = new URLSearchParams(window.location.search);
      const cardNumber = params.get("card") || "";
      const cardBalance = parseInt(params.get("balance")) || 0;

      if (!storedUserID) {
        console.error("User not logged in. Redirecting to login.");
        window.location.href = "/";
        return;
      }

      setUserID(storedUserID);
      setEmp(storedEmp || "");
      setCard(cardNumber);
      setBalance(cardBalance);
    } catch (error) {
      console.error("Error during initialization:", error);
    }
  }, []);

  const validateInputs = () => {
    if (!userID || !card || !pin) {
      setMessage("Missing inputs");
      setShowUnsuccessModal(true);
      return false;
    }
    if (rechargeAmount <= 0) {
      setMessage("Invalid recharge amount.");
      setShowUnsuccessModal(true);
      return false;
    }
    return true;
  };

  const handleRecharge = async () => {
    if (!validateInputs()) return false;

    try {
      const body = { card, userID, recharge: rechargeAmount, method: paymentMethod, pin };
      const response = await axios.post(`${Constants.API}card/recharge`, body, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data.status === "1001") {
        setMessage(response.data.message || "Recharge successful.");
        setShowSuccess(true);
        window.location.href = `/scan`;
        return true;
      } else {
        setMessage(response.data.message || "Recharge failed.");
        setShowUnsuccessModal(true);
        return false;
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "Recharge error.");
      setShowUnsuccessModal(true);
      console.error("Recharge error:", error);
      return false;
    }
  };

  return (
    <div className="form-container">
      <h2 className="form-title">
        <i>Recharge GCM-Card</i>
      </h2>
      <p className="emp-name">({emp})</p>
      <form className="event-form" onSubmit={(e) => e.preventDefault()}>
        <div className="form-group">
          <label>Recharge Amount</label>
          <select
            className="form-input"
            value={rechargeAmount}
            onChange={(e) => setRechargeAmount(parseInt(e.target.value))}
          >
            <option value="500">500</option>
            <option value="1000">1000</option>
            <option value="2000">2000</option>
            <option value="4000">4000</option>
            <option value="6000">6000</option>
          </select>
        </div>
        <div className="form-group">
          <label>Payment Method</label>
          <select
            className="form-input"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value)}
          >
            <option value="CASH">CASH</option>
            <option value="ONLINE">ONLINE</option>
          </select>
        </div>
        <div className="form-group">
          <label>PIN</label>
          <input
            type="password"
            name="Emp PIN"
            value={pin}
            maxLength={4}
            className="form-input"
            onChange={(e) => setPin(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Card</label>
          <input type="text" readOnly name="card" value={card} className="form-input readonly" required />
        </div>
        <div className="form-group">
          <label>Available Balance</label>
          <input type="text" readOnly name="balance" value={balance} className="form-input readonly" required />
        </div>

        <button type="button" className="form-submit-button" onClick={handleRecharge}>
          Recharge
        </button>
      </form>

      {showModal && <PinConfirmationModal show={showModal} onClose={() => setShowModal(false)} />}
      {showSuccess && <SuccessMessage message={message} onClose={() => setShowSuccess(false)} />}
      {showUnsuccessModal && <UnsuccessfulModal message={message} onClose={() => setShowUnsuccessModal(false)} />}
    </div>
  );
};

export default Recharge;
