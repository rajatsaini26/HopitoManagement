// models/Admin.js
const { DataTypes } = require("sequelize");
const sequelize = require("../config/db").sequelize;
const bcrypt = require("bcrypt"); // Add bcrypt for password hashing

const Admin = sequelize.define(
  "Admin",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mobile: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: true,
      validate: {
        is: /^[0-9]{10}$/, // Validate as a 10-digit number
      },
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    role: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "admin",
    },
    permissions: {
      type: DataTypes.JSON,
      defaultValue: {
        view_dashboard: true,
        manage_employees: true,
        manage_customers: true,
        manage_games: true,
        manage_sessions: true,
        view_reports: true,
        manage_transactions: true,
        system_settings: true,
      },
    },
    last_login: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "suspended"),
      defaultValue: "active",
    },
  },
  {
    tableName: "admin",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    indexes: [
      {
        fields: [ "status", "mobile"], name: 'idx_username_status',
      },
     
    ],
    // Replace your existing hooks in the Admin model with these:
    hooks: {
      beforeCreate: async (admin) => {
        console.log("🔍 beforeCreate hook triggered");
        console.log("🔍 Original password:", admin.password);

        if (admin.password) {
          // Check if password is already hashed (bcrypt hashes start with $2b$)
          if (!admin.password.startsWith("$2b$")) {
            const salt = await bcrypt.genSalt(10);
            admin.password = await bcrypt.hash(admin.password, salt);
            console.log("🔍 Password hashed in beforeCreate:", admin.password);
          } else {
            console.log("🔍 Password already hashed, skipping");
          }
        }
      },
      beforeUpdate: async (admin) => {
        console.log("🔍 beforeUpdate hook triggered");

        if (admin.changed("password")) {
          console.log("🔍 Password changed, hashing new password");

          // Check if password is already hashed
          if (!admin.password.startsWith("$2b$")) {
            const salt = await bcrypt.genSalt(10);
            admin.password = await bcrypt.hash(admin.password, salt);
            console.log("🔍 Password hashed in beforeUpdate:", admin.password);
          }
        }
      },
    },
  }
);

// ==================== AUTHENTICATION METHODS ====================

// Add this temporarily to your Admin model for testing
// Admin.debugAuthenticate = async function (mobile, password) {
//   try {
//     console.log("🔍 Attempting to authenticate mobile:", mobile);
//     console.log("🔍 Attempting to authenticate with password:", password);

//     const admin = await this.findOne({
//       where: {
//         mobile,
//         status: "active",
//       },
//     });

//     if (!admin) {
//       console.log("❌ Admin not found or inactive");
//       throw new Error("Invalid mobile number or admin account inactive");
//     }

//     console.log("✅ Admin found:", admin.username);
//     console.log("🔍 Stored password hash:", admin.password);
//     console.log("🔍 Password to compare:", password);

//     // Compare provided password with hashed password
//     const isMatch = await bcrypt.compare(password, admin.password);
//     console.log("🔍 Password comparison result:", isMatch);

//     if (!isMatch) {
//       console.log("❌ Password does not match");
//       throw new Error("Invalid password");
//     }

//     console.log("✅ Password matches, updating last login");

//     // Update last login
//     await admin.update({ last_login: new Date() });

//     return {
//       id: admin.id,
//       username: admin.username,
//       mobile: admin.mobile,
//       email: admin.email,
//       role: admin.role,
//       permissions: admin.permissions,
//       last_login: admin.last_login,
//     };
//   } catch (error) {
//     console.error("❌ Authentication failed:", error.message);
//     throw new Error(`Authentication failed: ${error.message}`);
//   }
// };

