// server/middleware/errorHandler.js
// Middleware central de errores de Express. Todo error que llegue aquí (sync o async
// gracias a Express 5) queda registrado en logs + BD y el cliente recibe un JSON
// limpio en vez de un stack trace o un cuelgue silencioso.

const { logError } = require('../logger');

function notFoundHandler(req, res) {
  res.status(404).json({ ok: false, error: 'Recurso no encontrado', path: req.originalUrl });
}

function errorHandler(err, req, res, _next) {
  const status = err.status || 500;

  logError(err.message || 'Error no controlado', {
    path: req.originalUrl,
    method: req.method,
    status,
    stack: err.stack,
  });

  res.status(status).json({
    ok: false,
    error: status === 500 ? 'Ocurrió un error interno. Ya quedó registrado en el log del sistema.' : err.message,
  });
}

module.exports = { notFoundHandler, errorHandler };
