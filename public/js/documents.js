// public/js/documents.js
// Plantillas preservadas del sistema original (Persona 5: contenido de dominio ya
// validado por el negocio, no se reescribe salvo blindaje de datos faltantes).

export function signatureProposalTemplate(project, salePriceText) {
  return `
    <h1 style="text-align:center; color:#0f172a;">PROPUESTA SIGNATURE BÚNKER ACÚSTICO</h1>
    <h3 style="text-align:center; color:#0284c7; font-weight:normal; margin-top:0;">Master Hands • High-End Home Theaters</h3>
    <hr>
    <p><strong>Cliente:</strong> ${escapeHtml(project.client?.name) || '[Cliente]'}<br>
    <strong>Proyecto:</strong> ${escapeHtml(project.name) || '[Proyecto]'}<br>
    <strong>Inversión Total Estimada:</strong> ${salePriceText}</p>
    <h3>1. Alcance de Aislamiento Tipo Room-Within-a-Room</h3>
    <ul>
      <li>Doble tabique desacoplado con perfiles independientes y lana de roca mineral (60 kg/m³).</li>
      <li>Membrana viscoelástica pesada (5 kg/m²) intercalada entre capas de yeso.</li>
      <li>Cielo raso suspendido de losa con resortes antivibratorios elastoméricos.</li>
      <li>Piso flotante con tacos de Sylomer calibrados para corte de energía subgrave (20-80 Hz).</li>
      <li>Silenciadores Baffle Box para inyección y retorno de aire acondicionado (NC-22).</li>
    </ul>
    <h3>2. Garantía y Criterios de Aceptación</h3>
    <p>Se garantiza un tiempo de reverberación RT60 interior de 0.25 a 0.35 s y un índice de aislamiento aéreo en campo D_nT,w ≥ 58 dB según ISO 16283 / ASTM E336.</p>
  `;
}

export function contractTemplate(project) {
  return `
    <h1 style="text-align:center; color:#0f172a;">CONTRATO DE PRESTACIÓN DE SERVICIOS ACÚSTICOS</h1>
    <hr>
    <p>Entre los suscritos, <strong>MASTER HANDS S.A.S.</strong> y el cliente <strong>${escapeHtml(project.client?.name) || '[Cliente]'}</strong>, se acuerda:</p>
    <p><strong>CLÁUSULA PRIMERA (Objeto):</strong> Diseño, suministro e instalación del sistema acústico para el proyecto ${escapeHtml(project.name) || '[Proyecto]'}.</p>
    <p><strong>CLÁUSULA SEGUNDA (Garantía de Desempeño):</strong> Se garantiza un ruido de fondo de climatización ≤ NC-25 y verificación con REW.</p>
    <p><strong>CLÁUSULA TERCERA (Forma de Pago):</strong> 50% anticipo al contrato, 30% contra aprobación de Hold Point 1 (inspección oculta) y 20% contra entrega As-Built.</p>
  `;
}

export function geminiPreset(type, project) {
  const { L = 6, W = 4.5, H = 2.7 } = project?.dimensions || {};
  if (type === 'subwoofer') {
    return `Actúa como ingeniero acústico senior de Master Hands. Explica de forma ejecutiva a un cliente en Medellín por qué para un cine con subwoofers en una sala de ${L}x${W}x${H}m se requiere piso flotante con elastómeros Sylomer y no una simple alfombra.`;
  }
  return 'Redacta una cláusula legal de blindaje técnico para un contrato de aislamiento acústico en Colombia que especifique que cualquier perforación de terceros anula la garantía de STC.';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
