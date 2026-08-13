/* ================= STATE ================= */
let currentUser = null;
let products = [];
let cart = [];
let wishlist = [];
let publicConfig = {};
let selectedProduct = null;
let pdSelectedSize = null;
let pdSelectedColor = null;
let pdQty = 1;
let activeCategoryFilter = null;
let checkoutBuyNowItem = null; // when set, checkout orders ONLY this item, not the cart
let authMode = 'login';

const colorMap = {
  "Jeans":"#3b82f6","Pants":"#0ea5e9","Shirts":"#38bdf8","T-Shirts":"#22d3ee",
  "Lowers":"#6366f1","Maxi":"#ec4899","Daily Wear":"#f472b6",
  "Night Gowns":"#f59e0b","Nighties":"#fbbf24","Night Suits":"#f97316",
  "Other Ladies Night Wear":"#fb7185"
};
const iconMap = {
  "Jeans":"👖","Pants":"👖","Shirts":"👔","T-Shirts":"👕","Lowers":"🩳",
  "Maxi":"👗","Daily Wear":"👚","Night Gowns":"🌙","Nighties":"✨",
  "Night Suits":"🌛","Other Ladies Night Wear":"🎀"
};
const CATEGORY_GROUPS = {
  "Night Wear": ["Maxi","Night Gowns","Nighties","Night Suits","Other Ladies Night Wear"],
  "Men's Wear": ["Jeans","Pants","Shirts","T-Shirts","Lowers"],
  "Ladies Wear": ["Daily Wear"]
};
const ORDER_STATUSES = ['Pending','Confirmed','Processing','Shipped','Out for Delivery','Delivered','Cancelled'];

/* ================= API HELPER ================= */
async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  let data = {};
  try { data = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}
async function apiUpload(path, formData) {
  const res = await fetch('/api' + path, { method: 'POST', credentials: 'same-origin', body: formData });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data.error || 'Upload failed.');
  return data;
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}
function money(n){ return '₹' + Number(n||0).toLocaleString('en-IN'); }

/* ================= NAVIGATION ================= */
function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  const nb = document.querySelector('.nav-btn[data-nav="' + name + '"]');
  if (nb) nb.classList.add('active');
  window.scrollTo(0, 0);
  if (name === 'cart') renderCartView();
  if (name === 'wishlist') renderWishlistView();
  if (name === 'profile') renderProfileView();
  if (name === 'categories') renderCategoriesView();
  if (name === 'orders') renderOrdersView();
}

/* ================= BOOT ================= */
async function boot() {
  try {
    const cfg = await api('/config');
    publicConfig = cfg;
    document.getElementById('bizTagline').textContent = cfg.business.name;
    document.getElementById('bizSubline').textContent = `${cfg.business.tagline} — ${cfg.business.positioning}`;
    document.getElementById('whatsappFab').href = `https://wa.me/${cfg.whatsappNumber}`;
  } catch (e) { console.error(e); }

  try {
    const me = await api('/auth/me');
    currentUser = me.user;
  } catch (e) { currentUser = null; }

  await loadProducts();
  renderHomeCats();

  if (currentUser) {
    await Promise.all([loadCart(), loadWishlist()]);
  }
  updateCartBadge();
}

/* ================= PRODUCTS ================= */
async function loadProducts() {
  const q = document.getElementById('searchInput').value;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (activeCategoryFilter) params.set('category', activeCategoryFilter);
  const data = await api('/products?' + params.toString());
  products = data.products;
  paintProductGrid();
}
function renderProducts() {
  clearTimeout(window._searchDebounce);
  window._searchDebounce = setTimeout(loadProducts, 250);
}
function paintProductGrid() {
  const grid = document.getElementById('productGrid');
  if (products.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/3; text-align:center; color:#999; padding:30px 0;">No products found</div>`;
    return;
  }
  grid.innerHTML = products.map((p) => productCardHTML(p)).join('');
}
function productCardHTML(p) {
  const img = p.images && p.images[0];
  const inWishlist = wishlist.some((w) => w.productId === p.id);
  return `
    <div class="product-card">
      <div class="product-img" style="background:${img ? `url(${img})` : (colorMap[p.category] || '#999')}" onclick="openProduct('${p.id}')">
        ${img ? '' : (iconMap[p.category] || '🛍️')}
        <div class="discount-tag">${p.discount}% OFF</div>
        <div class="fav-btn ${inWishlist ? 'active' : ''}" onclick="event.stopPropagation();toggleWishlist('${p.id}')">❤️</div>
        <div class="cart-quick" onclick="event.stopPropagation();quickAddToCart('${p.id}')">🛒</div>
      </div>
      <div class="product-info" onclick="openProduct('${p.id}')">
        <div class="cat-label">${p.category}</div>
        <div class="pname">${p.name}</div>
        <div class="price-row"><span class="now">${money(p.price)}</span><span class="mrp">${money(p.mrp)}</span></div>
        ${p.wholesalePrice ? `<div class="wholesale-line">Wholesale: ${money(p.wholesalePrice)} (Min ${p.wholesaleMinOrder})</div>` : ''}
        ${p.stock === 0 ? `<div class="stock-warn">Out of stock</div>` : (p.stock <= 5 ? `<div class="stock-warn">Only ${p.stock} left</div>` : '')}
      </div>
    </div>`;
}
function renderHomeCats() {
  const wrap = document.getElementById('homeCatScroll');
  const all = Object.values(CATEGORY_GROUPS).flat();
  wrap.innerHTML = all.map((c) => `
    <div class="cat-item" onclick="filterCategory('${c}')">
      <div class="cat-circle">${iconMap[c] || '🛍️'}</div>
      <span>${c}</span>
    </div>`).join('');
}
function filterCategory(c) {
  activeCategoryFilter = c;
  showView('home');
  loadProducts();
}
function renderCategoriesView() {
  const wrap = document.getElementById('categoriesPage');
  let html = '';
  for (const group in CATEGORY_GROUPS) {
    html += `<h4>👉 ${group}</h4><div class="cat-grid">`;
    CATEGORY_GROUPS[group].forEach((c) => {
      html += `<div class="cat-tile" onclick="filterCategory('${c}')"><span class="ic">${iconMap[c]}</span>${c}</div>`;
    });
    html += `</div>`;
  }
  html += `<div class="wholesale-banner" onclick="showWholesaleInfo()">
    <span class="ic">📦</span>
    <div><b>Wholesale Deals</b><span>Best prices for bulk orders</span></div>
  </div>`;
  wrap.innerHTML = html;
}
function showWholesaleInfo() {
  const biz = publicConfig.business || {};
  alert(`Wholesale enquiries:\nWhatsApp: +${publicConfig.whatsappNumber}\nEmail: ${biz.email}\nPhone: ${biz.phones ? biz.phones.join(', ') : ''}`);
}

