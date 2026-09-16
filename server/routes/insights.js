// server/routes/insights.js
// "Evolutiva / que aprenda": NO es un modelo de machine learning. Es un panel de
// inteligencia de negocio que agrega los datos reales que el equipo va generando
// (quoteSnapshots) para revelar patrones -> el sistema "aprende" en el sentido de que
// sus recomendaciones por defecto pueden ir ajustándose con más datos, no porque haya
// una IA entrenándose sola.

const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const snapshots = db.listQuoteSnapshots();
  if (!snapshots.length) {
    return res.json({
      ok: true,
      insights: null,
      message: 'Aún no hay suficientes cotizaciones guardadas para generar patrones. Vuelve cuando tengas al menos unos 5 proyectos cotizados.',
    });
  }

  const avg = (arr) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const margins = snapshots.map((s) => s.margin_pct).filter((v) => Number.isFinite(v));
  const volumes = snapshots.map((s) => s.volume_m3).filter((v) => Number.isFinite(v) && v > 0);
  const prices = snapshots.map((s) => s.sale_price).filter((v) => Number.isFinite(v) && v > 0);
  const pricePerM3 = snapshots
    .filter((s) => s.volume_m3 > 0 && s.sale_price > 0)
    .map((s) => s.sale_price / s.volume_m3);

  const countBy = (key) => {
    const counts = {};
    snapshots.forEach((s) => { const k = s[key] || '(sin especificar)'; counts[k] = (counts[k] || 0) + 1; });
    return Object.entries(counts).map(([k, n]) => ({ [key]: k, n })).sort((a, b) => b.n - a.n);
  };

  // Agregación mensual (últimos 12 meses con datos) para graficar tendencia de cotizaciones y precio promedio.
  const byMonthMap = {};
  snapshots.forEach((s) => {
    const month = (s.created_at || '').slice(0, 7); // "YYYY-MM"
    if (!month) return;
    if (!byMonthMap[month]) byMonthMap[month] = { month, count: 0, totalSale: 0 };
    byMonthMap[month].count += 1;
    byMonthMap[month].totalSale += Number.isFinite(s.sale_price) ? s.sale_price : 0;
  });
  const byMonth = Object.values(byMonthMap)
    .sort((a, b) => (a.month < b.month ? -1 : 1))
    .slice(-12)
    .map((m) => ({ month: m.month, count: m.count, avgSale: Math.round(m.totalSale / m.count) }));

  res.json({
    ok: true,
    insights: {
      totalQuotes: snapshots.length,
      avgMarginPct: round1(avg(margins)),
      avgVolumeM3: round1(avg(volumes)),
      avgSalePrice: Math.round(avg(prices) || 0),
      avgPricePerM3: Math.round(avg(pricePerM3) || 0),
      topProjectTypes: countBy('project_type').slice(0, 5),
      byStatus: countBy('status'),
      byMonth,
    },
  });
});

function round1(n) { return Number.isFinite(n) ? Math.round(n * 10) / 10 : null; }

module.exports = router;
