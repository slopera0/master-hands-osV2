// tests/acoustics.test.mjs
// PERSONA 4 (QA): pruebas unitarias mínimas sobre las fórmulas de física acústica,
// para detectar regresiones si alguien las modifica sin darse cuenta del impacto.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wavelength, axialMode, sabineRT60, roomGeometry, pressureProfile1D } from '../public/js/acoustics.js';

test('wavelength: 343 Hz a nivel del mar produce 1 metro de longitud de onda', () => {
  assert.ok(Math.abs(wavelength(343) - 1) < 0.001);
});

test('wavelength: frecuencias graves (20 Hz) producen longitudes de onda largas', () => {
  const l = wavelength(20);
  assert.ok(l > 17 && l < 17.2, `esperado ~17.15m, obtuvo ${l}`);
});

test('wavelength: frecuencia 0 o negativa retorna 0 (evita división por cero)', () => {
  assert.equal(wavelength(0), 0);
  assert.equal(wavelength(-10), 0);
});

test('axialMode: sala de 6m de largo produce modo fundamental ~28.6 Hz', () => {
  const f = axialMode(6);
  assert.ok(Math.abs(f - 28.583) < 0.01, `esperado ~28.58 Hz, obtuvo ${f}`);
});

test('sabineRT60: volumen 0 produce RT60 0 sin lanzar error', () => {
  assert.equal(sabineRT60(0, 40), 0);
});

test('sabineRT60: a mayor absorción, menor RT60 (relación inversa)', () => {
  const rt60Low = sabineRT60(72, 20);
  const rt60High = sabineRT60(72, 80);
  assert.ok(rt60High < rt60Low);
});

test('sabineRT60: absorción 0 retorna 0 en vez de Infinity', () => {
  assert.equal(sabineRT60(72, 0), 0);
});

test('roomGeometry: sala 6x4.5x2.7 sin vacíos calcula volumen y áreas correctamente', () => {
  const geo = roomGeometry({ L: 6, W: 4.5, H: 2.7 });
  assert.ok(Math.abs(geo.volume - 72.9) < 0.01);
  assert.ok(Math.abs(geo.floorArea - 27) < 0.01);
  assert.equal(geo.netWalls, geo.grossWalls); // sin puertas/ventanas, neto = bruto
});

test('roomGeometry: el área neta nunca es negativa aunque los vacíos excedan el bruto', () => {
  const geo = roomGeometry({ L: 3, W: 3, H: 2.4, doors: 500, windows: 0, other: 0 });
  assert.equal(geo.netWalls, 0);
});

test('pressureProfile1D: antinodo (1.0) en las paredes, nodo (0.0) en el centro para el modo fundamental', () => {
  assert.ok(Math.abs(pressureProfile1D(0) - 1) < 1e-9);   // pared izquierda
  assert.ok(Math.abs(pressureProfile1D(1) - 1) < 1e-9);   // pared derecha
  assert.ok(Math.abs(pressureProfile1D(0.5) - 0) < 1e-9); // centro de la sala
});