/* ================= PRODUCT DETAIL ================= */
async function openProduct(id) {
  try {
    const data = await api('/products/' + id);
    selectedProduct = data.product;
  } catch (e) { toast(e.message); return; }
  pdSelectedSize = selectedProduct.sizes && selectedProduct.sizes.length ? selectedProduct.sizes[0] : null;
  pdSelectedColor = selectedProduct.colors && selectedProduct.colors.length ? selectedProduct.colors[0] : null;
  pdQty = 1;
  renderDetail();
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-detail').classList.add('active');
  window.scrollTo(0, 0);
}
function renderDetail() {
  const p = selectedProduct;
  pdCurrentImageIndex = 0;
  const images = (p.images && p.images.length) ? p.images : null;
  const wrap = document.getElementById('view-detail');
  wrap.innerHTML = `
    <div class="pd-img-wrap">
      <div class="pd-img" id="pdImgMain"
        style="background:${images ? `url(${images[0]})` : (colorMap[p.category] || '#999')}"
        onclick="openLightbox()"
        onmousedown="pdDragStart(event)" onmousemove="pdDragMove(event)" onmouseup="pdDragEnd(event)" onmouseleave="pdDragEnd(event)"
        ontouchstart="pdDragStart(event)" ontouchmove="pdDragMove(event)" ontouchend="pdDragEnd(event)">
        ${images ? '' : (iconMap[p.category] || '🛍️')}
        ${images && images.length > 1 ? `<div class="img-badge">↔ Drag to rotate 360° · Tap to zoom</div>` : (images ? `<div class="img-badge">🔍 Tap to view full image</div>` : '')}
      </div>
      ${images && images.length > 1 ? `<div class="pd-thumbs" id="pdThumbs">
        ${images.map((im, i) => `<img src="${im}" class="pd-thumb ${i === 0 ? 'active' : ''}" onclick="setMainImage(${i})">`).join('')}
      </div>` : ''}
    </div>
    <div class="pd-body">
      <div class="pd-cat">${p.category}</div>
      <div class="pd-title">${p.name}</div>
      <div class="pd-price-row">
        <span class="now">${money(p.price)}</span>
        <span class="mrp">${money(p.mrp)}</span>
        <span class="off">${p.discount}% off</span>
      </div>
      ${p.wholesalePrice ? `<div class="pd-wholesale">Wholesale Price: ${money(p.wholesalePrice)} (Min Order ${p.wholesaleMinOrder} pcs)</div>` : ''}

      ${p.sizes && p.sizes.length ? `<div class="pd-label">Size</div><div class="pd-options">
        ${p.sizes.map((s) => `<div class="opt-btn ${s === pdSelectedSize ? 'selected' : ''}" onclick="selectSize('${s}')">${s}</div>`).join('')}
      </div>` : ''}

      ${p.colors && p.colors.length ? `<div class="pd-label">Color</div><div class="pd-options">
        ${p.colors.map((c) => `<div class="opt-btn ${c === pdSelectedColor ? 'selected' : ''}" onclick="selectColor('${c}')">${c}</div>`).join('')}
      </div>` : ''}

      <div class="pd-label">Qty</div>
      <div class="qty-row">
        <div class="qty-btn" onclick="changeQty(-1)">−</div>
        <div class="qty-val" id="qtyVal">${pdQty}</div>
        <div class="qty-btn" onclick="changeQty(1)">+</div>
      </div>
      <div style="font-size:12px; color:${p.stock === 0 ? '#e11d48' : '#8a8a8a'}; margin-top:6px;">
        ${p.stock === 0 ? 'Out of stock' : p.stock + ' pcs available'}
      </div>

      <div class="pd-perks">
        <div><span class="ic">🚚</span>Free Delivery</div>
        <div><span class="ic">🛡️</span>Quality Assured</div>
        <div><span class="ic">↩️</span>Easy Returns</div>
      </div>
      ${p.description ? `<div style="margin-top:14px; font-size:13px; color:#555;">${p.description}</div>` : ''}
    </div>
    <div class="pd-actions">
      <a class="btn-wa" href="https://wa.me/${publicConfig.whatsappNumber}?text=${encodeURIComponent('Interested in ' + p.name)}" target="_blank">WhatsApp</a>
      <button class="btn-cart" ${p.stock === 0 ? 'disabled style="opacity:.5"' : ''} onclick="addSelectedToCart()">Add to Cart</button>
      <button class="btn-buy" ${p.stock === 0 ? 'disabled style="opacity:.5"' : ''} onclick="buyNow()">Buy Now</button>
    </div>
  `;
}
function selectSize(s) { pdSelectedSize = s; renderDetail(); }
function selectColor(c) { pdSelectedColor = c; renderDetail(); }
function changeQty(d) { pdQty = Math.max(1, pdQty + d); document.getElementById('qtyVal').textContent = pdQty; }

