// server/db.js
// Base de datos local en un archivo JSON (data/masterhands.json), con escritura atómica
// (se escribe primero a un archivo temporal y luego se renombra) para que un corte de luz
// o un cierre abrupto del proceso no corrompa el archivo a mitad de escritura.
//
// Decisión de arquitectura: se descartó better-sqlite3 (motor SQL real) porque requiere
// compilar un módulo nativo en la instalación (node-gyp) y eso puede fallar de forma
// críptica según el sistema operativo, la conexión a internet o el antivirus del usuario.
// Para una aplicación que un no-desarrollador debe poder instalar con "npm install" sin
// sorpresas, la robustez de una base de datos 100% JavaScript pesa más que las ventajas de
// SQL (joins, índices) a esta escala de datos (una empresa, cientos de proyectos como mucho).
// Si el negocio crece a necesitar concurrencia multiusuario real, la ruta natural es migrar
// esta misma interfaz (los métodos de más abajo) a Postgres/Supabase sin tocar las rutas.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'masterhands.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const LOG_DIR = path.join(DATA_DIR, 'logs');

[DATA_DIR, UPLOAD_DIR, LOG_DIR].forEach((d) => { if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true }); });

const EMPTY_DB = { projects: {}, files: {}, errorLogs: [], quoteSnapshots: [], users: {}, sessions: {}, loginAttempts: {} };
const MAX_LOG_ENTRIES = 2000;
const MAX_SNAPSHOTS = 5000;

let state = loadFromDisk();

function loadFromDisk() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      return { ...structuredClone(EMPTY_DB), ...JSON.parse(raw) };
    }
  } catch (err) {
    // Si el archivo está corrupto, se respalda para no perder evidencia y se arranca limpio
    // en vez de tumbar el servidor entero.
    try { fs.copyFileSync(DB_FILE, DB_FILE + `.corrupt-${Date.now()}.bak`); } catch { /* noop */ }
    // eslint-disable-next-line no-console
    console.error('data/masterhands.json parecía corrupto; se respaldó y se inició una base nueva.', err.message);
  }
  const fresh = structuredClone(EMPTY_DB);
  persist(fresh);
  return fresh;
}

function persist(s = state) {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(s));
  fs.renameSync(tmp, DB_FILE); // rename es atómico en la práctica dentro del mismo disco
}

function nowIso() { return new Date().toISOString(); }

/* ============================== PROYECTOS ============================== */

function listProjectsSummary() {
  return Object.values(state.projects)
    .map((p) => ({ id: p.id, code: p.code, name: p.name, status: p.status, client_name: p.client?.name || '', city: p.city, project_type: p.projectType, updated_at: p.updatedAt }))
    .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
}

function getProject(id) { return state.projects[id] || null; }

function createProject(data) {
  const id = crypto.randomUUID();
  const project = { ...data, id, history: data.history || [], createdAt: nowIso(), updatedAt: nowIso() };
  state.projects[id] = project;
  persist();
  return project;
}

function addProjectHistory(id, event, detail, actor) {
  const p = state.projects[id];
  if (!p) return;
  p.history = p.history || [];
  p.history.push({ event, detail, actor: actor || 'sistema', at: nowIso() });
  persist();
}

function updateProject(id, data) {
  if (!state.projects[id]) return null;
  state.projects[id] = { ...state.projects[id], ...data, id, updatedAt: nowIso() };
  persist();
  return state.projects[id];
}

function deleteProject(id) {
  if (!state.projects[id]) return false;
  delete state.projects[id];
  Object.values(state.files).forEach((f) => { if (f.projectId === id) delete state.files[f.id]; });
  persist();
  return true;
}

/* ============================== ARCHIVOS ============================== */

