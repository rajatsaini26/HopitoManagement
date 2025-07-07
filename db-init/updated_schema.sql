-- Gaming Center Management System Database Schema
-- Execute this script to create the initial database structure

-- Create database (uncomment if needed)
CREATE DATABASE gaming_center; 
USE gaming_center;

-- ====================================
-- 1. ADMIN TABLE
-- ====================================
CREATE TABLE admin (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255) NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'admin',
    mobile VARCHAR(12) NOT NULL UNIQUE,
    permissions JSON DEFAULT ('{"view_dashboard": true, "manage_employees": true, "manage_customers": true, "manage_games": true, "manage_sessions": true, "view_reports": true, "manage_transactions": true, "system_settings": true}'),
    last_login DATETIME NULL,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_admin_username_status (username, status),
    INDEX idx_admin_email (email),
    
    -- Constraints
    CONSTRAINT chk_admin_email CHECK (email IS NULL OR email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
);

-- ====================================
-- 2. EMPLOYEES TABLE
-- ====================================
CREATE TABLE employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mobile VARCHAR(15) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    address TEXT NULL,
    userID INT NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    otp VARCHAR(6) NULL,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    role VARCHAR(50) DEFAULT 'employee',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_employees_mobile (mobile),
    INDEX idx_employees_userID (userID),
    INDEX idx_employees_status (status),
    
    -- Constraints
    CONSTRAINT chk_employees_mobile CHECK (mobile REGEXP '^[0-9]{10,15}$')
);

-- ====================================
-- 3. CUSTOMER TABLE
-- ====================================
CREATE TABLE customer (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    card VARCHAR(255) NOT NULL UNIQUE,
    balance DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    phone VARCHAR(20) NULL,
    email VARCHAR(255) NULL,
    status ENUM('active', 'inactive', 'blocked') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_customer_card (card),
    INDEX idx_customer_status (status),
    INDEX idx_customer_phone (phone),
    INDEX idx_customer_email (email),
    
    -- Constraints
    CONSTRAINT chk_customer_balance CHECK (balance >= 0),
    CONSTRAINT chk_customer_email CHECK (email IS NULL OR email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')
);

-- ====================================
-- 4. GAMES TABLE
-- ====================================
CREATE TABLE games (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_name VARCHAR(100) NOT NULL,
    session_time INT NOT NULL COMMENT 'Session time in minutes',
    charge DECIMAL(10, 2) NOT NULL COMMENT 'Charge per session',
    discount INT NULL DEFAULT 0 COMMENT 'Discount percentage',
    status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active',
    description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_games_status (status),
    INDEX idx_games_name (game_name),
    
    -- Constraints
    CONSTRAINT chk_games_session_time CHECK (session_time > 0),
    CONSTRAINT chk_games_charge CHECK (charge >= 0),
    CONSTRAINT chk_games_discount CHECK (discount >= 0 AND discount <= 100)
);



-- ====================================
-- 5. SESSIONS TABLE
-- ====================================
CREATE TABLE sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    game_id INT NOT NULL,
    emp_id INT NOT NULL,
    card VARCHAR(255) NOT NULL,
    start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    end_time DATETIME NULL,
    planned_duration INT NOT NULL COMMENT 'Planned session duration in minutes',
    actual_duration INT NULL COMMENT 'Actual session duration in minutes',
    base_charge DECIMAL(10, 2) NOT NULL COMMENT 'Base charge for the session',
    discount_applied INT DEFAULT 0 COMMENT 'Discount percentage applied',
    discount_amount DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Actual discount amount in currency',
    final_charge DECIMAL(10, 2) NOT NULL COMMENT 'Final charge after discount',
    status ENUM('active', 'completed', 'cancelled', 'paused') DEFAULT 'active',
    notes TEXT NULL,
    started_by INT NOT NULL COMMENT 'Employee who started the session',
    ended_by INT NULL COMMENT 'Employee who ended the session',
    payment_method ENUM('cash', 'online', 'card_balance') DEFAULT 'card_balance' COMMENT 'Payment method used',
    refund_amount DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Refund amount if session cancelled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_sessions_customer_status (customer_id, status),
    INDEX idx_sessions_game_status (game_id, status),
    INDEX idx_sessions_emp_created (emp_id, created_at),
    INDEX idx_sessions_time_range (start_time, end_time),
    INDEX idx_sessions_started_by (started_by),
    INDEX idx_sessions_ended_by (ended_by),
    
    -- Foreign Key Constraints
    CONSTRAINT fk_sessions_customer FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE,
    CONSTRAINT fk_sessions_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    CONSTRAINT fk_sessions_employee FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_sessions_started_by FOREIGN KEY (started_by) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_sessions_ended_by FOREIGN KEY (ended_by) REFERENCES employees(id) ON DELETE CASCADE,
    
    -- Check Constraints
    CONSTRAINT chk_sessions_planned_duration CHECK (planned_duration > 0),
    CONSTRAINT chk_sessions_actual_duration CHECK (actual_duration IS NULL OR actual_duration >= 0),
    CONSTRAINT chk_sessions_base_charge CHECK (base_charge >= 0),
    CONSTRAINT chk_sessions_discount_applied CHECK (discount_applied >= 0 AND discount_applied <= 100),
    CONSTRAINT chk_sessions_discount_amount CHECK (discount_amount >= 0),
    CONSTRAINT chk_sessions_final_charge CHECK (final_charge >= 0),
    CONSTRAINT chk_sessions_refund_amount CHECK (refund_amount >= 0),
    CONSTRAINT chk_sessions_end_time CHECK (end_time IS NULL OR end_time >= start_time)
);

