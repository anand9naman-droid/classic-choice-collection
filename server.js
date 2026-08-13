const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config/config');
const seed = require('./db/seed');
const { attachUser } = require('./middleware/auth');

seed(); // creates admin user + starter products only if they don't exist yet

const app = express();

app.use(express.json());
app.use(
  session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 } // 7 days
  })
);
app.use(attachUser);

// static frontend + uploaded product images
app.use(express.static(path.join(__dirname, 'public')));

// ---- API routes ----
app.use('/api/config', require('./routes/config'));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/cart', require('./routes/cart'));
app.use('/api/wishlist', require('./routes/wishlist'));
app.use('/api/addresses', require('./routes/addresses'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin', require('./routes/admin'));

// fallback to the SPA for any non-API route
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// central error handler (multer errors, unexpected exceptions, etc.)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong.' });
});

app.listen(config.PORT, () => {
  console.log(`\n  Classic Choice Collection running at http://localhost:${config.PORT}\n`);
});
