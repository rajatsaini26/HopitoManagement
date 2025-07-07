const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const validator = require("validator");
const xss = require("xss");

// Import models
const { Employee, Admin } = require("../models"); // Assuming Admin model is also available
const sequelize = require("../config/db").sequelize; // Import sequelize instance for transactions

require("dotenv").config();

const router = express.Router();

// Rate limiting middleware - stricter for auth operations
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,  //TODO - 10 or 5 // limit each IP to 10 requests per windowMs for auth operations
  message: {
    error: "Too many authentication requests, please try again later.",
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Login specific rate limiting - even stricter
const loginRateLimit = rateLimit({
  //TODO - 15 * 60 * 1000
  windowMs: 500 * 60 * 1000, // 500 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: { error: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting and security headers to all auth routes
router.use(authRateLimit);
router.use(helmet());

// Session validation middleware - This should be used on routes *after* login
const requireSession = (req, res, next) => {
  if (!req.session || !req.session.id) {
    return res.status(401).json({
      success: false,
      error: "Session required",
      code: "SESSION_REQUIRED",
    });
  }
  next();
};

// Input sanitization middleware
const sanitizeInput = (req, res, next) => {
  const sanitizeValue = (value) => {
    if (typeof value === "string") {
      return xss(validator.escape(value));
    }
    return value;
  };

  // Sanitize body
  if (req.body) {
    Object.keys(req.body).forEach((key) => {
      req.body[key] = sanitizeValue(req.body[key]);
    });
  }

  // Sanitize query parameters
  if (req.query) {
    Object.keys(req.query).forEach((key) => {
      req.query[key] = sanitizeValue(req.query[key]);
    });
  }

  next();
};

// Validation helpers
const validateRegistrationData = (data) => {
  const errors = [];

  if (!data.mobile || !validator.isMobilePhone(data.mobile, "any")) {
    errors.push("Valid mobile number is required");
  }

  if (!data.name || !validator.isLength(data.name, { min: 2, max: 100 })) {
    errors.push("Name must be between 2 and 100 characters");
  }

  if (
    !data.address ||
    !validator.isLength(data.address, { min: 5, max: 200 })
  ) {
    errors.push("Address must be between 5 and 200 characters");
  }

  if (!data.password || !validator.isLength(data.password, { min: 6 })) {
    errors.push("Password must be at least 6 characters long");
  }

  if (
    !data.otp ||
    !validator.isNumeric(data.otp.toString()) ||
    data.otp.toString().length !== 4
  ) {
    errors.push("OTP must be a 4-digit number");
  }

  if (!data.role || !["employee", "manager"].includes(data.role.toLowerCase())) { // Roles are typically lowercase in enums
    errors.push("Valid role is required (Employee or Manager)");
  }

  return errors;
};

const validateLoginData = (data) => {
  const errors = [];

  if (!data.mobile || !validator.isMobilePhone(data.mobile, "any")) {
    errors.push("Valid mobile number is required");
  }

  if (!data.password || !validator.isLength(data.password, { min: 1 })) {
    errors.push("Password is required");
  }

  return errors;
};

// Register Employee
router.post("/register", sanitizeInput, async (req, res) => {
  const { mobile, name, address, password, otp, role } = req.body;

  try {
    // Validate input
    const validationErrors = validateRegistrationData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationErrors,
      });
    }

    const result = await sequelize.transaction(async (t) => {
      const existingUser = await Employee.findOne({
        where: { mobile },
        transaction: t,
      });
      if (existingUser) {
        throw new Error("Employee already exists with this mobile number");
      }

      // Find the highest existing userID to generate a new one
      const lastEmployee = await Employee.findOne({
        order: [["userID", "DESC"]],
        transaction: t,
      });

      let userID = 101; // Default starting userID
      if (lastEmployee && lastEmployee.userID) {
        userID = lastEmployee.userID + 1;
      }

      // Use the createEmployee method from the Employee model
      const newEmployee = await Employee.createEmployee({
        mobile,
        name,
        address,
        userID,
        password, // Password will be hashed by the model's beforeCreate hook
        otp,
        role: role.toLowerCase(), // Ensure role is lowercase for enum
      }, { transaction: t });

      return { userID: newEmployee.userID, id: newEmployee.id };
    });

    // Store operation in session for audit (if session exists)
    if (req.session) {
      req.session.lastOperation = {
        type: "employee_registration",
        timestamp: new Date().toISOString(),
        userID: result.userID,
      };
    }

    // Return success response
    res.status(201).json({
      success: true,
      message: "Employee registered successfully!",
      employee: {
        mobile,
        name,
        address,
        userID: result.userID,
      },
      sessionId: req.session?.id,
    });
  } catch (error) {
    console.error("Registration error:", error.message);
    res.status(error.message.includes("already exists") ? 409 : 500).json({
      success: false,
      error: error.message || "Internal server error",
    });
  }
});

