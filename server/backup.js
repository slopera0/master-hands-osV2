// server/backup.js
// Respaldo automático periódico de data/masterhands.json a data/backups/, con rotación
// (se conservan los últimos N). También expone un respaldo manual bajo demanda desde el
// panel de administrador. No se respaldan los archivos binarios de data/uploads/ aquí por
// tamaño; para eso, la recomendación del README sigue siendo copiar toda la carpeta data/
// de vez en cuando a un disco externo o la nube.

const fs = require('fs');
const path = require('path');
const db = require('./db');

const BACKUP_DIR = path.join(db.DATA_DIR, 'backups');
const KEEP_LAST = 30;
const DEFAULT_INTERVAL_HOURS = 6;

if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

function timestampSlug() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function performBackup() {
  if (!fs.existsSync(db.DB_FILE)) return null;
  const filename = `masterhands-${timestampSlug()}.json`;
  const dest = path.join(BACKUP_DIR, filename);
  fs.copyFileSync(db.DB_FILE, dest);
  pruneOldBackups();
  return filename;
}

function pruneOldBackups() {
  const files = listBackups();
  if (files.length <= KEEP_LAST) return;
  files.slice(KEEP_LAST).forEach((f) => {
    try { fs.unlinkSync(path.join(BACKUP_DIR, f.name)); } catch { /* noop */ }
  });
}

function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      return { name: f, sizeKB: Math.round(stat.size / 1024), createdAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

function getBackupPath(filename) {
  // Evita path traversal: solo nombres de archivo simples generados por este mismo módulo.
  if (!/^masterhands-[\w-]+\.json$/.test(filename)) return null;
  const full = path.join(BACKUP_DIR, filename);
  return fs.existsSync(full) ? full : null;
}

let intervalHandle = null;

function scheduleBackups(hours = DEFAULT_INTERVAL_HOURS) {
  performBackup(); // uno al arrancar, para no depender de que el servidor lleve horas prendido
  clearInterval(intervalHandle);
  intervalHandle = setInterval(performBackup, hours * 60 * 60 * 1000);
}

module.exports = { performBackup, listBackups, getBackupPath, scheduleBackups, BACKUP_DIR };
