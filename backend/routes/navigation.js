const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');

const routesByRole = {
  Employee: [
    '/',
    '/scan',
    '/add',
    '/recharge'
  ],
  Admin: [
    '/admin',
    '/admin/reports',
    '/admin/emps',
    '/admin/updateEmp',
    '/admin/games',
    '/admin/addgames',
    '/admin/updategame',
    '/admin/history'
  ]
};

router.get('/routes', verifyToken, (req, res) => {
  const role = req.user && req.user.role;
  const routes = routesByRole[role] || [];
  res.json({ routes });
});

module.exports = router; 