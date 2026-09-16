// server/middleware/auth.js
// PERSONA 1/4 (Arquitectura + Seguridad): sesiones simples por cookie httpOnly firmadas
// solo por ser un token aleatorio opaco guardado en el servidor (no un JWT autocontenido),
// para no depender de una librería extra de firmado y mantener el modelo fácil de auditar:
// toda sesión activa está listada en data/masterhands.json -> sessions.

const db = require('../db');

const COOKIE_NAME = 'mh_session';

function parseCookies(header) {
  const out = {};
  (header || '').split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return;
    const k = pair.slice(0, idx).trim();
    const v = pair.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function setSessionCookie(res, token, maxAgeMs) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${token}; HttpOnly; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}; SameSite=Lax${secure}`);
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`);
}

function getTokenFromReq(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies[COOKIE_NAME] || null;
}

function requireAuth(req, res, next) {
  const token = getTokenFromReq(req);
  const session = token ? db.getSession(token) : null;
  if (!session) return res.status(401).json({ ok: false, error: 'Sesión no válida o expirada. Inicia sesión de nuevo.' });
  const user = db.getUserById(session.userId);
  if (!user) return res.status(401).json({ ok: false, error: 'Usuario no encontrado.' });
  req.user = { id: user.id, username: user.username, name: user.name, role: user.role };
  req.sessionToken = token;
  db.touchSession(token);
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ ok: false, error: 'No autenticado.' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ ok: false, error: `Esta acción requiere rol: ${roles.join(' o ')}.` });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, setSessionCookie, clearSessionCookie, getTokenFromReq, COOKIE_NAME };
