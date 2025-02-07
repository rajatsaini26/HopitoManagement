import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Constants from "../components/Constants";
import { format } from "date-fns";
import "../css/manageGame.css"; // Optional CSS file
import utils from "../components/Utils";

const ManageGames = () => {
  const [games, setGames] = useState([]); // Store games
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchGames();
        utils.checkLoginCredentials();

  }, []);

  // Fetch games from the backend
  const fetchGames = async () => {
    try {
      const response = await axios.get(`${Constants.API}game/gameList`, {
        headers: { "Content-Type": "application/json" },
      });

      if (response.data && response.data.status !== "10003") {
        console.log(response.data);
        setGames(Array.isArray(response.data.games) ? response.data.games : []);
      } else {
        setGames([]);
        setErrorMessage("No games found.");
      }
    } catch (error) {
      console.error("Error fetching games:", error.response?.data || error.message);
      setErrorMessage("Failed to fetch games. Please try again later.");
      setGames([]);
    }
  };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", flexDirection: "column" }}>
      <h1 style={{
          textAlign: "center",
          color: "black",
          padding: "30px 50px",
          borderRadius: "10px",
          fontFamily: "'Roboto', sans-serif",
          fontWeight: "700",
          fontStyle: "italic",
        }}>
        Manage Games
      </h1>

      {/* Buttons for Adding/Updating Games */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", padding: "10px" }}>
        <button className="button" onClick={() => navigate("/admin/addgames")}>Add Game</button>
        <button className="button" onClick={() => navigate("/admin/updateGame")}>Update Game</button>
      </div>

      {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}

      {/* Games Table */}
      <div style={{ width: "95%" }}>
        <table border="1" style={{ textAlign: "left", width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Name</th>
              <th>Session (minutes)</th>
              <th>Charge</th>
              <th>Discount %</th>
            </tr>
          </thead>
          <tbody>
            {games.length > 0 ? (
              games.map((game) => (
                <tr key={game.GameID}>
                  <td>{game.GameID}</td>
                  <td>{game.GameName}</td>
                  <td>{game.SessionTime}</td>
                  {/* <td>{game.release_date ? format(new Date(game.release_date), 'dd MMMM, yyyy') : 'N/A'}</td> */}
                  <td>{game.Charge}</td>
                  <td>{game.Discount}%</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" style={{ textAlign: "center" }}>No games found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ManageGames;
