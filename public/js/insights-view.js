// public/js/insights-view.js
import { api } from './api.js';
import { formatCOP } from './bom.js';

export async function renderInsights() {
  const container = document.getElementById('insightsContainer');
  container.innerHTML = '<div class="empty-state">Cargando…</div>';
  try {
    const { insights, message } = await api.insights();
    if (!insights) {
      container.innerHTML = `<div class="empty-state">${message}</div>`;
      return;
    }
    container.innerHTML = `
      <div class="grid grid-4">
        <div class="card kpi"><div class="kpi-label">Cotizaciones registradas</div><div class="kpi-val">${insights.totalQuotes}</div></div>
        <div class="card kpi"><div class="kpi-label">Margen promedio</div><div class="kpi-val accent">${insights.avgMarginPct ?? '—'}%</div></div>
        <div class="card kpi"><div class="kpi-label">Volumen promedio</div><div class="kpi-val">${insights.avgVolumeM3 ?? '—'} <small>m³</small></div></div>
        <div class="card kpi"><div class="kpi-label">Precio promedio / m³</div><div class="kpi-val">${formatCOP(insights.avgPricePerM3)}</div></div>
      </div>

      <div class="card" style="margin-top:16px;">
        <div class="card-head"><div class="card-title">Cotizaciones por mes (últimos 12 meses con datos)</div></div>
        ${monthChart(insights.byMonth)}
      </div>

      <div class="grid grid-2" style="margin-top:16px;">
        <div class="card">
          <div class="card-head"><div class="card-title">Tipologías más cotizadas</div></div>
          ${barRows(insights.topProjectTypes, 'project_type')}
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">Proyectos por estado</div></div>
          ${barRows(insights.byStatus, 'status')}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div class="empty-state">No se pudieron cargar los datos: ${err.message}</div>`;
  }
}

/** Barras horizontales simples (div con ancho %) — sin librerías, coherente con el resto del sistema de diseño. */
function barRows(rows, key) {
  if (!rows || !rows.length) return '<p class="kpi-label">Sin datos suficientes aún.</p>';
  const max = Math.max(...rows.map((r) => r.n), 1);
  return `<div style="display:grid; gap:10px;">${rows.map((r) => `
    <div>
      <div style="display:flex; justify-content:space-between; font-size:12px; margin-bottom:4px;">
        <span>${escapeHtml(r[key] || '(sin especificar)')}</span><b class="numeric">${r.n}</b>
      </div>
      <div style="height:8px; border-radius:5px; background:var(--graphite-800); overflow:hidden;">
        <div style="height:100%; width:${(r.n / max) * 100}%; background:var(--copper); border-radius:5px;"></div>
      </div>
    </div>`).join('')}</div>`;
}

/** Gráfico de barras verticales en SVG para la tendencia mensual de cotizaciones. */
function monthChart(byMonth) {
  if (!byMonth || !byMonth.length) return '<p class="kpi-label">Sin datos suficientes aún — vuelve cuando tengas cotizaciones de más de un mes.</p>';

  const width = 700, height = 180, padding = 30, barGap = 10;
  const maxCount = Math.max(...byMonth.map((m) => m.count), 1);
  const barWidth = (width - padding * 2) / byMonth.length - barGap;

  const bars = byMonth.map((m, i) => {
    const barHeight = (m.count / maxCount) * (height - padding * 2);
    const x = padding + i * (barWidth + barGap);
    const y = height - padding - barHeight;
    const label = m.month.slice(2).replace('-', '/'); // "26/03"
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barWidth.toFixed(1)}" height="${barHeight.toFixed(1)}" rx="3" fill="var(--copper)" opacity="0.85">
        <title>${m.month}: ${m.count} cotización(es), promedio ${formatCOP(m.avgSale)}</title>
      </rect>
      <text x="${(x + barWidth / 2).toFixed(1)}" y="${height - padding + 14}" text-anchor="middle" font-size="9" fill="var(--text-low)" font-family="var(--font-mono)">${label}</text>
      <text x="${(x + barWidth / 2).toFixed(1)}" y="${(y - 5).toFixed(1)}" text-anchor="middle" font-size="10" fill="var(--text-hi)" font-family="var(--font-mono)">${m.count}</text>
    `;
  }).join('');

  return `<svg viewBox="0 0 ${width} ${height}" style="width:100%; height:${height}px; display:block;">${bars}</svg>`;
}

function escapeHtml(str) { return String(str || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
