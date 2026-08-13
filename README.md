# Classic Choice Collection — Full Stack App

Ladies Night Wear wholesale & retail store: Node.js/Express backend +
vanilla JS frontend, with real authentication, per-user cart/wishlist/
orders, and an admin panel.

## Run it locally

```bash
npm install
npm start
```

Then open **http://localhost:3000** in your browser.

## Admin panel

Open the app → Profile tab → scroll to footer → "Admin Login"
(or go straight to the same page, the link opens the same page).

- Email: `naman9yadav@gmail.com`
- Password: `222202`

Admin can add products (with photo upload), delete products, and view
& update every customer order (status + payment status). This is
enforced on the server (`middleware/auth.js` → `requireAdmin`), not
just hidden in the UI.

## Configuration

Everything business-specific lives in **one file**: `config/config.js`
(overridable via a `.env` file — copy `.env.example` to `.env`).

| Value | Purpose |
|---|---|
| `PAYMENT_NUMBER` | UPI number shown at checkout (currently `9336738879`) |
| `WHATSAPP_NUMBER` | WhatsApp contact number (placeholder — update when the owner gives the real number) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Used only once, to seed the first admin account |
| `DELIVERY_CHARGE` | Flat delivery fee, 0 = free |

## Architecture

- `server.js` — Express app, sessions, static frontend, API mounting
- `config/config.js` — single source of truth for business config
- `db/store.js` — file-backed JSON "database" (table-like collections: users, products, cart_items, wishlist_items, addresses, orders). Swap this file for real Postgres/MySQL later without touching any route file.
- `db/seed.js` — creates the admin user + starter products on first boot only (never overwrites existing data)
- `middleware/auth.js` — `attachUser`, `requireAuth`, `requireAdmin` — session-based, server-enforced
- `routes/*.js` — REST API (auth, products, cart, wishlist, addresses, orders, admin, config)
- `public/` — frontend (same visual design as the original prototype: orange gradient theme, bottom nav, product cards)

## User data isolation

Every cart/wishlist/order/address query is scoped by `req.user.id`
from the session — never a shared/global collection. Verified with an
automated two-user test (User A adds to cart & checks out, User B
never sees User A's cart or orders, and vice versa).

## Payment flow

Manual UPI: checkout shows the configured `PAYMENT_NUMBER` and asks
the buyer to pay, then the order is created with `paymentStatus:
"pending"`. Nothing is auto-marked as paid — the admin marks an order
`paid` from the admin dashboard once payment is confirmed.

## New features (invoice, COD, 360 view, tracking)

- **Invoice PDF**: customers can download their own order invoice anytime from "My Orders" (`GET /api/orders/:id/invoice`). Generated live with `pdfkit` — no third-party service.
- **Admin bulk invoice/labels**: select multiple orders in the admin Orders tab → "Bulk Invoice/Labels" → downloads a single `.zip` with one PDF invoice per order (`POST /api/orders/admin/bulk-invoice`).
- **COD (Cash on Delivery)**: checkout now offers UPI or COD. COD orders skip the UPI payment box and are marked "pay at delivery"; admin still marks `paymentStatus` as paid once cash is collected.
- **Order tracking**: admin can attach a courier name + tracking number + expected delivery date to any order; it shows up on the customer's "My Orders" page automatically.
- **Full-screen image view**: tapping a product's main photo opens a zoomable full-screen lightbox (tap again to zoom, swipe arrows if multiple photos).
- **360° product view**: if the admin uploads *multiple* photos for a product (front/side/back/etc.), the customer can drag left/right on the main image to spin through them, simulating a 360° view. This is a simulated rotation using the angle photos the admin provides — true smooth 360° needs ~12–36 photos taken around the item; 3–6 gives a basic but working spin effect. Single-photo products just get the zoom lightbox.

## Known limitations to flag to the shop owner

- Database is still file-based JSON (see earlier note) — fine for a single small store, but will need a real database (Postgres) if order volume grows or multiple staff edit at once.
- COD and UPI are both "manual" flows — there is no live payment gateway integration (Razorpay/PayU etc.) yet. Admin marks payment status by hand after confirming.
