// public/js/auth-view.js
// Pantalla de acceso: si es el primer arranque (sin usuarios), pide crear la cuenta
// administradora; si no, pide usuario y contraseña normales.

import { toast } from './toast.js';

const BASE = '/api/auth';

export async function checkAuthStatus() {
  const res = await fetch(`${BASE}/status`);
  return res.json();
}

export async function getCurrentUser() {
  const res = await fetch(`${BASE}/me`);
  if (!res.ok) return null;
  const { user } = await res.json();
  return user;
}

export function renderAuthScreen(container, { needsSetup, onSuccess }) {
  container.innerHTML = `
    <div class="auth-shell">
      <div class="auth-card">
        <div class="brand" style="border:none; padding:0; margin-bottom:22px; justify-content:center;">
          <div class="brand-mark">MH</div>
          <div><h1>MASTER HANDS</h1><p>ACOUSTIC PROJECT OS · V2</p></div>
        </div>
        ${needsSetup ? `
          <h3 style="margin-top:0;">Configuración inicial</h3>
          <p class="kpi-label" style="margin-bottom:16px;">Aún no hay usuarios. Crea la cuenta de administrador para empezar.</p>
          <form id="setupForm" class="field-group">
            <label>Nombre completo<input id="setupName" placeholder="Ej. Andrés Pérez" required></label>
            <label>Usuario<input id="setupUsername" placeholder="admin" required></label>
            <label>Contraseña (mínimo 6 caracteres)<input id="setupPassword" type="password" required minlength="6"></label>
            <button class="btn btn-primary" type="submit">Crear cuenta y entrar</button>
          </form>
        ` : `
          <h3 style="margin-top:0;">Iniciar sesión</h3>
          <form id="loginForm" class="field-group">
            <label>Usuario<input id="loginUsername" required autofocus></label>
            <label>Contraseña<input id="loginPassword" type="password" required></label>
            <button class="btn btn-primary" type="submit">Entrar</button>
          </form>
        `}
        <p class="field-error" id="authError" style="margin-top:10px;"></p>
      </div>
    </div>
  `;

  const errorBox = document.getElementById('authError');

  if (needsSetup) {
    document.getElementById('setupForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.textContent = '';
      const body = {
        name: document.getElementById('setupName').value.trim(),
        username: document.getElementById('setupUsername').value.trim(),
        password: document.getElementById('setupPassword').value,
      };
      try {
        const res = await fetch(`${BASE}/setup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast('Cuenta creada. ¡Bienvenido!', 'success');
        onSuccess(data.user);
      } catch (err) { errorBox.textContent = err.message; }
    });
  } else {
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.textContent = '';
      const body = {
        username: document.getElementById('loginUsername').value.trim(),
        password: document.getElementById('loginPassword').value,
      };
      try {
        const res = await fetch(`${BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        onSuccess(data.user);
      } catch (err) { errorBox.textContent = err.message; }
    });
  }
}

export async function logout() {
  await fetch(`${BASE}/logout`, { method: 'POST' });
  location.reload();
}
