// public/js/three-scene.js
// PERSONA 3 (Frontend/3D): Three.js actualizado (r169, vía import map ESM, sin bundler)
// en lugar del r128 de 2021. Corrige la fuga de memoria del sistema anterior: cada vez
// que se reconstruye la sala se liberan explícitamente geometrías y materiales viejos
// (geometry.dispose()/material.dispose()), algo que el código original no hacía.
//
// También agrega lo que el propio manual pedía como "próxima versión": una
// visualización simplificada de nodos/antinodos de presión modal sobre el piso,
// basada en el perfil coseno del modo axial fundamental (ver acoustics.js).

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pressureProfile1D } from './acoustics.js';

let scene, camera, renderer, controls, roomGroup, pressureMesh, animId, hemiLight;
let currentDims = { L: 6, W: 4.5, H: 2.7 };
let showPressure = false;
let canvasEl;
let ready = false;
let theme = 'dark';

const THEMES = {
  dark: { bg: 0x0a0b0d, fog: 0x0a0b0d, wall: 0x2a2d33, floor: 0x1c1e24, hemiSky: 0x8f95a0, hemiGround: 0x1a1207 },
  light: { bg: 0xeceff2, fog: 0xeceff2, wall: 0xd7dbe0, floor: 0xc7ccd1, hemiSky: 0xffffff, hemiGround: 0x999999 },
};

function disposeObject3D(obj) {
  obj.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); });
    }
  });
}

export function initScene(canvas) {
  canvasEl = canvas;
  scene = new THREE.Scene();
  scene.background = new THREE.Color(THEMES[theme].bg);
  scene.fog = new THREE.Fog(THEMES[theme].fog, 12, 30);

  camera = new THREE.PerspectiveCamera(50, canvas.clientWidth / canvas.clientHeight || 1, 0.1, 100);
  camera.position.set(6, 5, 8);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  resizeRenderer();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.minDistance = 2;
  controls.maxDistance = 22;
  controls.target.set(0, 1.2, 0);

  hemiLight = new THREE.HemisphereLight(THEMES[theme].hemiSky, THEMES[theme].hemiGround, 0.9);
  scene.add(hemiLight);
  const key = new THREE.DirectionalLight(0xffe4c2, 1.1);
  key.position.set(5, 8, 4);
  scene.add(key);
  const rim = new THREE.PointLight(0xc8874a, 0.5, 20);
  rim.position.set(-4, 3, -4);
  scene.add(rim);

  roomGroup = new THREE.Group();
  scene.add(roomGroup);

  buildRoom(currentDims);

  window.addEventListener('resize', resizeRenderer);
  const ro = new ResizeObserver(() => resizeRenderer());
  ro.observe(canvas.parentElement);

  ready = true;
  animate();
}

