// tests/bom.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateBom, formatCOP, DEFAULT_BOM_ITEMS } from '../public/js/bom.js';

test('calculateBom: sin ítems produce todo en cero sin lanzar error', () => {
  const r = calculateBom([], { waste: 10, indirect: 10, margin: 35 });
  assert.equal(r.directCost, 0);
  assert.equal(r.salePrice, 0);
});

test('calculateBom: aplica desperdicio, indirectos y margen en el orden correcto', () => {
  const items = [{ qty: 10, price: 1000 }]; // subtotal crudo: 10,000
  const r = calculateBom(items, { waste: 10, indirect: 10, margin: 0 });
  // directo con desperdicio: 10000 * 1.10 = 11000
  assert.ok(Math.abs(r.directCost - 11000) < 0.01);
  // indirecto: 11000 * 0.10 = 1100
  assert.ok(Math.abs(r.indirectCost - 1100) < 0.01);
  // margen 0% => precio de venta = costo total = 12100
  assert.ok(Math.abs(r.salePrice - 12100) < 0.01);
});

test('calculateBom: el margen comercial se calcula sobre el precio de venta, no como markup simple', () => {
  const items = [{ qty: 1, price: 10000 }];
  const r = calculateBom(items, { waste: 0, indirect: 0, margin: 50 });
  // costo=10000, margen 50% del precio de venta => precioVenta = 10000 / (1-0.5) = 20000
  assert.ok(Math.abs(r.salePrice - 20000) < 0.01);
});

test('calculateBom: ignora cantidades o precios negativos en vez de restar del total', () => {
  const items = [{ qty: -5, price: 1000 }, { qty: 5, price: -1000 }, { qty: 5, price: 1000 }];
  const r = calculateBom(items, { waste: 0, indirect: 0, margin: 0 });
  assert.ok(Math.abs(r.directCost - 5000) < 0.01); // solo el tercer ítem cuenta
});

test('calculateBom: los porcentajes se limitan a rangos seguros (evita margen >= 100%)', () => {
  const items = [{ qty: 1, price: 1000 }];
  const r = calculateBom(items, { waste: 0, indirect: 0, margin: 150 }); // debe recortarse a 99.9
  assert.ok(Number.isFinite(r.salePrice));
  assert.ok(r.salePrice > 0);
});

test('formatCOP: formatea como pesos colombianos con separador de miles', () => {
  assert.equal(formatCOP(1000000), '$1.000.000');
});

test('DEFAULT_BOM_ITEMS: conserva los 9 ítems de dominio originales del negocio', () => {
  assert.equal(DEFAULT_BOM_ITEMS.length, 9);
  assert.ok(DEFAULT_BOM_ITEMS.every((it) => it.name && it.unit && it.price > 0));
});
