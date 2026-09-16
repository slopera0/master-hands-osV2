// public/js/validation.js
// PERSONA 4 (QA): validación del lado del cliente para feedback inmediato.
// El servidor vuelve a validar todo (ver server/routes/projects.js) porque
// nunca hay que confiar solo en el navegador.

export function isPositiveNumber(v, { max = Infinity, allowZero = false } = {}) {
  const n = parseFloat(v);
  if (!Number.isFinite(n)) return false;
  if (allowZero ? n < 0 : n <= 0) return false;
  if (n > max) return false;
  return true;
}

export function isValidEmail(v) {
  if (!v) return true; // el email es opcional en varios formularios
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

export function setFieldError(inputEl, errorEl, message) {
  if (message) {
    inputEl?.setAttribute('aria-invalid', 'true');
    if (errorEl) errorEl.textContent = message;
  } else {
    inputEl?.removeAttribute('aria-invalid');
    if (errorEl) errorEl.textContent = '';
  }
}

export function validateDimensionsForm({ L, W, H, doors, windows, other }) {
  const errors = [];
  if (!isPositiveNumber(L, { max: 99 })) errors.push('Largo (L) debe ser mayor a 0 y menor a 99 m.');
  if (!isPositiveNumber(W, { max: 99 })) errors.push('Ancho (W) debe ser mayor a 0 y menor a 99 m.');
  if (!isPositiveNumber(H, { max: 20 })) errors.push('Alto (H) debe ser mayor a 0 y menor a 20 m.');
  [['Puertas', doors], ['Ventanas', windows], ['Otros vacíos', other]].forEach(([label, v]) => {
    if (v !== undefined && v !== '' && !isPositiveNumber(v, { allowZero: true })) {
      errors.push(`${label} no puede ser negativo.`);
    }
  });
  return errors;
}
