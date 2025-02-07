import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import Constants from "../components/Constants";
import { format } from "date-fns";
import "../css/ManageEmp.css";
import utils from "../components/Utils";

const ManageEmp = () => {
  const [employees, setEmployees] = useState([]); // Ensure it's initialized as an array
  const [errorMessage, setErrorMessage] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    fetchEmployees();
        utils.checkLoginCredentials();

  }, []);

  // Fetch employees from the backend
  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${Constants.API}admin/emp_list`, {
        headers: { "Content-Type": "application/json" },
      });

      // Ensure response structure matches expectations
      if (response.data && response.data.status !== "10003") {
        console.log(response.data);
        setEmployees(
          Array.isArray(response.data.employees) ? response.data.employees : []
        );
      } else {
        setEmployees([]);
        setErrorMessage("No employees found.");
      }
    } catch (error) {
      console.error(
        "Error fetching employees:",
        error.response?.data || error.message
      );
      setErrorMessage("Failed to fetch employees. Please try again later.");
      setEmployees([]); // Ensure employees is reset to an empty array on error
    }
  };

  return (
    <div style={{
        display:"flex",
        justifyContent:'center',
        alignItems:'center',
        flexDirection:'column'
    }}>
      <h1
        style={{
          textAlign: "center",
          color: "black",
          padding: "30px 50px",
          borderRadius: "10px",
          fontFamily: "'Roboto', sans-serif",
          fontWeight: "700",
          fontStyle: "italic",
        }}
      >
        Manage Employees
      </h1>
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "10px", // Adds space between the buttons
          padding: "10px", // Optional padding for better layout
        }}
      >
        <button className="button" onClick={() => navigate("/register")}>
          Add Employee
        </button>
        <button className="button" onClick={() => navigate("/admin/updateEmp")}>
          Update Employee
        </button>
      </div>
      {errorMessage && <div style={{ color: "red" }}>{errorMessage}</div>}
            <div style={{width:"95%"}}>
                <table border="1" style={{ textAlign: "left" }}>
                    <thead>
                        <tr>
                            <th>Employee ID</th>
                            <th>Name</th>
                            <th>Post</th>
                            <th>Mobile Number</th>
                            <th>Joining Date</th>
                            <th>Last Day</th>
                            <th>Address</th>

                        </tr>
                    </thead>
                    <tbody>
                        {employees.length > 0 ? (
                            employees.map((employee) => (
                                <tr key={employee.userID}>
                                    <td>{employee.userID}</td>
                                    <td>{employee.name}</td>
                                    <td>{employee.role}</td>
                                    <td>{employee.mobile}</td>
                                    <td>
                                        {/* Format the created_at date as joining date */}
                                        {employee.created_at
                                            ? format(new Date(employee.created_at), 'dd MMMM, yyyy')
                                            : 'N/A'}
                                    </td>
                                    <td>
                                        {/* Format the lastDay date if available */}
                                        {employee.lastDay
                                            ? format(new Date(employee.lastDay), 'MMMM dd, yyyy')
                                            : 'N/A'}
                                    </td>
                                    <td>{employee.address}</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan="6" style={{ textAlign: "center" }}>
                                    No employees found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
</div>
    </div>
  );
};

export default ManageEmp;
