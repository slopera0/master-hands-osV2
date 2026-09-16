// public/js/toast.js
// Sistema simple de notificaciones. Reemplaza los alert()/console.log silenciosos
// del sistema anterior por feedback visible al usuario ante éxitos y errores.

const stack = document.getElementById('toastStack');

export function toast(message, type = 'info', timeoutMs = 4200) {
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'toast-error' : type === 'success' ? 'toast-success' : ''}`;
  el.textContent = message;
  stack.appendChild(el);
  setTimeout(() => el.remove(), timeoutMs);
}
