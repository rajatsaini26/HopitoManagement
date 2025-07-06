-- ========================
-- DATABASE SCHEMA SETUP
-- ========================

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS Transactions;
DROP TABLE IF EXISTS Employee;
DROP TABLE IF EXISTS Customer;
DROP TABLE IF EXISTS Games;
DROP TABLE IF EXISTS Admin;
DROP TABLE IF EXISTS Counter;

-- ========================
-- Table: Admin
-- ========================
CREATE TABLE Admin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    mobile VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(45) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ========================
-- Table: Customer
-- ========================
CREATE TABLE Customer (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    card VARCHAR(255) NOT NULL UNIQUE,
    balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    mobile VARCHAR(45) NOT NULL UNIQUE,
    address VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ========================
-- Table: Games
-- ========================
CREATE TABLE Games (
    GameID INT AUTO_INCREMENT PRIMARY KEY,
    GameName VARCHAR(50) NOT NULL,
    SessionTime INT NOT NULL,
    Charge DECIMAL(10,2) NOT NULL,
    Discount INT DEFAULT 0 CHECK (Discount BETWEEN 0 AND 100),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ========================
-- Table: Employee
-- ========================
CREATE TABLE Employee (
    id INT AUTO_INCREMENT PRIMARY KEY,
    userID INT NOT NULL UNIQUE,
    mobile VARCHAR(15) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    address VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    otp VARCHAR(4) NOT NULL,
    role ENUM('Manager', 'Admin', 'Employee') NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    lastDay DATETIME
);

-- ========================
-- Table: Transactions
-- ========================
CREATE TABLE Transactions (
    TransactionID INT AUTO_INCREMENT PRIMARY KEY,
    CardID VARCHAR(50) NOT NULL,
    Amount DECIMAL(10,2) NOT NULL,
    Type ENUM('credit', 'debit') NOT NULL,
    EmployeeID INT,
    GameID INT,
    TransactionTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    Remarks VARCHAR(255),
    Method ENUM('ONLINE', 'CASH') NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (CardID) REFERENCES Customer(card),
    FOREIGN KEY (EmployeeID) REFERENCES Employee(userID),
    FOREIGN KEY (GameID) REFERENCES Games(GameID)
);

-- ========================
-- Table: Counter
-- ========================
CREATE TABLE Counter (
    name VARCHAR(255) PRIMARY KEY,
    seq INT DEFAULT 100
);

-- ========================
-- Default Data Insertions
-- ========================

-- 🔐 Insert default admin (username: admin, mobile: 6350037900)
-- Hashed password: bcrypt hash of "nctladnun" (cost: 10)
-- INSERT INTO Admin (username, password, mobile, name)
-- VALUES (
--     'admin',
--     '$2b$10$z3.q1tdR8fwYfT3yf6Z5E.49FqqvLqGp2gjFvACGhwEY/DUL8ttKu',  -- ← "nctladnun"
--     '6350037900',
--     'Super Admin'
-- );

-- 🧾 Optional default for Counter
INSERT INTO Counter (name, seq) VALUES ('employeeID', 101);
