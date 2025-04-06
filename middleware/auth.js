const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
      const authHeader = req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log("🔒 Missing or invalid Authorization header:", authHeader);
          return res.status(401).json({ error: 'No token provided' });
      }
      const token = authHeader.replace('Bearer ', '');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log("🔓 Token decoded successfully:", decoded);
      req.user = { userId: decoded.userId };
      console.log('📦 req.user attached:', req.user);  
      next();
  } catch (err) {
    console.error("❌ JWT verification failed:", err.message);
      return res.status(401).json({ error: 'Invalid token' });
  }
};
