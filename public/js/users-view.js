// public/js/users-view.js
// Panel de gestión de usuarios, visible solo para el rol "admin".

import { toast } from './toast.js';

const BASE = '/api/auth';
const ROLE_LABELS = { admin: 'Administrador', vendedor: 'Comercial / Ventas', tecnico: 'Técnico de campo' };

export async function renderUsers(container, currentUserId) {
  container.innerHTML = '<div class="empty-state">Cargando usuarios…</div>';
  try {
    const res = await fetch(`${BASE}/users`);
    const { users } = await res.json();
    container.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th></th></tr></thead>
          <tbody>
            ${users.map((u) => `
              <tr>
                <td>${escapeHtml(u.name)}${u.id === currentUserId ? ' <span class="badge badge-neutral">tú</span>' : ''}</td>
                <td class="numeric">${escapeHtml(u.username)}</td>
                <td><span class="badge badge-ok">${ROLE_LABELS[u.role] || u.role}</span></td>
                <td>${u.id === currentUserId ? '' : `<button class="btn btn-sm btn-danger" data-del-user="${u.id}">Eliminar</button>`}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
    container.querySelectorAll('[data-del-user]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este usuario? Perderá acceso inmediatamente.')) return;
        try {
          const r = await fetch(`${BASE}/users/${btn.dataset.delUser}`, { method: 'DELETE' });
          const d = await r.json();
          if (!r.ok) throw new Error(d.error);
          toast('Usuario eliminado.', 'success');
          renderUsers(container, currentUserId);
        } catch (err) { toast(err.message, 'error'); }
      });
    });
  } catch (err) {
    container.innerHTML = `<div class="empty-state">No se pudo cargar la lista de usuarios: ${err.message}</div>`;
  }
}

export function wireNewUserForm(formEls, onCreated) {
  formEls.button.addEventListener('click', async () => {
    const body = {
      name: formEls.name.value.trim(),
      username: formEls.username.value.trim(),
      password: formEls.password.value,
      role: formEls.role.value,
    };
    if (!body.username || body.password.length < 6) {
      toast('Usuario y contraseña de al menos 6 caracteres son obligatorios.', 'error');
      return;
    }
    try {
      const res = await fetch(`${BASE}/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast(`Usuario "${body.username}" creado.`, 'success');
      formEls.name.value = ''; formEls.username.value = ''; formEls.password.value = '';
      onCreated();
    } catch (err) { toast(err.message, 'error'); }
  });
}

function escapeHtml(str) { return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
