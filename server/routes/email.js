// server/routes/email.js
// Envío real de correo (propuesta/contrato). Requiere credenciales SMTP en .env.
// Si no están configuradas, el endpoint responde con un error claro en vez de fallar
// en silencio, y el frontend ofrece "Descargar PDF y enviar manualmente" como alternativa.

const express = require('express');
const nodemailer = require('nodemailer');
const db = require('../db');

const router = express.Router();

function getTransport() {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
}

router.post('/', async (req, res, next) => {
  try {
    const { projectId, to, subject, message, pdfBase64, fileName } = req.body || {};

    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ ok: false, error: 'Correo de destino inválido.' });
    }

    const transport = getTransport();
    if (!transport) {
      return res.status(503).json({
        ok: false,
        error: 'El envío de correo no está configurado. Define SMTP_HOST, SMTP_USER y SMTP_PASS en el archivo .env (ver README).',
      });
    }

    const attachments = [];
    if (pdfBase64) {
      attachments.push({
        filename: fileName || 'Propuesta_Master_Hands.pdf',
        content: Buffer.from(pdfBase64, 'base64'),
        contentType: 'application/pdf',
      });
    }

    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject: subject || 'Propuesta técnica y comercial — Master Hands',
      text: message || 'Adjuntamos la propuesta de su proyecto acústico.',
      attachments,
    });

    if (projectId) {
      db.addProjectHistory(projectId, 'emailed', `Enviado a ${to}`, req.user?.name);
    }

    res.json({ ok: true, message: 'Correo enviado correctamente.' });
  } catch (err) { next(err); }
});

module.exports = router;