function resizeRenderer() {
  if (!renderer || !canvasEl) return;
  const w = canvasEl.clientWidth || 800;
  const h = canvasEl.clientHeight || 480;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

function animate() {
  animId = requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

/** Reconstruye la sala liberando toda la geometría/material anterior (fix de fuga de memoria). */
export function buildRoom(dims) {
  currentDims = dims;
  if (!roomGroup) return;

  // Limpieza explícita: el sistema original solo hacía roomGroup.remove(child),
  // lo que deja geometrías y materiales huérfanos en memoria de la GPU.
  while (roomGroup.children.length) {
    const child = roomGroup.children.pop();
    disposeObject3D(child);
    roomGroup.remove(child);
  }
  pressureMesh = null;

  const { L, W, H } = dims;
  const wallMat = new THREE.MeshStandardMaterial({ color: THEMES[theme].wall, roughness: 0.85, metalness: 0.05, side: THREE.BackSide });
  const floorMat = new THREE.MeshStandardMaterial({ color: THEMES[theme].floor, roughness: 0.6, metalness: 0.1 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0xc8874a, roughness: 0.4, metalness: 0.6 });

  // Caja de la sala (interior visible con BackSide)
  const box = new THREE.Mesh(new THREE.BoxGeometry(L, H, W), wallMat);
  box.position.set(0, H / 2, 0);
  roomGroup.add(box);

  // Piso separado para poder pintarlo con el overlay de presión
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(L, W), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.01, 0);
  floor.name = 'floor';
  roomGroup.add(floor);

  // Pantalla frontal (bafle ciego)
  const screen = new THREE.Mesh(new THREE.BoxGeometry(L * 0.55, H * 0.55, 0.06), new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.2 }));
  screen.position.set(0, H * 0.5, -W / 2 + 0.05);
  roomGroup.add(screen);

  // Butacas simplificadas (2 filas)
  const seatGeo = new THREE.BoxGeometry(0.55, 0.9, 0.55);
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x3a2f28, roughness: 0.9 });
  const rows = 2, seatsPerRow = Math.max(2, Math.min(5, Math.round(L / 1.1)));
  for (let r = 0; r < rows; r++) {
    for (let s = 0; s < seatsPerRow; s++) {
      const seat = new THREE.Mesh(seatGeo, seatMat);
      const xOffset = (s - (seatsPerRow - 1) / 2) * 0.9;
      const zOffset = W / 2 - 1.0 - r * 1.1;
      seat.position.set(xOffset, 0.45, zOffset);
      roomGroup.add(seat);
    }
  }

  // Subwoofers en esquinas traseras (acento cobre)
  [-1, 1].forEach((side) => {
    const sub = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), accentMat);
    sub.position.set(side * (L / 2 - 0.4), 0.25, W / 2 - 0.4);
    roomGroup.add(sub);
  });

  if (showPressure) addPressureOverlay(dims);
}

/** Overlay pedagógico de nodos/antinodos del modo axial fundamental a lo largo de L. */
function addPressureOverlay(dims) {
  const { L, W } = dims;
  const segments = 40;
  const geo = new THREE.PlaneGeometry(L, W, segments, 1);
  const colors = [];
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); // -L/2..L/2
    const ratio = (x + L / 2) / L; // 0..1
    const p = pressureProfile1D(ratio); // 0 (nodo) .. 1 (antinodo)
    // Verdigris (baja presión) -> Cobre (alta presión)
    const c = new THREE.Color().lerpColors(new THREE.Color(0x5f9a8f), new THREE.Color(0xe0a468), p);
    colors.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.65 });
  pressureMesh = new THREE.Mesh(geo, mat);
  pressureMesh.rotation.x = -Math.PI / 2;
  pressureMesh.position.set(0, 0.02, 0);
  pressureMesh.name = 'pressureOverlay';
  roomGroup.add(pressureMesh);
}

export function togglePressureMode() {
  showPressure = !showPressure;
  buildRoom(currentDims);
  return showPressure;
}

export function setTheme(next) {
  theme = THEMES[next] ? next : 'dark';
  if (scene) {
    scene.background = new THREE.Color(THEMES[theme].bg);
    scene.fog = new THREE.Fog(THEMES[theme].fog, 12, 30);
  }
  if (hemiLight) {
    hemiLight.color.setHex(THEMES[theme].hemiSky);
    hemiLight.groundColor.setHex(THEMES[theme].hemiGround);
  }
  buildRoom(currentDims);
  return theme;
}

export function getTheme() { return theme; }

export function resetView() {
  if (!controls) return;
  camera.position.set(6, 5, 8);
  controls.target.set(0, 1.2, 0);
  controls.update();
}

export function capturePNG(filename = 'render_master_hands.png') {
  if (!renderer) return;
  renderer.render(scene, camera); // asegura el último frame antes de capturar
  const url = renderer.domElement.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
}

export function isReady() { return ready; }

/** Limpieza total (por si en el futuro se destruye y recrea el canvas). */
export function disposeScene() {
  if (animId) cancelAnimationFrame(animId);
  if (roomGroup) disposeObject3D(roomGroup);
  if (renderer) renderer.dispose();
  window.removeEventListener('resize', resizeRenderer);
  ready = false;
}