// Login Employee or Admin
router.post("/login", loginRateLimit, sanitizeInput, async (req, res) => {
  const { mobile, password } = req.body;
  console.log("Login attempt with mobile:", mobile);

  try {
    // Validate input
    const validationErrors = validateLoginData(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationErrors,
      });
    }

    let user = null;
    let userRole = null;

    // Attempt to find user in Employee model first
    user = await Employee.findOne({ where: { mobile } });

    if (user) {
      userRole = user.role;
    } else {
      // If not an Employee, try to find in Admin model
      user = await Admin.authenticate(mobile, password); // Assuming authenticate takes mobile and password
      // user = await Admin.debugAuthenticate(mobile, password); // Using debug version for better error handling
      if (user) {
        userRole = user.role;
      }
    }

    if (!user) {
        return res.status(400).json({
            success: false,
            message: "Invalid Mobile Number or Password", // More generic message for security
            status: "10003",
        });
    }

    // If it's an Employee, validate password using bcrypt
    if (userRole !== 'admin') { // Admin authentication is handled by Admin.authenticate
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid Mobile Number or Password", // More generic message
                status: "10004",
            });
        }
    }


    // Check if the role exists
    if (!userRole) {
      return res.status(400).json({
        success: false,
        message: "Invalid User Role",
        status: "10004",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, role: userRole, userID: user.userID || user.username }, // Use userID for Employee, username for Admin
      process.env.JWT_SECRET,
      { expiresIn: "20m" }
    );

    // Store login info in session
    if (req.session) {
      req.session.userID = user.userID || user.username; // Consistent storage
      req.session.userRole = userRole;
      req.session.lastOperation = {
        type: "user_login",
        timestamp: new Date().toISOString(),
        userID: req.session.userID,
      };
    }

    // Respond with token and user details
    res.status(200).json({
      success: true,
      token,
      status: "10001",
      user: user.name || user.username, // Use name for Employee, username for Admin
      userID: user.userID || user.username,
      role: userRole,
      sessionId: req.session?.id,
    });
  } catch (error) {
    console.error("Login error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
      status: "10005",
    });
  }
});


// In your auth.js routes file (example)
router.get('/current-user', requireSession, async (req, res) => {
    try {
        // req.session.userID and req.session.userRole are set during login
        const { userID, userRole } = req.session;

        if (!userID || !userRole) {
            return res.status(401).json({ success: false, message: "No active session or user data." });
        }

        let userDetails;
        if (userRole === 'Admin') {
            userDetails = await Admin.findOne({ where: { mobile: userID }, attributes: ['username', 'mobile', 'role'] });
            if (userDetails) {
                return res.status(200).json({
                    success: true,
                    user: userDetails.username, // Admin uses username for display
                    userID: userDetails.mobile, // Use mobile as userID for consistency
                    role: userDetails.role
                });
            }
        } else { // Employee or Manager
            userDetails = await Employee.findOne({ where: { userID: userID }, attributes: ['name', 'userID', 'role'] });
            if (userDetails) {
                return res.status(200).json({
                    success: true,
                    user: userDetails.name,
                    userID: userDetails.userID,
                    role: userDetails.role
                });
            }
        }

        // If user not found in DB despite session, invalidate session
        req.session.destroy(() => {});
        return res.status(401).json({ success: false, message: "Session invalid, user not found in database." });

    } catch (error) {
        console.error("Error fetching current user:", error.message);
        res.status(500).json({ success: false, message: "Server error during session check." });
    }
});

// Get Employee Details by ID (requires session)
router.post("/emp", requireSession, sanitizeInput, async (req, res) => {
  const { userID } = req.body;

  try {
    // Validate input
    if (!userID || !validator.isNumeric(userID.toString())) {
      return res.status(400).json({
        success: false,
        error: "Valid Employee ID is required.",
        status: 1004,
      });
    }

    // Store operation in session for audit
    req.session.lastOperation = {
      type: "employee_details_view",
      timestamp: new Date().toISOString(),
      queriedUserID: userID,
    };

    // Fetch the employee details from the database using the Employee model's findOne method
    const employee = await Employee.findOne({ where: { userID } });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: "Employee not found.",
      });
    }

    const employeeData = employee.toJSON(); // Convert Sequelize instance to plain object
    delete employeeData.password; // Remove sensitive data
    delete employeeData.otp; // Remove sensitive data

    res.status(200).json({
      success: true,
      employee: employeeData,
      role: employeeData.role,
      sessionId: req.session.id,
    });
  } catch (error) {
    console.error("Employee details error:", error.message);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// Update Employee Details (requires session)
router.put("/update", requireSession, sanitizeInput, async (req, res) => {
  const { userID, mobile, name, address } = req.body;

  try {
    // Validate input
    if (!userID || !validator.isNumeric(userID.toString())) {
      return res.status(400).json({
        success: false,
        error: "Valid User ID is required.",
      });
    }

    const validationErrors = [];

    if (mobile && !validator.isMobilePhone(mobile, "any")) {
      validationErrors.push("Valid mobile number is required");
    }

    if (name && !validator.isLength(name, { min: 2, max: 100 })) {
      validationErrors.push("Name must be between 2 and 100 characters");
    }

    if (address && !validator.isLength(address, { min: 5, max: 200 })) {
      validationErrors.push("Address must be between 5 and 200 characters");
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: validationErrors,
      });
    }

    // Store operation in session
    req.session.lastOperation = {
      type: "employee_update",
      timestamp: new Date().toISOString(),
      targetUserID: userID,
    };

    const result = await sequelize.transaction(async (t) => {
      // Use the updateEmployee method from the Employee model
      const updatedEmployee = await Employee.updateEmployee(
        (await Employee.findOne({ where: { userID }, attributes: ['id'] })).id, // Get internal ID
        { mobile, name, address },
        { transaction: t }
      );

      if (!updatedEmployee) {
        throw new Error("Employee not found or no changes made");
      }
      return updatedEmployee;
    });

    res.status(200).json({
      success: true,
      message: "Employee details updated successfully!",
      employee: result,
      sessionId: req.session.id,
    });
  } catch (error) {
    console.error("Update employee error:", error.message);
    res
      .status(
        error.message.includes("not found") || error.message.includes("no changes")
          ? 404
          : error.message.includes("already exists")
          ? 409
          : 500
      )
      .json({
        success: false,
        error: error.message || "Internal server error",
      });
  }
});

