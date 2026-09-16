// server/routes/files.js
// Los binarios (fotos, planos, renders PNG) se guardan en disco (data/uploads/<uuid>.ext),
// los metadatos en data/masterhands.json. Esto evita que el archivo de "base de datos" crezca
// a decenas de MB con cada foto y hace los respaldos más livianos y rápidos.
//
// Para fotos se genera además una miniatura (ancho 360px) con Jimp -una librería de imágenes
// 100% JavaScript, sin compilación nativa, coherente con la decisión de robustez del resto
// del proyecto- para que la Bóveda de Archivos cargue rápido incluso con fotos de cámara de
// varios MB cada una.

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const { Jimp } = require('jimp');
const db = require('../db');
const { logWarn } = require('../logger');

const router = express.Router();

const MAX_FILE_MB = 25;
const THUMB_WIDTH = 360;
const ALLOWED_MIME = new Set([
  'image/png', 'image/jpeg', 'image/webp', 'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, db.UPLOAD_DIR),
  filename: (req, file, cb) => {
    const id = crypto.randomUUID();
    const safeExt = path.extname(file.originalname).slice(0, 10);
    cb(null, `${id}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) return cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
    cb(null, true);
  },
});

async function generateThumbnail(fullPath, id) {
  try {
    const image = await Jimp.read(fullPath);
    image.resize({ w: Math.min(THUMB_WIDTH, image.bitmap.width) });
    const thumbName = `${id}_thumb.jpg`;
    await image.write(path.join(db.UPLOAD_DIR, thumbName));
    return thumbName;
  } catch (err) {
    // Una foto corrupta o en un formato raro no debe tumbar la subida completa;
    // simplemente se queda sin miniatura y se sirve el archivo original.
    logWarn('No se pudo generar miniatura', { id, error: err.message });
    return null;
  }
}

// POST /api/projects/:projectId/files
router.post('/:projectId/files', upload.array('files', 20), async (req, res, next) => {
  try {
    const projectId = req.params.projectId;
    if (!db.getProject(projectId)) return res.status(404).json({ ok: false, error: 'Proyecto no encontrado' });

    const saved = [];
    for (const f of (req.files || [])) {
      const id = path.parse(f.filename).name;
      const isImage = f.mimetype.startsWith('image/');
      const thumbPath = isImage ? await generateThumbnail(path.join(db.UPLOAD_DIR, f.filename), id) : null;
      const record = db.addFile({ id, projectId, name: f.originalname, mimeType: f.mimetype, sizeBytes: f.size, diskPath: f.filename, thumbPath });
      saved.push({ id: record.id, name: record.name, mimeType: record.mimeType, sizeBytes: record.sizeBytes, hasThumb: Boolean(thumbPath) });
    }

    res.status(201).json({ ok: true, files: saved });
  } catch (err) { next(err); }
});

// GET /api/projects/:projectId/files -> metadatos
router.get('/:projectId/files', (req, res) => {
  const files = db.listFilesByProject(req.params.projectId)
    .map((f) => ({ id: f.id, name: f.name, mime_type: f.mimeType, size_bytes: f.sizeBytes, created_at: f.createdAt, has_thumb: Boolean(f.thumbPath) }));
  res.json({ ok: true, files });
});

// GET /api/files/file/:id/thumbnail -> miniatura si existe, o el archivo completo si no
router.get('/file/:id/thumbnail', (req, res, next) => {
  try {
    const row = db.getFile(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'Archivo no encontrado' });
    const thumbFull = row.thumbPath ? path.join(db.UPLOAD_DIR, row.thumbPath) : null;
    const target = thumbFull && fs.existsSync(thumbFull) ? thumbFull : path.join(db.UPLOAD_DIR, row.diskPath);
    if (!fs.existsSync(target)) return res.status(410).json({ ok: false, error: 'El archivo ya no existe en disco' });
    res.sendFile(target);
  } catch (err) { next(err); }
});

// GET /api/files/file/:id/download
router.get('/file/:id/download', (req, res, next) => {
  try {
    const row = db.getFile(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'Archivo no encontrado' });
    const fullPath = path.join(db.UPLOAD_DIR, row.diskPath);
    if (!fs.existsSync(fullPath)) return res.status(410).json({ ok: false, error: 'El archivo ya no existe en disco' });
    res.download(fullPath, row.name);
  } catch (err) { next(err); }
});

// DELETE /api/files/file/:id
router.delete('/file/:id', (req, res, next) => {
  try {
    const row = db.getFile(req.params.id);
    if (!row) return res.status(404).json({ ok: false, error: 'Archivo no encontrado' });
    const fullPath = path.join(db.UPLOAD_DIR, row.diskPath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    if (row.thumbPath) {
      const thumbFull = path.join(db.UPLOAD_DIR, row.thumbPath);
      if (fs.existsSync(thumbFull)) fs.unlinkSync(thumbFull);
    }
    db.deleteFile(req.params.id);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Multer y validaciones de archivo devuelven errores especiales; los normalizamos a 400.
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || /Tipo de archivo no permitido/.test(err.message || '')) {
    return res.status(400).json({ ok: false, error: err.message });
  }
  next(err);
});

module.exports = router;