-- ====================================
-- 6. TRANSACTIONS TABLE
-- ====================================
CREATE TABLE transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    card VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    emp_id INT NOT NULL,
    type ENUM('cash', 'online') NOT NULL DEFAULT 'cash',
    transaction_type ENUM('recharge', 'new_card', 'game_session', 'refund') NOT NULL DEFAULT 'recharge',
    balance_before DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    balance_after DECIMAL(10, 2) NOT NULL,
    game_id INT NULL,
    session_id INT NULL COMMENT 'Reference to session for game transactions',
    session_time INT NULL COMMENT 'Session time in minutes for game transactions',
    discount_applied INT DEFAULT 0 COMMENT 'Discount percentage applied',
    discount_amount DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Actual discount amount in currency',
    status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'completed',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_transactions_customer_type (customer_id, transaction_type),
    INDEX idx_transactions_emp_created (emp_id, created_at),
    INDEX idx_transactions_type_status (type, status),
    INDEX idx_transactions_session (session_id),
    INDEX idx_transactions_game (game_id),
    INDEX idx_transactions_created_at (created_at),
    
    -- Foreign Key Constraints
    CONSTRAINT fk_transactions_customer FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE,
    CONSTRAINT fk_transactions_employee FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_transactions_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL,
    CONSTRAINT fk_transactions_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    
    -- Check Constraints
    CONSTRAINT chk_transactions_amount CHECK (amount != 0),
    CONSTRAINT chk_transactions_balance_before CHECK (balance_before >= 0),
    CONSTRAINT chk_transactions_balance_after CHECK (balance_after >= 0),
    CONSTRAINT chk_transactions_session_time CHECK (session_time IS NULL OR session_time > 0),
    CONSTRAINT chk_transactions_discount_applied CHECK (discount_applied >= 0 AND discount_applied <= 100),
    CONSTRAINT chk_transactions_discount_amount CHECK (discount_amount >= 0)
);

