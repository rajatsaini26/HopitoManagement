import React, { useEffect, useState } from "react";
import axios from "axios";
import "../css/addcard.css";
import SuccessMessage from "../components/Sucess";
import UnsuccessfulModal from "../components/Unsuccess";
import utils from "../components/Utils";

const AddCard = () => {
  const [userID, setUserID] = useState("");
  const [card, setCard] = useState("");
  const [emp, setEmp] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showUnsuccessModal, setShowUnsuccessModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [message, setMessage] = useState("");
  const [otp, setOTP] = useState("");
  const [utr, setUTR] = useState("");

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    address: "",
    phone: "",
    cardLevel: "1000", // Default value
  });

  useEffect(() => {
    utils.checkLoginCredentials();

    setUserID(localStorage.getItem("userID") || "");
    setEmp(localStorage.getItem("user") || "");
    const params = new URLSearchParams(window.location.search);
    setCard(params.get("card") || "");
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "phone") {
      // Allow only numbers and restrict to 10 digits
      setForm((prevForm) => ({ ...prevForm, phone: value.replace(/\D/g, "").slice(0, 10) }));
    } else {
      setForm((prevForm) => ({ ...prevForm, [name]: value }));
    }
  };

  const handleUTRChange = (e) => {
    // Allow only 5 digits
    setUTR(e.target.value.replace(/\D/g, "").slice(0, 5));
  };

  const checkCard = async (uid) => {
    try {
      const response = await axios.post(
        "http://localhost:5000/api/card/check-card",
        { card: uid },
        { headers: { "Content-Type": "application/json" } }
      );

      if (response.data.status === "1003" && response.data.route === "AddCard") {
        return true;
      } else if (response.data.status === "1001" && response.data.route === "RechargeScreen") {
        window.location.href = `/recharge?card=${uid}`;
      } else {
        console.error("Card exists but cannot be issued.");
        return false;
      }
    } catch (error) {
      console.error("Error checking card:", error.response?.data || error.message);
      return false;
    }
  };

  const handleNewCard = async (e) => {
    e.preventDefault();

    if (!userID || !card || !form.firstName || !form.lastName || !form.phone || !form.address || !otp || 
      (paymentMethod === "ONLINE" && !utr)) {
      setMessage("Please fill in all required fields.");
      setShowUnsuccessModal(true);
      return;
    }

    try {
      if (await checkCard(card)) {
        const body = {
          name: `${form.firstName} ${form.lastName}`,
          mobile: form.phone,
          address: form.address,
          card: card,
          userID: userID,
          balance: parseInt(form.cardLevel, 10),
          method: paymentMethod,
          pin: otp,
          utr: paymentMethod === "ONLINE" ? utr : null,
        };

        const response = await axios.post(
          "http://localhost:5000/api/card/issue",
          body,
          { headers: { "Content-Type": "application/json" } }
        );

        if (response.data.status === 1001) {
          setMessage(response.data.message);
          setShowSuccess(true);
          setTimeout(() => {
            window.location.href = "/scan";
          }, 1850);
        } else {
          setMessage(response.data.message);
          setShowUnsuccessModal(true);
        }
      } else {
        setShowUnsuccessModal(false);
      }
    } catch (error) {
      setMessage(error.message);
      setShowUnsuccessModal(true);
      console.error("Error issuing card:", error.response?.data || error.message);
    }
  };

  return (
    <div className="form-container">
      <h2 className="form-title">Add GCM-Card</h2>
      <p className="emp-id">( {emp} )</p>

      <form className="event-form" onSubmit={handleNewCard}>
        {/* Name Fields */}
        <div className="form-group">
          <label>Name</label>
          <div className="name-fields">
            <input
              type="text"
              name="firstName"
              value={form.firstName}
              onChange={handleInputChange}
              placeholder="First Name"
              className="form-input"
              required
            />
            <input
              type="text"
              name="lastName"
              value={form.lastName}
              onChange={handleInputChange}
              placeholder="Last Name"
              className="form-input"
              required
            />
          </div>
        </div>

        {/* Address */}
        <div className="form-group">
          <label>Address</label>
          <input
            type="text"
            name="address"
            value={form.address}
            onChange={handleInputChange}
            placeholder="Location"
            className="form-input"
            required
          />
        </div>

        {/* Phone */}
        <div className="form-group">
          <label>Phone</label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleInputChange}
            placeholder="Phone Number"
            className="form-input"
            required
          />
        </div>

        {/* PIN */}
        <div className="form-group">
          <label>PIN</label>
          <input
            type="password"
            name="pin"
            value={otp}
            onChange={(e) => setOTP(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="****"
            className="form-input"
            required
          />
        </div>

        {/* Card Level */}
        <div className="form-group">
          <label>Card-Level</label>
          <select
            name="cardLevel"
            value={form.cardLevel}
            onChange={handleInputChange}
            className="form-input"
            required
          >
            <option value="1000">1000</option>
            <option value="3000">3000</option>
            <option value="5000">5000</option>
          </select>
        </div>

        {/* Payment Method */}
        <div className="form-group">
          <label>Payment Method</label>
          <select
            className="form-input"
            value={paymentMethod}
            onChange={(e) => {
              setPaymentMethod(e.target.value);
              console.log("Payment method changed to:", e.target.value); // Debugging
            }}
          >
            <option value="CASH">CASH</option>
            <option value="ONLINE">ONLINE</option>
          </select>
        </div>

        {/* UTR Field (Only for Online Payment) */}
        {paymentMethod === "ONLINE" && (
          <div className="form-group">
            <label>UTR</label>
            <input
              type="text"
              name="UTR"
              value={utr}
              onChange={handleUTRChange}
              placeholder="Enter 5-digit UTR"
              className="form-input"
              required
            />
          </div>
        )}

        {/* Card */}
        <div className="form-group">
          <label>Card</label>
          <input
            type="text"
            readOnly
            name="card"
            value={card}
            className="form-input"
            required
          />
        </div>

        {/* Submit Button */}
        <button type="submit" className="form-submit-button">
          Add Card
        </button>
      </form>

      {/* Success & Error Messages */}
      {showSuccess && <SuccessMessage message={message} onClose={() => setShowSuccess(false)} />}
      {showUnsuccessModal && <UnsuccessfulModal message={message} onClose={() => setShowUnsuccessModal(false)} />}
    </div>
  );
};

export default AddCard;
