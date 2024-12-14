const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { connectDB } = require('./config/db'); // Import connectDB from the config
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games')
const cardRoutes = require('./routes/card');

dotenv.config();

const app = express();

// Middleware
app.use(express.json());
app.use(cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));

// Connect to MySQL
connectDB();

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/card', cardRoutes);



// Default Route
app.get('/', (req, res) => {
    res.send('Backend API is running');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