function addFile(fileMeta) {
  const record = { ...fileMeta, createdAt: nowIso() };
  state.files[record.id] = record;
  persist();
  return record;
}
function getFile(id) { return state.files[id] || null; }
function listFilesByProject(projectId) {
  return Object.values(state.files)
    .filter((f) => f.projectId === projectId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}
function deleteFile(id) {
  if (!state.files[id]) return false;
  delete state.files[id];
  persist();
  return true;
}

/* ============================== LOGS DE ERROR ============================== */

function addErrorLog(level, message, context) {
  state.errorLogs.push({ id: state.errorLogs.length + 1, level, message, context, created_at: nowIso() });
  if (state.errorLogs.length > MAX_LOG_ENTRIES) state.errorLogs = state.errorLogs.slice(-MAX_LOG_ENTRIES);
  persist();
}
function listErrorLogs(limit = 50) {
  return [...state.errorLogs].reverse().slice(0, limit);
}
function countErrorsSince(sinceMs) {
  const cutoff = Date.now() - sinceMs;
  return state.errorLogs.filter((l) => new Date(l.created_at).getTime() >= cutoff).length;
}

/* ============================== SNAPSHOTS (aprendizaje del negocio) ============================== */

function addQuoteSnapshot(snapshot) {
  state.quoteSnapshots.push({ ...snapshot, created_at: nowIso() });
  if (state.quoteSnapshots.length > MAX_SNAPSHOTS) state.quoteSnapshots = state.quoteSnapshots.slice(-MAX_SNAPSHOTS);
  persist();
}
function listQuoteSnapshots() { return state.quoteSnapshots; }

/* ============================== USUARIOS Y SESIONES ============================== */

function userCount() { return Object.keys(state.users).length; }
function listUsers() {
  return Object.values(state.users).map((u) => ({ id: u.id, username: u.username, name: u.name, role: u.role, createdAt: u.createdAt }));
}
function getUserByUsername(username) {
  return Object.values(state.users).find((u) => u.username.toLowerCase() === String(username).toLowerCase()) || null;
}
function getUserById(id) { return state.users[id] || null; }
function createUser({ username, name, role, salt, hash }) {
  const id = crypto.randomUUID();
  const user = { id, username, name, role, salt, hash, createdAt: nowIso() };
  state.users[id] = user;
  persist();
  return user;
}
function updateUserPassword(id, salt, hash) {
  if (!state.users[id]) return false;
  state.users[id].salt = salt;
  state.users[id].hash = hash;
  persist();
  return true;
}
function deleteUser(id) {
  if (!state.users[id]) return false;
  delete state.users[id];
  Object.keys(state.sessions).forEach((tok) => { if (state.sessions[tok].userId === id) delete state.sessions[tok]; });
  persist();
  return true;
}
function countAdmins() { return Object.values(state.users).filter((u) => u.role === 'admin').length; }

function createSession(userId, ttlMs, meta = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = nowIso();
  state.sessions[token] = {
    userId,
    expiresAt: Date.now() + ttlMs,
    createdAt: now,
    lastUsedAt: now,
    ip: meta.ip || '',
    userAgent: meta.userAgent || '',
  };
  persist();
  return token;
}
function getSession(token) {
  const s = state.sessions[token];
  if (!s) return null;
  if (s.expiresAt < Date.now()) { delete state.sessions[token]; persist(); return null; }
  return s;
}
function touchSession(token) {
  const s = state.sessions[token];
  if (!s) return;
  // Evita escribir a disco en cada petición: solo actualiza si pasó más de un minuto
  // desde el último uso registrado (autosave dispara muchas peticiones seguidas).
  if (Date.now() - new Date(s.lastUsedAt).getTime() < 60_000) return;
  s.lastUsedAt = nowIso();
  persist();
}
function deleteSession(token) {
  if (!state.sessions[token]) return false;
  delete state.sessions[token];
  persist();
  return true;
}
function listSessionsByUser(userId) {
  return Object.entries(state.sessions)
    .filter(([, s]) => s.userId === userId)
    .map(([token, s]) => ({ token, ...s }))
    .sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : -1));
}
function listAllSessions() {
  return Object.entries(state.sessions)
    .map(([token, s]) => ({ token, ...s, user: state.users[s.userId] ? { name: state.users[s.userId].name, username: state.users[s.userId].username } : null }))
    .sort((a, b) => (a.lastUsedAt < b.lastUsedAt ? 1 : -1));
}

/* ============================== CONTROL DE FUERZA BRUTA EN LOGIN ============================== */
// Se bloquea temporalmente un usuario (no la IP, porque en redes de oficina/obra suelen
// compartir la misma IP y bloquearla afectaría a todo el equipo) tras varios intentos fallidos.

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutos
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

function recordFailedLogin(username) {
  const key = String(username).toLowerCase();
  const now = Date.now();
  const entry = state.loginAttempts[key] || { attempts: [], lockedUntil: 0 };
  entry.attempts = entry.attempts.filter((t) => now - t < ATTEMPT_WINDOW_MS);
  entry.attempts.push(now);
  if (entry.attempts.length >= MAX_ATTEMPTS) entry.lockedUntil = now + LOCKOUT_MS;
  state.loginAttempts[key] = entry;
  persist();
}
function clearFailedLogins(username) {
  const key = String(username).toLowerCase();
  if (state.loginAttempts[key]) { delete state.loginAttempts[key]; persist(); }
}
function getLockoutRemainingMs(username) {
  const key = String(username).toLowerCase();
  const entry = state.loginAttempts[key];
  if (!entry || !entry.lockedUntil) return 0;
  const remaining = entry.lockedUntil - Date.now();
  return remaining > 0 ? remaining : 0;
}

/* ============================== ESTADO / TAMAÑO ============================== */

function dbFileSizeKB() {
  try { return Math.round(fs.statSync(DB_FILE).size / 1024); } catch { return 0; }
}
function projectCount() { return Object.keys(state.projects).length; }
function uploadsSizeKB() {
  try {
    const files = fs.readdirSync(UPLOAD_DIR).filter((f) => f !== '.gitkeep');
    const total = files.reduce((sum, f) => sum + fs.statSync(path.join(UPLOAD_DIR, f)).size, 0);
    return Math.round(total / 1024);
  } catch { return 0; }
}

module.exports = {
  UPLOAD_DIR,
  LOG_DIR,
  DATA_DIR,
  DB_FILE,
  listProjectsSummary, getProject, createProject, updateProject, deleteProject, addProjectHistory,
  addFile, getFile, listFilesByProject, deleteFile,
  addErrorLog, listErrorLogs, countErrorsSince,
  addQuoteSnapshot, listQuoteSnapshots,
  dbFileSizeKB, projectCount, uploadsSizeKB,
  userCount, listUsers, getUserByUsername, getUserById, createUser, updateUserPassword, deleteUser, countAdmins,
  createSession, getSession, touchSession, deleteSession, listSessionsByUser, listAllSessions,
  recordFailedLogin, clearFailedLogins, getLockoutRemainingMs,
};
