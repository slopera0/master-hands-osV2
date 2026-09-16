// server/index.js
// Punto de entrada. Levanta un servidor local que sirve el frontend, expone la API
// (con autenticación por sesión y roles) y un canal WebSocket para sincronización en
// vivo entre dispositivos conectados a la misma red.

// Nota: dotenv (paquete real de npm) imprime por defecto un aviso promocional de un producto
// comercial del autor y no instrucciones a seguir; se silencia con `quiet` para mantener logs limpios.
require('dotenv').config({ quiet: true });
const path = require('path');
const os = require('os');
const http = require('http');
const express = require('express');
const cors = require('cors');

const db = require('./db');
const { logger, attachDb, logError } = require('./logger');
attachDb(db);
const backup = require('./backup');

const { requireAuth, requireRole } = require('./middleware/auth');
const { initRealtime } = require('./realtime');

const authRouter = require('./routes/auth');
const projectsRouter = require('./routes/projects');
const filesRouter = require('./routes/files');
const geminiRouter = require('./routes/gemini');
const emailRouter = require('./routes/email');
const systemRouter = require('./routes/system');
const insightsRouter = require('./routes/insights');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '30mb' })); // 30mb: suficiente para adjuntar un PDF/base64 sin abrir la puerta a payloads absurdos
app.use(express.urlencoded({ extended: true }));

// ---- Rate limiting minimalista para el proxy de IA y el login (evita abuso / fuerza bruta) ----
const rateBuckets = new Map();
function simpleRateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + ':' + req.baseUrl;
    const now = Date.now();
    const bucket = rateBuckets.get(key) || [];
    const recent = bucket.filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      return res.status(429).json({ ok: false, error: 'Demasiadas solicitudes. Espera un momento.' });
    }
    recent.push(now);
    rateBuckets.set(key, recent);
    next();
  };
}

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'master-hands-acoustic-os', time: new Date().toISOString() }));

// ---- Autenticación (pública: status/setup/login; el resto requiere sesión) ----
app.use('/api/auth', simpleRateLimit(30, 60_000), authRouter);

// ---- API protegida: todo lo que sigue requiere haber iniciado sesión ----
app.use('/api/projects', requireAuth, projectsRouter);
app.use('/api/projects', requireAuth, filesRouter); // expone /api/projects/:projectId/files
app.use('/api/files', requireAuth, filesRouter);    // expone /api/files/file/:id/download y delete
app.use('/api/gemini', requireAuth, simpleRateLimit(20, 60_000), geminiRouter);
app.use('/api/email', requireAuth, simpleRateLimit(10, 60_000), emailRouter);
app.use('/api/insights', requireAuth, insightsRouter);
app.use('/api/system', requireAuth, requireRole('admin'), systemRouter);

// ---- Frontend estático ----
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// ---- Errores ----
app.use(notFoundHandler);
app.use(errorHandler);

process.on('unhandledRejection', (reason) => logError('unhandledRejection', { reason: String(reason) }));
process.on('uncaughtException', (err) => logError('uncaughtException', { message: err.message, stack: err.stack }));

const server = http.createServer(app);
initRealtime(server);

function localNetworkAddresses() {
  const nets = os.networkInterfaces();
  const addrs = [];
  Object.values(nets).forEach((ifaces) => {
    (ifaces || []).forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) addrs.push(iface.address);
    });
  });
  return addrs;
}

server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Master Hands Acoustic OS escuchando en http://localhost:${PORT}`);
  backup.scheduleBackups(Number(process.env.BACKUP_INTERVAL_HOURS) || 6);
  const lan = localNetworkAddresses();
  // eslint-disable-next-line no-console
  console.log(`\n  ➜  Local:   http://localhost:${PORT}`);
  lan.forEach((ip) => console.log(`  ➜  Red LAN: http://${ip}:${PORT}  (otros dispositivos en tu misma red/wifi)`));
  console.log('');
});
