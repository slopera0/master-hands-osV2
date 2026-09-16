// server/routes/auth.js
const express = require('express');
const db = require('../db');
const { hashPassword, verifyPassword, SESSION_TTL_MS } = require('../auth');
const { requireAuth, requireRole, setSessionCookie, clearSessionCookie } = require('../middleware/auth');
const { logWarn } = require('../logger');

const router = express.Router();

const VALID_ROLES = ['admin', 'vendedor', 'tecnico'];

function publicUser(u) { return { id: u.id, username: u.username, name: u.name, role: u.role }; }
function sessionMeta(req) { return { ip: req.ip, userAgent: req.headers['user-agent'] || '' }; }

function friendlyDevice(userAgent) {
  const ua = (userAgent || '').toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'Tablet';
  if (/iphone|android/.test(ua)) return 'Celular';
  if (/mac os/.test(ua)) return 'Mac';
  if (/windows/.test(ua)) return 'Windows';
  if (/linux/.test(ua)) return 'Linux';
  return 'Dispositivo';
}

// GET /api/auth/status -> le dice al frontend si mostrar "crear cuenta admin" o "iniciar sesión"
router.get('/status', (req, res) => {
  res.json({ ok: true, needsSetup: db.userCount() === 0 });
});

// POST /api/auth/setup -> solo funciona si todavía no existe ningún usuario (primer arranque)
router.post('/setup', (req, res) => {
  if (db.userCount() > 0) {
    return res.status(403).json({ ok: false, error: 'La configuración inicial ya se completó. Usa el inicio de sesión normal.' });
  }
  const { username, password, name } = req.body || {};
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ ok: false, error: 'Usuario y una contraseña de al menos 6 caracteres son obligatorios.' });
  }
  const { salt, hash } = hashPassword(password);
  const user = db.createUser({ username: username.trim(), name: name?.trim() || username.trim(), role: 'admin', salt, hash });
  const token = db.createSession(user.id, SESSION_TTL_MS, sessionMeta(req));
  setSessionCookie(res, token, SESSION_TTL_MS);
  res.status(201).json({ ok: true, user: publicUser(user) });
});

// POST /api/auth/login (con bloqueo temporal tras varios intentos fallidos)
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username) return res.status(400).json({ ok: false, error: 'Escribe tu usuario.' });

  const lockedMs = db.getLockoutRemainingMs(username);
  if (lockedMs > 0) {
    const mins = Math.ceil(lockedMs / 60000);
    return res.status(429).json({ ok: false, error: `Demasiados intentos fallidos. Intenta de nuevo en ${mins} minuto(s).` });
  }

  const user = db.getUserByUsername(username);
  if (!user || !verifyPassword(password || '', user.salt, user.hash)) {
    db.recordFailedLogin(username);
    logWarn('Intento de login fallido', { username });
    return res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos.' });
  }

  db.clearFailedLogins(username);
  const token = db.createSession(user.id, SESSION_TTL_MS, sessionMeta(req));
  setSessionCookie(res, token, SESSION_TTL_MS);
  res.json({ ok: true, user: publicUser(user) });
});

// POST /api/auth/logout
router.post('/logout', requireAuth, (req, res) => {
  db.deleteSession(req.sessionToken);
  clearSessionCookie(res);
  res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// POST /api/auth/change-password -> el propio usuario cambia su contraseña
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ ok: false, error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }
  const user = db.getUserById(req.user.id);
  if (!verifyPassword(currentPassword || '', user.salt, user.hash)) {
    return res.status(401).json({ ok: false, error: 'La contraseña actual no es correcta.' });
  }
  const { salt, hash } = hashPassword(newPassword);
  db.updateUserPassword(user.id, salt, hash);
  res.json({ ok: true });
});

// ---- Sesiones activas ("Mi Cuenta") ----

// GET /api/auth/sessions -> las propias sesiones (o todas, si eres admin y pides ?all=1)
router.get('/sessions', requireAuth, (req, res) => {
  const raw = (req.query.all === '1' && req.user.role === 'admin') ? db.listAllSessions() : db.listSessionsByUser(req.user.id);
  const sessions = raw.map((s) => ({
    token: s.token,
    isCurrent: s.token === req.sessionToken,
    device: friendlyDevice(s.userAgent),
    ip: s.ip,
    createdAt: s.createdAt,
    lastUsedAt: s.lastUsedAt,
    user: s.user || null,
  }));
  res.json({ ok: true, sessions });
});

// DELETE /api/auth/sessions/:token -> revocar una sesión (propia, o cualquiera si eres admin)
router.delete('/sessions/:token', requireAuth, (req, res) => {
  const target = db.getSession(req.params.token);
  if (!target) return res.status(404).json({ ok: false, error: 'Esa sesión ya no existe.' });
  if (target.userId !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'No puedes revocar sesiones de otro usuario.' });
  }
  db.deleteSession(req.params.token);
  res.json({ ok: true, wasCurrent: req.params.token === req.sessionToken });
});

// ---- Gestión de usuarios (solo admin) ----

router.get('/users', requireAuth, requireRole('admin'), (req, res) => {
  res.json({ ok: true, users: db.listUsers() });
});

router.post('/users', requireAuth, requireRole('admin'), (req, res) => {
  const { username, password, name, role } = req.body || {};
  if (!username || !password || password.length < 6) {
    return res.status(400).json({ ok: false, error: 'Usuario y una contraseña de al menos 6 caracteres son obligatorios.' });
  }
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ ok: false, error: `Rol inválido. Debe ser: ${VALID_ROLES.join(', ')}.` });
  }
  if (db.getUserByUsername(username)) {
    return res.status(409).json({ ok: false, error: 'Ya existe un usuario con ese nombre.' });
  }
  const { salt, hash } = hashPassword(password);
  const user = db.createUser({ username: username.trim(), name: name?.trim() || username.trim(), role, salt, hash });
  res.status(201).json({ ok: true, user: publicUser(user) });
});

router.delete('/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  const target = db.getUserById(req.params.id);
  if (!target) return res.status(404).json({ ok: false, error: 'Usuario no encontrado.' });
  if (target.role === 'admin' && db.countAdmins() <= 1) {
    return res.status(400).json({ ok: false, error: 'No puedes eliminar el único administrador restante.' });
  }
  db.deleteUser(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
