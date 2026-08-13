const express = require('express');
const db = require('../db/store');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  res.json({ addresses: db.filter('addresses', (a) => a.userId === req.user.id) });
});

router.post('/', (req, res) => {
  const { name, phone, addressLine, city, district, state, pincode } = req.body || {};
  if (!name || !phone || !addressLine || !city || !state || !pincode) {
    return res.status(400).json({ error: 'name, phone, addressLine, city, state and pincode are required.' });
  }
  const address = db.insert('addresses', {
    userId: req.user.id, name, phone, addressLine, city, district: district || '', state, pincode
  });
  res.status(201).json({ address });
});

router.delete('/:id', (req, res) => {
  const addr = db.getById('addresses', req.params.id);
  if (!addr || addr.userId !== req.user.id) return res.status(404).json({ error: 'Address not found.' });
  db.remove('addresses', addr.id);
  res.json({ ok: true });
});

module.exports = router;
