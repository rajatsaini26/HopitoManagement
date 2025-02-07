const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/db'); // Assuming your MySQL config is in 'config/db'
const { generateUserID } = require('../utils/generateUserID');
require('dotenv').config();

const router = express.Router();

// Register Employee
router.post('/register', async (req, res) => {
    const { mobile, name, address, password, otp, role } = req.body;

    try {
        // Get the last employee's userID
        const [lastEmployee] = await pool.query('SELECT userID FROM Employee ORDER BY userID DESC LIMIT 1');

        // Calculate the new userID
        let userID = 101; // Default in case no employee exists
        if (lastEmployee.length > 0) {
            userID = lastEmployee[0].userID + 1; // Increment the last userID by 1
        }

        // Check if the mobile number is already registered
        const [existingUser] = await pool.query('SELECT * FROM Employee WHERE mobile = ?', [mobile]);
        if (existingUser.length > 0) {
            return res.status(400).json({ success: false, message: 'Employee already exists with this mobile number.' });
        }
        console.log(userID);
        if (!userID) {
            
            return res.status(500).json({ success: false, message: "Failed to generate userID" });
        }

        // Hash the password and OTP
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert the new employee into the database
        await pool.query(
            'INSERT INTO Employee (mobile, name, address, userID, password, otp, role) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [mobile, name, address, userID, hashedPassword, otp,role]
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

// Login Employee or Admin
router.post('/login', async (req, res) => {
    const { mobile, password } = req.body;
    let role, user;

    try {
        // Query the Employee table to check if the mobile number exists
        const [users] = await pool.query('SELECT * FROM Employee WHERE mobile = ?', [mobile]);

        if (users.length === 0) {
            // If no user is found in Employee, query the Admin table
            const [admins] = await pool.query('SELECT * FROM Admin WHERE mobile = ?', [mobile]);
            console.log(admins);

            if (admins.length === 0) {
                // If no user is found in both Employee and Admin tables
                return res.status(400).json({
                    success: false,
                    message: 'Invalid Mobile Number',
                    status: "10003"
                });
            }

            // If user is found in the Admin table, validate password and role
            user = admins[0];
            role = 'Admin'; // Assign role as 'admin'
        } else {
            // If user is found in the Employee table
            user = users[0];
            role = user.role; // Assign role from Employee table
        }

        // Validate the password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Invalid credentials',
                status: "10004"
            });
        }

        // Check if the role exists for employees
        if (!role || role.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Invalid User',
                status: "10004"
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, role }, // Include role in the token payload
            process.env.JWT_SECRET,
            { expiresIn: '20m' }
        );

        // Respond with token and user details
        res.status(200).json({
            success: true,
            token,
            status: "10001",
            user: user.name,
            userID: user.userID,
            role,
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            status: "10005"
        });
    }
});

// Get Employee Details by ID   (working)
router.post('/emp', async (req, res) => {
    const { userID } = req.body; // Get the employee ID from the URL parameters
    let id =userID;
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
            employee: employee[0],
            role: employee[0].role, // Return the first (and only) employee object
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

router.get('/validatePin', async (req, res) => {

    const { enteredPin,userID } = req.body; // PIN entered by the user
    try {
        const [users] = await pool.query('SELECT * FROM Employee WHERE userID = ?', [userID]);
        // Compare the entered PIN with the hashed PIN
        if (users[0].OTP == enteredPin) {
            res.send({ success: true, message: "PIN verified successfully", status: 1001 });
        } else {
            res.status(401).send({ success: false, message: "Incorrect PIN", status: 1003 });
        }
    }catch(e){
        res.status(402).send({ success: false, message: "Server Error", status: 1004 });

    }
});


module.exports = router;
