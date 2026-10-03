// Usage: requireRole('Admin') or requireRole('Admin', 'Conservation Officer')
// Must run AFTER the authenticate middleware, since it reads req.user
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action' });
    }

    next();
  };
}

module.exports = requireRole;