/* ---- 360° drag viewer (cycles through admin-uploaded angle photos) ---- */
let pdCurrentImageIndex = 0;
let _pdDrag = { active: false, startX: 0, moved: false };
function pdDragStart(e) {
  const images = selectedProduct.images;
  if (!images || images.length < 2) return;
  _pdDrag.active = true;
  _pdDrag.moved = false;
  _pdDrag.startX = e.touches ? e.touches[0].clientX : e.clientX;
}
function pdDragMove(e) {
  if (!_pdDrag.active) return;
  const images = selectedProduct.images;
  const x = e.touches ? e.touches[0].clientX : e.clientX;
  const dx = x - _pdDrag.startX;
  if (Math.abs(dx) > 35) {
    _pdDrag.moved = true;
    const dir = dx > 0 ? -1 : 1;
    pdCurrentImageIndex = (pdCurrentImageIndex + dir + images.length) % images.length;
    _pdDrag.startX = x;
    updateMainImage();
  }
}
function pdDragEnd() { _pdDrag.active = false; }
function setMainImage(i) { pdCurrentImageIndex = i; updateMainImage(); }
function updateMainImage() {
  const images = selectedProduct.images;
  const main = document.getElementById('pdImgMain');
  if (main) main.style.background = `url(${images[pdCurrentImageIndex]})`;
  document.querySelectorAll('#pdThumbs .pd-thumb').forEach((t, i) => t.classList.toggle('active', i === pdCurrentImageIndex));
}

/* ---- Full-screen image lightbox ---- */
function openLightbox() {
  if (_pdDrag.moved) { _pdDrag.moved = false; return; } // don't open if user was dragging to rotate
  const images = selectedProduct.images;
  if (!images || images.length === 0) return;
  document.getElementById('lightboxImg').src = images[pdCurrentImageIndex];
  document.getElementById('lightboxImg').classList.remove('zoomed');
  document.getElementById('lightboxCounter').textContent = images.length > 1 ? `${pdCurrentImageIndex + 1} / ${images.length}` : '';
  document.getElementById('lightbox').classList.add('show');
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('show'); }
function lightboxNav(dir) {
  const images = selectedProduct.images;
  pdCurrentImageIndex = (pdCurrentImageIndex + dir + images.length) % images.length;
  document.getElementById('lightboxImg').src = images[pdCurrentImageIndex];
  document.getElementById('lightboxImg').classList.remove('zoomed');
  document.getElementById('lightboxCounter').textContent = `${pdCurrentImageIndex + 1} / ${images.length}`;
  updateMainImage();
}
function lightboxToggleZoom() { document.getElementById('lightboxImg').classList.toggle('zoomed'); }

