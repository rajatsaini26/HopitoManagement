const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const WebSocket = require("ws");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const { connectDB, sequelize } = require("./config/db"); // Updated to get sequelize instance

// Import route modules
const authRoutes = require("./routes/auth");
const gameRoutes = require("./routes/games");
const cardRoutes = require("./routes/card");
const checkRoutes = require("./routes/navigation");

const adminRoutes = require("./routes/adminAPIs"); // Assuming this is the correct path for admin routes

dotenv.config(); // Load environment variables
const app = express();

// --- Session Store Configuration ---
// IMPORTANT: Changed tableName to avoid conflict with your 'Sessions' game model
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: "http_sessions", // Renamed to avoid conflict with your 'Sessions' game model
  checkExpirationInterval: 15 * 60 * 1000, // Check every 15 minutes
  expiration: 24 * 60 * 60 * 1000, // 24 hours
});

// --- Session Configuration ---
app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      "f9f13256ec72de1daafa5e569b7f292d736a5d87aa6abd13a3a832ad90b0913a69add4d49c2b0f006559e370208bdcc5497d6f108826047cb9a91227cc815ada", // Use environment variable for secret, fallback to provided string
    store: sessionStore, // Use the configured sessionStore instance
    resave: false, // Don't save session if unmodified
    saveUninitialized: false, // Don't create session until something stored
    rolling: true, // Reset expiration on activity
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      httpOnly: true, // Prevent XSS attacks
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // CSRF protection
    },
    name: "sessionId", // Custom session cookie name
  })
);

// --- Middleware ---
app.use(express.json({ limit: "10mb" })); // Added size limit for JSON bodies
app.use(express.urlencoded({ extended: true, limit: "10mb" })); // Added size limit for URL-encoded bodies

// Enhanced CORS Configuration
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        process.env.CLIENT_URL || "http://localhost:5001",
        "http://localhost:3000", // React dev server
        "http://localhost:5000", // Additional frontend
        "http://localhost:5001"
      ];

      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Not allowed by CORS: ${origin}`));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    credentials: true,
    optionsSuccessStatus: 200,
  })
);

// Security Headers Middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains"
    );
  }
  next();
});

// Request Logging Middleware (Basic)
app.use((req, res, next) => {
  console.log(
    `${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`
  );
  next();
});

// --- Database Connection and Model Setup ---
const initializeDatabase = async (retries = 3) => {
  try {
    // Connect to database (assuming connectDB handles database selection like 'gaming_center')
    await connectDB();
    console.log("✅ Connected to MySQL database");

    // Import all models (ensure they are loaded before sync)
    // These imports are crucial for Sequelize to recognize the models
    // and create/alter tables during synchronization.
    require('./models/Admin');
    require('./models/Customer');
    require('./models/Employee');
    require('./models/Games');
    require('./models/Sessions'); // Your game sessions model
    require('./models/Transaction');
    require('./models/TransactionHistory');
    // Add other model imports if you have more

    // Configure sync options based on environment
    const syncOptions = {
      // alter: process.env.NODE_ENV !== 'production', // Use `alter: true` in development to update schema
      alter:false,
      force: process.env.NODE_ENV === 'development' && process.env.FORCE_SYNC === 'true', // Force sync (drop tables) only in dev if explicitly set
      logging: process.env.NODE_ENV === 'development' ? console.log : false // Log SQL queries in development
    };

    // Sync models with database
    await sequelize.sync(syncOptions); // Use the defined syncOptions
    console.log("✅ Models synchronized with database");

    // Sync session store table (this creates the 'http_sessions' table if it doesn't exist)
    await sessionStore.sync();
    console.log("✅ Session store synchronized");

    // Test database connection
    await sequelize.authenticate();
    console.log("✅ Database authentication successful");

    // Log available models
    console.log(`📊 Available models: ${Object.keys(sequelize.models).join(', ')}`);

  } catch (err) {
    console.error("❌ Database initialization failed:", err.message);

    if (retries > 0) {
      console.log(`🔄 Retrying database connection... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds before retrying
      return initializeDatabase(retries - 1);
    }

    console.error("❌ Max retries reached. Exiting...");
    process.exit(1); // Exit process if database connection fails after retries
  }
};


// --- Routes ---
app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes); // Changed to /api/game as per your routes file
app.use("/api/card", cardRoutes);
app.use("/api/admin", adminRoutes); // Assuming this is for admin-specific API routes
app.use("/api/nav", checkRoutes); // Endpoint to check accessible routes based on user role
// --- Health Check Endpoint ---
// Enhanced Health Check with Database Status
app.get("/status", async (req, res) => {
  let dbStatus = "Unknown";
  let modelCount = 0;

  try {
    await sequelize.authenticate();
    dbStatus = "Connected";
    modelCount = Object.keys(sequelize.models).length;
  } catch (error) {
    dbStatus = "Disconnected";
    console.error("Health check DB error:", error.message);
  }

  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    session: req.session.id ? "Active" : "None",
    database: {
      status: dbStatus,
      models: modelCount,
      dialect: sequelize.getDialect()
    },
    // Ensure these variables are defined or conditionally included if they might not be
    websocket: {
      clients: typeof clients !== 'undefined' ? clients.size : 0,
      port: typeof WEBSOCKET_PORT !== 'undefined' ? WEBSOCKET_PORT : null
    },
    rfid: {
      connected: typeof isRFIDConnected !== 'undefined' ? isRFIDConnected : false,
      port: typeof serialPort !== 'undefined' && serialPort ? serialPort.path : null
    }
  });
});


