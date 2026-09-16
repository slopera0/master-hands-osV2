// server/routes/system.js
// Alimenta el panel "Estado del Sistema" dentro de la app: últimos errores registrados,
// si Gemini/Email están configurados, tamaño de la base de datos, y respaldos.

const express = require('express');
const fs = require('fs');
const db = require('../db');
const backup = require('../backup');

const router = express.Router();

router.get('/status', (req, res) => {
  res.json({
    ok: true,
    status: {
      dbSizeKB: db.dbFileSizeKB(),
      uploadsSizeKB: db.uploadsSizeKB(),
      projectCount: db.projectCount(),
      errorCount24h: db.countErrorsSince(24 * 60 * 60 * 1000),
      geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      emailConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      nodeEnv: process.env.NODE_ENV || 'development',
      serverTime: new Date().toISOString(),
    },
  });
});

router.get('/logs', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  res.json({ ok: true, logs: db.listErrorLogs(limit) });
});

// ---- Respaldos ----

router.get('/backups', (req, res) => {
  res.json({ ok: true, backups: backup.listBackups() });
});

router.post('/backups', (req, res) => {
  const filename = backup.performBackup();
  res.json({ ok: true, filename });
});

router.get('/backups/:filename/download', (req, res) => {
  const full = backup.getBackupPath(req.params.filename);
  if (!full || !fs.existsSync(full)) return res.status(404).json({ ok: false, error: 'Respaldo no encontrado' });
  res.download(full, req.params.filename);
});

module.exports = router;