Admin.authenticate = async function (mobile, password) {
  try {
    const admin = await this.findOne({
      where: {
        mobile, // Authenticate by mobile
        status: "active",
      },
    });

    if (!admin) {
      throw new Error("Invalid mobile number or admin account inactive");
    }

    // Compare provided password with hashed password
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      throw new Error("Invalid password");
    }

    // Update last login
    await admin.update({ last_login: new Date() });

    return {
      id: admin.id,
      username: admin.username,
      mobile: admin.mobile, // Include mobile in the returned object
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      last_login: admin.last_login,
    };
  } catch (error) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
};

// ==================== ADMIN MANAGEMENT METHODS ====================

/**
 * Creates a new admin user.
 * Password will be hashed by the model's beforeCreate hook.
 * @param {object} data - Admin data.
 * @param {string} data.username - Unique username.
 * @param {string} data.password - Plain text password.
 * @param {string} [data.mobile] - Optional mobile number (must be unique if provided).
 * @param {string} [data.email] - Optional email address.
 * @param {string} [data.role='admin'] - Role of the admin.
 * @param {object} [data.permissions] - JSON object of permissions.
 * @param {string} [data.status='active'] - Status of the admin account.
 * @returns {Promise<Admin>} The created admin instance.
 * @throws {Error} If validation fails or username/mobile already exists.
 */
Admin.createAdmin = async function ({
  username,
  password,
  mobile,
  email,
  role = "admin",
  permissions,
  status = "active",
}) {
  // The beforeCreate hook handles password hashing.
  // Sequelize's built-in unique validation will throw an error if username or mobile already exist.
  // However, explicit checks can provide more specific error messages.

  // Check if admin with given username already exists
  const existingByUsername = await this.findOne({ where: { username } });
  if (existingByUsername) {
    throw new Error("Admin with this username already exists.");
  }

  // Check if admin with given mobile already exists (if mobile is provided)
  if (mobile) {
    const existingByMobile = await this.findOne({ where: { mobile } });
    if (existingByMobile) {
      throw new Error("Admin with this mobile number already exists.");
    }
  }

  const newAdmin = await this.create({
    username,
    password, // Password will be hashed by the beforeCreate hook
    mobile,
    email,
    role,
    permissions,
    status,
  });

  return newAdmin;
};

// You can add other admin management methods here, e.g., updateAdmin, deleteAdmin, etc.

// ==================== DASHBOARD OVERVIEW METHODS ====================

Admin.getDashboardOverview = async function (date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    // Lazily require models to avoid circular dependencies if they also require Admin
    const TransactionHistory = require("./TransactionHistory");
    const Sessions = require("./Sessions");
    const Customer = require("./Customer");
    const Employee = require("./Employee");
    const Games = require("./Games");

    const [
      dailyTransactions,
      activeSessions,
      customerOverview,
      employeeStats,
      gameStats,
      revenueBreakdown,
    ] = await Promise.all([
      // Pass `this` (Admin model) where needed for its methods
      this.getDailyTransactions(date),
      this.getActiveSessions(),
      this.getCustomerOverview(),
      this.getEmployeePerformance(date),
      this.getGamePopularity(date),
      this.getRevenueBreakdown(startOfDay, endOfDay),
    ]);

    return {
      date: date.toISOString().split("T")[0],
      transactions: dailyTransactions,
      sessions: activeSessions,
      customers: customerOverview,
      employees: employeeStats,
      games: gameStats,
      revenue: revenueBreakdown,
      summary: {
        total_revenue: revenueBreakdown.total_revenue || 0,
        total_transactions: dailyTransactions.summary.total_count || 0,
        active_sessions: activeSessions.total_active || 0,
        total_customers: customerOverview.total_customers || 0,
      },
    };
  } catch (error) {
    throw new Error(`Failed to get dashboard overview: ${error.message}`);
  }
};

// ==================== DAILY OPERATIONS METHODS ====================

