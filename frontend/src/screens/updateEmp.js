import React, { useState, useEffect } from "react";
import axios from "axios";
import SuccessMessage from "../components/Sucess";
import UnsuccessfulModal from "../components/Unsuccess";
import Constants from "../components/Constants";
import utils from "../components/Utils";

const UpdateEmployeeDetails = () => {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [lastDay, setLastDay] = useState(""); // Initially empty
  const [isFired, setIsFired] = useState(false);
  const [position, setPosition] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [showUnsuccessModal, setShowUnsuccessModal] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
        utils.checkLoginCredentials();

    const fetchEmployeeDetails = async () => {

      try {
        const body = { userID: 101 };
        const response = await axios.post(
          `http://localhost:5000/api/auth/emp`,
          body,
          {
            headers: { "Content-Type": "application/json" },
          }
        );
        if (response.data.success) {
          const { name, mobile, address, lastDay, role } =
            response.data.employee;
          setName(name || "");
          setMobile(mobile || "");
          setAddress(address || "");
          setLastDay(lastDay || "");
          setPosition(role || "");
        } else {
          setMessage("Failed to fetch employee details.");
          setShowUnsuccessModal(true);
        }
      } catch (error) {
        setMessage(error.response?.data?.message || "Error fetching details.");
        setShowUnsuccessModal(true);
      }
    };

    fetchEmployeeDetails();
  }, []);

  const validateInputs = () => {
    if (!name || !mobile || !address) {
      setMessage("Name, mobile, and address are required.");
      setShowUnsuccessModal(true);
      return false;
    }

    if (!/^\d{10}$/.test(mobile)) {
      setMessage("Invalid mobile number format.");
      setShowUnsuccessModal(true);
      return false;
    }

    return true;
  };

  const handleUpdate = async () => {
    if (!validateInputs()) return;

    try {
      const empID = localStorage.getItem("employeeID"); // Replace with the correct key
      if (!empID) {
        setMessage("Employee ID not found. Please log in.");
        setShowUnsuccessModal(true);
        return;
      }

      // If fired, set the last day to today
      const finalLastDay = isFired
        ? new Date().toISOString().slice(0, 10)
        : lastDay;

      const body = { name, mobile, address, lastDay: finalLastDay };
      const response = await axios.put(
        `${Constants.API}/employee/${empID}`,
        body,
        {
          headers: { "Content-Type": "application/json" },
        }
      );

      if (response.data.success) {
        setMessage("Employee details updated successfully.");
        setShowSuccess(true);
      } else {
        setMessage(response.data.message || "Failed to update details.");
        setShowUnsuccessModal(true);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "Error updating details.");
      setShowUnsuccessModal(true);
    }
  };

  return (
    <div className="form-container">
      <h2 className="form-title" style={{ textDecorationLine: "underline" }}>
        <i>Update Employee Details</i>
      </h2>
      <form className="event-form" onSubmit={(e) => e.preventDefault()}>
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="form-input"
            required
          />
        </div>
        <div className="form-group">
          <label>Mobile</label>
          <input
            type="text"
            name="mobile"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="form-input"
            required
          />
        </div>
        <div className="form-group" >
          <label>Position</label>
          <select
            name="Position"
            style={{backgroundColor:'white', color:"black"}}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="form-input"
            required
          >
           
            <option value="Manager">Manager</option>
            <option value="Employee">Employee</option>
          </select>
        </div>
        <div className="form-group">
          <label>Address</label>
          <textarea
            name="address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="form-input"
            required
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            cursor: "pointer",
            marginLeft: 15,
            marginTop: -5,
            marginBottom: 15,
          }}
          onClick={() => setIsFired(!isFired)} // Toggles the checkbox when the div is clicked
        >
          <input
            type="checkbox"
            checked={isFired}
            onChange={(e) => {
              setIsFired(e.target.checked);
              if (e.target.checked) {
                setLastDay(new Date().toISOString().slice(0, 10));
              } else {
                setLastDay(""); // Clear if unchecked
              }
            }}
          />
          <label
            style={{
              color: "white",
              paddingLeft: 15,
              cursor: "pointer", // Ensure label also shows pointer cursor
            }}
          >
            Did Employee quit his job?
          </label>
        </div>

        {isFired && (
          <div className="form-group">
            <label>Today</label>
            <input
              type="date"
              name="lastDay"
              value={lastDay}
              onChange={(e) => setLastDay(e.target.value)}
              className="form-input"
            />
          </div>
        )}
        <button
          type="button"
          className="form-submit-button"
          onClick={handleUpdate}
        >
          Update Details
        </button>
      </form>

      {showSuccess && (
        <SuccessMessage
          message={message}
          onClose={() => setShowSuccess(false)}
        />
      )}
      {showUnsuccessModal && (
        <UnsuccessfulModal
          message={message}
          onClose={() => setShowUnsuccessModal(false)}
        />
      )}
    </div>
  );
};

export default UpdateEmployeeDetails;