/* ================= CART ================= */
function requireLoginOrRedirect() {
  if (!currentUser) {
    toast('Please login to continue');
    showView('profile');
    return false;
  }
  return true;
}
async function loadCart() {
  const data = await api('/cart');
  cart = data.items;
  updateCartBadge();
}
function updateCartBadge() {
  document.getElementById('cartBadge').textContent = cart.reduce((s, c) => s + c.qty, 0);
}
async function addSelectedToCart() {
  if (!requireLoginOrRedirect()) return;
  try {
    await api('/cart', { method: 'POST', body: { productId: selectedProduct.id, size: pdSelectedSize, color: pdSelectedColor, qty: pdQty } });
    await loadCart();
    toast(selectedProduct.name + ' added to cart');
  } catch (e) { toast(e.message); }
}
async function quickAddToCart(id) {
  if (!requireLoginOrRedirect()) return;
  const p = products.find((x) => x.id === id);
  try {
    await api('/cart', { method: 'POST', body: { productId: id, size: null, color: null, qty: 1 } });
    await loadCart();
    toast((p ? p.name : 'Item') + ' added to cart');
  } catch (e) { toast(e.message); }
}
function buyNow() {
  if (!requireLoginOrRedirect()) return;
  if (selectedProduct.stock === 0) { toast('Out of stock'); return; }
  checkoutBuyNowItem = { productId: selectedProduct.id, size: pdSelectedSize, color: pdSelectedColor, qty: pdQty, snapshot: selectedProduct };
  renderCheckoutView();
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-checkout').classList.add('active');
}
function renderCartView() {
  const wrap = document.getElementById('view-cart');
  if (!currentUser) {
    wrap.innerHTML = `<div class="empty-state"><div class="ic">🔒</div><b>Login to view your cart</b>
      <button onclick="showView('profile')">Login</button></div>`;
    return;
  }
  if (cart.length === 0) {
    wrap.innerHTML = `<div class="empty-state">
      <div class="ic">🛍️</div><b>Your cart is empty</b>
      <p style="font-size:12px; margin-top:4px;">Add items to start shopping</p>
      <button onclick="showView('home')">Continue Shopping</button>
    </div>`;
    return;
  }
  const subtotal = cart.reduce((s, c) => s + (c.product ? c.product.price : 0) * c.qty, 0);
  const delivery = publicConfig.deliveryCharge || 0;
  wrap.innerHTML = cart.map((c) => {
    const p = c.product || {};
    const img = p.images && p.images[0];
    return `
    <div class="cart-item">
      <div class="thumb" style="background:${img ? `url(${img})` : (colorMap[p.category] || '#999')}">${img ? '' : (iconMap[p.category] || '🛍️')}</div>
      <div class="info">
        <b>${p.name || 'Product removed'}</b>
        <div class="meta">${c.size ? ('Size: ' + c.size + ' ') : ''}${c.color ? ('• Color: ' + c.color) : ''}</div>
        <div class="qty-mini">
          <button onclick="updateCartQty('${c.id}', ${c.qty - 1})">−</button>
          <span>${c.qty}</span>
          <button onclick="updateCartQty('${c.id}', ${c.qty + 1})">+</button>
        </div>
        <div class="price">${money(p.price * c.qty)}</div>
      </div>
      <div class="remove" onclick="removeFromCart('${c.id}')">Remove</div>
    </div>`;
  }).join('') + `
    <div class="cart-summary">
      <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
      <div class="row"><span>Delivery</span><span>${delivery ? money(delivery) : 'Free'}</span></div>
      <div class="row total"><span>Total</span><span>${money(subtotal + delivery)}</span></div>
    </div>
    <div class="checkout-btn" onclick="goToCheckoutFromCart()">Proceed to Checkout</div>
  `;
}
async function updateCartQty(itemId, qty) {
  if (qty < 1) return removeFromCart(itemId);
  try {
    await api('/cart/' + itemId, { method: 'PUT', body: { qty } });
    await loadCart();
    renderCartView();
  } catch (e) { toast(e.message); }
}
async function removeFromCart(itemId) {
  try {
    await api('/cart/' + itemId, { method: 'DELETE' });
    await loadCart();
    renderCartView();
  } catch (e) { toast(e.message); }
}
function goToCheckoutFromCart() {
  if (cart.length === 0) return;
  checkoutBuyNowItem = null;
  showCheckout();
}
function showCheckout() {
  renderCheckoutView();
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.getElementById('view-checkout').classList.add('active');
}