// --- Session Test Endpoint ---
app.get("/api/session-test", (req, res) => {
  if (!req.session.views) {
    req.session.views = 0;
  }
  req.session.views++;

  res.json({
    sessionId: req.session.id,
    views: req.session.views,
    cookie: req.session.cookie,
  });
});

// --- Error Handling Middleware ---
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err.stack);
  res.status(500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message,
  });
});

// --- 404 Handler ---
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// --- Server Setup ---
const PORT = process.env.PORT || 3000;
let server;

const startServer = async () => {
  try {
    await initializeDatabase(); // Initialize database and sync models/session store

    server = app.listen(PORT, (err) => {
      if (err) {
        console.error("❌ Error starting server:", err.message);
        process.exit(1);
      }
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
    });

    // Handle server errors
    server.on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(`❌ Port ${PORT} is already in use`);
        process.exit(1);
      } else {
        console.error("❌ Server error:", err.message);
      }
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

// --- WebSocket Setup ---
const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 8080;
const wss = new WebSocket.Server({
  port: WEBSOCKET_PORT,
  perMessageDeflate: false, // Disable compression for better performance
});

const clients = new Set(); // Keep track of connected WebSocket clients

wss.on("connection", (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`🔌 WebSocket client connected from ${clientIp}`);
  clients.add(ws);

  // Send welcome message
  ws.send(
    JSON.stringify({
      event: "connected",
      message: "WebSocket connection established",
      timestamp: new Date().toISOString(),
    })
  );

  ws.on("close", () => {
    console.log(`🔌 WebSocket client ${clientIp} disconnected`);
    clients.delete(ws);
  });

  ws.on("error", (err) => {
    console.error("❌ WebSocket error:", err.message);
    clients.delete(ws);
  });

  // Heartbeat mechanism
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
});

// WebSocket heartbeat to detect broken connections
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      clients.delete(ws);
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000); // 30 seconds

console.log(`🔌 WebSocket server running on port ${WEBSOCKET_PORT}`);

// --- Enhanced RFID Reader with Retry Logic ---
let serialPort;
let isRFIDConnected = false;
let rfidRetryInterval;
// This Set will now be managed locally within each initRFIDReader call
// to ensure all ports are re-evaluated in each retry cycle.
let triedPortsGlobal = new Set(); // Renamed to avoid confusion with local usage

const broadcastToClients = (data) => {
  const message = JSON.stringify(data);
  let sentCount = 0;

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    } else {
      clients.delete(client); // Clean up disconnected clients
    }
  });

  if (sentCount > 0) {
    console.log(`📤 Broadcasted to ${sentCount} clients:`, data.event);
  }
};

// This function now just lists ALL COM/tty ports, no filtering by triedPorts
const listAllComPorts = async () => {
  try {
    const ports = await SerialPort.list();
    const comPorts = ports.filter(
      (port) => port.path && (port.path.startsWith("COM") || port.path.startsWith("/dev/tty"))
    );
    return comPorts.map((p) => p.path);
  } catch (error) {
    console.error("❌ Error listing serial ports:", error.message);
    return [];
  }
};

