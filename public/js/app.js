// public/js/app.js
// Orquestador principal. Conecta store <-> DOM <-> API para todas las vistas.

import { api, onSyncChange, trySyncQueue } from './api.js';
import { store } from './state.js';
import { toast } from './toast.js';
import { DEFAULT_BOM_ITEMS, MATERIALS_CATALOG, calculateBom, formatCOP } from './bom.js';
import { wavelength, axialMode, sabineRT60, roomGeometry } from './acoustics.js';
import { validateDimensionsForm, isValidEmail, setFieldError } from './validation.js';
import { signatureProposalTemplate, contractTemplate, geminiPreset } from './documents.js';
import { renderInsights } from './insights-view.js';
import { renderSystemStatus, wireBackupButton } from './system-view.js';
import * as Scene3D from './three-scene.js';
import * as Sig from './signature.js';
import { exportDocumentToPdf, getDocumentPdfBase64 } from './pdf-export.js';
import { checkAuthStatus, getCurrentUser, renderAuthScreen, logout } from './auth-view.js';
import { renderUsers, wireNewUserForm } from './users-view.js';
import { renderAccount } from './account-view.js';
import { initRealtime } from './realtime.js';
import * as Tones from './tone-generator.js';

let currentUser = null;

/* ============================== NAVEGACIÓN ============================== */

