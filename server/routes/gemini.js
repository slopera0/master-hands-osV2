// server/routes/gemini.js
// PERSONA 4 (Seguridad): la versión anterior guardaba la API Key de Gemini en el navegador
// y llamaba a Google directamente desde el cliente -> cualquiera con la consola abierta
// podía robarla. Ahora la key vive SOLO en el archivo .env del servidor (nunca llega al
// navegador) y el frontend le pide a este endpoint que haga la consulta por él.

const express = require('express');
const { logWarn } = require('../logger');

const router = express.Router();

const LOCAL_FALLBACK_NOTICE = 'MODO ASISTENTE LOCAL (sin conexión a Gemini configurada por el administrador del sistema).';

router.post('/', async (req, res, next) => {
  try {
    const { prompt } = req.body || {};
    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ ok: false, error: 'La consulta no puede estar vacía.' });
    }

    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      logWarn('Se intentó usar Gemini Copilot sin GEMINI_API_KEY configurada en .env');
      return res.json({ ok: true, source: 'local', text: LOCAL_FALLBACK_NOTICE });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: String(prompt) }] }] }),
        signal: controller.signal,
      }
    ).finally(() => clearTimeout(timeout));

    const data = await upstream.json();

    if (!upstream.ok) {
      return res.status(502).json({ ok: false, error: 'Gemini rechazó la solicitud.', detail: data });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(502).json({ ok: false, error: 'Gemini no devolvió contenido interpretable.' });

    res.json({ ok: true, source: 'gemini', text });
  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({ ok: false, error: 'Gemini tardó demasiado en responder (timeout).' });
    }
    next(err);
  }
});

module.exports = router;
