const express = require('express');
const db = require('../db/store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const items = db.filter('wishlist_items', (w) => w.userId === req.user.id)
    .map((w) => ({ ...w, product: db.getById('products', w.productId) }));
  res.json({ items });
});

// toggle: adds if absent, removes if present - only ever touches MY wishlist
router.post('/:productId', (req, res) => {
  const { productId } = req.params;
  const product = db.getById('products', productId);
  if (!product) return res.status(404).json({ error: 'Product not found.' });

  const existing = db.find('wishlist_items', (w) => w.userId === req.user.id && w.productId === productId);
  if (existing) {
    db.remove('wishlist_items', existing.id);
    return res.json({ inWishlist: false });
  }
  db.insert('wishlist_items', { userId: req.user.id, productId });
  res.json({ inWishlist: true });
});

module.exports = router;
