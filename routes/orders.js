const express = require('express');
const db = require('../db/store');
const config = require('../config/config');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const VALID_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];

function nextOrderNumber() {
  const count = db.all('orders').length + 1;
  const stamp = Date.now().toString().slice(-6);
  return `CCC${stamp}${String(count).padStart(3, '0')}`;
}

// ---- CHECKOUT (creates order for the LOGGED-IN user only) ----
// body: { buyNowItem?: {productId,size,color,qty}, address: {...} }
// If buyNowItem is provided -> only that single item is ordered.
// Otherwise -> the caller's own cart is used and then cleared.
router.post('/', requireAuth, (req, res) => {
  const { buyNowItem, address } = req.body || {};

  if (!address || !address.name || !address.phone || !address.addressLine || !address.city || !address.state || !address.pincode) {
    return res.status(400).json({ error: 'Complete delivery address (name, phone, addressLine, city, state, pincode) is required.' });
  }

  let sourceItems = [];
  if (buyNowItem && buyNowItem.productId) {
    const product = db.getById('products', buyNowItem.productId);
    if (!product) return res.status(404).json({ error: 'Product not found.' });
    const qty = Math.max(1, Number(buyNowItem.qty) || 1);
    if (product.stock != null && product.stock < qty) {
      return res.status(400).json({ error: `${product.name}: only ${product.stock} in stock.` });
    }
    sourceItems = [{ product, qty, size: buyNowItem.size || null, color: buyNowItem.color || null, cartItemId: null }];
  } else {
    const cartItems = db.filter('cart_items', (c) => c.userId === req.user.id);
    if (cartItems.length === 0) {
      return res.status(400).json({ error: 'Your cart is empty.' });
    }
    for (const c of cartItems) {
      const product = db.getById('products', c.productId);
      if (!product) continue;
      if (product.stock != null && product.stock < c.qty) {
        return res.status(400).json({ error: `${product.name}: only ${product.stock} in stock.` });
      }
      sourceItems.push({ product, qty: c.qty, size: c.size, color: c.color, cartItemId: c.id });
    }
  }

  if (sourceItems.length === 0) {
    return res.status(400).json({ error: 'No valid items to order.' });
  }

  const items = sourceItems.map((si) => ({
    productId: si.product.id,
    name: si.product.name,
    price: si.product.price,
    qty: si.qty,
    size: si.size,
    color: si.color
  }));
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const delivery = config.DELIVERY_CHARGE;
  const total = subtotal + delivery;

  const order = db.insert('orders', {
    orderNumber: nextOrderNumber(),
    userId: req.user.id,
    buyerName: req.user.name,
    buyerEmail: req.user.email,
    items,
    subtotal,
    delivery,
    total,
    address,
    paymentNumber: config.PAYMENT_NUMBER,
    paymentStatus: 'pending', // manual UPI flow - never auto-marked as paid
    status: 'Pending'
  });

  // decrement stock
  sourceItems.forEach((si) => {
    if (si.product.stock != null) {
      db.update('products', si.product.id, { stock: Math.max(0, si.product.stock - si.qty) });
    }
  });

  // clear only the cart items that were actually ordered (cart checkout path)
  sourceItems.forEach((si) => {
    if (si.cartItemId) db.remove('cart_items', si.cartItemId);
  });

  res.status(201).json({ order });
});

// ---- MY ORDERS ONLY ----
router.get('/', requireAuth, (req, res) => {
  const mine = db.filter('orders', (o) => o.userId === req.user.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ orders: mine });
});

router.get('/:id', requireAuth, (req, res) => {
  const order = db.getById('orders', req.params.id);
  if (!order || (order.userId !== req.user.id && req.user.role !== 'admin')) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  res.json({ order });
});

// ---- ADMIN: view all orders / update status & payment status ----
router.get('/admin/all', requireAdmin, (req, res) => {
  const all = db.all('orders').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  res.json({ orders: all });
});

router.put('/admin/:id/status', requireAdmin, (req, res) => {
  const { status, paymentStatus } = req.body || {};
  const order = db.getById('orders', req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  const patch = {};
  if (status) {
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    patch.status = status;
  }
  if (paymentStatus) {
    if (!['pending', 'paid', 'failed'].includes(paymentStatus)) return res.status(400).json({ error: 'Invalid payment status.' });
    patch.paymentStatus = paymentStatus;
  }
  const updated = db.update('orders', order.id, patch);
  res.json({ order: updated });
});

module.exports = router;
