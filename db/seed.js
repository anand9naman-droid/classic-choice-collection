const bcrypt = require('bcryptjs');
const db = require('./store');
const config = require('../config/config');

function seed() {
  // ---- seed admin user (only once) ----
  const existingAdmin = db.find('users', (u) => u.email === config.ADMIN_EMAIL);
  if (!existingAdmin) {
    const passwordHash = bcrypt.hashSync(config.ADMIN_PASSWORD, 10);
    db.insert('users', {
      name: 'Admin',
      email: config.ADMIN_EMAIL,
      passwordHash,
      role: 'admin'
    });
    console.log(`[seed] admin user created (${config.ADMIN_EMAIL})`);
  }

  // ---- seed starter products (only if catalog is empty) ----
  const existingProducts = db.all('products');
  if (existingProducts.length === 0) {
    const starter = [
      {
        name: 'Kurtis',
        description: 'Comfortable everyday kurti, soft breathable fabric.',
        images: [],
        price: 300, mrp: 600, discount: 50,
        category: 'Night Gowns', sizes: ['Free Size'], colors: ['Pink'],
        stock: 100, featured: true, newArrival: false, bestseller: true,
        wholesalePrice: 200, wholesaleMinOrder: 10
      },
      {
        name: "PRINCEFEBRICS Women Embroidered Cotton Blend Straight Kurta (Beige)",
        description: 'Embroidered cotton blend straight kurta.',
        images: [],
        price: 350, mrp: 500, discount: 30,
        category: 'Night Gowns', sizes: ['S', 'M', 'L', 'XL'], colors: ['Beige'],
        stock: 80, featured: false, newArrival: true, bestseller: false,
        wholesalePrice: 300, wholesaleMinOrder: 10
      },
      {
        name: "Jean's",
        description: 'Classic fit denim jeans.',
        images: [],
        price: 900, mrp: 1200, discount: 25,
        category: 'Jeans', sizes: ['28', '30', '32', '34'], colors: ['Light Blue'],
        stock: 60, featured: true, newArrival: false, bestseller: false,
        wholesalePrice: 700, wholesaleMinOrder: 10
      },
      {
        name: 'Lower',
        description: 'Everyday cotton lower / track pant.',
        images: [],
        price: 450, mrp: 550, discount: 18,
        category: 'Lowers', sizes: ['M', 'L', 'XL'], colors: ['Black'],
        stock: 120, featured: false, newArrival: false, bestseller: true,
        wholesalePrice: 300, wholesaleMinOrder: 20
      },
      {
        name: 'Trouser for Men',
        description: 'Relaxed fit trouser.',
        images: [],
        price: 350, mrp: 500, discount: 30,
        category: 'Lowers', sizes: ['M', 'L', 'XL'], colors: ['Grey'],
        stock: 90, featured: false, newArrival: false, bestseller: false,
        wholesalePrice: 300, wholesaleMinOrder: 10
      },
      {
        name: 'Denim Jeans',
        description: 'Wide leg denim jeans, premium wash.',
        images: [],
        price: 900, mrp: 1800, discount: 50,
        category: 'Jeans', sizes: ['28', '30', '32'], colors: ['Black'],
        stock: 45, featured: true, newArrival: false, bestseller: false,
        wholesalePrice: 810, wholesaleMinOrder: 15
      }
    ];
    starter.forEach((p) => db.insert('products', p));
    console.log(`[seed] ${starter.length} starter products created`);
  }
}

module.exports = seed;
