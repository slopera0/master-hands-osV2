// public/js/tone-generator.js
// Función pedida explícitamente en el "Análisis Crítico" del manual original:
// "Generador de Tonos y Barridos de Frecuencia (Web Audio API)" para pruebas rápidas
// de aislamiento en sitio directamente desde el navegador/tablet, sin instalar nada más.

let audioCtx = null;
let oscillator = null;
let noiseSource = null;
let gainNode = null;

function ctx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function ensureGain(volume) {
  const c = ctx();
  if (!gainNode) {
    gainNode = c.createGain();
    gainNode.connect(c.destination);
  }
  gainNode.gain.setValueAtTime(volume, c.currentTime);
  return gainNode;
}

export function isPlaying() { return Boolean(oscillator || noiseSource); }

export function playTone(freqHz, volume = 0.15) {
  stopAll();
  const c = ctx();
  const gain = ensureGain(volume);
  oscillator = c.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(freqHz, c.currentTime);
  oscillator.connect(gain);
  oscillator.start();
}

/** Barrido logarítmico de f1 a f2 en durationSec segundos. */
export function playSweep(f1, f2, durationSec, volume = 0.15) {
  stopAll();
  const c = ctx();
  const gain = ensureGain(volume);
  oscillator = c.createOscillator();
  oscillator.type = 'sine';
  const safeF1 = Math.max(1, f1);
  const safeF2 = Math.max(1, f2);
  oscillator.frequency.setValueAtTime(safeF1, c.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(safeF2, c.currentTime + durationSec);
  oscillator.connect(gain);
  oscillator.start();
  oscillator.stop(c.currentTime + durationSec);
  oscillator.onended = () => { oscillator = null; };
}

/** Ruido rosa (aproximación con el filtro de Paul Kellet) reproducido en bucle. */
export function playPinkNoise(volume = 0.12) {
  stopAll();
  const c = ctx();
  const gain = ensureGain(volume);
  const bufferSize = 2 * c.sampleRate;
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  noiseSource = c.createBufferSource();
  noiseSource.buffer = buffer;
  noiseSource.loop = true;
  noiseSource.connect(gain);
  noiseSource.start();
}

export function setVolume(volume) {
  if (gainNode) gainNode.gain.setValueAtTime(volume, ctx().currentTime);
}

export function stopAll() {
  if (oscillator) { try { oscillator.stop(); } catch { /* ya detenido */ } oscillator.disconnect(); oscillator = null; }
  if (noiseSource) { try { noiseSource.stop(); } catch { /* ya detenido */ } noiseSource.disconnect(); noiseSource = null; }
}
