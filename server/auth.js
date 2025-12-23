// ===== AUTHENTICATION UTILITIES =====
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'lords_of_war_secret_key_change_in_production';
const JWT_EXPIRY = '30d'; // 30 days for beta testing

// Hash password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// Compare password with hash
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

// Generate JWT token
const generateToken = (userId, username) => {
  return jwt.sign(
    { userId, username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
};

// Verify JWT token
const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
};

// Middleware to authenticate requests
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'No token provided'
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired token'
    });
  }

  // Check if token is in active sessions (if sessions table exists)
  const { db } = require('./database');
  const crypto = require('crypto');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  
  db.get('SELECT id FROM active_sessions WHERE token_hash = ?', [tokenHash], (err, session) => {
    if (err) {
      console.error('Error checking session:', err);
      // If sessions table doesn't exist yet, allow the request
      req.user = decoded;
      return next();
    }
    
    if (!session) {
      return res.status(403).json({
        success: false,
        message: 'Session has been logged out'
      });
    }
    
    // Update last_used timestamp
    db.run('UPDATE active_sessions SET last_used = CURRENT_TIMESTAMP WHERE id = ?', [session.id], () => {});
    
    req.user = decoded;
    next();
  });
};

// Validate inputs
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_-]{3,20}$/;
  return usernameRegex.test(username);
};

const isValidPassword = (password) => {
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

module.exports = {
  hashPassword,
  comparePassword,
  generateToken,
  verifyToken,
  authenticateToken,
  isValidEmail,
  isValidUsername,
  isValidPassword
};
