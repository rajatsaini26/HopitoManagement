const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db'); // Assuming your MySQL config is in 'config/db'
const {generateUserID} = require('../utils/generateUserID');
require('dotenv').config();

const router = express.Router();

// Register Employee
router.post('/register', async (req, res) => {
    const { mobile, name, address, password, otp } = req.body;

    try {
        // Check if the employee already exists
        const [existingUser] = await pool.query('SELECT * FROM Employee WHERE mobile = ?', [mobile]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: 'Employee already exists with this mobile number.' });
        }

        // Generate userID
        const userID = await generateUserID().catch((err) => {
            console.error("Error generating userID:", err);
            return null; // Fallback to handle errors
        });

        if (!userID) {
            return res.status(500).json({ success: false, message: "Failed to generate userID" });
        }

        // Hash the password and OTP
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert the new employee into the database
        await pool.query(
            'INSERT INTO Employee (mobile, name, address, userID, password, otp) VALUES (?, ?, ?, ?, ?, ?)',
            [mobile, name, address, userID, hashedPassword, otp]
        );

        // Return success response
        res.status(201).json({
            success: true,
            message: 'Employee registered successfully!',
            employee: {
                mobile,
                name,
                address,
                userID,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Login Employee
router.post('/login', async (req, res) => {
    const { mobile, password } = req.body;

    try {
        const [users] = await pool.query('SELECT * FROM Employee WHERE mobile = ?', [mobile]);
        if (users.length === 0) {
            return res.status(400).json({ success: false, message: 'Invalid Mobile Number', status: "10003" });
        }

        const user = users[0];

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ success: false, message: 'Invalid credentials', status: "10004" });
        }

        const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '30m' });
        res.status(200).json({
            success: true,
            token,
            status: "10001",
            user: user.name,
            userID: user.userID,
            
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal server error', status: "10005" });
    }
});

// Get Employee Details by ID   (working)
router.get('/emp', async (req, res) => {
    const { userID } = req.body; // Get the employee ID from the URL parameters

    try {
        // Validate input
        if (!id) {
            return res.status(400).json({ success: false, message: 'Employee ID is required.' });
        }

        // Fetch the employee details from the database
        const [employee] = await pool.query('SELECT * FROM Employee WHERE userID = ?', [id]);

        if (employee.length === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        // Return success response with employee details
        res.status(200).json({
            success: true,
            employee: employee[0], // Return the first (and only) employee object
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Update Employee Details
// NOTE METHOD-> PUT
// in update form, provide the details of employee in all the fields.
router.put('/update', async (req, res) => {
    const { userID, mobile, name, address } = req.body; // Get the details from the request body

    try {
        // Validate input
        if (!userID) {
            return res.status(400).json({ success: false, message: 'User  ID is required.' });
        }

        // Update the employee details in the database
        const [results] = await pool.query(
            'UPDATE Employee SET mobile = ?, name = ?, address = ? WHERE userID = ?',
            [mobile, name, address, userID]
        );

        if (results.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Employee details updated successfully!',
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Update Employee Password
// NOTE METHOD-> PUT
router.put('/update_pass', async (req, res) => {
    const { userID, oldPassword, newPassword } = req.body; // Get the details from the request body

    try {
        // Validate input
        if (!userID || !oldPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'User  ID, old password, and new password are required.' });
        }

        // Fetch the employee's current hashed password from the database
        const [employee] = await pool.query('SELECT password FROM Employee WHERE userID = ?', [userID]);

        if (employee.length === 0) {
            return res.status(404).json({ success: false, message: 'Employee not found.' });
        }

        // Compare the old password with the hashed password
        const isMatch = await bcrypt.compare(oldPassword, employee[0].password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Old password is incorrect.' });
        }

        // Hash the new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update the password in the database
        await pool.query('UPDATE Employee SET password = ? WHERE userID = ?', [hashedNewPassword, userID]);

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Password updated successfully!',
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

module.exports = router;
