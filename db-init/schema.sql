-- ========================
-- IMPROVED DATABASE SCHEMA
-- ========================

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS TransactionHistory;
DROP TABLE IF EXISTS Transactions;
DROP TABLE IF EXISTS Sessions;
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
-- Table: Sessions (NEW)
-- ========================
CREATE TABLE Sessions (
    SessionID INT AUTO_INCREMENT PRIMARY KEY,
    CardID VARCHAR(50) NOT NULL,
    GameID INT NOT NULL,
    StartTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    EndTime DATETIME NULL,
    Duration INT NULL, -- in minutes
    ActualCharge DECIMAL(10,2) NOT NULL,
    DiscountApplied INT DEFAULT 0,
    Status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
    EmployeeID INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (CardID) REFERENCES Customer(card),
    FOREIGN KEY (GameID) REFERENCES Games(GameID),
    FOREIGN KEY (EmployeeID) REFERENCES Employee(id)
);

-- ========================
-- Table: Transactions (IMPROVED)
-- ========================
CREATE TABLE Transactions (
    TransactionID INT AUTO_INCREMENT PRIMARY KEY,
    CardID VARCHAR(50) NOT NULL,
    Amount DECIMAL(10,2) NOT NULL,
    PreviousBalance DECIMAL(10,2) NOT NULL,
    NewBalance DECIMAL(10,2) NOT NULL,
    Type ENUM('credit', 'debit') NOT NULL,
    Category ENUM('recharge', 'new_card', 'game_charge', 'refund', 'adjustment') NOT NULL,
    EmployeeID INT,
    GameID INT NULL,
    SessionID INT NULL,
    TransactionTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    Remarks VARCHAR(255),
    Method ENUM('ONLINE', 'CASH') NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (CardID) REFERENCES Customer(card),
    FOREIGN KEY (EmployeeID) REFERENCES Employee(id),
    FOREIGN KEY (GameID) REFERENCES Games(GameID),
    FOREIGN KEY (SessionID) REFERENCES Sessions(SessionID)
);

-- ========================
-- Table: TransactionHistory (NEW)
-- ========================
CREATE TABLE TransactionHistory (
    HistoryID INT AUTO_INCREMENT PRIMARY KEY,
    TransactionID INT NOT NULL,
    CardID VARCHAR(50) NOT NULL,
    Amount DECIMAL(10,2) NOT NULL,
    PreviousBalance DECIMAL(10,2) NOT NULL,
    NewBalance DECIMAL(10,2) NOT NULL,
    Type ENUM('credit', 'debit') NOT NULL,
    Category ENUM('recharge', 'new_card', 'game_charge', 'refund', 'adjustment') NOT NULL,
    EmployeeID INT,
    GameID INT NULL,
    SessionID INT NULL,
    TransactionTime DATETIME NOT NULL,
    Remarks VARCHAR(255),
    Method ENUM('ONLINE', 'CASH') NOT NULL,
    ArchivedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_card_date (CardID, TransactionTime),
    INDEX idx_employee_date (EmployeeID, TransactionTime)
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

-- Insert default counter values
INSERT INTO Counter (name, seq) VALUES ('employeeID', 101);
INSERT INTO Counter (name, seq) VALUES ('transactionID', 1001);

-- ========================
-- USEFUL VIEWS FOR REPORTING
-- ========================

-- View for customer balance summary
CREATE VIEW CustomerBalanceSummary AS
SELECT 
    c.id,
    c.name,
    c.card,
    c.balance,
    c.mobile,
    COALESCE(SUM(CASE WHEN t.Type = 'credit' THEN t.Amount ELSE 0 END), 0) as TotalCredits,
    COALESCE(SUM(CASE WHEN t.Type = 'debit' THEN t.Amount ELSE 0 END), 0) as TotalDebits,
    COUNT(t.TransactionID) as TotalTransactions
FROM Customer c
LEFT JOIN Transactions t ON c.card = t.CardID
GROUP BY c.id, c.name, c.card, c.balance, c.mobile;

-- View for daily transaction summary
CREATE VIEW DailyTransactionSummary AS
SELECT 
    DATE(TransactionTime) as TransactionDate,
    COUNT(*) as TotalTransactions,
    SUM(CASE WHEN Type = 'credit' THEN Amount ELSE 0 END) as TotalCredits,
    SUM(CASE WHEN Type = 'debit' THEN Amount ELSE 0 END) as TotalDebits,
    SUM(CASE WHEN Type = 'credit' THEN Amount ELSE -Amount END) as NetAmount
FROM Transactions
GROUP BY DATE(TransactionTime)
ORDER BY TransactionDate DESC;