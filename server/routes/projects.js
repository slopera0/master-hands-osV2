// server/routes/projects.js
const express = require('express');
const crypto = require('crypto');
const db = require('../db');
const { broadcast } = require('../realtime');
const { requireRole } = require('../middleware/auth');

const router = express.Router();

// ---- Validación (Persona 4: nunca confiar solo en la validación del cliente) ----
function toNumber(v, fallback = 0) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

function validateDims(body) {
  const errors = [];
  const dims = { L: 'Largo', W: 'Ancho', H: 'Alto' };
  Object.entries(dims).forEach(([k, label]) => {
    const v = toNumber(body.dimensions?.[k], NaN);
    if (!Number.isFinite(v) || v <= 0 || v > 100) {
      errors.push(`${label} debe ser un número mayor a 0 y menor a 100 metros.`);
    }
  });
  const areas = { doors: 'Área de puertas', windows: 'Área de ventanas', other: 'Otros vacíos' };
  Object.entries(areas).forEach(([k, label]) => {
    if (body.dimensions?.[k] === undefined) return;
    const v = toNumber(body.dimensions[k], NaN);
    if (!Number.isFinite(v) || v < 0) errors.push(`${label} no puede ser negativo.`);
  });
  ['waste', 'indirect'].forEach((k) => {
    if (body.params?.[k] === undefined) return;
    const v = toNumber(body.params[k], NaN);
    if (!Number.isFinite(v) || v < 0 || v > 100) errors.push(`El parámetro "${k}" debe estar entre 0 y 100.`);
  });
  if (body.params?.margin !== undefined) {
    const v = toNumber(body.params.margin, NaN);
    if (!Number.isFinite(v) || v < 0 || v >= 100) errors.push('El margen debe estar entre 0 y 99.9 (un margen de 100% o más rompe el cálculo de precio de venta).');
  }
  return errors;
}

