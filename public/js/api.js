// public/js/api.js
// PERSONA 1 (Arquitectura/Datos): reemplaza el acceso directo a localStorage por
// llamadas a la API del servidor local (SQLite real). Si el servidor no responde
// (por ejemplo, cerraste la terminal que lo corre), el cambio se guarda en una cola
// local y se reintenta automáticamente -> esto es lo que hace el sistema "offline-first"
// de verdad, en vez de solo prometerlo en el manual.

import { toast } from './toast.js';

const BASE = '/api';
const QUEUE_KEY = 'mh_pending_sync_v2';
let online = true;
const listeners = new Set();

export function onSyncChange(fn) { listeners.add(fn); }
function setOnline(v) {
  if (v === online) return;
  online = v;
  listeners.forEach((fn) => fn(online));
}

function readQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { return []; }
}
function writeQueue(q) { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); }

async function raw(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  let body = null;
  try { body = await res.json(); } catch { /* respuesta sin cuerpo JSON (ej. descarga de archivo) */ }
  if (!res.ok) {
    const message = body?.error || `Error HTTP ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return body;
}

/**
 * request(): intenta ir al servidor. Si falla por red (servidor apagado / sin wifi)
 * y el método es de escritura, encola el cambio para reintentar y devuelve un
 * resultado "optimista" para que la interfaz no se bloquee.
 */
export async function request(path, options = {}, { queueOnFail = false, queuePayload = null } = {}) {
  try {
    const data = await raw(path, options);
    setOnline(true);
    return data;
  } catch (err) {
    const isNetworkError = err instanceof TypeError; // fetch lanza TypeError si no hay conexión
    if (isNetworkError) {
      setOnline(false);
      if (queueOnFail) {
        const q = readQueue();
        q.push({ path, options, ts: Date.now(), payload: queuePayload });
        writeQueue(q);
        toast('Sin conexión con el servidor local. El cambio quedó guardado y se sincronizará automáticamente.', 'error', 5500);
        return { ok: true, queued: true };
      }
    }
    throw err;
  }
}

export async function trySyncQueue() {
  const q = readQueue();
  if (!q.length) return;
  const remaining = [];
  for (const item of q) {
    try {
      await raw(item.path, item.options);
    } catch (err) {
      if (err instanceof TypeError) { remaining.push(item); continue; } // sigue sin conexión
      // Error de negocio (ej. validación) al reintentar: se descarta para no encolar infinitamente,
      // pero se avisa al usuario.
      toast(`No se pudo sincronizar un cambio pendiente: ${err.message}`, 'error');
    }
  }
  writeQueue(remaining);
  if (remaining.length === 0 && q.length > 0) {
    setOnline(true);
    toast('Cambios pendientes sincronizados correctamente.', 'success');
  }
}

// Reintenta cada 15s y también cuando el navegador detecta que volvió la red.
setInterval(trySyncQueue, 15000);
window.addEventListener('online', trySyncQueue);

export const api = {
  listProjects: () => request('/projects'),
  getProject: (id) => request(`/projects/${id}`),
  createProject: (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) }),
  updateProject: (id, data) => request(`/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) }, { queueOnFail: true }),
  deleteProject: (id) => request(`/projects/${id}`, { method: 'DELETE' }),

  listFiles: (projectId) => request(`/projects/${projectId}/files`),
  deleteFile: (id) => request(`/files/file/${id}`, { method: 'DELETE' }),
  uploadFiles: async (projectId, fileList) => {
    const form = new FormData();
    Array.from(fileList).forEach((f) => form.append('files', f));
    const res = await fetch(`${BASE}/projects/${projectId}/files`, { method: 'POST', body: form });
    const body = await res.json();
    if (!res.ok) throw new Error(body?.error || 'Error al subir archivo');
    return body;
  },

  askGemini: (prompt) => request('/gemini', { method: 'POST', body: JSON.stringify({ prompt }) }),
  sendEmail: (payload) => request('/email', { method: 'POST', body: JSON.stringify(payload) }),
  systemStatus: () => request('/system/status'),
  systemLogs: () => request('/system/logs'),
  insights: () => request('/insights'),

  changePassword: (currentPassword, newPassword) => request('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  listSessions: () => request('/auth/sessions'),
  revokeSession: (token) => request(`/auth/sessions/${token}`, { method: 'DELETE' }),
  listBackups: () => request('/system/backups'),
  triggerBackup: () => request('/system/backups', { method: 'POST' }),
};

export function isOnline() { return online; }