/* ================= CHECKOUT ================= */
function renderCheckoutView() {
  const wrap = document.getElementById('view-checkout');
  let items, subtotal;
  if (checkoutBuyNowItem) {
    const p = checkoutBuyNowItem.snapshot;
    items = [{ name: p.name, price: p.price, qty: checkoutBuyNowItem.qty, size: checkoutBuyNowItem.size, color: checkoutBuyNowItem.color }];
    subtotal = p.price * checkoutBuyNowItem.qty;
  } else {
    items = cart.map((c) => ({ name: c.product?.name, price: c.product?.price, qty: c.qty, size: c.size, color: c.color }));
    subtotal = cart.reduce((s, c) => s + (c.product ? c.product.price : 0) * c.qty, 0);
  }
  const delivery = publicConfig.deliveryCharge || 0;
  const total = subtotal + delivery;

  wrap.innerHTML = `
    <div class="checkout-form">
      <h3 style="margin-bottom:10px;">Order Summary</h3>
      ${items.map((i) => `<div class="cart-summary" style="margin:0 0 8px;"><div class="row"><span>${i.name} ${i.size ? '(' + i.size + ')' : ''} x${i.qty}</span><span>${money(i.price * i.qty)}</span></div></div>`).join('')}
      <div class="cart-summary">
        <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
        <div class="row"><span>Delivery</span><span>${delivery ? money(delivery) : 'Free'}</span></div>
        <div class="row total"><span>Total</span><span>${money(total)}</span></div>
      </div>

      <h3 style="margin:16px 0 10px;">Delivery Address</h3>
      <div class="form-error" id="checkoutError"></div>
      <label>Full Name</label><input type="text" id="coName" value="${currentUser ? currentUser.name : ''}">
      <label>Phone</label><input type="tel" id="coPhone" placeholder="10-digit mobile number">
      <label>Full Address</label><input type="text" id="coAddress" placeholder="House no, street, area">
      <label>City</label><input type="text" id="coCity">
      <label>District</label><input type="text" id="coDistrict">
      <label>State</label><input type="text" id="coState">
      <label>PIN Code</label><input type="text" id="coPincode">

      <h3 style="margin:16px 0 10px;">Payment Method</h3>
      <div class="pay-method-row">
        <div class="pay-method-opt selected" id="payOptUPI" onclick="selectPaymentMethod('UPI')">
          <span class="ic">📲</span>UPI (Pay Now)
        </div>
        <div class="pay-method-opt" id="payOptCOD" onclick="selectPaymentMethod('COD')">
          <span class="ic">💵</span>Cash on Delivery
        </div>
      </div>
      <div id="payDetailsBox">
        <div class="pay-box">
          <span>Pay via UPI to complete your order</span>
          <b>${publicConfig.paymentNumber || ''}</b>
          <span>Pay ${money(total)} then tap "Place Order". Our team will confirm payment and process your order.</span>
        </div>
      </div>

      <div class="checkout-btn" onclick="placeOrder()">Place Order</div>
    </div>
  `;
  window._checkoutTotal = total;
  window._checkoutPaymentMethod = 'UPI';
}
function selectPaymentMethod(method) {
  window._checkoutPaymentMethod = method;
  document.getElementById('payOptUPI').classList.toggle('selected', method === 'UPI');
  document.getElementById('payOptCOD').classList.toggle('selected', method === 'COD');
  const box = document.getElementById('payDetailsBox');
  if (method === 'UPI') {
    box.innerHTML = `<div class="pay-box">
      <span>Pay via UPI to complete your order</span>
      <b>${publicConfig.paymentNumber || ''}</b>
      <span>Pay ${money(window._checkoutTotal)} then tap "Place Order". Our team will confirm payment and process your order.</span>
    </div>`;
  } else {
    box.innerHTML = `<div class="pay-box">
      <span>💵 Cash on Delivery selected</span>
      <b>${money(window._checkoutTotal)} due at delivery</b>
      <span>Pay in cash to the delivery person when your order arrives.</span>
    </div>`;
  }
}
async function placeOrder() {
  const errBox = document.getElementById('checkoutError');
  errBox.style.display = 'none';
  const address = {
    name: document.getElementById('coName').value.trim(),
    phone: document.getElementById('coPhone').value.trim(),
    addressLine: document.getElementById('coAddress').value.trim(),
    city: document.getElementById('coCity').value.trim(),
    district: document.getElementById('coDistrict').value.trim(),
    state: document.getElementById('coState').value.trim(),
    pincode: document.getElementById('coPincode').value.trim()
  };
  const body = { address, paymentMethod: window._checkoutPaymentMethod || 'UPI' };
  if (checkoutBuyNowItem) {
    body.buyNowItem = { productId: checkoutBuyNowItem.productId, size: checkoutBuyNowItem.size, color: checkoutBuyNowItem.color, qty: checkoutBuyNowItem.qty };
  }
  try {
    const data = await api('/orders', { method: 'POST', body });
    checkoutBuyNowItem = null;
    await loadCart();
    toast('Order placed! #' + data.order.orderNumber);
    showView('orders');
  } catch (e) {
    errBox.textContent = e.message;
    errBox.style.display = 'block';
  }
}

