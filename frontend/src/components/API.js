import axios from "axios";
import Constants from "./Constants";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // Import useAuth to access authStatus
async function ValidatePIN(upin, userID) {
  try {
    if (upin) {
      const body = {
        enteredPin: upin,
        userID: userID,
      };
      console.log(body);
      const response = await axios.get(
        "http://localhost:5000/api/auth/validatePin",
        body,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      if (response.data.status == 1001) {
        console.log("Pin OK");
        return true;
      } else {
        console.error("PIN failed");
        return false;
      }
    }
  } catch (error) {
    console.error("Error:", error.response?.data || error.message);
    return false;
  }
}

export { ValidatePIN };
