import React, { useState, useEffect } from "react";

import SuccessMessage from "../components/Sucess";
import UnsuccessfulModal from "../components/Unsuccess";
import { useLocation } from "react-router-dom";
import { useAPI } from "../components/useAPI";
const UpdateEmployeeDetails = () => {
  const [formData, setFormData] = useState({
    name: "",
    mobile: "",
    address: "",
    lastDay: "",
    role: "Employee",
  });

  const { fetchEmployee, updateEmployee } = useAPI();
  const [isFired, setIsFired] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showUnsuccessModal, setShowUnsuccessModal] = useState(false);
  const [message, setMessage] = useState("");
  const location = useLocation();
  const passedEmpID = location.state?.employeeID;
  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "mobile" && !/^\d{0,10}$/.test(value)) return;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  useEffect(() => {
      if (passedEmpID) {
        fetchEmployeeDetails(passedEmpID);
      }
  }, []);

  const fetchEmployeeDetails = async (empID) => {
    try {
      if (!empID) {
        setMessage("Employee ID not found.");
        setShowUnsuccessModal(true);
        return;
      }

      const response = await fetchEmployee({ userID: empID });

      if (response.data.success) {
        const { name, mobile, address, lastDay, role } = response.data.employee;
        setFormData({
          name: name || "",
          mobile: mobile || "",
          address: address || "",
          lastDay: lastDay || "",
          role: role || "",
        });
        if (lastDay) setIsFired(true);
      } else {
        throw new Error("Failed to fetch employee details.");
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "Error fetching details.");
      setShowUnsuccessModal(true);
    }
  };

  const validateInputs = () => {
    if (!formData.name || !formData.mobile || !formData.address) {
      setMessage("Name, mobile, and address are required.");
      setShowUnsuccessModal(true);
      return false;
    }

    if (!/^\d{10}$/.test(formData.mobile)) {
      setMessage("Invalid mobile number format.");
      setShowUnsuccessModal(true);
      return false;
    }

    return true;
  };

  const handleUpdate = async (empID) => {
    if (!validateInputs()) return;

    if (!empID) {
      setMessage("Employee ID not found. Please log in.");
      setShowUnsuccessModal(true);
      return;
    }

    const updatedFormData = {
      ...formData,
      lastDay: isFired ? new Date().toISOString().slice(0, 10) : "",
      userID: empID, // ✅ Add empID here
    };

    try {
      const response = await updateEmployee(updatedFormData);

      if (response.data.success) {
        setMessage("Employee details updated successfully.");
        setShowSuccess(true);
      } else {
        throw new Error(response.data.message || "Failed to update.");
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
            value={formData.name}
            onChange={handleChange}
            className="form-input"
            required
          />
        </div>

        <div className="form-group">
          <label>Mobile</label>
          <input
            type="text"
            name="mobile"
            value={formData.mobile}
            onChange={handleChange}
            className="form-input"
            required
          />
        </div>

        <select
          name="role"
          style={{ backgroundColor: "white", color: "black" }}
          value={
            formData.role?.toLowerCase() === "manager" ? "Manager" : "Employee"
          }
          onChange={handleChange}
          className="form-input"
          required
        >
          <option value="Manager">Manager</option>
          <option value="Employee">Employee</option>
        </select>

        <div className="form-group">
          <label>Address</label>
          <textarea
            name="address"
            value={formData.address}
            onChange={handleChange}
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
          onClick={() => {
            setIsFired((prev) => !prev);
            setFormData((prev) => ({
              ...prev,
              lastDay: !isFired ? new Date().toISOString().slice(0, 10) : "",
            }));
          }}
        >
          <input
            type="checkbox"
            checked={isFired}
            onChange={() => {}} // Checkbox toggle handled by div
          />
          <label style={{ color: "white", paddingLeft: 15 }}>
            Did Employee quit their job?
          </label>
        </div>

        {isFired && (
          <div className="form-group">
            <label>Last Working Day</label>
            <input
              type="date"
              name="lastDay"
              value={formData.lastDay}
              onChange={handleChange}
              className="form-input"
            />
          </div>
        )}

        <button
          type="button"
          className="form-submit-button"
          onClick={() => handleUpdate(passedEmpID)}
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
