const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const WebSocket = require("ws");
const session = require("express-session");
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const { connectDB, sequelize } = require("./config/db"); // Updated to get sequelize instance

const authRoutes = require("./routes/auth");
const gameRoutes = require("./routes/games");
const cardRoutes = require("./routes/card");
const adminRoutes = require("./routes/adminAPIs");

dotenv.config();
const app = express();

// Session Store Configuration
const sessionStore = new SequelizeStore({
  db: sequelize,
  tableName: "Sessions",
  checkExpirationInterval: 15 * 60 * 1000, // Check every 15 minutes
  expiration: 24 * 60 * 60 * 1000, // 24 hours
});

// Session Configuration
app.use(
  session({
    secret:
      process.env.SESSION_SECRET ||
      " f9f13256ec72de1daafa5e569b7f292d736a5d87aa6abd13a3a832ad90b0913a69add4d49c2b0f006559e370208bdcc5497d6f108826047cb9a91227cc815ada",
    store: new SequelizeStore({
      db: sequelize, // ✅ pass the Sequelize instance here
    }),
    resave: false,
    saveUninitialized: false,
    rolling: true, // Reset expiration on activity
    cookie: {
      secure: process.env.NODE_ENV === "production", // HTTPS only in production
      httpOnly: true, // Prevent XSS
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    },
    name: "sessionId", // Custom session name
  })
);

// Middleware
app.use(express.json({ limit: "10mb" })); // Added size limit
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Enhanced CORS Configuration
app.use(
  cors({
    origin: function (origin, callback) {
      const allowedOrigins = [
        process.env.CLIENT_URL || "http://localhost:5001",
        "http://localhost:3000", // React dev server
        "http://localhost:5000", // Additional frontend
      ];

      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
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

// Database Connection and Session Store Setup
const initializeDatabase = async () => {
  try {
    await connectDB();
    console.log("✅ Connected to MySQL database");

    // Sync session store
    await sessionStore.sync();
    console.log("✅ Session store synchronized");

    // Test database connection
    await sequelize.authenticate();
    console.log("✅ Database authentication successful");
  } catch (err) {
    console.error("❌ Database initialization failed:", err.message);
    process.exit(1);
  }
};

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/game", gameRoutes);
app.use("/api/card", cardRoutes);
app.use("/api/admin", adminRoutes);

// Health Check Endpoint
app.get("/status", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    session: req.session.id ? "Active" : "None",
  });
});

// Session Test Endpoint
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

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err.stack);
  res.status(500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message,
  });
});

// 404 Handler
app.use("*", (req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Server Setup
const PORT = process.env.PORT || 3000;
let server;

const startServer = async () => {
  try {
    await initializeDatabase();

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

// WebSocket Setup
const WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || 8080;
const wss = new WebSocket.Server({
  port: WEBSOCKET_PORT,
  perMessageDeflate: false, // Disable compression for better performance
});

const clients = new Set();

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

// Enhanced RFID Reader with Retry Logic
let serialPort;
let isRFIDConnected = false;
let rfidRetryInterval;
let triedPorts = new Set();

const broadcastToClients = (data) => {
  const message = JSON.stringify(data);
  let sentCount = 0;

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
      sentCount++;
    } else {
      clients.delete(client);
    }
  });

  if (sentCount > 0) {
    console.log(`📤 Broadcasted to ${sentCount} clients:`, data.event);
  }
};

const listAvailablePorts = async () => {
  try {
    const ports = await SerialPort.list();
    const comPorts = ports.filter(
      (port) =>
        port.path &&
        (port.path.startsWith("COM") || port.path.startsWith("/dev/tty")) &&
        !triedPorts.has(port.path) // Skip already failed ports
    );

    if (comPorts.length === 0) {
      console.log("⚠️ No new serial ports to try");
      triedPorts.clear(); // Reset so we can retry everything
      return null;
    }

    console.log(
      "📡 Available untried ports:",
      comPorts.map((p) => p.path).join(", ")
    );
    return comPorts.map((p) => p.path);
  } catch (error) {
    console.error("❌ Error listing serial ports:", error.message);
    return null;
  }
};

const initRFIDReader = async () => {
  try {
    const portPaths = await listAvailablePorts();
    if (!portPaths || portPaths.length === 0) {
      console.log("⏳ Waiting to retry RFID detection...");
      return false;
    }

    for (const portPath of portPaths) {
      console.log(`🔍 Attempting connection to: ${portPath}`);

      const testPort = new SerialPort({
        path: portPath,
        baudRate: 9600,
        autoOpen: false,
      });

      const openPromise = new Promise((resolve) => {
        testPort.open((err) => {
          if (err) {
            console.warn(`❌ Failed to open ${portPath}: ${err.message}`);
            triedPorts.add(portPath);
            resolve(false);
            return;
          }

          console.log(`✅ RFID reader connected at: ${portPath}`);
          serialPort = testPort;
          isRFIDConnected = true;

          const parser = serialPort.pipe(
            new ReadlineParser({ delimiter: "\r\n" })
          );
          let location = 1;

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
            console.error("❌ Serial port error:", err.message);
            isRFIDConnected = false;
            triedPorts.add(portPath);
            serialPort = null;
          });

          serialPort.on("close", () => {
            console.log(`🔌 RFID port ${portPath} closed`);
            isRFIDConnected = false;
            triedPorts.add(portPath);
            serialPort = null;
          });

          resolve(true);
        });
      });

      const success = await openPromise;
      if (success) return true;
    }

    return false;
  } catch (err) {
    console.error("❌ Error initializing RFID reader:", err.message);
    return false;
  }
};

const startRFIDMonitoring = () => {
  console.log("🔄 Starting RFID monitoring...");

  // Initial connection attempt
  initRFIDReader();

  // Retry mechanism - check every 5 seconds if not connected
  rfidRetryInterval = setInterval(async () => {
    if (!isRFIDConnected) {
      console.log("🔄 Retrying RFID connection...");
      await initRFIDReader();
    }
  }, 5000);
};

// Graceful Shutdown
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
  process.exit(0);
};

// Error Handlers
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught exception:", err.message);
  console.error(err.stack);
  if (process.env.NODE_ENV === "production") {
    shutdown();
  }
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled promise rejection:", reason);
  if (process.env.NODE_ENV === "production") {
    shutdown();
  }
});

// Shutdown Signals
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start the application
startServer().then(() => {
  // Start RFID monitoring after server is ready
  setTimeout(startRFIDMonitoring, 2000);
});