const initRFIDReader = async () => {
  // Reset triedPorts for this new attempt cycle
  const triedPortsThisCycle = new Set();
  const allAvailablePorts = await listAllComPorts();
  const preferredPortPath = process.env.RFID_PORT;

  let portsToAttempt = [];

  // 1. Add preferred port first if it's configured and available
  if (preferredPortPath && allAvailablePorts.includes(preferredPortPath)) {
    portsToAttempt.push(preferredPortPath);
    console.log(`🔍 Prioritizing configured RFID_PORT: ${preferredPortPath}`);
  }

  // 2. Add all other available ports that haven't been tried yet in this specific cycle
  const otherPorts = allAvailablePorts.filter(p => !portsToAttempt.includes(p));
  portsToAttempt = [...portsToAttempt, ...otherPorts];

  if (portsToAttempt.length === 0) {
    console.log("⏳ No serial ports found to attempt connection in this cycle.");
    return false;
  }

  for (const portPath of portsToAttempt) {
    // If this port failed in a previous iteration of *this specific initRFIDReader call*, skip it
    if (triedPortsThisCycle.has(portPath)) {
        continue;
    }

    console.log(`🔍 Attempting connection to: ${portPath}`);

    const testPort = new SerialPort({
      path: portPath,
      baudRate: 9600, // Ensure this matches your Arduino code
      autoOpen: false,
    });

    const openPromise = new Promise((resolve) => {
      // Set a timeout for the port opening process
      const timeoutId = setTimeout(() => {
        if (!testPort.isOpen) { // If port hasn't opened yet
          console.warn(`⏳ Timeout opening ${portPath}. Closing and trying next.`);
          testPort.close(() => {}); // Attempt to close if still open
          triedPortsThisCycle.add(portPath); // Mark as tried and failed for this cycle
          resolve(false);
        }
      }, 3000); // 3 second timeout for port opening

      testPort.open((err) => {
        clearTimeout(timeoutId); // Clear the timeout if port opens quickly
        if (err) {
          console.warn(`❌ Failed to open ${portPath}: ${err.message}`);
          triedPortsThisCycle.add(portPath); // Mark this port as tried and failed
          resolve(false);
          return;
        }

        console.log(`✅ RFID reader connected at: ${portPath}`);
        serialPort = testPort;
        isRFIDConnected = true;

        const parser = serialPort.pipe(
          new ReadlineParser({ delimiter: "\r\n" }) // Assuming RFID UIDs are terminated by newline
        );
        let location = 1; // Default location, could be configured

        parser.on("data", (uid) => {
          uid = uid
            .toString()
            .replace(/[\x00-\x1F\x7F]/g, "")
            .trim();
          if (uid) {
            console.log("🏷️ RFID Card Scanned:", uid);
            broadcastToClients({
              event: "rfidScanned",
              uid,
              location,
              timestamp: new Date().toISOString(),
            });
          }
        });

        serialPort.on("error", (err) => {
          console.error("❌ Serial port error on active connection:", err.message);
          isRFIDConnected = false;
          // No need to add to triedPortsThisCycle here, as it's an active connection error
          // The interval will trigger a new initRFIDReader call if needed
          if (serialPort && serialPort.isOpen) {
            serialPort.close(() => {}); // Attempt to close the faulty port
          }
          serialPort = null;
        });

        serialPort.on("close", () => {
          console.log(`🔌 RFID port ${portPath} closed unexpectedly.`);
          isRFIDConnected = false;
          // No need to add to triedPortsThisCycle here
          serialPort = null;
        });

        resolve(true); // Resolve promise on successful connection
      });
    });

    const success = await openPromise;
    if (success) {
      // If a port connects, we're done with this initRFIDReader cycle
      // Clear the global triedPorts set so that if this connection drops,
      // all ports (including the one that just worked) are re-evaluated.
      triedPortsGlobal.clear(); // Clear the global set here
      return true;
    }
  }

  // If we reach here, no port connected in this iteration
  console.log("⚠️ All available ports tried in this cycle, none connected successfully.");
  return false;
};

const startRFIDMonitoring = () => {
  console.log("🔄 Starting RFID monitoring...");

  // Initial connection attempt
  initRFIDReader();

  // Retry mechanism - check every 5 seconds if not connected
  rfidRetryInterval = setInterval(async () => {
    if (!isRFIDConnected) {
      console.log("🔄 Retrying RFID connection...");
      // For each retry, initRFIDReader will get a fresh list and manage its internal triedPorts.
      await initRFIDReader();
    }
  }, 5000);
};

// --- Graceful Shutdown ---
const shutdown = async () => {
  console.log("🛑 Initiating graceful shutdown...");

  // Clear intervals
  if (rfidRetryInterval) {
    clearInterval(rfidRetryInterval);
  }
  clearInterval(heartbeat);

  // Close serial port
  if (serialPort && serialPort.isOpen) {
    serialPort.close((err) => {
      if (err) {
        console.error("❌ Error closing serial port:", err.message);
      } else {
        console.log("✅ Serial port closed");
      }
    });
  }

  // Close WebSocket server
  wss.close(() => {
    console.log("✅ WebSocket server closed");
  });

  // Close HTTP server
  if (server) {
    server.close(() => {
      console.log("✅ HTTP server closed");
    });
  }

  // Close database connection
  try {
    await sequelize.close();
    console.log("✅ Database connection closed");
  } catch (err) {
    console.error("❌ Error closing database:", err.message);
  }

  console.log("👋 Shutdown complete");
  process.exit(0); // Exit process gracefully
};

// --- Error Handlers ---
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught exception:", err.message);
  console.error(err.stack);
  // In production, consider graceful shutdown for unhandled exceptions
  if (process.env.NODE_ENV === "production") {
    shutdown();
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled promise rejection:", reason);
  // In production, consider graceful shutdown for unhandled rejections
  if (process.env.NODE_ENV === "production") {
    shutdown();
  }
});

// --- Shutdown Signals ---
process.on("SIGINT", shutdown); // Ctrl+C
process.on("SIGTERM", shutdown); // Termination signal

// --- Start the application ---
startServer().then(() => {
  // Start RFID monitoring after server is ready
  setTimeout(startRFIDMonitoring, 2000); // Delay to ensure server is fully up
});