/* ================= WISHLIST ================= */
async function loadWishlist() {
  const data = await api('/wishlist');
  wishlist = data.items;
}
async function toggleWishlist(id) {
  if (!requireLoginOrRedirect()) return;
  try {
    await api('/wishlist/' + id, { method: 'POST' });
    await loadWishlist();
    paintProductGrid();
    if (document.getElementById('view-wishlist').classList.contains('active')) renderWishlistView();
  } catch (e) { toast(e.message); }
}
function renderWishlistView() {
  const wrap = document.getElementById('view-wishlist');
  if (!currentUser) {
    wrap.innerHTML = `<div class="empty-state"><div class="ic">🔒</div><b>Login to view your wishlist</b>
      <button onclick="showView('profile')">Login</button></div>`;
    return;
  }
  if (wishlist.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><div class="ic">❤️</div><b>Your wishlist is empty</b>
      <button onclick="showView('home')">Explore Products</button></div>`;
    return;
  }
  wrap.innerHTML = `<div class="grid-2" style="padding-top:14px;">` + wishlist.map((w) => {
    const p = w.product;
    if (!p) return '';
    const img = p.images && p.images[0];
    return `
    <div class="product-card">
      <div class="product-img" style="background:${img ? `url(${img})` : (colorMap[p.category] || '#999')}" onclick="openProduct('${p.id}')">
        ${img ? '' : (iconMap[p.category] || '🛍️')}
        <div class="fav-btn active" onclick="event.stopPropagation();toggleWishlist('${p.id}')">❤️</div>
      </div>
      <div class="product-info" onclick="openProduct('${p.id}')">
        <div class="cat-label">${p.category}</div>
        <div class="pname">${p.name}</div>
        <div class="price-row"><span class="now">${money(p.price)}</span><span class="mrp">${money(p.mrp)}</span></div>
      </div>
    </div>`;
  }).join('') + `</div>`;
}

/* ================= ORDERS (MY ORDERS) ================= */
async function renderOrdersView() {
  const wrap = document.getElementById('view-orders');
  if (!currentUser) {
    wrap.innerHTML = `<div class="empty-state"><div class="ic">🔒</div><b>Login to view your orders</b>
      <button onclick="showView('profile')">Login</button></div>`;
    return;
  }
  wrap.innerHTML = `<div class="empty-state"><div class="ic">⏳</div><b>Loading...</b></div>`;
  try {
    const data = await api('/orders');
    if (data.orders.length === 0) {
      wrap.innerHTML = `<div class="empty-state"><div class="ic">📦</div><b>No orders yet</b>
        <button onclick="showView('home')">Start Shopping</button></div>`;
      return;
    }
    wrap.innerHTML = `<div style="padding-top:14px;">` + data.orders.map((o) => `
      <div class="order-card">
        <div class="top"><span>#${o.orderNumber}</span><span class="status ${o.status}">${o.status}</span></div>
        <div class="line">${o.items.map((i) => i.name + ' x' + i.qty).join(', ')}</div>
        <div class="line">Total: ${money(o.total)} · ${o.paymentMethod || 'UPI'} · Payment: ${o.paymentStatus}</div>
        <div class="line">${new Date(o.createdAt).toLocaleString()}</div>
        ${o.trackingNumber ? `<div class="tracking-box">🚚 ${o.courierName || 'Courier'} · Tracking No: ${o.trackingNumber}${o.estimatedDelivery ? ' · Expected: ' + o.estimatedDelivery : ''}</div>` : ''}
        <div class="order-actions">
          <a href="/api/orders/${o.id}/invoice" target="_blank">📄 Download Invoice</a>
        </div>
      </div>`).join('') + `</div>`;
  } catch (e) { toast(e.message); }
}

/* ================= PROFILE / AUTH ================= */
function renderProfileView() {
  const wrap = document.getElementById('view-profile');
  if (currentUser) {
    wrap.innerHTML = `
      <div class="profile-header">
        <div class="avatar">👤</div>
        <div><b>${currentUser.name}</b><span>${currentUser.email}</span></div>
      </div>
      <div class="menu-list">
        <div class="menu-item" onclick="showView('orders')"><div class="left">📦 My Orders</div>›</div>
        <div class="menu-item" onclick="showView('wishlist')"><div class="left">❤️ Wishlist</div>›</div>
        <div class="menu-item" onclick="showWholesaleInfo()"><div class="left">🏬 Wholesale Registration</div>›</div>
        <div class="menu-item" onclick="showAboutUs()"><div class="left">📍 About Us</div>›</div>
        <div class="menu-item" onclick="showContactUs()"><div class="left">📞 Contact Us</div>›</div>
        <div class="menu-item"><div class="left">🌙 Dark Mode</div><div class="toggle" onclick="toggleDarkMode(this)"></div></div>
        <div class="menu-item" onclick="logout()" style="color:#e11d48;"><div class="left" style="color:#e11d48;">🚪 Logout</div></div>
      </div>
      ${footerHtml()}
    `;
    return;
  }
  wrap.innerHTML = `
    <div class="profile-header">
      <div class="avatar">👤</div>
      <div><b>Welcome!</b><span>Guest</span></div>
    </div>
    <div class="menu-list">
      <div class="menu-item" onclick="showAboutUs()"><div class="left">📍 About Us</div>›</div>
      <div class="menu-item" onclick="showContactUs()"><div class="left">📞 Contact Us</div>›</div>
      <div class="menu-item"><div class="left">🌙 Dark Mode</div><div class="toggle" onclick="toggleDarkMode(this)"></div></div>
    </div>
    <div class="auth-form">
      <h3 style="margin-bottom:10px;">${authMode === 'login' ? 'Login' : 'Create Account'}</h3>
      <div class="form-error" id="authError"></div>
      ${authMode === 'signup' ? `<input type="text" id="authName" placeholder="Full Name">` : ''}
      <input type="email" id="authEmail" placeholder="Email">
      <input type="password" id="authPass" placeholder="Password">
      <button onclick="doAuth()">${authMode === 'login' ? 'Login' : 'Create Account'}</button>
      <div class="switch" onclick="toggleAuthMode()">${authMode === 'login' ? "Don't have an account? Create one" : 'Already have an account? Login'}</div>
    </div>
    ${footerHtml()}
  `;
}
function toggleAuthMode() { authMode = authMode === 'login' ? 'signup' : 'login'; renderProfileView(); }
function toggleDarkMode(el) {
  el.classList.toggle('on');
  document.body.classList.toggle('dark');
}
async function doAuth() {
  const errBox = document.getElementById('authError');
  errBox.style.display = 'none';
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPass').value.trim();
  const nameField = document.getElementById('authName');
  try {
    let data;
    if (authMode === 'signup') {
      data = await api('/auth/signup', { method: 'POST', body: { name: nameField ? nameField.value.trim() : '', email, password } });
    } else {
      data = await api('/auth/login', { method: 'POST', body: { email, password } });
    }
    currentUser = data.user;
    await Promise.all([loadCart(), loadWishlist()]);
    updateCartBadge();
    renderProfileView();
    toast('Welcome, ' + currentUser.name + '!');
  } catch (e) {
    errBox.textContent = e.message;
    errBox.style.display = 'block';
  }
}
async function logout() {
  await api('/auth/logout', { method: 'POST' });
  currentUser = null;
  cart = [];
  wishlist = [];
  updateCartBadge();
  renderProfileView();
}
function showAboutUs() {
  const biz = publicConfig.business || {};
  alert(`${biz.name}\n${biz.tagline} — ${biz.positioning}\n${biz.productsLine}\n\nAddress:\n${biz.address}`);
}
function showContactUs() {
  const biz = publicConfig.business || {};
  alert(`Email: ${biz.email}\nPhone: ${biz.phones ? biz.phones.join(' / ') : ''}\nWhatsApp: +${publicConfig.whatsappNumber}\nAddress: ${biz.address}`);
}
function footerHtml() {
  const biz = publicConfig.business || {};
  return `<div class="site-footer">
    <div class="biz">${biz.name || ''}<br>${biz.email || ''} · ${biz.phones ? biz.phones.join(' / ') : ''}</div>
    © ${new Date().getFullYear()} Classic Choice Collection<br>
    <a onclick="openAdmin()">Admin Login</a>
  </div>`;
}

/* ================= ADMIN PANEL ================= */
function openAdmin() {
  document.getElementById('mainApp').style.display = 'none';
  document.getElementById('adminLoginView').style.display = 'flex';
}
function closeAdmin() {
  document.getElementById('adminLoginView').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
}
async function adminLogin() {
  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPass').value.trim();
  const errBox = document.getElementById('adminError');
  errBox.style.display = 'none';
  try {
    const data = await api('/auth/login', { method: 'POST', body: { email, password } });
    if (data.user.role !== 'admin') {
      await api('/auth/logout', { method: 'POST' });
      throw new Error('This account does not have admin access.');
    }
    currentUser = data.user;
    document.getElementById('adminLoginView').style.display = 'none';
    document.getElementById('adminDash').style.display = 'block';
    await Promise.all([renderAdminProducts(), renderAdminOrders(), renderAdminCustomers(), renderAdminStats()]);
  } catch (e) {
    errBox.textContent = e.message;
    errBox.style.display = 'block';
  }
}
async function adminLogout() {
  await api('/auth/logout', { method: 'POST' });
  currentUser = null;
  document.getElementById('adminDash').style.display = 'none';
  document.getElementById('mainApp').style.display = 'flex';
  document.getElementById('adminEmail').value = '';
  document.getElementById('adminPass').value = '';
}
function adminTab(tab) {
  document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
  document.querySelector('.admin-tab[data-tab="' + tab + '"]').classList.add('active');
  document.querySelectorAll('.admin-panel').forEach((p) => p.classList.remove('active'));
  document.getElementById('admin-' + tab).classList.add('active');
}
async function renderAdminStats() {
  const data = await api('/admin/summary');
  document.getElementById('adminStats').innerHTML = `
    <div class="admin-stat"><b>${data.totalProducts}</b><span>Products</span></div>
    <div class="admin-stat"><b>${data.totalOrders}</b><span>Orders</span></div>
    <div class="admin-stat"><b>${data.totalCustomers}</b><span>Customers</span></div>
    <div class="admin-stat"><b>${money(data.revenue)}</b><span>Revenue (paid)</span></div>
  `;
}
let adminSelectedImageFiles = [];
function previewAdminImg(e) {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;
  adminSelectedImageFiles = files;
  const wrap = document.getElementById('apImgPreviewWrap');
  wrap.innerHTML = '';
  files.forEach((file) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = document.createElement('img');
      img.src = reader.result;
      img.style.cssText = 'width:56px;height:56px;object-fit:cover;border-radius:8px;';
      wrap.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
}
async function adminAddProduct() {
  const name = document.getElementById('apName').value.trim();
  const category = document.getElementById('apCategory').value;
  const description = document.getElementById('apDesc').value.trim();
  const price = parseFloat(document.getElementById('apPrice').value);
  const mrp = parseFloat(document.getElementById('apMrp').value);
  const stock = parseInt(document.getElementById('apStock').value || '0', 10);
  const wholesalePrice = document.getElementById('apWholesalePrice').value;
  const wholesaleMinOrder = document.getElementById('apWholesaleMin').value;
  const sizes = document.getElementById('apSizes').value.split(',').map((s) => s.trim()).filter(Boolean);
  const colors = document.getElementById('apColors').value.split(',').map((s) => s.trim()).filter(Boolean);

  if (!name || !price || !mrp) { toast('Please fill product name, price and MRP'); return; }

  try {
    const data = await api('/products', {
      method: 'POST',
      body: { name, description, category, price, mrp, stock, sizes, colors, wholesalePrice: wholesalePrice || null, wholesaleMinOrder: wholesaleMinOrder || null }
    });
    // upload each selected photo one at a time - server appends each to the product's images array
    for (const file of adminSelectedImageFiles) {
      const fd = new FormData();
      fd.append('image', file);
      await apiUpload('/products/' + data.product.id + '/image', fd);
    }
    const uploadedCount = adminSelectedImageFiles.length;
    ['apName', 'apDesc', 'apPrice', 'apMrp', 'apStock', 'apWholesalePrice', 'apWholesaleMin', 'apSizes', 'apColors'].forEach((id) => (document.getElementById(id).value = ''));
    document.getElementById('apImgPreviewWrap').innerHTML = '';
    document.getElementById('apImgInput').value = '';
    adminSelectedImageFiles = [];
    toast('Product added to store!' + (uploadedCount > 1 ? ' 360° view enabled.' : ''));
    await renderAdminProducts();
    await renderAdminStats();
  } catch (e) { toast(e.message); }
}
async function renderAdminProducts() {
  const data = await api('/products');
  document.getElementById('adminProductList').innerHTML = data.products.map((p) => {
    const img = p.images && p.images[0];
    return `
    <div class="admin-product-row">
      <div class="thumb" style="background:${img ? `url(${img})` : (colorMap[p.category] || '#999')}">${img ? '' : (iconMap[p.category] || '🛍️')}</div>
      <div class="name">${p.name}<br><span style="font-weight:400;color:var(--muted);">${money(p.price)} · ${p.category} · Stock: ${p.stock}</span></div>
      <div class="del" onclick="adminDeleteProduct('${p.id}')">Delete</div>
    </div>`;
  }).join('');
}
async function adminDeleteProduct(id) {
  try {
    await api('/products/' + id, { method: 'DELETE' });
    await renderAdminProducts();
    await renderAdminStats();
  } catch (e) { toast(e.message); }
}
async function renderAdminOrders() {
  const data = await api('/orders/admin/all');
  const wrap = document.getElementById('adminOrderList');
  if (data.orders.length === 0) { wrap.innerHTML = `<div class="empty-state"><div class="ic">📦</div><b>No orders yet</b></div>`; return; }
  const toolbar = `<div class="bulk-toolbar">
    <span style="font-size:12px;"><input type="checkbox" id="selectAllOrders" onchange="toggleSelectAllOrders(this)"> Select all</span>
    <button onclick="adminBulkInvoice()">📦 Bulk Invoice / Labels (<span id="selectedCount">0</span>)</button>
  </div>`;
  wrap.innerHTML = toolbar + data.orders.map((o) => `
    <div class="admin-order-card">
      <input type="checkbox" class="select-order" value="${o.id}" onchange="updateSelectedCount()">
      <div class="top"><span>#${o.orderNumber}</span><span class="status ${o.status}">${o.status}</span></div>
      <div class="line">Buyer: ${o.buyerName} (${o.buyerEmail})</div>
      <div class="line">Items: ${o.items.map((i) => i.name + ' x' + i.qty).join(', ')}</div>
      <div class="line">Total: ${money(o.total)} · ${o.paymentMethod || 'UPI'} · Payment: ${o.paymentStatus}</div>
      <div class="line">Ship to: ${o.address.name}, ${o.address.addressLine}, ${o.address.city}, ${o.address.state} - ${o.address.pincode}</div>
      <div class="line">📞 Customer phone: ${o.address.phone}</div>
      <select onchange="adminUpdateOrderStatus('${o.id}', this.value)">
        ${ORDER_STATUSES.map((s) => `<option ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <select onchange="adminUpdatePaymentStatus('${o.id}', this.value)">
        ${['pending', 'paid', 'failed'].map((s) => `<option ${s === o.paymentStatus ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <div class="tracking-inputs">
        <input type="text" placeholder="Courier (e.g. Delhivery)" id="courier-${o.id}" value="${o.courierName || ''}">
        <input type="text" placeholder="Tracking No." id="track-${o.id}" value="${o.trackingNumber || ''}">
        <button onclick="adminSaveTracking('${o.id}')">Save</button>
      </div>
      <a class="admin-invoice-btn" href="/api/orders/admin/${o.id}/invoice" target="_blank">📄 Download Invoice</a>
    </div>`).join('');
}
function toggleSelectAllOrders(cb) {
  document.querySelectorAll('.select-order').forEach((el) => (el.checked = cb.checked));
  updateSelectedCount();
}
function updateSelectedCount() {
  const n = document.querySelectorAll('.select-order:checked').length;
  document.getElementById('selectedCount').textContent = n;
}
async function adminBulkInvoice() {
  const ids = Array.from(document.querySelectorAll('.select-order:checked')).map((el) => el.value);
  if (ids.length === 0) { toast('Select at least one order first'); return; }
  try {
    const res = await fetch('/api/orders/admin/bulk-invoice', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderIds: ids })
    });
    if (!res.ok) throw new Error('Failed to generate invoices');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `invoices-${Date.now()}.zip`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast(ids.length + ' invoices downloaded');
  } catch (e) { toast(e.message); }
}
async function adminSaveTracking(orderId) {
  const courierName = document.getElementById('courier-' + orderId).value.trim();
  const trackingNumber = document.getElementById('track-' + orderId).value.trim();
  try {
    await api('/orders/admin/' + orderId + '/status', { method: 'PUT', body: { courierName, trackingNumber } });
    toast('Tracking info saved');
  } catch (e) { toast(e.message); }
}
async function adminUpdateOrderStatus(orderId, status) {
  try { await api('/orders/admin/' + orderId + '/status', { method: 'PUT', body: { status } }); toast('Order status updated'); }
  catch (e) { toast(e.message); }
}
async function adminUpdatePaymentStatus(orderId, paymentStatus) {
  try { await api('/orders/admin/' + orderId + '/status', { method: 'PUT', body: { paymentStatus } }); toast('Payment status updated'); await renderAdminStats(); }
  catch (e) { toast(e.message); }
}
async function renderAdminCustomers() {
  const data = await api('/admin/customers');
  const wrap = document.getElementById('adminCustomerList');
  if (data.customers.length === 0) { wrap.innerHTML = `<div class="empty-state"><div class="ic">👤</div><b>No customers yet</b></div>`; return; }
  wrap.innerHTML = data.customers.map((c) => `
    <div class="admin-product-row">
      <div class="thumb" style="background:#f0f0f0;">👤</div>
      <div class="name">${c.name}<br><span style="font-weight:400;color:var(--muted);">${c.email}</span></div>
    </div>`).join('');
}

/* ================= INIT ================= */
boot();
