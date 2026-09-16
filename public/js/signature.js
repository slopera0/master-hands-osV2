// public/js/signature.js
// PERSONA 6 (Producto): firma electrónica simple por captura en canvas + sello de tiempo.
// No es una firma digital certificada legalmente (eso requiere un proveedor como
// DocuSign/SignWell); es una evidencia de consentimiento razonable para un contrato
// de servicios entre partes que ya se conocen. Ver README para la ruta hacia firma
// certificada si el volumen del negocio lo justifica.

let canvas, ctx, drawing = false, hasStroke = false;

export function initSignaturePad(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';

  const pos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: (p.clientX - rect.left) * (canvas.width / rect.width), y: (p.clientY - rect.top) * (canvas.height / rect.height) };
  };

  const start = (e) => { drawing = true; hasStroke = true; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); e.preventDefault(); };
  const move = (e) => { if (!drawing) return; const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); e.preventDefault(); };
  const end = () => { drawing = false; };

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);
}

export function clearSignature() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  hasStroke = false;
}

export function hasSignature() { return hasStroke; }

export function getSignatureDataUrl() {
  return hasStroke ? canvas.toDataURL('image/png') : null;
}

export function loadSignatureDataUrl(dataUrl) {
  if (!dataUrl || !ctx) return;
  const img = new Image();
  img.onload = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0); hasStroke = true; };
  img.src = dataUrl;
}
