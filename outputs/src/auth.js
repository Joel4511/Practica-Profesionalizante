const jwt = require("jsonwebtoken");

const COOKIE_NAME = "tgt_session";

function signSession(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: "8h" }
  );
}

function setSessionCookie(res, user) {
  res.cookie(COOKIE_NAME, signSession(user), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000
  });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

function requireAuth(req, res, next) {
  try {
    req.user = jwt.verify(req.cookies[COOKIE_NAME], process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "No autorizado" });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) return res.status(403).json({ error: "Acceso denegado" });
    next();
  };
}

module.exports = { setSessionCookie, clearSessionCookie, requireAuth, requireRole };
