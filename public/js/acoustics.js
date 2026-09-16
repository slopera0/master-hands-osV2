// public/js/acoustics.js
// PERSONA 5 (Dominio acústico): funciones puras, verificadas contra el sistema original.
// Se mantienen las mismas fórmulas (correctas) del sistema anterior, ahora aisladas
// para poder probarlas y reutilizarlas sin depender del DOM.

export const SPEED_OF_SOUND = 343; // m/s a ~20°C

/** Longitud de onda en metros dada una frecuencia en Hz. */
export function wavelength(freqHz) {
  if (!freqHz || freqHz <= 0) return 0;
  return SPEED_OF_SOUND / freqHz;
}

/** Frecuencia del primer modo axial para una dimensión en metros. */
export function axialMode(dimensionM) {
  if (!dimensionM || dimensionM <= 0) return 0;
  return SPEED_OF_SOUND / (2 * dimensionM);
}

/** RT60 por la fórmula de Sabine. volumeM3 en m³, absorptionSabines en sabines (m² * coeficiente). */
export function sabineRT60(volumeM3, absorptionSabines) {
  if (!absorptionSabines || absorptionSabines <= 0) return 0;
  return (0.161 * volumeM3) / absorptionSabines;
}

/** Geometría neta de la sala a partir de dimensiones y vacíos (puertas/ventanas/otros). */
export function roomGeometry({ L, W, H, doors = 0, windows = 0, other = 0 }) {
  const floorArea = L * W;
  const grossWalls = 2 * (L * H) + 2 * (W * H);
  const netWalls = Math.max(0, grossWalls - doors - windows - other);
  const volume = L * W * H;
  return { floorArea, grossWalls, netWalls, volume };
}

/**
 * Perfil de presión normalizado (0 a 1) del modo axial dominante a lo largo de un eje,
 * usado para colorear el piso en el visor 3D: p(x) ∝ cos(pi * x / L) al cuadrado (antinodo en paredes, nodo al centro para el 1er modo).
 * Esto es una simplificación pedagógica del modo (1,0,0), no una simulación FEM completa.
 */
export function pressureProfile1D(positionRatio) {
  // positionRatio: 0..1 a lo largo del eje
  const p = Math.cos(Math.PI * positionRatio);
  return p * p; // 0 en el centro (nodo), 1 en las paredes (antinodo) para el modo fundamental
}
