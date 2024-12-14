const jwt = require('jsonwebtoken');
require('dotenv').config();

const verifyToken = (req, res, next) => {
    const token = req.headers['authorization'];
    if (!token) return res.status(403).json({ success: false, message: 'No token provided', status:'10006' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded; // You can access this in your routes
        next(); // Proceed to the next middleware or route
    } catch (err) {
        return res.status(400).json({ success: false, message: 'Invalid or expired token', status:"10007" });
    }
};

module.exports = verifyToken;
