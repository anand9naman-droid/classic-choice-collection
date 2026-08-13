const express = require('express');
const db = require('../db/store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth); // every cart route requires a logged-in user

function enriched(item) {
  const product = db.getById('products', item.productId);
  return { ...item, product };
}

// GET my cart only (never any other user's)
router.get('/', (req, res) => {
  const items = db.filter('cart_items', (c) => c.userId === req.user.id).map(enriched);
  res.json({ items });
});

// Add to cart (or bump qty if same product+size+color already in MY cart)
router.post('/', (req, res) => {
  const { productId, size, color, qty } = req.body || {};
  const product = db.getById('products', productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const quantity = Math.max(1, Number(qty) || 1);
  if (product.stock != null && product.stock < quantity) {
    return res.status(400).json({ error: `Only ${product.stock} in stock.` });
  }

  const existing = db.find(
    'cart_items',
    (c) => c.userId === req.user.id && c.productId === productId && c.size === (size || null) && c.color === (color || null)
  );
  if (existing) {
    const updated = db.update('cart_items', existing.id, { qty: existing.qty + quantity });
    return res.json({ item: enriched(updated) });
  }
  const item = db.insert('cart_items', {
    userId: req.user.id, productId, size: size || null, color: color || null, qty: quantity
  });
  res.status(201).json({ item: enriched(item) });
});

// Update quantity - only if the item belongs to ME
router.put('/:itemId', (req, res) => {
  const item = db.getById('cart_items', req.params.itemId);
  if (!item || item.userId !== req.user.id) return res.status(404).json({ error: 'Cart item not found.' });
  const qty = Math.max(1, Number(req.body.qty) || 1);
  const product = db.getById('products', item.productId);
  if (product && product.stock != null && product.stock < qty) {
    return res.status(400).json({ error: `Only ${product.stock} in stock.` });
  }
  const updated = db.update('cart_items', item.id, { qty });
  res.json({ item: enriched(updated) });
});

// Remove - only if it belongs to ME
router.delete('/:itemId', (req, res) => {
  const item = db.getById('cart_items', req.params.itemId);
  if (!item || item.userId !== req.user.id) return res.status(404).json({ error: 'Cart item not found.' });
  db.remove('cart_items', item.id);
  res.json({ ok: true });
});

// Clear MY cart only
router.delete('/', (req, res) => {
  db.removeWhere('cart_items', (c) => c.userId === req.user.id);
  res.json({ ok: true });
});

module.exports = router;
