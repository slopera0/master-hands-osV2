// public/js/account-view.js
import { api } from './api.js';
import { toast } from './toast.js';

function deviceIcon(device) {
  return { Tablet: '📱', Celular: '📱', Mac: '💻', Windows: '💻', Linux: '💻' }[device] || '🖥️';
}

export async function renderAccount(container) {
  container.innerHTML = `
    <div class="grid grid-2">
      <div class="card">
        <div class="card-head"><div class="card-title">Cambiar contraseña</div></div>
        <div class="field-group">
          <label>Contraseña actual<input id="acctCurrentPassword" type="password"></label>
          <label>Nueva contraseña (mínimo 6 caracteres)<input id="acctNewPassword" type="password"></label>
          <label>Confirmar nueva contraseña<input id="acctConfirmPassword" type="password"></label>
          <span class="field-error" id="acctPasswordError"></span>
          <button class="btn btn-primary" id="btnChangePassword">Actualizar contraseña</button>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><div class="card-title">Sesiones activas</div></div>
        <p class="kpi-label" style="margin-bottom:10px;">Dispositivos donde has iniciado sesión. Si no reconoces uno, ciérralo.</p>
        <div id="sessionsListContainer"><div class="empty-state">Cargando…</div></div>
      </div>
    </div>
  `;

  document.getElementById('btnChangePassword').addEventListener('click', async () => {
    const current = document.getElementById('acctCurrentPassword').value;
    const next = document.getElementById('acctNewPassword').value;
    const confirm = document.getElementById('acctConfirmPassword').value;
    const errorBox = document.getElementById('acctPasswordError');
    errorBox.textContent = '';
    if (next.length < 6) { errorBox.textContent = 'La nueva contraseña debe tener al menos 6 caracteres.'; return; }
    if (next !== confirm) { errorBox.textContent = 'La confirmación no coincide con la nueva contraseña.'; return; }
    try {
      await api.changePassword(current, next);
      toast('Contraseña actualizada.', 'success');
      document.getElementById('acctCurrentPassword').value = '';
      document.getElementById('acctNewPassword').value = '';
      document.getElementById('acctConfirmPassword').value = '';
    } catch (err) { errorBox.textContent = err.message; }
  });

  renderSessionsList();
}

async function renderSessionsList() {
  const box = document.getElementById('sessionsListContainer');
  try {
    const { sessions } = await api.listSessions();
    box.innerHTML = sessions.map((s) => `
      <div class="project-list-item" style="cursor:default;">
        <div class="info">
          <h4>${deviceIcon(s.device)} ${s.device} ${s.isCurrent ? '<span class="badge badge-ok">Esta sesión</span>' : ''}</h4>
          <p>IP ${escapeHtml(s.ip)} · último uso ${new Date(s.lastUsedAt).toLocaleString('es-CO')}</p>
        </div>
        <div class="actions">
          ${s.isCurrent ? '' : `<button class="btn btn-sm btn-danger" data-revoke="${s.token}">Cerrar sesión</button>`}
        </div>
      </div>
    `).join('') || '<div class="empty-state">No hay sesiones activas.</div>';

    box.querySelectorAll('[data-revoke]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api.revokeSession(btn.dataset.revoke);
          toast('Sesión cerrada.', 'success');
          renderSessionsList();
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  } catch (err) {
    box.innerHTML = `<div class="empty-state">No se pudieron cargar las sesiones: ${err.message}</div>`;
  }
}

function escapeHtml(str) { return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
