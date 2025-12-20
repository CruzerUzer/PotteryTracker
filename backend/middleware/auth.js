// Authentication middleware to check if user is logged in
export const requireAuth = (req, res, next) => {
  if (req.session && req.session.userId) {
    // User is authenticated, add userId to request object for easy access
    req.userId = req.session.userId;
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

