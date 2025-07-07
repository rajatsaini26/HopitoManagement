// utils/validation.js
const { Op } = require('sequelize');

class ValidationUtils {
    /**
     * Validate customer balance before deduction
     * @param {Object} customer - Customer instance
     * @param {number} amount - Amount to deduct
     * @throws {Error} If insufficient balance
     */
    static validateBalance(customer, amount) {
        try {
            if (!customer) {
                throw new Error('Customer not found');
            }

            const currentBalance = parseFloat(customer.balance);
            const requiredAmount = parseFloat(amount);

            if (isNaN(currentBalance) || isNaN(requiredAmount)) {
                throw new Error('Invalid balance or amount values');
            }

            if (currentBalance < requiredAmount) {
                throw new Error(`Insufficient balance. Required: ${requiredAmount}, Available: ${currentBalance}`);
            }

            return true;
        } catch (error) {
            throw new Error(`Balance validation failed: ${error.message}`);
        }
    }

    /**
     * Validate customer status
     * @param {Object} customer - Customer instance
     * @throws {Error} If customer is not active
     */
    static validateCustomerStatus(customer) {
        try {
            if (!customer) {
                throw new Error('Customer not found');
            }

            if (customer.status !== 'active') {
                throw new Error(`Customer account is ${customer.status}. Please contact support.`);
            }

            return true;
        } catch (error) {
            throw new Error(`Customer status validation failed: ${error.message}`);
        }
    }

    /**
     * Validate employee status
     * @param {Object} employee - Employee instance
     * @throws {Error} If employee is not active
     */
    static validateEmployeeStatus(employee) {
        try {
            if (!employee) {
                throw new Error('Employee not found');
            }

            if (employee.status !== 'active') {
                throw new Error(`Employee account is ${employee.status}. Please contact admin.`);
            }

            return true;
        } catch (error) {
            throw new Error(`Employee status validation failed: ${error.message}`);
        }
    }

    /**
     * Validate game availability
     * @param {Object} game - Game instance
     * @throws {Error} If game is not available
     */
    static validateGameAvailability(game) {
        try {
            if (!game) {
                throw new Error('Game not found');
            }

            if (game.status !== 'active') {
                throw new Error(`Game is currently ${game.status}. Please try another game.`);
            }

            return true;
        } catch (error) {
            throw new Error(`Game availability validation failed: ${error.message}`);
        }
    }

    /**
     * Validate transaction amount
     * @param {number} amount - Transaction amount
     * @throws {Error} If amount is invalid
     */
    static validateAmount(amount) {
        try {
            const numAmount = parseFloat(amount);

            if (isNaN(numAmount) || numAmount <= 0) {
                throw new Error('Invalid amount. Amount must be a positive number.');
            }

            if (numAmount > 10000) {
                throw new Error('Amount exceeds maximum limit of 10,000.');
            }

            return true;
        } catch (error) {
            throw new Error(`Amount validation failed: ${error.message}`);
        }
    }

    /**
     * Validate session time
     * @param {number} sessionTime - Session time in minutes
     * @throws {Error} If session time is invalid
     */
    static validateSessionTime(sessionTime) {
        try {
            if (sessionTime !== null && sessionTime !== undefined) {
                const numTime = parseInt(sessionTime, 10);

                if (isNaN(numTime) || numTime <= 0) {
                    throw new Error('Invalid session time. Time must be a positive number.');
                }

                if (numTime > 480) { // 8 hours max
                    throw new Error('Session time exceeds maximum limit of 8 hours.');
                }
            }

            return true;
        } catch (error) {
            throw new Error(`Session time validation failed: ${error.message}`);
        }
    }

    /**
     * Validate card format
     * @param {string} card - Card number
     * @throws {Error} If card format is invalid
     */
    static validateCard(card) {
        try {
            if (!card || typeof card !== 'string') {
                throw new Error('Card number is required.');
            }

            const cleanCard = card.trim();
            if (cleanCard.length < 4 || cleanCard.length > 20) {
                throw new Error('Card number must be between 4 and 20 characters.');
            }

            // Check if card contains only alphanumeric characters
            const cardRegex = /^[a-zA-Z0-9]+$/;
            if (!cardRegex.test(cleanCard)) {
                throw new Error('Card number must contain only alphanumeric characters.');
            }

            return true;
        } catch (error) {
            throw new Error(`Card validation failed: ${error.message}`);
        }
    }

    /**
     * Validate email format
     * @param {string} email - Email address
     * @throws {Error} If email format is invalid
     */
    static validateEmail(email) {
        try {
            if (email && email.length > 0) {
                const trimmedEmail = email.trim();
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(trimmedEmail)) {
                    throw new Error('Invalid email format.');
                }
            }

            return true;
        } catch (error) {
            throw new Error(`Email validation failed: ${error.message}`);
        }
    }

    /**
     * Validate phone number
     * @param {string} phone - Phone number
     * @throws {Error} If phone format is invalid
     */
    static validatePhone(phone) {
        try {
            if (phone && phone.length > 0) {
                const cleanPhone = phone.replace(/[\s\-\(\)]/g, ''); // Remove common phone formatting
                const phoneRegex = /^[0-9]{10,15}$/;
                if (!phoneRegex.test(cleanPhone)) {
                    throw new Error('Invalid phone number format. Must be 10-15 digits.');
                }
            }

            return true;
        } catch (error) {
            throw new Error(`Phone validation failed: ${error.message}`);
        }
    }

    /**
     * Validate if customer has any active sessions
     * @param {number} customerId - Customer ID
     * @param {Object} Sessions - Sessions model
     * @returns {Promise<boolean>} True if customer has active sessions
     */
    static async hasActiveSessions(customerId, Sessions) {
        if (!customerId || !Sessions) {
            throw new Error('Customer ID and Sessions model are required');
        }

        try {
            const activeSessions = await Sessions.findAll({
                where: {
                    customer_id: customerId,
                    status: 'active'
                }
            });

            return activeSessions.length > 0;
        } catch (error) {
            throw new Error(`Error checking active sessions: ${error.message}`);
        }
    }

    /**
     * Validate required fields
     * @param {Object} data - Data object to validate
     * @param {Array} requiredFields - Array of required field names
     * @throws {Error} If any required field is missing
     */
    static validateRequiredFields(data, requiredFields) {
        try {
            if (!data || typeof data !== 'object') {
                throw new Error('Data object is required');
            }

            if (!Array.isArray(requiredFields)) {
                throw new Error('Required fields must be an array');
            }

            const missingFields = requiredFields.filter(field => 
                data[field] === null || data[field] === undefined || data[field] === ''
            );

            if (missingFields.length > 0) {
                throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
            }

            return true;
        } catch (error) {
            throw new Error(`Required fields validation failed: ${error.message}`);
        }
    }
}

module.exports = ValidationUtils;