// public/js/state.js
// Reemplaza el "data-bind" casero disperso por un store central simple con
// getters/setters de rutas anidadas ("client.email") y autosave debounced hacia
// la API (que a su vez cae en la cola offline de api.js si el servidor no responde).

import { api } from './api.js';
import { toast } from './toast.js';

function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  keys.slice(0, -1).forEach((k) => { if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {}; cur = cur[k]; });
  cur[keys[keys.length - 1]] = value;
}

class Store {
  constructor() {
    this.project = null; // proyecto activo, forma normalizada del backend
    this.subscribers = new Set();
    this._saveTimer = null;
  }

  subscribe(fn) { this.subscribers.add(fn); return () => this.subscribers.delete(fn); }
  notify() { this.subscribers.forEach((fn) => fn(this.project)); }

  async load(projectId) {
    const { project } = await api.getProject(projectId);
    this.project = project;
    this.notify();
    return project;
  }

  get(path) { return this.project ? getPath(this.project, path) : undefined; }

  set(path, value, { autosave = true } = {}) {
    if (!this.project) return;
    setPath(this.project, path, value);
    this.notify();
    if (autosave) this.scheduleSave();
  }

  scheduleSave(delayMs = 700) {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this.saveNow(), delayMs);
  }

  async saveNow() {
    if (!this.project) return;
    try {
      const { project } = await api.updateProject(this.project.id, this.project);
      if (project) { this.project = project; this.notify(); }
    } catch (err) {
      toast(`No se pudo guardar: ${err.message}`, 'error');
    }
  }
}

export const store = new Store();
