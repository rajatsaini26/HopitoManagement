import React, { useState } from "react";
import axios from "axios";

const UpdateGame = () => {
  const [gameID, setGameID] = useState();
  const [name, setName] = useState("");
  const [charge, setCharge] = useState();
  const [session, setSession] = useState();
  const [discount, setdiscount] = useState();
  const [showSuccess, setShowSuccess] = useState(false);
  const [showUnsuccessModal, setShowUnsuccessModal] = useState(false);
  const [message, setMessage] = useState("");

  const fetchGameDetails = async () => {
    if (!gameID) {
      setMessage("Please enter a valid Game ID.");
      setShowUnsuccessModal(true);
      return;
    }
    

    try {
      const response = await axios.get(`http://localhost:5000/api/game/gamedetails`, {
        params: { id: gameID },
        headers: { "Content-Type": "application/json" },
      });

      if (response.data) {
        console.log(response.data);
        setName(response.data.Name || ""); // ✅ Prevents undefined issue
        setCharge(response.data.Charge ?? ""); // ✅ Ensures empty string if null
        setSession(response.data.Session ?? "");
        setdiscount(response.data.Discount ?? "");

      } else {
        setMessage("Game not found.");
        setShowUnsuccessModal(true);
      }
    } catch (error) {
      setMessage("Error fetching game details.");
      setShowUnsuccessModal(true);
    }
  };

  const handleUpdateGame = async () => {
    if (!gameID || (!name && !charge && !session)) {
      setMessage("Please enter Game ID and at least one field to update.");
      setShowUnsuccessModal(true);
      return;
    }

    const body = {
      id: gameID,
      name,
      charge,
      session,
      discount,
    };

    try {
      const response = await axios.put("http://localhost:5000/api/game/update", body, {
        headers: { "Content-Type": "application/json" },
      });

      setMessage(response.data.message || "Game updated successfully.");
      setShowSuccess(true);
    } catch (error) {
      setMessage(error.response?.data?.error || "Error updating game.");
      setShowUnsuccessModal(true);
    }
  };

  return (
    <div className="form-container">
      <h2 className="form-title" style={{ textDecoration: "underline" }}>
        <i>Update Game Details</i>
      </h2>

      <form className="game-form" onSubmit={(e) => e.preventDefault()}>
        <div className="form-group">
          <label>Game ID</label>
          <input
            type="number"
            placeholder="Enter Game ID"
            value={gameID}
            onChange={(e) => setGameID(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={fetchGameDetails}
            className="fetch-button"
          >
            Fetch Game Details
          </button>
        </div>

        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            placeholder="Game Name"
            value={name}
            onChange={(e) => setName(e.target.value || "")} // ✅ Ensures controlled component
          />
        </div>
        <div className="form-group">
          <label>Charge</label>
          <input
            type="number"
            placeholder="Game Charge"
            value={charge}
            onChange={(e) => setCharge(e.target.value || 100)}
          />
        </div>
        <div className="form-group">
          <label>Session Time</label>
          <input
            type="number"
            placeholder="Session Time (in minutes)"
            value={session}
            onChange={(e) => setSession(e.target.value || 0)}
          />
        </div>
        <div className="form-group">
          <label>Discount %</label>
          <input
            type="number"
            placeholder="Discount (%)"
            value={discount}
            onChange={(e) => setdiscount(e.target.value || 0)}
          />
        </div>
        

        <button type="button" className="form-submit-button" onClick={handleUpdateGame}>
          Update Game
        </button>
      </form>
{/* 
      {showSuccess && <SuccessMessage message={message} onClose={() => setShowSuccess(false)} />}
      {showUnsuccessModal && <UnsuccessfulModal message={message} onClose={() => setShowUnsuccessModal(false)} />} */}
    </div>
  );
};

export default UpdateGame;
