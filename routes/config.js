const express = require('express');
const config = require('../config/config');

const router = express.Router();

// Only non-secret values are exposed here. Session secret, admin
// password, etc. never leave the server.
router.get('/', (req, res) => {
  res.json({
    paymentNumber: config.PAYMENT_NUMBER,
    whatsappNumber: config.WHATSAPP_NUMBER,
    deliveryCharge: config.DELIVERY_CHARGE,
    business: config.BUSINESS
  });
});

module.exports = router;