-- ====================================
-- 7. TRANSACTION HISTORY TABLE
-- ====================================
CREATE TABLE transactionHistory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_id INT NOT NULL,
    customer_id INT NOT NULL,
    card VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    emp_id INT NOT NULL,
    type ENUM('cash', 'online') NOT NULL DEFAULT 'cash',
    transaction_type ENUM('recharge', 'new_card', 'game_session', 'refund') NOT NULL DEFAULT 'recharge',
    balance_before DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    balance_after DECIMAL(10, 2) NOT NULL,
    game_id INT NULL,
    session_id INT NULL COMMENT 'Reference to session for game transactions',
    session_time INT NULL COMMENT 'Session time in minutes for game transactions',
    discount_applied INT DEFAULT 0 COMMENT 'Discount percentage applied',
    discount_amount DECIMAL(10, 2) DEFAULT 0.00 COMMENT 'Actual discount amount in currency',
    status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'completed',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Indexes
    INDEX idx_transaction_history_customer_type (customer_id, transaction_type),
    INDEX idx_transaction_history_emp_created (emp_id, created_at),
    INDEX idx_transaction_history_transaction (transaction_id),
    INDEX idx_transaction_history_session (session_id),
    INDEX idx_transaction_history_created_status (created_at, status),
    INDEX idx_transaction_history_game (game_id),
    
    -- Foreign Key Constraints
    CONSTRAINT fk_transaction_history_transaction FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    CONSTRAINT fk_transaction_history_customer FOREIGN KEY (customer_id) REFERENCES customer(id) ON DELETE CASCADE,
    CONSTRAINT fk_transaction_history_employee FOREIGN KEY (emp_id) REFERENCES employees(id) ON DELETE CASCADE,
    CONSTRAINT fk_transaction_history_game FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL,
    CONSTRAINT fk_transaction_history_session FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE SET NULL,
    
    -- Check Constraints
    CONSTRAINT chk_transaction_history_amount CHECK (amount != 0),
    CONSTRAINT chk_transaction_history_balance_before CHECK (balance_before >= 0),
    CONSTRAINT chk_transaction_history_balance_after CHECK (balance_after >= 0),
    CONSTRAINT chk_transaction_history_session_time CHECK (session_time IS NULL OR session_time > 0),
    CONSTRAINT chk_transaction_history_discount_applied CHECK (discount_applied >= 0 AND discount_applied <= 100),
    CONSTRAINT chk_transaction_history_discount_amount CHECK (discount_amount >= 0)
);


-- ====================================
-- 8. SESSIONS TABLE
-- ====================================
CREATE TABLE `http_sessions` (
    `sid` VARCHAR(36) NOT NULL PRIMARY KEY,
    `expires` DATETIME NULL DEFAULT NULL,
    `data` TEXT NULL DEFAULT NULL,
    `createdAt` DATETIME NOT NULL,
    `updatedAt` DATETIME NOT NULL
);



-- ====================================
-- 9. TRIGGERS FOR AUDIT TRAIL
-- ====================================

-- Trigger to automatically create transaction history when a transaction is created
DELIMITER //
CREATE TRIGGER tr_transaction_history_insert
AFTER INSERT ON transactions
FOR EACH ROW
BEGIN
    INSERT INTO transactionHistory (
        transaction_id, customer_id, card, amount, emp_id, type, transaction_type,
        balance_before, balance_after, game_id, session_id, session_time,
        discount_applied, discount_amount, status, notes, created_at, updated_at
    ) VALUES (
        NEW.id, NEW.customer_id, NEW.card, NEW.amount, NEW.emp_id, NEW.type, NEW.transaction_type,
        NEW.balance_before, NEW.balance_after, NEW.game_id, NEW.session_id, NEW.session_time,
        NEW.discount_applied, NEW.discount_amount, NEW.status, NEW.notes, NEW.created_at, NEW.updated_at
    );
END//

