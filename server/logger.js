// server/logger.js
// Registro de errores en dos capas:
// 1) Archivo de log en disco (data/logs/*.log) - para depuración técnica y auditoría externa.
// 2) data/masterhands.json (errorLogs) - para mostrar un panel "Estado del Sistema" dentro de la app.

const path = require('path');
const winston = require('winston');

const LOG_DIR = path.join(__dirname, '..', 'data', 'logs');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: path.join(LOG_DIR, 'error.log'), level: 'error' }),
    new winston.transports.File({ filename: path.join(LOG_DIR, 'combined.log') }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
  }));
}

let dbRef = null;
function attachDb(db) { dbRef = db; }

function logError(message, context = {}) {
  logger.error(message, context);
  try {
    if (dbRef) dbRef.addErrorLog('error', message, context);
  } catch (e) {
    logger.error('No se pudo escribir el log de error en data/masterhands.json', { original: message, e: e.message });
  }
}

function logWarn(message, context = {}) {
  logger.warn(message, context);
  try {
    if (dbRef) dbRef.addErrorLog('warn', message, context);
  } catch (e) { /* silencioso: no bloquear el flujo por un fallo de logging secundario */ }
}

module.exports = { logger, attachDb, logError, logWarn };
