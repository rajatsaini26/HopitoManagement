import React, { useState } from "react";
import "../css/employee_reg.css";
import SuccessMessage from "../components/Sucess";
import UnsuccessfulModal from "../components/Unsuccess";
import { useAPI } from "../components/useAPI";

const Registration = () => {
  const [formData, setFormData] = useState({
    mobile: "",
    name: "",
    address: "",
    password: "",
    otp: "",
    role: "Employee",
  });

  const [showSuccess, setShowSuccess] = useState(false);
  const [showUnsuccessModal, setShowUnsuccessModal] = useState(false);
  const [message, setMessage] = useState("");
  const { createEmployee } = useAPI();

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Mobile and otp field validation
    if (name === "mobile" && !/^\d{0,10}$/.test(value)) return;
    if (name === "otp" && !/^\d{0,4}$/.test(value)) return;

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateInputs = () => {
    if (formData.mobile.length !== 10) {
      setMessage("Mobile number must be 10 digits.");
      setShowUnsuccessModal(true);
      return false;
    }

    if (formData.otp.length !== 4) {
      setMessage("otp must be 4 digits.");
      setShowUnsuccessModal(true);
      return false;
    }

    // Add more validations as needed
    return true;
  };

  const handleRegistration = async (event) => {
    event.preventDefault();

    if (!validateInputs()) return;

    const result = await createEmployee(formData);

    if (result.success) {
      setMessage("Registration successful!");
      setShowSuccess(true);
      setFormData({
        mobile: "",
        name: "",
        address: "",
        password: "",
        otp: "",
        role: "Employee",
      });
    } else {
      setMessage(result.message || "Registration failed. Please try again.");
      setShowUnsuccessModal(true);
    }
  };

  return (
    <div className="container">
      <div className="registration-container">
        <h1 className="registration-title">
          <i>Employee Registration</i>
        </h1>
        <form className="registration-form" onSubmit={handleRegistration}>
          <div className="form-group">
            <label>Mobile Number</label>
            <input
              type="number"
              name="mobile"
              placeholder="Mobile Number"
              value={formData.mobile}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              name="name"
              placeholder="Full Name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Address</label>
            <input
              type="text"
              name="address"
              placeholder="Address"
              value={formData.address}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>otp</label>
            <input
              type="number"
              name="otp"
              placeholder="otp"
              value={formData.otp}
              onChange={handleChange}
              required
            />
          </div>
          <div className="form-group">
            <label>Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
            >
              <option value="" disabled>
                Select Role
              </option>
              <option value="Manager">Manager</option>
              <option value="Employee">Employee</option>
            </select>
          </div>
          <button type="submit" className="registration-button">
            Register
          </button>
        </form>
        {showSuccess && message && (
          <SuccessMessage
            message={message}
            onClose={() => setShowSuccess(false)}
          />
        )}
        {showUnsuccessModal && message && (
          <UnsuccessfulModal
            message={message}
            onClose={() => setShowUnsuccessModal(false)}
          />
        )}
      </div>
    </div>
  );
};

export default Registration;
