const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const WebSocket = require('ws');
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const { connectDB } = require('./config/db');
const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const cardRoutes = require('./routes/card');
const adminRoutes = require('./routes/adminAPIs');

dotenv.config();
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5001',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
}));

// Connect to MySQL
connectDB().then(() => {
    console.log('Connected to MySQL database');
}).catch(err => {
    console.error('Database connection failed:', err.message);
    process.exit(1); // Exit if database connection fails
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api/card', cardRoutes);
app.use('/api/admin', adminRoutes);

// Default route

app.get('/status', (req, res) => {
    res.send('Backend API is running');
});

// Create HTTP server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, (err) => {
    if (err) {
        console.error('Error starting server:', err.message);
        process.exit(1);
    }
    console.log(`Server running on port ${PORT}`);
});

// WebSocket setup
const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 8080;
const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });

const clients = new Set();
wss.on('connection', (ws) => {
    console.log('Frontend connected');
    clients.add(ws);

    ws.on('close', () => {
        console.log('Frontend disconnected');
        clients.delete(ws);
    });

    ws.on('error', (err) => {
        console.error('WebSocket error:', err.message);
    });
});

console.log(`WebSocket server running on port ${WEBSOCKET_PORT}`);

// List all available COM ports (on Windows)
const listAvailablePorts = async () => {
    try {
        const ports = await SerialPort.list();

        const comPorts = ports.filter(port => port.path && port.path.startsWith('COM'));

        if (comPorts.length === 0) {
            console.error("No available COM ports found.");
            process.exit(1);
        }

        return comPorts[0].path;
    } catch (error) {
        console.error("Error listing serial ports:", error.message);
        process.exit(1);
    }
};

// Set up the serial port for RFID reader
let serialPort;
const initRFIDReader = async () => {
    const portPath = await listAvailablePorts();
    console.log('Using Port Path:', portPath);

    if (!portPath) {
        console.error("No valid port path found.");
        process.exit(1);
    }

    try {
        serialPort = new SerialPort({
            path: portPath,
            baudRate: 9600,
        });

        serialPort.on('open', () => {
            console.log('Serial port opened for RFID reader on path:', portPath);
        });

        const parser = serialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));
        let location =1;
        parser.on('data', (uid) => {
            uid = uid.toString().replace(/[\x00-\x1F\x7F]/g, '').trim();
            if (uid) {
                console.log('RFID Card Scanned:', uid);
                for (let client of clients) {
                    console.log(`Sending RFID ${uid} to ${client}`);
                    client.send(JSON.stringify({ event: 'rfidScanned', uid, location }));
                }
            } else {
                console.error('Received empty data from RFID reader');
            }
        });

        serialPort.on('error', (err) => {
            console.error('Error in serial port:', err.message);
        });
    } catch (err) {
        console.error('Failed to initialize RFID reader:', err.message);
    }
};

// Initialize RFID reader
initRFIDReader();

// Graceful shutdown
const shutdown = () => {
    console.log('Shutting down server...');
    if (serialPort) {
        serialPort.close((err) => {
            if (err) {
                console.error('Error closing serial port:', err.message);
            } else {
                console.log('Serial port closed successfully');
            }
        });
    }

    wss.close(() => {
        console.log('WebSocket server closed');
        process.exit(0);
    });
};

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err.message);
    console.error(err.stack);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled promise rejection:', reason);
});

// Handle shutdown signals
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);