const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const { connectDB } = require('./config/db'); // Import connectDB from the config
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const cardRoutes = require('./routes/card');
const { ReadlineParser } = require('@serialport/parser-readline');
const WebSocket = require('ws');
const { SerialPort } = require('serialport');


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

// Create an HTTP server
const server = app.listen(process.env.PORT || 5000, () => {
    console.log(`Server running on port ${process.env.PORT || 5000}`);
});

// WebSocket server setup
const wss = new WebSocket.Server({ 
    port: 8080,
    handleProtocols: (protocols, request) => {
        // Handle protocols (if needed)
        console.log('Protocols:', protocols);
        // Accept the first protocol or return false to accept any protocol
        return protocols[0] || false;
    }
});
const clients = new Set(); 
wss.on('connection', (ws) => {
    console.log('Frontend connected');
    clients.add(ws);
    // Replace 'COM3' with your Arduino's port
    const port = new SerialPort({
        path: 'COM9',        // Replace 'COM3' with your actual port
        baudRate: 9600,      // Baud rate for the serial communication
    });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    port.on('open', () => {
        console.log('Serial Port Opened');
    });

    parser.on('data', (data) => {
        console.log(`Received: ${data}`);

        // Check if the data has the expected structure
        if (data.includes("uid:") && data.includes("location:")) {
            const [uid, location] = data.split(',');
            const uidValue = uid.split(':')[1];
            const locationValue = location.split(':')[1];
            
            if (clients.size > 0) { // Check if there are any connected clients
                clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ uid: uidValue, location: locationValue }));
                    }
                });
            }
        } else {
            console.error('Received data is malformed:', data);
        }
    });

    port.on('error', (err) => {
        console.error(`Error: ${err.message}`);
    });
});