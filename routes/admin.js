const express = require('express');
const db = require('../db/store');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAdmin);

router.get('/customers', (req, res) => {
  const customers = db.filter('users', (u) => u.role === 'customer')
    .map((u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt }));
  res.json({ customers });
});

router.get('/summary', (req, res) => {
  const orders = db.all('orders');
  res.json({
    totalProducts: db.all('products').length,
    totalCustomers: db.filter('users', (u) => u.role === 'customer').length,
    totalOrders: orders.length,
    pendingOrders: orders.filter((o) => o.status === 'Pending').length,
    revenue: orders.reduce((s, o) => s + (o.paymentStatus === 'paid' ? o.total : 0), 0)
  });
});

module.exports = router;
