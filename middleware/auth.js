const db = require('../db/store');

/** Attaches req.user if a valid session exists (does not block the request). */
function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    const user = db.getById('users', req.session.userId);
    if (user) {
      req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    } else {
      // stale session pointing at a deleted user
      req.session.destroy(() => {});
    }
  }
  next();
}

/** Blocks the request unless the user is logged in. */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Please login to continue.' });
  }
  next();
}

/** Blocks the request unless the logged-in user has the admin role.
 *  This is enforced here on the server for every admin route - the
 *  frontend hiding admin buttons is NOT the security boundary. */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access only.' });
  }
  next();
}

module.exports = { attachUser, requireAuth, requireAdmin };
