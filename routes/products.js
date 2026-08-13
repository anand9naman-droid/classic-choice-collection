const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db/store');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${db.uuid()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Only image files are allowed.'));
    cb(null, true);
  }
});

// ---- PUBLIC: list + detail ----
router.get('/', (req, res) => {
  const { category, q } = req.query;
  let products = db.all('products');
  if (category) products = products.filter((p) => p.category === category);
  if (q) {
    const needle = String(q).toLowerCase();
    products = products.filter(
      (p) => p.name.toLowerCase().includes(needle) || p.category.toLowerCase().includes(needle)
    );
  }
  res.json({ products });
});

router.get('/:id', (req, res) => {
  const product = db.getById('products', req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  res.json({ product });
});

// ---- ADMIN: create / update / delete / image upload ----
router.post('/', requireAdmin, (req, res) => {
  const { name, description, price, mrp, category, sizes, colors, stock, wholesalePrice, wholesaleMinOrder } = req.body || {};
  if (!name || price == null || mrp == null || !category) {
    return res.status(400).json({ error: 'name, price, mrp and category are required.' });
  }
  const discount = mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const product = db.insert('products', {
    name, description: description || '', images: [],
    price: Number(price), mrp: Number(mrp), discount,
    category, sizes: sizes || [], colors: colors || [],
    stock: Number(stock || 0),
    featured: false, newArrival: true, bestseller: false,
    wholesalePrice: wholesalePrice ? Number(wholesalePrice) : null,
    wholesaleMinOrder: wholesaleMinOrder ? Number(wholesaleMinOrder) : null
  });
  res.status(201).json({ product });
});

router.put('/:id', requireAdmin, (req, res) => {
  const existing = db.getById('products', req.params.id);
  if (!existing) return res.status(404).json({ error: 'Product not found.' });
  const patch = { ...req.body };
  if (patch.price != null && patch.mrp != null && patch.mrp > 0) {
    patch.discount = Math.round(((patch.mrp - patch.price) / patch.mrp) * 100);
  }
  const product = db.update('products', req.params.id, patch);
  res.json({ product });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const removed = db.remove('products', req.params.id);
  if (!removed) return res.status(404).json({ error: 'Product not found.' });
  // orders keep their historical product snapshot, so deleting the
  // catalog entry does not corrupt past order records.
  res.json({ ok: true });
});

router.post('/:id/image', requireAdmin, upload.single('image'), (req, res) => {
  const product = db.getById('products', req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found.' });
  if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
  const url = `/uploads/${req.file.filename}`;
  const images = [...(product.images || []), url];
  const updated = db.update('products', req.params.id, { images });
  res.json({ product: updated });
});

module.exports = router;