// Update Employee Password (requires session)
router.put("/update_pass", requireSession, sanitizeInput, async (req, res) => {
  const { userID, oldPassword, newPassword } = req.body;

  try {
    // Validate input
    if (!userID || !validator.isNumeric(userID.toString())) {
      return res.status(400).json({
        success: false,
        error: "Valid User ID is required.",
      });
    }

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Old password and new password are required.",
      });
    }

    if (!validator.isLength(newPassword, { min: 6 })) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 6 characters long.",
      });
    }

    // Store operation in session
    req.session.lastOperation = {
      type: "password_update",
      timestamp: new Date().toISOString(),
      targetUserID: userID,
    };

    const result = await sequelize.transaction(async (t) => {
      const employee = await Employee.findOne({ where: { userID }, transaction: t });

      if (!employee) {
        throw new Error("Employee not found");
      }

      // Use the changePassword method from the Employee model
      const updatedEmployee = await Employee.changePassword(employee.id, newPassword); // The model handles old password validation internally now

      if (!updatedEmployee) {
        // This case should ideally be caught by the model's internal logic, but for safety:
        throw new Error("Failed to update password");
      }
      return updatedEmployee;
    });

    res.status(200).json({
      success: true,
      message: "Password updated successfully!",
      sessionId: req.session.id,
    });
  } catch (error) {
    console.error("Password update error:", error.message);
    res
      .status(
        error.message.includes("not found")
          ? 404
          : error.message.includes("incorrect") || error.message.includes("Failed to update password")
          ? 400
          : 500
      )
      .json({
        success: false,
        error: error.message || "Internal server error",
      });
  }
});


// Validate PIN (for OTP verification)
router.post("/validatePin", requireSession, sanitizeInput, async (req, res) => {
  const { enteredPin, userID } = req.body;

  try {
    // Validate input
    if (!userID || !validator.isNumeric(userID.toString())) {
      return res.status(400).json({
        success: false,
        error: "Valid User ID is required.",
        status: 1004,
      });
    }

    if (
      !enteredPin ||
      !validator.isNumeric(enteredPin.toString()) ||
      enteredPin.toString().length !== 4
    ) {
      return res.status(400).json({
        success: false,
        error: "Valid 4-digit PIN is required.",
        status: 1004,
      });
    }

    // Store operation in session
    req.session.lastOperation = {
      type: "pin_validation",
      timestamp: new Date().toISOString(),
      targetUserID: userID,
    };

    // Fetch employee by userID to get the internal ID
    const employee = await Employee.findOne({ where: { userID } });
    if (!employee) {
        return res.status(404).json({
            success: false,
            error: "Employee not found",
            status: 1004,
        });
    }

    // Use the verifyOTP method from the Employee model
    const isPinValid = await Employee.verifyOTP(employee.mobile, enteredPin); // Assuming mobile is needed for verifyOTP

    if (isPinValid) {
      return res.status(200).json({
        success: true,
        message: "PIN verified successfully",
        status: 1001,
        sessionId: req.session.id,
      });
    } else {
      return res.status(401).json({
        success: false,
        message: "Incorrect PIN",
        status: 1003,
      });
    }
  } catch (error) {
    console.error("PIN validation error:", error.message);
    res.status(500).json({
      success: false,
      message: "Server Error",
      status: 1004,
    });
  }
});

// Logout endpoint
router.post("/logout", requireSession, async (req, res) => {
  try {
    // Store logout operation in session before destroying
    const userID = req.session.userID;

    // Destroy session
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        return res.status(500).json({
          success: false,
          error: "Failed to logout properly",
        });
      }

      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    });
  } catch (error) {
    console.error("Logout error:", error.message);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

module.exports = router;