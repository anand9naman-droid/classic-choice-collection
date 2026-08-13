const express = require('express');
const archiver = require('archiver');
const { PassThrough } = require('stream');
const db = require('../db/store');
const config = require('../config/config');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { renderInvoice } = require('../utils/invoice');

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
  const { buyNowItem, address, paymentMethod } = req.body || {};
  const method = paymentMethod === 'COD' ? 'COD' : 'UPI';

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
    paymentMethod: method, // 'UPI' (manual) or 'COD'
    paymentNumber: method === 'UPI' ? config.PAYMENT_NUMBER : null,
    paymentStatus: 'pending', // UPI: pending until admin confirms; COD: pending until collected on delivery
    status: 'Pending',
    courierName: null,
    trackingNumber: null,
    estimatedDelivery: null
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
  const { status, paymentStatus, courierName, trackingNumber, estimatedDelivery } = req.body || {};
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
  if (courierName !== undefined) patch.courierName = courierName || null;
  if (trackingNumber !== undefined) patch.trackingNumber = trackingNumber || null;
  if (estimatedDelivery !== undefined) patch.estimatedDelivery = estimatedDelivery || null;
  const updated = db.update('orders', order.id, patch);
  res.json({ order: updated });
});

// ---- INVOICE: customer downloads their own order's invoice ----
router.get('/:id/invoice', requireAuth, (req, res) => {
  const order = db.getById('orders', req.params.id);
  if (!order || (order.userId !== req.user.id && req.user.role !== 'admin')) {
    return res.status(404).json({ error: 'Order not found.' });
  }
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderNumber}.pdf"`);
  const doc = renderInvoice(order, res);
  doc.end();
});

// ---- ADMIN: single invoice (same as above but explicit admin path) ----
router.get('/admin/:id/invoice', requireAdmin, (req, res) => {
  const order = db.getById('orders', req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found.' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="invoice-${order.orderNumber}.pdf"`);
  const doc = renderInvoice(order, res);
  doc.end();
});

// ---- ADMIN: bulk invoice/label generation - one zip with a PDF per order ----
// body: { orderIds: [...] }  (used for bulk order processing / shipping labels)
router.post('/admin/bulk-invoice', requireAdmin, (req, res) => {
  const { orderIds } = req.body || {};
  if (!Array.isArray(orderIds) || orderIds.length === 0) {
    return res.status(400).json({ error: 'orderIds array is required.' });
  }
  const orders = orderIds.map((id) => db.getById('orders', id)).filter(Boolean);
  if (orders.length === 0) return res.status(404).json({ error: 'No matching orders found.' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="invoices-bulk-${Date.now()}.zip"`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => { throw err; });
  archive.pipe(res);

  orders.forEach((order, idx) => {
    const pass = new PassThrough();
    const chunks = [];
    pass.on('data', (c) => chunks.push(c));
    pass.on('end', () => {
      archive.append(Buffer.concat(chunks), { name: `invoice-${order.orderNumber}.pdf` });
      if (idx === orders.length - 1) archive.finalize();
    });
    const doc = renderInvoice(order, pass);
    doc.end();
  });
});

module.exports = router;