-- Trigger to automatically update transaction history when a transaction is updated
CREATE TRIGGER tr_transaction_history_update
AFTER UPDATE ON transactions
FOR EACH ROW
BEGIN
    UPDATE transactionHistory 
    SET 
        customer_id = NEW.customer_id,
        card = NEW.card,
        amount = NEW.amount,
        emp_id = NEW.emp_id,
        type = NEW.type,
        transaction_type = NEW.transaction_type,
        balance_before = NEW.balance_before,
        balance_after = NEW.balance_after,
        game_id = NEW.game_id,
        session_id = NEW.session_id,
        session_time = NEW.session_time,
        discount_applied = NEW.discount_applied,
        discount_amount = NEW.discount_amount,
        status = NEW.status,
        notes = NEW.notes,
        updated_at = NEW.updated_at
    WHERE transaction_id = NEW.id;
END//
DELIMITER ;

-- ====================================
-- 9. SAMPLE DATA INSERT (Optional)
-- ====================================

-- Insert sample admin user (password: admin123)
-- INSERT INTO admin (username, password, email, mobile, role, status) VALUES 
-- ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@gamingcenter.com', '1234567890', 'admin', 'active');

-- Insert sample games
-- INSERT INTO games (game_name, session_time, charge, discount, status, description) VALUES 
-- ('Virtual Reality Adventure', 30, 25.00, 10, 'active', 'Immersive VR gaming experience'),
-- ('Racing Simulator', 15, 15.00, 5, 'active', 'High-speed racing simulation'),
-- ('Battle Arena', 45, 35.00, 15, 'active', 'Multiplayer battle arena game'),
-- ('Puzzle Quest', 20, 12.00, 0, 'active', 'Brain-teasing puzzle challenges');

-- -- Insert sample employee
-- INSERT INTO employees (mobile, name, address, userID, password, status, role) VALUES 
-- ('9876543210', 'John Doe', '123 Main Street, City', 1001, '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'active', 'employee');

-- -- Insert sample customer
-- INSERT INTO customer (name, card, balance, phone, email, status) VALUES 
-- ('Alice Johnson', 'CARD001', 100.00, '9123456789', 'alice@example.com', 'active'),
-- ('Bob Smith', 'CARD002', 75.50, '9123456788', 'bob@example.com', 'active');

-- ====================================
-- 10. VIEWS FOR REPORTING
-- ====================================

-- View for active sessions with customer and game details
CREATE VIEW active_sessions_view AS
SELECT 
    s.id,
    s.card,
    c.name as customer_name,
    g.game_name,
    s.start_time,
    s.planned_duration,
    s.final_charge,
    s.payment_method,
    e1.name as started_by_name,
    s.status
FROM sessions s
JOIN customer c ON s.customer_id = c.id
JOIN games g ON s.game_id = g.id
JOIN employees e1 ON s.started_by = e1.id
WHERE s.status = 'active';

-- View for daily revenue summary
CREATE VIEW daily_revenue_view AS
SELECT 
    DATE(created_at) as transaction_date,
    transaction_type,
    type as payment_type,
    COUNT(*) as transaction_count,
    SUM(amount) as total_amount
FROM transactions
WHERE status = 'completed'
GROUP BY DATE(created_at), transaction_type, type
ORDER BY transaction_date DESC;

-- View for customer balance summary
CREATE VIEW customer_balance_summary AS
SELECT 
    c.id,
    c.name,
    c.card,
    c.balance,
    c.status,
    COUNT(t.id) as total_transactions,
    SUM(CASE WHEN t.transaction_type = 'recharge' THEN t.amount ELSE 0 END) as total_recharge,
    SUM(CASE WHEN t.transaction_type = 'game_session' THEN t.amount ELSE 0 END) as total_spent,
    c.created_at as customer_since
FROM customer c
LEFT JOIN transactions t ON c.id = t.customer_id
GROUP BY c.id, c.name, c.card, c.balance, c.status, c.created_at;

-- ====================================
-- SCHEMA CREATION COMPLETE
-- ====================================

-- Display completion message
SELECT 'Gaming Center Database Schema Created Successfully!' as STATUS;