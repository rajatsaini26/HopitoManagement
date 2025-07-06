const { Admin } = require('../models');
const bcrypt = require('bcrypt');

async function createDefaultAdmin() {
  const defaultMobile = '6350037900';
  const defaultPassword = 'nctladnun';
  const defaultUsername = 'admin';
  const defaultName = 'Super Admin';

  const existing = await Admin.findOne({ where: { mobile: defaultMobile } });
  if (existing) {
    console.log('✅ Default admin already exists.');
    return;
  }

  const hashedPassword = await bcrypt.hash(defaultPassword, 10);
  await Admin.create({
    username: defaultUsername,
    password: hashedPassword,
    mobile: defaultMobile,
    name: defaultName
  });

  console.log('✅ Default admin created.');
}

module.exports = createDefaultAdmin;