Admin.getDailyTransactions = async function (date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    const TransactionHistory = require("./TransactionHistory");
    const Employee = require("./Employee"); // Ensure Employee is loaded for include

    const [summary, byType, byEmployee] = await Promise.all([
      // Overall summary
      TransactionHistory.findAll({
        where: {
          created_at: {
            [sequelize.Op.between]: [startOfDay, endOfDay],
          },
        },
        attributes: [
          [sequelize.fn("COUNT", sequelize.col("id")), "total_count"],
          [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
          [sequelize.fn("AVG", sequelize.col("amount")), "avg_amount"],
          [
            sequelize.fn("SUM", sequelize.col("discount_amount")),
            "total_discount",
          ],
        ],
        raw: true,
      }),

      // By transaction type
      TransactionHistory.findAll({
        where: {
          created_at: {
            [sequelize.Op.between]: [startOfDay, endOfDay],
          },
        },
        attributes: [
          "transaction_type",
          "type",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
          [
            sequelize.fn("SUM", sequelize.col("discount_amount")),
            "total_discount",
          ],
        ],
        group: ["transaction_type", "type"],
        raw: true,
      }),

      // By employee
      TransactionHistory.findAll({
        where: {
          created_at: {
            [sequelize.Op.between]: [startOfDay, endOfDay],
          },
        },
        include: [
          {
            model: Employee, // Use imported Employee model directly
            attributes: ["name", "userID"],
            as: "employee",
          },
        ],
        attributes: [
          "emp_id",
          [
            sequelize.fn("COUNT", sequelize.col("TransactionHistory.id")),
            "count",
          ],
          [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
        ],
        group: ["emp_id", "employee.id"],
        order: [[sequelize.fn("SUM", sequelize.col("amount")), "DESC"]],
      }),
    ]);

    return {
      summary: summary[0] || {},
      by_type: byType || [],
      by_employee: byEmployee || [],
    };
  } catch (error) {
    throw new Error(`Failed to get daily transactions: ${error.message}`);
  }
};

Admin.getActiveSessions = async function () {
  try {
    const Sessions = require("./Sessions");
    const Customer = require("./Customer"); // Ensure Customer is loaded for include
    const Games = require("./Games"); // Ensure Games is loaded for include
    const Employee = require("./Employee"); // Ensure Employee is loaded for include

    const [activeSessions, pausedSessions, sessionStats] = await Promise.all([
      Sessions.findAll({
        where: { status: "active" },
        include: [
          {
            model: Customer, // Use imported Customer model directly
            attributes: ["name", "card"],
          },
          {
            model: Games, // Use imported Games model directly
            attributes: ["game_name", "session_time"],
          },
          {
            model: Employee, // Use imported Employee model directly
            attributes: ["name", "userID"],
            as: "StartedBy",
          },
        ],
        order: [["start_time", "ASC"]],
      }),

      Sessions.findAll({
        where: { status: "paused" },
        include: [
          {
            model: Customer, // Use imported Customer model directly
            attributes: ["name", "card"],
          },
          {
            model: Games, // Use imported Games model directly
            attributes: ["game_name"],
          },
        ],
      }),

      Sessions.findAll({
        where: {
          status: ["active", "paused"],
          created_at: {
            [sequelize.Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000),
          },
        },
        attributes: [
          "status",
          [sequelize.fn("COUNT", sequelize.col("id")), "count"],
          [sequelize.fn("SUM", sequelize.col("final_charge")), "total_revenue"],
        ],
        group: ["status"],
        raw: true,
      }),
    ]);

    return {
      active: activeSessions,
      paused: pausedSessions,
      stats: sessionStats,
      total_active: activeSessions.length,
      total_paused: pausedSessions.length,
    };
  } catch (error) {
    throw new Error(`Failed to get active sessions: ${error.message}`);
  }
};

// ==================== CUSTOMER ANALYTICS METHODS ====================

Admin.getCustomerOverview = async function () {
  try {
    const Customer = require("./Customer");

    const [overview, topCustomers, balanceDistribution] = await Promise.all([
      Customer.findAll({
        attributes: [
          [sequelize.fn("COUNT", sequelize.col("id")), "total_customers"],
          [sequelize.fn("SUM", sequelize.col("balance")), "total_balance"],
          [sequelize.fn("AVG", sequelize.col("balance")), "avg_balance"],
          [sequelize.fn("MIN", sequelize.col("balance")), "min_balance"],
          [sequelize.fn("MAX", sequelize.col("balance")), "max_balance"],
        ],
        raw: true,
      }),

      Customer.findAll({
        order: [["balance", "DESC"]],
        limit: 10,
        attributes: ["id", "name", "card", "balance", "created_at"],
      }),

      Customer.findAll({
        attributes: [
          [
            sequelize.fn(
              "COUNT",
              sequelize.fn(
                "CASE",
                sequelize.where(sequelize.col("balance"), ">", 1000),
                1,
                null
              )
            ),
            "high_balance",
          ],
          [
            sequelize.fn(
              "COUNT",
              sequelize.fn(
                "CASE",
                sequelize.where(sequelize.col("balance"), "BETWEEN", 100, 1000),
                1,
                null
              )
            ),
            "medium_balance",
          ],
          [
            sequelize.fn(
              "COUNT",
              sequelize.fn(
                "CASE",
                sequelize.where(sequelize.col("balance"), "<", 100),
                1,
                null
              )
            ),
            "low_balance",
          ],
        ],
        raw: true,
      }),
    ]);

    return {
      overview: overview[0] || {},
      top_customers: topCustomers,
      balance_distribution: balanceDistribution[0] || {},
    };
  } catch (error) {
    throw new Error(`Failed to get customer overview: ${error.message}`);
  }
};

Admin.getCustomerActivity = async function (customerId, startDate, endDate) {
  try {
    const TransactionHistory = require("./TransactionHistory");
    const Sessions = require("./Sessions");

    const [transactions, sessions, stats] = await Promise.all([
      TransactionHistory.getByCustomerId(customerId, 100),
      Sessions.getSessionHistory(customerId, 50),
      TransactionHistory.getCustomerStats(customerId, startDate, endDate),
    ]);

    return {
      transactions,
      sessions,
      stats,
    };
  } catch (error) {
    throw new Error(`Failed to get customer activity: ${error.message}`);
  }
};

// ==================== EMPLOYEE PERFORMANCE METHODS ====================

Admin.getEmployeePerformance = async function (date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    const Employee = require("./Employee");
    const TransactionHistory = require("./TransactionHistory");
    const Sessions = require("./Sessions");

    const [employeeTransactions, employeeSessions, employeeList] =
      await Promise.all([
        TransactionHistory.findAll({
          where: {
            created_at: {
              [sequelize.Op.between]: [startOfDay, endOfDay],
            },
          },
          include: [
            {
              model: Employee,
              attributes: ["name", "userID"],
              as: "employee",
            },
          ],
          attributes: [
            "emp_id",
            "transaction_type",
            [
              sequelize.fn("COUNT", sequelize.col("TransactionHistory.id")),
              "count",
            ],
            [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
            [
              sequelize.fn("SUM", sequelize.col("discount_amount")),
              "total_discount",
            ],
          ],
          group: ["emp_id", "transaction_type", "employee.id"],
          order: [[sequelize.fn("SUM", sequelize.col("amount")), "DESC"]],
        }),

        Sessions.findAll({
          where: {
            created_at: {
              [sequelize.Op.between]: [startOfDay, endOfDay],
            },
          },
          include: [
            {
              model: Employee,
              attributes: ["name", "userID"],
              as: "StartedBy",
            },
          ],
          attributes: [
            "emp_id",
            [
              sequelize.fn("COUNT", sequelize.col("Sessions.id")),
              "session_count",
            ],
            [
              sequelize.fn("SUM", sequelize.col("final_charge")),
              "session_revenue",
            ],
            [
              sequelize.fn("AVG", sequelize.col("actual_duration")),
              "avg_session_duration",
            ],
          ],
          group: ["emp_id", "StartedBy.id"],
          order: [[sequelize.fn("SUM", sequelize.col("final_charge")), "DESC"]],
        }),

        Employee.findAll({
          where: { status: "active" },
          attributes: ["id", "name", "userID", "status"],
        }),
      ]);

    // Combine employee data
    const performanceData = employeeList.map((emp) => {
      const transactions = employeeTransactions.filter(
        (t) => t.emp_id === emp.id
      );
      const sessions = employeeSessions.find((s) => s.emp_id === emp.id);

      const totalTransactions = transactions.reduce(
        (sum, t) => sum + parseInt(t.dataValues.count || 0),
        0
      );
      const totalAmount = transactions.reduce(
        (sum, t) => sum + parseFloat(t.dataValues.total_amount || 0),
        0
      );
      const totalDiscount = transactions.reduce(
        (sum, t) => sum + parseFloat(t.dataValues.total_discount || 0),
        0
      );

      return {
        employee: emp,
        transactions: {
          total_count: totalTransactions,
          total_amount: totalAmount,
          total_discount: totalDiscount,
          by_type: transactions,
        },
        sessions: {
          count: sessions
            ? parseInt(sessions.dataValues.session_count || 0)
            : 0,
          revenue: sessions
            ? parseFloat(sessions.dataValues.session_revenue || 0)
            : 0,
          avg_duration: sessions
            ? parseFloat(sessions.dataValues.avg_session_duration || 0)
            : 0,
        },
      };
    });

    return performanceData.sort(
      (a, b) =>
        b.transactions.total_amount +
        b.sessions.revenue -
        (a.transactions.total_amount + a.sessions.revenue)
    );
  } catch (error) {
    throw new Error(`Failed to get employee performance: ${error.message}`);
  }
};

// ==================== GAME ANALYTICS METHODS ====================

Admin.getGamePopularity = async function (date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  try {
    const Sessions = require("./Sessions");
    const Games = require("./Games");

    const [gameStats, allGames] = await Promise.all([
      Sessions.findAll({
        where: {
          created_at: {
            [sequelize.Op.between]: [startOfDay, endOfDay],
          },
        },
        include: [
          {
            model: Games,
            attributes: ["game_name", "session_time", "charge"],
          },
        ],
        attributes: [
          "game_id",
          [
            sequelize.fn("COUNT", sequelize.col("Sessions.id")),
            "session_count",
          ],
          [sequelize.fn("SUM", sequelize.col("final_charge")), "total_revenue"],
          [
            sequelize.fn("AVG", sequelize.col("actual_duration")),
            "avg_duration",
          ],
          [
            sequelize.fn("SUM", sequelize.col("refund_amount")),
            "total_refunds",
          ],
        ],
        group: ["game_id", "Game.id"],
        order: [[sequelize.fn("COUNT", sequelize.col("Sessions.id")), "DESC"]],
      }),

      Games.findAll({
        where: { status: "active" },
        attributes: ["id", "game_name", "session_time", "charge", "discount"],
      }),
    ]);

    return {
      daily_stats: gameStats,
      all_games: allGames,
    };
  } catch (error) {
    throw new Error(`Failed to get game popularity: ${error.message}`);
  }
};

// ==================== REVENUE ANALYTICS METHODS ====================

Admin.getRevenueBreakdown = async function (startDate, endDate) {
  try {
    const TransactionHistory = require("./TransactionHistory");
    const Employee = require("./Employee"); // Ensure Employee is loaded for include

    const [revenueByType, revenueByGame, revenueByEmployee, totalRevenue] =
      await Promise.all([
        TransactionHistory.getRevenueSummary(startDate, endDate),
        TransactionHistory.getGameRevenue(startDate, endDate),
        TransactionHistory.findAll({
          where: {
            created_at: {
              [sequelize.Op.between]: [startDate, endDate],
            },
          },
          include: [
            {
              model: Employee,
              attributes: ["name", "userID"],
              as: "employee",
            },
          ],
          attributes: [
            "emp_id",
            [sequelize.fn("SUM", sequelize.col("amount")), "total_amount"],
            [
              sequelize.fn("COUNT", sequelize.col("TransactionHistory.id")),
              "transaction_count",
            ],
          ],
          group: ["emp_id", "employee.id"],
          order: [[sequelize.fn("SUM", sequelize.col("amount")), "DESC"]],
        }),

        TransactionHistory.findAll({
          where: {
            created_at: {
              [sequelize.Op.between]: [startDate, endDate],
            },
          },
          attributes: [
            [sequelize.fn("SUM", sequelize.col("amount")), "total_revenue"],
            [
              sequelize.fn("SUM", sequelize.col("discount_amount")),
              "total_discount",
            ],
            [sequelize.fn("COUNT", sequelize.col("id")), "total_transactions"],
          ],
          raw: true,
        }),
      ]);

    return {
      total_revenue: totalRevenue[0]?.total_revenue || 0,
      total_discount: totalRevenue[0]?.total_discount || 0,
      total_transactions: totalRevenue[0]?.total_transactions || 0,
      by_type: revenueByType,
      by_game: revenueByGame,
      by_employee: revenueByEmployee,
    };
  } catch (error) {
    throw new Error(`Failed to get revenue breakdown: ${error.message}`);
  }
};

// ==================== REPORTING METHODS ====================

Admin.generateDailyReport = async function (date = new Date()) {
  try {
    // Lazily require models to avoid circular dependencies if they also require Admin
    const TransactionHistory = require("./TransactionHistory");
    const Sessions = require("./Sessions");
    const Customer = require("./Customer");
    const Employee = require("./Employee");
    const Games = require("./Games");

    const [transactions, sessions, customers, employees, games, revenue] =
      await Promise.all([
        this.getDailyTransactions(date),
        this.getActiveSessions(),
        this.getCustomerOverview(),
        this.getEmployeePerformance(date),
        this.getGamePopularity(date),
        this.getRevenueBreakdown(
          new Date(date.getTime() - 24 * 60 * 60 * 1000),
          new Date(date.getTime() + 24 * 60 * 60 * 1000)
        ),
      ]);

    return {
      report_date: date.toISOString().split("T")[0],
      generated_at: new Date().toISOString(),
      summary: {
        total_revenue: revenue.total_revenue,
        total_transactions: transactions.summary.total_count,
        active_sessions: sessions.total_active,
        top_performing_employee: employees[0]?.employee?.name || "N/A",
        most_popular_game: games.daily_stats[0]?.Game?.game_name || "N/A",
      },
      details: {
        transactions,
        sessions,
        customers,
        employees,
        games,
        revenue,
      },
    };
  } catch (error) {
    throw new Error(`Failed to generate daily report: ${error.message}`);
  }
};

Admin.getCustomReport = async function (startDate, endDate, filters = {}) {
  try {
    const TransactionHistory = require("./TransactionHistory");
    const Sessions = require("./Sessions");
    const Customer = require("./Customer"); // Ensure Customer is loaded for include
    const Employee = require("./Employee"); // Ensure Employee is loaded for include
    const Games = require("./Games"); // Ensure Games is loaded for include

    const whereClause = {
      created_at: {
        [sequelize.Op.between]: [startDate, endDate],
      },
    };

    // Apply filters
    if (filters.employee_id) {
      whereClause.emp_id = filters.employee_id;
    }
    if (filters.transaction_type) {
      whereClause.transaction_type = filters.transaction_type;
    }
    if (filters.game_id) {
      whereClause.game_id = filters.game_id;
    }

    const [transactions, sessions, revenue] = await Promise.all([
      TransactionHistory.findAll({
        where: whereClause,
        include: [
          {
            model: Employee,
            attributes: ["name", "userID"],
            as: "employee",
          },
          {
            model: Customer,
            attributes: ["name", "card"],
            as: "customer",
          },
          {
            model: Games,
            attributes: ["game_name"],
            as: "game",
            required: false,
          },
        ],
        order: [["created_at", "DESC"]],
      }),

      Sessions.findAll({
        where: {
          created_at: {
            [sequelize.Op.between]: [startDate, endDate],
          },
          ...(filters.employee_id && { emp_id: filters.employee_id }),
          ...(filters.game_id && { game_id: filters.game_id }),
        },
        include: [
          {
            model: Customer,
            attributes: ["name", "card"],
          },
          {
            model: Games,
            attributes: ["game_name"],
          },
          {
            model: Employee,
            attributes: ["name", "userID"],
            as: "StartedBy",
          },
        ],
        order: [["created_at", "DESC"]],
      }),

      this.getRevenueBreakdown(startDate, endDate),
    ]);

    return {
      period: {
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
      },
      filters,
      transactions,
      sessions,
      revenue,
      summary: {
        total_transactions: transactions.length,
        total_sessions: sessions.length,
        total_revenue: revenue.total_revenue,
      },
    };
  } catch (error) {
    throw new Error(`Failed to generate custom report: ${error.message}`);
  }
};

// ==================== SYSTEM MANAGEMENT METHODS ====================

Admin.getSystemStats = async function () {
  try {
    // Lazily require models to avoid circular dependencies if they also require Admin
    const Customer = require("./Customer");
    const Employee = require("./Employee");
    const Games = require("./Games");
    const Sessions = require("./Sessions");
    const Transaction = require("./Transaction"); // Ensure Transaction is loaded

    const [
      customerCount,
      employeeCount,
      gameCount,
      sessionCount,
      transactionCount,
    ] = await Promise.all([
      Customer.count(),
      Employee.count({ where: { status: "active" } }),
      Games.count({ where: { status: "active" } }),
      Sessions.count(),
      Transaction.count(),
    ]);

    return {
      total_customers: customerCount,
      active_employees: employeeCount,
      active_games: gameCount,
      total_sessions: sessionCount,
      total_transactions: transactionCount,
      last_updated: new Date().toISOString(),
    };
  } catch (error) {
    throw new Error(`Failed to get system stats: ${error.message}`);
  }
};

Admin.cleanupOldRecords = async function (daysToKeep = 365) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

  try {
    const TransactionHistory = require("./TransactionHistory");

    const deletedCount = await TransactionHistory.destroy({
      where: {
        created_at: {
          [sequelize.Op.lt]: cutoffDate,
        },
      },
    });

    return {
      deleted_records: deletedCount,
      cutoff_date: cutoffDate.toISOString().split("T")[0],
    };
  } catch (error) {
    throw new Error(`Failed to cleanup old records: ${error.message}`);
  }
};

// ==================== AUTHENTICATION METHODS ====================

// Admin.authenticate = async function(mobile, password) {
//     try {
//         const admin = await this.findOne({
//             where: {
//                 mobile,
//                 status: 'active'
//             }
//         });

//         if (!admin) {
//             throw new Error('Invalid mobile number or admin account inactive');
//         }

//         // Compare provided password with hashed password
//         const isMatch = await bcrypt.compare(password, admin.password);
//         if (!isMatch) {
//             throw new Error('Invalid password');
//         }

//         // Update last login
//         await admin.update({ last_login: new Date() });

//         return {
//             id: admin.id,
//             username: admin.username,
//             mobile: admin.mobile, // Include mobile in the returned object
//             email: admin.email,
//             role: admin.role,
//             permissions: admin.permissions,
//             last_login: admin.last_login
//         };
//     } catch (error) {
//         throw new Error(`Authentication failed: ${error.message}`);
//     }
// };

module.exports = Admin;