const NAV_ITEMS = [
  { section: 'Proyecto' },
  { id: 'projects', label: 'Proyectos', icon: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z', global: true },
  { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2 4 4 8-8 4 4' },
  { id: 'project', label: 'Proyecto & Intake', icon: 'M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2' },
  { id: 'site', label: 'Visita & Sitio', icon: 'M12 21c-4.5-4.5-8-8.14-8-11.5A8 8 0 0 1 20 9.5c0 3.36-3.5 7-8 11.5z' },
  { section: 'Ingeniería' },
  { id: '3d', label: 'Simulador 3D', icon: 'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z' },
  { id: 'calculator', label: 'Calculadora Física', icon: 'M9 7h6M9 11h6M9 15h3M4 4h16v16H4z' },
  { id: 'tones', label: 'Generador de Tonos', icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z' },
  { id: 'estimator', label: 'Estimador BOM', icon: 'M3 3v18h18M7 15l3-3 4 4 5-6' },
  { section: 'Comercial' },
  { id: 'files', label: 'Bóveda de Archivos', icon: 'M21 8V7l-3-4H6L3 7v1M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' },
  { id: 'proposal', label: 'Propuesta & Contrato', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5z' },
  { id: 'providers', label: 'Proveedores', icon: 'M20 7h-9M14 17H5M17 4l3 3-3 3M7 14l-3 3 3 3' },
  { section: 'Sistema' },
  { id: 'insights', label: 'Aprendizaje del Negocio', icon: 'M3 3v18h18M18 17V9M13 17V5M8 17v-4', global: true },
  { id: 'users', label: 'Usuarios', icon: 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', global: true, roles: ['admin'] },
  { id: 'system', label: 'Estado del Sistema', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', global: true, roles: ['admin'] },
  { id: 'account', label: 'Mi Cuenta', icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z', global: true },
];

const VIEW_META = {
  projects: { title: 'Proyectos', subtitle: 'Selecciona o crea un proyecto para comenzar.' },
  dashboard: { title: 'Dashboard', subtitle: 'Centro de control del proyecto activo.' },
  project: { title: 'Proyecto & Intake', subtitle: 'Ficha maestra del cliente y checklist de insumos.' },
  site: { title: 'Visita & Sitio', subtitle: 'Levantamiento físico del recinto y checklist de visita.' },
  '3d': { title: 'Simulador 3D', subtitle: 'Visualización interactiva de la sala.' },
  calculator: { title: 'Calculadora Física', subtitle: 'Longitud de onda, modos axiales y RT60.' },
  tones: { title: 'Generador de Tonos', subtitle: 'Tono puro, barrido de frecuencia y ruido rosa para pruebas rápidas en sitio.' },
  estimator: { title: 'Estimador BOM', subtitle: 'Matriz paramétrica de cantidades y costos.' },
  files: { title: 'Bóveda de Archivos', subtitle: 'Fotos, planos y documentos del proyecto.' },
  proposal: { title: 'Propuesta & Contrato', subtitle: 'Editor de documentos y firma electrónica.' },
  providers: { title: 'Proveedores', subtitle: 'Directorio homologado en Medellín.' },
  insights: { title: 'Aprendizaje del Negocio', subtitle: 'Patrones agregados de tus cotizaciones reales.' },
  users: { title: 'Usuarios', subtitle: 'Gestión de accesos y roles del equipo.' },
  system: { title: 'Estado del Sistema', subtitle: 'Salud del servidor, integraciones, respaldos y log de errores.' },
  account: { title: 'Mi Cuenta', subtitle: 'Contraseña y sesiones activas.' },
};

let currentView = 'projects';
let bomEditingLock = false;

function renderNav() {
  const nav = document.getElementById('navigation');
  nav.innerHTML = '';
  NAV_ITEMS.forEach((item) => {
    if (item.roles && !item.roles.includes(currentUser?.role)) return; // ocultar ítems fuera del rol
    if (item.section) {
      const label = document.createElement('div');
      label.className = 'nav-section-label';
      label.textContent = item.section;
      nav.appendChild(label);
      return;
    }
    const btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.dataset.view = item.id;
    btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="${item.icon}"/></svg><span>${item.label}</span>`;
    btn.addEventListener('click', () => switchView(item.id));
    nav.appendChild(btn);
  });
}

function switchView(viewId) {
  if (!store.project && !['projects', 'insights', 'system'].includes(viewId)) {
    toast('Primero selecciona o crea un proyecto.', 'error');
    viewId = 'projects';
  }
  currentView = viewId;
  document.querySelectorAll('.view-panel').forEach((el) => el.classList.remove('active'));
  document.getElementById(`view-${viewId}`)?.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.view === viewId));
  const meta = VIEW_META[viewId] || {};
  document.getElementById('viewHeading').textContent = meta.title || '';
  document.getElementById('viewSubtitle').textContent = meta.subtitle || '';
  document.getElementById('mobileViewHeading').textContent = meta.title || '';
  document.getElementById('topbarActions').style.display = viewId === 'projects' ? 'none' : 'flex';
  closeMobileDrawer();

  if (viewId === '3d') initOrResize3D();
  if (viewId === 'insights') renderInsights();
  if (viewId === 'system') renderSystemStatus();
  if (viewId === 'files') loadFiles();
  if (viewId === 'users') renderUsers(document.getElementById('usersListContainer'), currentUser?.id);
  if (viewId === 'account') renderAccount(document.getElementById('accountContainer'));
  if (viewId === 'tones') Tones.stopAll();
  if (viewId === 'proposal') {
    if (!Sig._initialized) { Sig.initSignaturePad(document.getElementById('signaturePad')); Sig._initialized = true; }
    if (store.project?.signatureData?.dataUrl) Sig.loadSignatureDataUrl(store.project.signatureData.dataUrl);
    if (store.project?.client?.name) document.getElementById('signerName').value = document.getElementById('signerName').value || store.project.client.name;
    updateSignatureStatus();
  }
}

/* ============================== PROYECTOS (lista) ============================== */

let allProjectsCache = [];

async function loadProjectList() {
  const container = document.getElementById('projectListContainer');
  container.innerHTML = '<div class="empty-state">Cargando proyectos…</div>';
  try {
    const { projects } = await api.listProjects();
    allProjectsCache = projects;
    renderFilteredProjectList();
  } catch (err) {
    container.innerHTML = `<div class="empty-state">No se pudo conectar con el servidor local (${err.message}). Verifica que "npm start" siga corriendo en la terminal.</div>`;
  }
}

function renderFilteredProjectList() {
  const container = document.getElementById('projectListContainer');
  const query = (document.getElementById('projectSearchInput')?.value || '').trim().toLowerCase();
  const statusFilter = document.getElementById('projectStatusFilter')?.value || '';

  const filtered = allProjectsCache.filter((p) => {
    const matchesQuery = !query || [p.name, p.client_name, p.code, p.city].some((f) => (f || '').toLowerCase().includes(query));
    const matchesStatus = !statusFilter || p.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  if (!allProjectsCache.length) {
    container.innerHTML = '<div class="empty-state">Aún no tienes proyectos. Crea el primero con el botón de arriba.</div>';
    return;
  }
  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state">Ningún proyecto coincide con la búsqueda o el filtro.</div>';
    return;
  }

  container.innerHTML = '';
  filtered.forEach((p) => {
    const el = document.createElement('div');
    el.className = 'project-list-item';
    el.innerHTML = `
      <div class="info">
        <h4>${escapeHtml(p.name || '(Sin nombre)')} <span class="badge badge-neutral">${escapeHtml(p.code || '')}</span></h4>
        <p>${escapeHtml(p.client_name || 'Sin cliente')} · ${escapeHtml(p.city || '')} · ${escapeHtml(p.project_type || '')}</p>
      </div>
      <div class="actions">
        <span class="badge ${statusBadgeClass(p.status)}">${statusLabel(p.status)}</span>
        <button class="btn btn-sm btn-danger" data-del="${p.id}">Eliminar</button>
      </div>`;
    el.addEventListener('click', (e) => { if (!e.target.closest('[data-del]')) openProject(p.id); });
    el.querySelector('[data-del]').addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`¿Eliminar "${p.name}"? Esta acción no se puede deshacer.`)) return;
      try { await api.deleteProject(p.id); toast('Proyecto eliminado.', 'success'); loadProjectList(); }
      catch (err) { toast(`No se pudo eliminar: ${err.message}`, 'error'); }
    });
    container.appendChild(el);
  });
}

async function openProject(id) {
  try {
    await store.load(id);
    localStorage.setItem('mh_last_project', id);
    document.getElementById('activeProjectName').textContent = store.project.name || '(Sin nombre)';
    populateAllFields();
    switchView('dashboard');
  } catch (err) {
    toast(`No se pudo abrir el proyecto: ${err.message}`, 'error');
  }
}

async function createProject(name, clientName) {
  const payload = {
    name: name || 'Nuevo Proyecto Acústico',
    client: { name: clientName || '' },
    city: 'Medellín',
    projectType: 'Home Theater Dedicado (Dolby Atmos)',
    dimensions: { L: 6.0, W: 4.5, H: 2.7, doors: 1.8, windows: 3.0, other: 0 },
    params: { waste: 10, indirect: 10, margin: 35 },
    bom: DEFAULT_BOM_ITEMS,
    docs: {}, site: {},
  };
  const { project } = await api.createProject(payload);
  return project;
}

function statusLabel(s) {
  return { prospecto: 'Prospecto', cotizado: 'Cotizado', aprobado: 'Aprobado', en_obra: 'En obra', entregado: 'Entregado' }[s] || s || 'Prospecto';
}
function statusBadgeClass(s) {
  return { prospecto: 'badge-neutral', cotizado: 'badge-warn', aprobado: 'badge-ok', en_obra: 'badge-warn', entregado: 'badge-ok' }[s] || 'badge-neutral';
}

/* ============================== BINDING GENÉRICO ============================== */

function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }

function attachGenericBindings() {
  document.querySelectorAll('[data-bind]').forEach((el) => {
    const path = el.dataset.bind;
    const evt = (el.type === 'checkbox' || el.tagName === 'SELECT') ? 'change' : 'input';
    el.addEventListener(evt, () => {
      const value = el.type === 'checkbox' ? el.checked : el.value;
      store.set(path, value);
      if (path === 'client.email') {
        const errorEl = document.querySelector('[data-error-for="client.email"]');
        setFieldError(el, errorEl, isValidEmail(value) ? '' : 'Correo con formato inválido.');
      }
    });
  });
}

function populateBoundFields() {
  if (!store.project) return;
  document.querySelectorAll('[data-bind]').forEach((el) => {
    const value = getPath(store.project, el.dataset.bind);
    if (el.type === 'checkbox') el.checked = Boolean(value);
    else el.value = value ?? '';
  });
}

/* ============================== VISITA / GEOMETRÍA ============================== */

function readDimsFromForm() {
  return {
    L: parseFloat(document.getElementById('dimL').value),
    W: parseFloat(document.getElementById('dimW').value),
    H: parseFloat(document.getElementById('dimH').value),
    doors: parseFloat(document.getElementById('areaDoors').value) || 0,
    windows: parseFloat(document.getElementById('areaWindows').value) || 0,
    other: parseFloat(document.getElementById('areaOther').value) || 0,
  };
}

function populateDimsForm() {
  const d = store.project?.dimensions || {};
  document.getElementById('dimL').value = d.L ?? 6;
  document.getElementById('dimW').value = d.W ?? 4.5;
  document.getElementById('dimH').value = d.H ?? 2.7;
  document.getElementById('areaDoors').value = d.doors ?? 0;
  document.getElementById('areaWindows').value = d.windows ?? 0;
  document.getElementById('areaOther').value = d.other ?? 0;
}

function recalcGeometry({ persist = true } = {}) {
  const dims = readDimsFromForm();
  const errors = validateDimensionsForm(dims);
  const errorBox = document.getElementById('dimError');
  ['dimL', 'dimW', 'dimH'].forEach((id) => document.getElementById(id).removeAttribute('aria-invalid'));

  if (errors.length) {
    errorBox.textContent = errors.join(' ');
    ['dimL', 'dimW', 'dimH'].forEach((id) => document.getElementById(id).setAttribute('aria-invalid', 'true'));
    return null;
  }
  errorBox.textContent = '';

  const geo = roomGeometry(dims);
  document.getElementById('calcFloorArea').textContent = geo.floorArea.toFixed(2);
  document.getElementById('calcGrossWalls').textContent = geo.grossWalls.toFixed(2);
  document.getElementById('calcRoomVol').textContent = geo.volume.toFixed(2);
  document.getElementById('calcNetWalls').textContent = geo.netWalls.toFixed(2);
  document.getElementById('calcSabineVol').value = geo.volume.toFixed(2);

  if (persist && store.project) {
    store.set('dimensions', dims);
  }

  recalcModes(dims);
  recalcSabine(geo.volume);
  recalcDashboard(dims, geo);
  updateWaveDivider(dims);
  debounce3DUpdate(dims);
  return { dims, geo };
}

function recalcModes(dims) {
  document.getElementById('calcModeL').textContent = axialMode(dims.L).toFixed(1) + ' Hz';
  document.getElementById('calcModeW').textContent = axialMode(dims.W).toFixed(1) + ' Hz';
  document.getElementById('calcModeH').textContent = axialMode(dims.H).toFixed(1) + ' Hz';
}

function recalcSabine(volume) {
  const sabines = parseFloat(document.getElementById('calcSabinesInput').value) || 0;
  const rt60 = sabineRT60(volume, sabines);
  document.getElementById('calcRT60Result').value = rt60 ? rt60.toFixed(3) + ' s' : '—';
}

function recalcLambda() {
  const f = parseFloat(document.getElementById('calcFreqInput').value) || 0;
  document.getElementById('calcLambdaResult').textContent = f > 0 ? wavelength(f).toFixed(2) + ' m' : '—';
}

/* ============================== BOM / ESTIMADOR ============================== */

function populateBomForm() {
  const p = store.project?.params || {};
  document.getElementById('paramWaste').value = p.waste ?? 10;
  document.getElementById('paramIndirect').value = p.indirect ?? 10;
  document.getElementById('paramMargin').value = p.margin ?? 35;
  renderBomTable();
}

function renderBomTable() {
  const tbody = document.getElementById('bomTableBody');
  const items = store.project?.bom || [];
  tbody.innerHTML = items.map((it, idx) => `
    <tr data-idx="${idx}">
      <td><input class="bom-name" autocomplete="off" value="${escapeAttr(it.name)}"></td>
      <td><input class="bom-qty numeric" type="number" autocomplete="off" min="0" step="0.1" value="${it.qty}" style="width:70px;"></td>
      <td><input class="bom-unit" autocomplete="off" value="${escapeAttr(it.unit)}" style="width:56px;"></td>
      <td><input class="bom-price numeric" type="number" autocomplete="off" min="0" step="1000" value="${it.price}"></td>
      <td class="numeric bom-waste-cell">—</td>
      <td class="numeric bom-subtotal-cell">—</td>
      <td><button class="btn btn-sm btn-danger bom-del">✕</button></td>
    </tr>`).join('');

  tbody.querySelectorAll('tr').forEach((row) => {
    const idx = parseInt(row.dataset.idx, 10);
    row.querySelector('.bom-name').addEventListener('input', (e) => updateBomItem(idx, 'name', e.target.value));
    row.querySelector('.bom-qty').addEventListener('input', (e) => updateBomItem(idx, 'qty', parseFloat(e.target.value) || 0));
    row.querySelector('.bom-unit').addEventListener('input', (e) => updateBomItem(idx, 'unit', e.target.value));
    row.querySelector('.bom-price').addEventListener('input', (e) => updateBomItem(idx, 'price', parseFloat(e.target.value) || 0));
    row.querySelector('.bom-del').addEventListener('click', () => removeBomItem(idx));
  });

  recalcBomTotals();
}

function updateBomItem(idx, field, value) {
  if (!store.project) return;
  store.project.bom[idx][field] = value;
  recalcBomTotals();
  store.scheduleSave();
}

function removeBomItem(idx) {
  store.project.bom.splice(idx, 1);
  renderBomTable();
  store.scheduleSave();
}

function addBomItem() {
  if (!store.project) return;
  store.project.bom.push({ name: 'Nuevo elemento acústico / servicio', qty: 1, unit: 'und', price: 0 });
  renderBomTable();
  store.scheduleSave();
}

function renderCatalog() {
  const container = document.getElementById('catalogContainer');
  container.innerHTML = MATERIALS_CATALOG.map((cat, ci) => `
    <div style="margin-bottom:16px;">
      <div class="nav-section-label" style="padding-left:0;">${escapeHtml(cat.category)}</div>
      <div style="display:grid; gap:6px; margin-top:6px;">
        ${cat.items.map((it, ii) => `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; padding:8px 10px; background:var(--graphite-800); border-radius:8px;">
            <div style="font-size:12.5px;">${escapeHtml(it.name)}<br><span style="color:var(--text-low); font-size:10.5px;">${escapeHtml(it.unit)} · ${formatCOP(it.price)}</span></div>
            <button class="btn btn-sm btn-primary" data-cat="${ci}" data-item="${ii}">+</button>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const item = MATERIALS_CATALOG[btn.dataset.cat].items[btn.dataset.item];
      if (!store.project) return;
      store.project.bom.push({ name: item.name, qty: 1, unit: item.unit, price: item.price });
      renderBomTable();
      store.scheduleSave();
      toast(`"${item.name}" agregado a la BOM.`, 'success');
    });
  });
}

function currentParams() {
  return {
    waste: parseFloat(document.getElementById('paramWaste').value) || 0,
    indirect: parseFloat(document.getElementById('paramIndirect').value) || 0,
    margin: parseFloat(document.getElementById('paramMargin').value) || 0,
  };
}

function recalcBomTotals() {
  if (!store.project) return;
  const items = store.project.bom || [];
  const params = currentParams();
  const result = calculateBom(items, params);

  document.querySelectorAll('#bomTableBody tr').forEach((row, i) => {
    const raw = Math.max(0, items[i].qty) * Math.max(0, items[i].price);
    row.querySelector('.bom-waste-cell').textContent = `${params.waste}%`;
    row.querySelector('.bom-subtotal-cell').textContent = formatCOP(raw);
  });

  document.getElementById('bomDirectCost').textContent = formatCOP(result.directCost);
  document.getElementById('bomIndirectCost').textContent = formatCOP(result.indirectCost);
  document.getElementById('bomFinalSalePrice').textContent = formatCOP(result.salePrice);

  document.getElementById('kpiSalePrice').textContent = formatCOP(result.salePrice);

  if (store.project) {
    store.project.params = params;
    store.project.salePrice = result.salePrice; // usado por el snapshot de insights en el backend
  }
  return result;
}

function persistBomParams() {
  store.scheduleSave();
}

/* ============================== DASHBOARD ============================== */

function recalcDashboard(dims, geo) {
  document.getElementById('kpiProjectName').textContent = store.project?.name || '—';
  document.getElementById('kpiTotalArea').innerHTML = `${geo.floorArea.toFixed(1)} <small>m²</small>`;
  document.getElementById('kpiTotalVol').innerHTML = `${geo.volume.toFixed(1)} <small>m³</small>`;
  renderStatusPipeline();
  renderDashboardAlerts(dims, geo);
}

function renderStatusPipeline() {
  const wrap = document.getElementById('statusPipeline');
  const statuses = ['prospecto', 'cotizado', 'aprobado', 'en_obra', 'entregado'];
  wrap.innerHTML = statuses.map((s) => `<button class="status-pill ${store.project?.status === s ? 'active' : ''}" data-status="${s}">${statusLabel(s)}</button>`).join('');
  wrap.querySelectorAll('[data-status]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.set('status', btn.dataset.status);
      renderStatusPipeline();
      toast(`Estado actualizado a "${statusLabel(btn.dataset.status)}".`, 'success');
    });
  });
}

function renderDashboardAlerts(dims, geo) {
  const box = document.getElementById('dashboardAlerts');
  const alerts = [];

  if (geo.netWalls < geo.grossWalls * 0.4) {
    alerts.push({ level: 'danger', text: 'El área de puertas/ventanas/vacíos supera el 60% de los muros brutos. Verifica las medidas antes de cotizar.' });
  }
  const params = store.project?.params || {};
  if ((params.margin || 0) < 15) {
    alerts.push({ level: 'warn', text: 'El margen comercial configurado es menor al 15%. Revisa la rentabilidad del proyecto.' });
  }
  const items = store.project?.bom || [];
  if (items.some((it) => !it.price || it.price <= 0)) {
    alerts.push({ level: 'warn', text: 'Hay ítems de la BOM sin costo unitario definido.' });
  }
  if (store.project?.client?.email && !isValidEmail(store.project.client.email)) {
    alerts.push({ level: 'warn', text: 'El correo del cliente tiene un formato inválido; el envío de propuesta fallará.' });
  }
  if (store.project?.status === 'en_obra' && !store.project?.signatureData) {
    alerts.push({ level: 'danger', text: 'El proyecto está "En obra" pero el contrato no tiene firma electrónica registrada.' });
  }
  const modeL = axialMode(dims.L), modeW = axialMode(dims.W);
  if (Math.abs(modeL - modeW) < 3) {
    alerts.push({ level: 'warn', text: `Los modos axiales de Largo (${modeL.toFixed(1)} Hz) y Ancho (${modeW.toFixed(1)} Hz) están muy cerca: riesgo de coloración de bajos. Considera ajustar proporciones o tratamiento bass-trap.` });
  }

  box.innerHTML = alerts.length
    ? alerts.map((a) => `<div class="callout ${a.level === 'danger' ? 'callout-danger' : 'callout-warn'}">${a.text}</div>`).join('')
    : '<div class="callout" style="border-left-color:var(--success);">Sin alertas activas. Geometría y parámetros dentro de rangos esperados.</div>';
}

/* ============================== ONDA DE FRECUENCIA (elemento de firma) ============================== */

function updateWaveDivider(dims) {
  const el = document.getElementById('waveDivider');
  if (!el) return;
  const modes = [axialMode(dims.L), axialMode(dims.W), axialMode(dims.H)];
  const maxF = Math.max(...modes, 1);
  const width = 600, height = 30, N = 140;
  let d = '';
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = t * width;
    let y = 0;
    modes.forEach((f, idx) => { y += Math.sin(t * Math.PI * 2 * (1 + idx) * (0.4 + f / maxF)) * (7 / (idx + 1)); });
    d += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${(height / 2 - y).toFixed(1)} `;
  }
  el.innerHTML = `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="var(--copper)" stroke-width="1.3"/></svg>`;
}

/* ============================== 3D ============================== */

let sceneInitStarted = false;
let debounce3DTimer = null;

function initOrResize3D() {
  const canvas = document.getElementById('canvas3D');
  const loading = document.getElementById('canvas3DLoading');
  if (!sceneInitStarted) {
    sceneInitStarted = true;
    try {
      Scene3D.initScene(canvas);
      loading.classList.add('hide');
    } catch (err) {
      loading.innerHTML = `Error al iniciar el motor 3D: ${err.message}`;
    }
  }
  if (store.project?.dimensions) Scene3D.buildRoom(store.project.dimensions);
}

function debounce3DUpdate(dims) {
  clearTimeout(debounce3DTimer);
  debounce3DTimer = setTimeout(() => { if (Scene3D.isReady()) Scene3D.buildRoom(dims); }, 200);
}

/* ============================== ARCHIVOS ============================== */

async function loadFiles() {
  const grid = document.getElementById('fileGrid');
  if (!store.project) return;
  grid.innerHTML = '<div class="empty-state">Cargando…</div>';
  try {
    const { files } = await api.listFiles(store.project.id);
    grid.innerHTML = files.length ? '' : '<div class="empty-state">Aún no hay archivos en la bóveda de este proyecto.</div>';
    files.forEach((f) => {
      const card = document.createElement('div');
      card.className = 'file-card';
      const isImg = (f.mime_type || '').startsWith('image/');
      card.innerHTML = `
        <div class="file-preview">${isImg ? `<img src="/api/files/file/${f.id}/thumbnail" loading="lazy" alt="">` : '📄'}</div>
        <div class="file-name" title="${escapeAttr(f.name)}">${escapeHtml(f.name)}</div>
        <div class="file-meta">${(f.size_bytes / 1024).toFixed(0)} KB</div>
        <div style="display:flex; gap:6px;">
          <a class="btn btn-sm" style="flex:1; text-align:center;" href="/api/files/file/${f.id}/download" download>Descargar</a>
          <button class="btn btn-sm btn-danger" data-del-file="${f.id}">✕</button>
        </div>`;
      card.querySelector('[data-del-file]').addEventListener('click', async () => {
        try { await api.deleteFile(f.id); loadFiles(); } catch (err) { toast(err.message, 'error'); }
      });
      grid.appendChild(card);
    });
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Error al cargar archivos: ${err.message}</div>`;
  }
}

async function handleFileUpload(fileList) {
  if (!store.project || !fileList.length) return;
  try {
    await api.uploadFiles(store.project.id, fileList);
    toast('Archivo(s) subido(s) correctamente.', 'success');
    loadFiles();
  } catch (err) {
    toast(`Error al subir: ${err.message}`, 'error');
  }
}

/* ============================== PROPUESTA / DOCUMENTO / FIRMA ============================== */

const LEGAL_SIGNATURE_NOTICE = 'Aviso legal: esta firma queda registrada con nombre, cédula, dirección IP, fecha/hora del servidor y un hash del documento firmado (para detectar si el texto cambió después de firmarlo). Es una evidencia electrónica razonable de consentimiento, pero no es una firma digital certificada bajo la Ley 527 de 1999 (esa certificación requiere un proveedor autorizado como DocuSign o SignWell).';

/**
 * Construye, fuera de pantalla, una versión completa del documento (contenido + bloque
 * de firma + aviso legal) para exportar a PDF o adjuntar por email. El editor en pantalla
 * (documentPaper) no incluye la firma ni el aviso — por eso el PDF anterior salía incompleto.
 */
function buildExportablePaper() {
  const paper = document.getElementById('documentPaper');
  const sig = store.project?.signatureData;

  const wrapper = document.createElement('div');
  wrapper.className = 'doc-paper';
  wrapper.style.cssText = 'position:fixed; left:-9999px; top:0; width:700px;';
  wrapper.innerHTML = paper.innerHTML;

  if (sig?.signedAt) {
    const block = document.createElement('div');
    block.style.cssText = 'margin-top:32px; padding-top:20px; border-top:1px solid #ccc;';
    block.innerHTML = `
      <h3 style="margin-bottom:10px;">Firma electrónica</h3>
      <img src="${sig.dataUrl}" style="max-width:280px; border:1px solid #999; background:#fff; display:block; margin-bottom:8px;">
      <p style="margin:2px 0;"><strong>Firmado por:</strong> ${escapeHtml(sig.signerName)}${sig.signerId ? ' · C.C. ' + escapeHtml(sig.signerId) : ''}</p>
      <p style="margin:2px 0;"><strong>Fecha:</strong> ${new Date(sig.signedAt).toLocaleString('es-CO')}</p>
      <p style="margin:12px 0 0; font-size:10.5px; color:#666; line-height:1.5;">${LEGAL_SIGNATURE_NOTICE}</p>
    `;
    wrapper.appendChild(block);
  }

  document.body.appendChild(wrapper);
  return wrapper;
}

function populateDocumentPaper() {
  const paper = document.getElementById('documentPaper');
  paper.innerHTML = store.project?.proposalHtml || '<p style="color:#888;">Usa las plantillas de arriba o escribe la propuesta libremente.</p>';
}

function saveDocumentPaper() {
  const paper = document.getElementById('documentPaper');
  store.set('proposalHtml', paper.innerHTML);
}

function updateSignatureStatus() {
  const box = document.getElementById('signatureStatus');
  const sig = store.project?.signatureData;
  if (sig?.signedAt) {
    box.innerHTML = `<span class="badge badge-ok">Firmado</span> por ${escapeHtml(sig.signerName)} el ${new Date(sig.signedAt).toLocaleString('es-CO')}<br><span style="font-size:10.5px; color:var(--text-low);">IP ${escapeHtml(sig.ip || '—')} · hash ${escapeHtml((sig.docHash || '').slice(0, 12))}…</span>`;
  } else {
    box.innerHTML = '<span class="badge badge-neutral">Sin firmar</span>';
  }
}

/* ============================== GEMINI COPILOT ============================== */

function localGeminiFallback(promptText) {
  const d = store.project?.dimensions || { L: 6, W: 4.5, H: 2.7 };
  const vol = (d.L * d.W * d.H).toFixed(1);
  return `[MODO ASISTENTE LOCAL MASTER HANDS — sin GEMINI_API_KEY configurada en el servidor]

Dictamen para ${store.project?.name || 'Proyecto'}:
Con dimensiones de ${d.L}m x ${d.W}m x ${d.H}m (Volumen: ${vol} m³), los modos axiales primarios se ubican en ${axialMode(d.L).toFixed(1)} Hz (Largo) y ${axialMode(d.W).toFixed(1)} Hz (Ancho).

Recomendación de Ingeniería:
1. Desacoplamiento obligatorio de subwoofers con plataforma flotante (Sylomer) para evitar inyección a losa.
2. Instalar Baffle Boxes en inyección y retorno HVAC para mantener ruido de fondo ≤ NC-22.
3. Aplicar doble placa de yeso 15.9mm con membrana viscoelástica para amortiguar coincidencia modal.

(Consulta original: "${promptText}". Configura GEMINI_API_KEY en el archivo .env del servidor para respuestas generadas por IA sobre esta consulta específica.)`;
}

async function runGemini() {
  const promptText = document.getElementById('geminiPrompt').value.trim();
  const responseBox = document.getElementById('geminiResponse');
  if (!promptText) { responseBox.value = 'Por favor escribe una consulta o selecciona una plantilla.'; return; }

  responseBox.value = 'Consultando…';
  const d = store.project?.dimensions || {};
  const fullPrompt = `Eres el Asistente Experto de Ingeniería Acústica de MASTER HANDS (Medellín, Colombia). Contexto del Proyecto: Dimensiones ${d.L}x${d.W}x${d.H}m. Cliente: ${store.project?.client?.name || ''}. Consulta: ${promptText}`;

  try {
    const res = await api.askGemini(fullPrompt);
    responseBox.value = res.source === 'local' ? localGeminiFallback(promptText) : res.text;
  } catch (err) {
    responseBox.value = `Error al consultar el Copiloto: ${err.message}`;
  }
}

/* ============================== EMAIL ============================== */

async function openEmailModal() {
  document.getElementById('emailTo').value = store.project?.client?.email || '';
  try {
    const { status } = await api.systemStatus();
    document.getElementById('emailConfigNotice').style.display = status.emailConfigured ? 'none' : 'block';
  } catch { /* si falla el chequeo, se intenta igual al enviar */ }
  document.getElementById('emailModal').classList.add('show');
}

async function confirmSendEmail() {
  const to = document.getElementById('emailTo').value.trim();
  if (!isValidEmail(to) || !to) { toast('Correo de destino inválido.', 'error'); return; }
  const btn = document.getElementById('btnConfirmSendEmail');
  btn.disabled = true; btn.textContent = 'Generando PDF y enviando…';
  try {
    const exportEl = buildExportablePaper();
    const pdfBase64 = await getDocumentPdfBase64(exportEl);
    exportEl.remove();
    await api.sendEmail({
      projectId: store.project.id,
      to,
      subject: document.getElementById('emailSubject').value,
      message: document.getElementById('emailMessage').value,
      pdfBase64,
      fileName: `Propuesta_${(store.project.name || 'MasterHands').replace(/\s+/g, '_')}.pdf`,
    });
    toast('Correo enviado correctamente.', 'success');
    document.getElementById('emailModal').classList.remove('show');
  } catch (err) {
    toast(`No se pudo enviar: ${err.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = 'Adjuntar PDF y enviar';
  }
}

/* ============================== POBLAR TODO AL ABRIR PROYECTO ============================== */

function populateAllFields() {
  populateBoundFields();
  populateDimsForm();
  populateBomForm();
  populateDocumentPaper();
  recalcGeometry({ persist: false });
  recalcLambda();
  document.getElementById('stdFolderPath').value = `/Proyectos/${(store.project.code || 'MH-XXXX')}_${(store.project.client?.name || 'Cliente').replace(/\s+/g, '_')}/`;
}

/* ============================== UTILIDADES ============================== */

function escapeHtml(str) { return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function escapeAttr(str) { return escapeHtml(str).replace(/`/g, '&#96;'); }

/* ============================== INIT ============================== */

function wireStaticEvents() {
  document.getElementById('btnNewProject').addEventListener('click', () => document.getElementById('newProjectModal').classList.add('show'));
  document.getElementById('projectSearchInput').addEventListener('input', renderFilteredProjectList);
  document.getElementById('projectStatusFilter').addEventListener('change', renderFilteredProjectList);
  document.getElementById('btnSwitchProject').addEventListener('click', () => { switchView('projects'); loadProjectList(); });
  document.getElementById('btnCloseNewProject').addEventListener('click', () => document.getElementById('newProjectModal').classList.remove('show'));
  document.getElementById('btnConfirmNewProject').addEventListener('click', async () => {
    const name = document.getElementById('npName').value.trim();
    const client = document.getElementById('npClient').value.trim();
    try {
      const project = await createProject(name, client);
      document.getElementById('newProjectModal').classList.remove('show');
      document.getElementById('npName').value = ''; document.getElementById('npClient').value = '';
      toast('Proyecto creado.', 'success');
      openProject(project.id);
    } catch (err) { toast(`No se pudo crear el proyecto: ${err.message}`, 'error'); }
  });

  document.getElementById('btnSaveNow').addEventListener('click', async () => {
    if (!store.project) return;
    saveDocumentPaper();
    await store.saveNow();
    toast('Proyecto guardado.', 'success');
  });
  document.getElementById('btnPrint').addEventListener('click', () => window.print());

  // Geometría / visita
  ['dimL', 'dimW', 'dimH', 'areaDoors', 'areaWindows', 'areaOther'].forEach((id) => {
    document.getElementById(id).addEventListener('input', () => recalcGeometry());
  });
  document.getElementById('calcFreqInput').addEventListener('input', recalcLambda);
  document.getElementById('calcSabinesInput').addEventListener('input', () => {
    const vol = parseFloat(document.getElementById('calcSabineVol').value) || 0;
    recalcSabine(vol);
  });

  // BOM
  document.getElementById('btnAddBom').addEventListener('click', addBomItem);
  document.getElementById('btnOpenCatalog').addEventListener('click', () => { renderCatalog(); document.getElementById('catalogModal').classList.add('show'); });
  document.getElementById('btnCloseCatalog').addEventListener('click', () => document.getElementById('catalogModal').classList.remove('show'));
  ['paramWaste', 'paramIndirect', 'paramMargin'].forEach((id) => {
    document.getElementById(id).addEventListener('input', () => { recalcBomTotals(); persistBomParams(); });
  });

  // Archivos
  document.getElementById('fileInput').addEventListener('change', (e) => handleFileUpload(e.target.files));

  // Documento / plantillas
  document.querySelectorAll('[data-cmd]').forEach((btn) => btn.addEventListener('click', () => {
    document.execCommand(btn.dataset.cmd, false, null);
    document.getElementById('documentPaper').focus();
  }));
  document.getElementById('documentPaper').addEventListener('input', debounce(saveDocumentPaper, 800));
  document.getElementById('btnTemplateSignature').addEventListener('click', () => {
    const salePriceText = document.getElementById('bomFinalSalePrice').textContent;
    document.getElementById('documentPaper').innerHTML = signatureProposalTemplate(store.project, salePriceText);
    saveDocumentPaper();
  });
  document.getElementById('btnTemplateContract').addEventListener('click', () => {
    document.getElementById('documentPaper').innerHTML = contractTemplate(store.project);
    saveDocumentPaper();
  });

  // Firma
  document.getElementById('btnClearSignature').addEventListener('click', () => Sig.clearSignature());
  document.getElementById('btnSaveSignature').addEventListener('click', async () => {
    if (!Sig.hasSignature()) { toast('Dibuja la firma antes de guardar.', 'error'); return; }
    const signerName = document.getElementById('signerName').value.trim();
    const signerId = document.getElementById('signerId').value.trim();
    if (!signerName) { toast('Escribe el nombre completo del firmante.', 'error'); return; }
    try {
      const res = await fetch(`/api/projects/${store.project.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dataUrl: Sig.getSignatureDataUrl(),
          signerName, signerId,
          documentHtml: document.getElementById('documentPaper').innerHTML,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      store.project = data.project;
      updateSignatureStatus();
      toast('Firma guardada con rastro de auditoría (IP, hora y hash del documento).', 'success');
    } catch (err) { toast(`No se pudo guardar la firma: ${err.message}`, 'error'); }
  });

  // PDF / Email
  document.getElementById('btnExportPdf').addEventListener('click', async () => {
    const exportEl = buildExportablePaper();
    try {
      await exportDocumentToPdf(exportEl, {
        fileName: `Propuesta_${(store.project?.name || 'MasterHands').replace(/\s+/g, '_')}.pdf`,
      });
    } catch (err) { toast(err.message, 'error'); }
    finally { exportEl.remove(); }
  });
  document.getElementById('btnEmailDoc').addEventListener('click', openEmailModal);
  document.getElementById('btnCloseEmail').addEventListener('click', () => document.getElementById('emailModal').classList.remove('show'));
  document.getElementById('btnConfirmSendEmail').addEventListener('click', confirmSendEmail);

  // Gemini
  document.getElementById('btnGeminiOpen').addEventListener('click', () => document.getElementById('geminiModal').classList.add('show'));
  document.getElementById('btnCloseGemini').addEventListener('click', () => document.getElementById('geminiModal').classList.remove('show'));
  document.getElementById('btnRunGemini').addEventListener('click', runGemini);
  document.getElementById('btnPreset1').addEventListener('click', () => { document.getElementById('geminiPrompt').value = geminiPreset('subwoofer', store.project); });
  document.getElementById('btnPreset2').addEventListener('click', () => { document.getElementById('geminiPrompt').value = geminiPreset('warranty', store.project); });

  // Árbol de carpetas
  document.getElementById('btnCopyTree').addEventListener('click', async () => {
    const tree = `01_Cliente\n02_Contratos\n03_Planos_Recibidos\n04_Visita_Tecnica\n05_Calculos_Acusticos\n06_BOM_Cotizacion\n07_Render_3D\n08_Fotos_Obra\n09_QA_QC\n10_As_Built\n11_Comunicaciones`;
    try { await navigator.clipboard.writeText(tree); toast('Árbol de carpetas copiado al portapapeles.', 'success'); }
    catch { toast('No se pudo copiar automáticamente; selecciona el texto manualmente.', 'error'); }
  });

  // 3D toolbar
  document.getElementById('btnTogglePressure').addEventListener('click', (e) => {
    const on = Scene3D.togglePressureMode();
    e.target.textContent = on ? 'Ocultar modos de presión' : 'Ver modos de presión';
  });
  document.getElementById('btnRender3D').addEventListener('click', () => Scene3D.capturePNG(`render_${(store.project?.name || 'sala').replace(/\s+/g, '_')}.png`));
  document.getElementById('btnReset3D').addEventListener('click', () => Scene3D.resetView());
  document.getElementById('btnToggle3DTheme').addEventListener('click', (e) => {
    const next = Scene3D.getTheme() === 'dark' ? 'light' : 'dark';
    Scene3D.setTheme(next);
    e.target.textContent = next === 'dark' ? '☀️ Tema claro' : '🌙 Tema oscuro';
  });

  // Sync indicator
  onSyncChange((isOnline) => {
    document.getElementById('syncDot').className = `dot ${isOnline ? 'dot-ok' : 'dot-err'}`;
    document.getElementById('syncLabel').textContent = isOnline ? 'Conectado' : 'Sin conexión — guardando local';
  });

  // Generador de tonos
  document.getElementById('btnPlayTone').addEventListener('click', () => {
    Tones.playTone(parseFloat(document.getElementById('toneFreq').value) || 60, parseFloat(document.getElementById('toneVolume').value));
  });
  document.getElementById('btnPlaySweep').addEventListener('click', () => {
    Tones.playSweep(
      parseFloat(document.getElementById('sweepFrom').value) || 20,
      parseFloat(document.getElementById('sweepTo').value) || 200,
      parseFloat(document.getElementById('sweepDuration').value) || 8,
      parseFloat(document.getElementById('toneVolume').value)
    );
  });
  document.getElementById('btnPlayNoise').addEventListener('click', () => Tones.playPinkNoise(parseFloat(document.getElementById('toneVolume').value)));
  document.getElementById('btnStopAllAudio').addEventListener('click', () => Tones.stopAll());
  document.getElementById('toneVolume').addEventListener('input', (e) => Tones.setVolume(parseFloat(e.target.value)));

  // Usuarios (admin)
  document.getElementById('btnLogout').addEventListener('click', () => { Tones.stopAll(); logout(); });
  wireNewUserForm({
    button: document.getElementById('btnCreateUser'),
    name: document.getElementById('newUserName'),
    username: document.getElementById('newUserUsername'),
    password: document.getElementById('newUserPassword'),
    role: document.getElementById('newUserRole'),
  }, () => renderUsers(document.getElementById('usersListContainer'), currentUser?.id));

  // Respaldos (admin)
  wireBackupButton();

  // Cerrar modales con click en backdrop o Escape
  document.querySelectorAll('.modal-backdrop').forEach((backdrop) => {
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.classList.remove('show'); });
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal-backdrop.show').forEach((m) => m.classList.remove('show'));
  });
}

function debounce(fn, ms) { let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); }; }

/* ============================== MENÚ MÓVIL (hamburguesa) ============================== */

function openMobileDrawer() {
  document.querySelector('.sidebar').classList.add('open');
  document.getElementById('sidebarBackdrop').classList.add('open');
}
function closeMobileDrawer() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebarBackdrop').classList.remove('open');
}
function wireMobileMenu() {
  document.getElementById('btnHamburger').addEventListener('click', openMobileDrawer);
  document.getElementById('sidebarBackdrop').addEventListener('click', closeMobileDrawer);
}

async function init() {
  const { needsSetup } = await checkAuthStatus();
  let user = needsSetup ? null : await getCurrentUser();

  if (needsSetup || !user) {
    document.getElementById('authScreen').style.display = 'block';
    document.getElementById('appShell').style.display = 'none';
    renderAuthScreen(document.getElementById('authScreen'), {
      needsSetup,
      onSuccess: (u) => { currentUser = u; startApp(); },
    });
    return;
  }
  currentUser = user;
  startApp();
}

function startApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('authScreen').innerHTML = ''; // saca los campos de contraseña del DOM por completo:
  // dejarlos solo ocultos con CSS confundía el autocompletado de Chrome en otros formularios de la página (ítems del BOM, firma, etc.)
  document.getElementById('appShell').style.display = 'grid';
  document.getElementById('userBadgeName').textContent = currentUser.name || currentUser.username;
  document.getElementById('userBadgeRole').textContent = { admin: 'Administrador', vendedor: 'Comercial', tecnico: 'Técnico' }[currentUser.role] || currentUser.role;

  renderNav();
  attachGenericBindings();
  wireStaticEvents();
  wireMobileMenu();
  loadProjectList();
  trySyncQueue();

  initRealtime({
    changed: (payload) => {
      if (store.project && payload.id === store.project.id) {
        toast('Este proyecto fue actualizado desde otro dispositivo. Recargando datos…', 'success');
        store.load(store.project.id).then(populateAllFields);
      }
      if (currentView === 'projects') loadProjectList();
    },
    created: () => { if (currentView === 'projects') loadProjectList(); },
    deleted: (payload) => {
      if (currentView === 'projects') loadProjectList();
      if (store.project && payload.id === store.project.id) {
        toast('Este proyecto fue eliminado desde otro dispositivo.', 'error');
        store.project = null;
        switchView('projects');
      }
    },
  });

  const lastId = localStorage.getItem('mh_last_project');
  if (lastId) {
    openProject(lastId).catch(() => { /* el proyecto pudo haber sido borrado; se queda en la lista */ });
  }
}

document.addEventListener('DOMContentLoaded', init);