function normalizeIncoming(id, b, existing = {}) {
  return {
    code: b.code || existing.code || `MH-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    name: b.name ?? existing.name ?? '',
    status: b.status || existing.status || 'prospecto',
    client: {
      name: b.client?.name ?? existing.client?.name ?? '',
      phone: b.client?.phone ?? existing.client?.phone ?? '',
      email: b.client?.email ?? existing.client?.email ?? '',
    },
    city: b.city ?? existing.city ?? 'Medellín',
    projectType: b.projectType ?? existing.projectType ?? 'Home Theater Dedicado (Dolby Atmos)',
    objective: b.objective ?? existing.objective ?? '',
    visitDate: b.visitDate ?? existing.visitDate ?? null,
    dimensions: {
      L: toNumber(b.dimensions?.L, existing.dimensions?.L ?? 6.0),
      W: toNumber(b.dimensions?.W, existing.dimensions?.W ?? 4.5),
      H: toNumber(b.dimensions?.H, existing.dimensions?.H ?? 2.7),
      doors: toNumber(b.dimensions?.doors, existing.dimensions?.doors ?? 0),
      windows: toNumber(b.dimensions?.windows, existing.dimensions?.windows ?? 0),
      other: toNumber(b.dimensions?.other, existing.dimensions?.other ?? 0),
    },
    params: {
      waste: toNumber(b.params?.waste, existing.params?.waste ?? 10),
      indirect: toNumber(b.params?.indirect, existing.params?.indirect ?? 10),
      margin: toNumber(b.params?.margin, existing.params?.margin ?? 35),
    },
    docs: b.docs ?? existing.docs ?? {},
    site: b.site ?? existing.site ?? {},
    proposalHtml: b.proposalHtml ?? existing.proposalHtml ?? '',
    contractHtml: b.contractHtml ?? existing.contractHtml ?? '',
    signatureData: b.signatureData ?? existing.signatureData ?? null,
    signedAt: b.signedAt ?? existing.signedAt ?? null,
    bom: Array.isArray(b.bom) ? b.bom.map((it) => ({ name: String(it.name || ''), qty: toNumber(it.qty, 0), unit: String(it.unit || ''), price: toNumber(it.price, 0) })) : (existing.bom || []),
  };
}

// GET /api/projects -> lista resumida
router.get('/', (req, res) => {
  res.json({ ok: true, projects: db.listProjectsSummary() });
});

// GET /api/projects/:id -> proyecto completo
router.get('/:id', (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ ok: false, error: 'Proyecto no encontrado' });
  res.json({ ok: true, project });
});

// POST /api/projects -> crear
router.post('/', (req, res, next) => {
  try {
    const b = req.body || {};
    const errors = validateDims(b);
    if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });

    const project = db.createProject(normalizeIncoming(null, b));
    db.addProjectHistory(project.id, 'created', 'Proyecto creado', req.user?.name);
    broadcast('project:created', { id: project.id });
    res.status(201).json({ ok: true, project });
  } catch (err) { next(err); }
});

// PUT /api/projects/:id -> actualizar (autosave incluido)
router.put('/:id', (req, res, next) => {
  try {
    const existing = db.getProject(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Proyecto no encontrado' });

    const b = req.body || {};
    const errors = validateDims(b);
    if (errors.length) return res.status(400).json({ ok: false, error: errors.join(' ') });

    const updated = db.updateProject(req.params.id, normalizeIncoming(req.params.id, b, existing));

    if (b.status && b.status !== existing.status) {
      db.addProjectHistory(req.params.id, 'status_changed', `${existing.status} -> ${b.status}`, req.user?.name);
    }

    // Snapshot para el panel de "Aprendizaje del negocio"
    if (b.salePrice !== undefined) {
      const V = toNumber(b.dimensions?.L, 0) * toNumber(b.dimensions?.W, 0) * toNumber(b.dimensions?.H, 0);
      db.addQuoteSnapshot({
        projectId: req.params.id,
        project_type: b.projectType || existing.projectType || '',
        volume_m3: V,
        net_walls_m2: toNumber(b.netWalls, 0),
        margin_pct: toNumber(b.params?.margin, 0),
        sale_price: toNumber(b.salePrice, 0),
        status: b.status || existing.status,
      });
    }

    broadcast('project:updated', { id: req.params.id, by: req.user?.name });
    res.json({ ok: true, project: updated });
  } catch (err) { next(err); }
});

// POST /api/projects/:id/sign -> evento de firma auditado (no es una firma digital certificada,
// ver README y aviso en la interfaz). Se registra IP, fecha/hora del servidor y hash del
// documento firmado para poder demostrar más adelante que no fue alterado después de firmarse.
router.post('/:id/sign', (req, res, next) => {
  try {
    const existing = db.getProject(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Proyecto no encontrado' });

    const { dataUrl, signerName, signerId, documentHtml } = req.body || {};
    if (!dataUrl || !signerName) {
      return res.status(400).json({ ok: false, error: 'Falta la firma dibujada o el nombre del firmante.' });
    }
    const docHash = crypto.createHash('sha256').update(documentHtml || existing.proposalHtml || '').digest('hex');
    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
    const signedAt = new Date().toISOString();

    const signatureData = { dataUrl, signerName, signerId: signerId || '', ip, docHash, signedAt };
    const updated = db.updateProject(req.params.id, { ...existing, signatureData, signedAt });
    db.addProjectHistory(req.params.id, 'signed', `Firmado por ${signerName} desde IP ${ip}`, req.user?.name);
    broadcast('project:updated', { id: req.params.id });
    res.json({ ok: true, project: updated });
  } catch (err) { next(err); }
});

// DELETE /api/projects/:id
router.delete('/:id', requireRole('admin', 'vendedor'), (req, res, next) => {
  try {
    const deleted = db.deleteProject(req.params.id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Proyecto no encontrado' });
    broadcast('project:deleted', { id: req.params.id });
    res.json({ ok: true });
  } catch (err) { next(err); }
});

module.exports = router;
