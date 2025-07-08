import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import utils from "../components/Utils";

const AddGames = () => {
  const [name, setName] = useState("");
  const [charge, setCharge] = useState(100.0);
  const [session, setSession] = useState("");
  const [discount, setDiscount] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showUnsuccessModal, setShowUnsuccessModal] = useState(false);
  const [message, setMessage] = useState("");
  const navigate = useNavigate();

  useEffect(()=>{
        
  });
  const handleNewGame = async (e) => {
    e.preventDefault();

    if (!name || !charge || !session) {
      setMessage("Please fill in all required fields.");
      setShowUnsuccessModal(true);
      return;
    }

    const body = {
      name,
      charge,
      discount,
      session,
    };

    try {
      const response = await axios.post(
        "http://localhost:5000/api/game/add",
        body,
        {
          headers: { "Content-Type": "application/json" },
        }
      );
      console.log(response.status);
      setMessage(response.data.message || "Game added successfully.");
      if ((response.status = 201)) {
        navigate("/admin/games");
      }
      // Clear the form after successful submission
      setName("");
      setCharge(100.0);
      setSession("");
      setDiscount(0);
    } catch (error) {
      setMessage("Failed to add game.");
      setShowUnsuccessModal(true);
    }
  };

  return (
    <div className="registration-container">
      <h1 className="registration-title">
        <i>Add Game</i>
      </h1>

      <form className="registration-form" onSubmit={handleNewGame}>
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            placeholder="Game Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            required
          />
        </div>
        <div className="form-group">
          <label>Charge</label>
          <input
            type="number"
            placeholder="Game Charge"
            value={charge}
            onChange={(e) => setCharge(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Session Time</label>
          <input
            type="number"
            placeholder="Time (in minutes)"
            value={session}
            onChange={(e) => setSession(e.target.value)}
            required
          />
        </div>
        <div className="form-group">
          <label>Discount</label>
          <input
            type="number"
            placeholder="Discount (%)"
            value={discount}
            onChange={(e) => setDiscount(Number(e.target.value))}
          />
        </div>
        <button type="submit" className="registration-button">
          Register
        </button>
      </form>
    </div>
  );
};

export default AddGames;
