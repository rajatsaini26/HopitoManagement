const mongoose = require('mongoose');

// Define the Counter schema
const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 100 }, // Start from 100
});

// Create the Counter model
const Counter = mongoose.model('Counter', counterSchema);

// Function to generate a new user ID
async function generateUserID() {
    try {
        const counter = await Counter.findByIdAndUpdate(
            { _id: "employeeID" },
            { $inc: { seq: 1 } },
            { new: true, upsert: true } // Upsert ensures the document is created if missing
        );
        console.log("Generated userID:", counter.seq);
        return counter.seq;
    } catch (error) {
        console.error("Error in generateUserID:", error);
        throw error;
    }
}

module.exports = generateUserID;
