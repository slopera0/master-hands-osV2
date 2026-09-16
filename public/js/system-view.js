// public/js/system-view.js
// Panel de "Estado del Sistema": esto es lo que hace la app auditable en la práctica.
// Cualquier persona con acceso puede ver qué ha fallado, cuándo, y si Gemini/Email
// están configurados, sin tener que abrir archivos de log a mano.

import { api } from './api.js';
import { toast } from './toast.js';

export async function renderSystemStatus() {
  const kpis = document.getElementById('systemKpis');
  const logsBody = document.getElementById('systemLogsBody');
  kpis.innerHTML = '<div class="card kpi"><div class="kpi-label">Cargando…</div></div>';

  try {
    const [{ status }, { logs }] = await Promise.all([api.systemStatus(), api.systemLogs()]);

    kpis.innerHTML = `
      <div class="card kpi"><div class="kpi-label">Proyectos en base de datos</div><div class="kpi-val">${status.projectCount}</div></div>
      <div class="card kpi"><div class="kpi-label">Tamaño BD / Archivos</div><div class="kpi-val">${status.dbSizeKB} <small>KB</small> / ${status.uploadsSizeKB} <small>KB</small></div></div>
      <div class="card kpi"><div class="kpi-label">Errores (24h)</div><div class="kpi-val" style="color:${status.errorCount24h > 0 ? 'var(--danger)' : 'var(--success)'}">${status.errorCount24h}</div></div>
      <div class="card kpi"><div class="kpi-label">Integraciones</div><div style="display:flex; gap:6px; margin-top:8px;">
        <span class="badge ${status.geminiConfigured ? 'badge-ok' : 'badge-neutral'}">Gemini ${status.geminiConfigured ? 'ON' : 'OFF'}</span>
        <span class="badge ${status.emailConfigured ? 'badge-ok' : 'badge-neutral'}">Email ${status.emailConfigured ? 'ON' : 'OFF'}</span>
      </div></div>
    `;

    logsBody.innerHTML = logs.length
      ? logs.map((l) => `
        <tr class="log-row-${l.level}">
          <td><span class="badge ${l.level === 'error' ? 'badge-danger' : 'badge-warn'}">${l.level.toUpperCase()}</span></td>
          <td>${escapeHtml(l.message)}</td>
          <td class="numeric" style="color:var(--text-low);">${l.created_at}</td>
        </tr>`).join('')
      : `<tr><td colspan="3" class="empty-state">Sin errores registrados. Buena señal.</td></tr>`;
  } catch (err) {
    kpis.innerHTML = `<div class="card"><div class="empty-state">No se pudo cargar el estado del sistema: ${err.message}</div></div>`;
  }

  renderBackups();
}

async function renderBackups() {
  const box = document.getElementById('backupsContainer');
  if (!box) return;
  box.innerHTML = '<div class="empty-state">Cargando…</div>';
  try {
    const { backups } = await api.listBackups();
    box.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Archivo</th><th>Tamaño</th><th>Fecha</th><th></th></tr></thead>
          <tbody>
            ${backups.length ? backups.map((b) => `
              <tr>
                <td class="numeric">${b.name}</td>
                <td class="numeric">${b.sizeKB} KB</td>
                <td class="numeric" style="color:var(--text-low);">${new Date(b.createdAt).toLocaleString('es-CO')}</td>
                <td><a class="btn btn-sm" href="/api/system/backups/${b.name}/download" download>Descargar</a></td>
              </tr>`).join('') : `<tr><td colspan="4" class="empty-state">Aún no hay respaldos generados.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    box.innerHTML = `<div class="empty-state">No se pudieron cargar los respaldos: ${err.message}</div>`;
  }
}

export function wireBackupButton() {
  document.getElementById('btnTriggerBackup')?.addEventListener('click', async () => {
    try {
      await api.triggerBackup();
      toast('Respaldo generado.', 'success');
      renderBackups();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
