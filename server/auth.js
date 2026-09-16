// server/auth.js
// Hashing de contraseñas con scrypt (módulo nativo de Node, no requiere instalar nada
// como bcrypt que sí necesita compilación). Cada contraseña lleva su propia sal aleatoria.

const crypto = require('crypto');

const KEY_LEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, KEY_LEN).toString('hex');
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  const hash = crypto.scryptSync(String(password), salt, KEY_LEN).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b); // evita timing attacks al comparar hashes
}

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

module.exports = { hashPassword, verifyPassword, SESSION_TTL_MS };
