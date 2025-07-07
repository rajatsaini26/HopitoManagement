// Debug version of createDefaultAdmin
const { Admin } = require('../models');
const bcrypt = require('bcrypt');

async function createDefaultAdmin() {
  const defaultMobile = '6350037900';
  const defaultPassword = '123123';
  const defaultUsername = 'Default Admin';
  const defaultEmail = 'admin@example.com';
  const defaultRole = 'admin';
  const defaultPermissions = {
    view_dashboard: true,
    manage_employees: true,
    manage_customers: true,
    manage_games: true,
    manage_sessions: true,
    view_reports: true,
    manage_transactions: true,
    system_settings: true
  };

  try {
    // Check if admin already exists by mobile number
    const existing = await Admin.findOne({ where: { mobile: defaultMobile } });
    if (existing) {
      console.log('✅ Default admin already exists.');
      console.log('🔍 Stored password hash:', existing.password);
      
      // Test password comparison
      const isMatch = await bcrypt.compare(defaultPassword, existing.password);
      console.log('🔍 Password comparison result:', isMatch);
      
      return;
    }

    console.log('🔍 Creating admin with password:', defaultPassword);

    const newAdmin = await Admin.createAdmin({
      username: defaultUsername,
      password: defaultPassword,
      mobile: defaultMobile,
      email: defaultEmail,
      role: defaultRole,
      permissions: defaultPermissions,
      status: 'active'
    });

    console.log('✅ Default admin created.');
    console.log('🔍 Created admin password hash:', newAdmin.password);
    
    // Test password comparison immediately after creation
    const isMatch = await bcrypt.compare(defaultPassword, newAdmin.password);
    console.log('🔍 Password comparison result after creation:', isMatch);
    
  } catch (error) {
    console.error('❌ Error creating default admin:', error.message);
    console.error('❌ Full error:', error);
  }
}

// Debug version of authenticate method


module.exports = createDefaultAdmin;