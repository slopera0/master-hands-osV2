// public/js/realtime.js
// Cliente WebSocket: escucha cambios hechos desde OTROS dispositivos conectados al mismo
// servidor (misma red local, o misma instancia si está desplegada online) y notifica a
// la aplicación para refrescar. Reconecta solo automáticamente si se cae la conexión.

let socket = null;
let handlers = { changed: () => {}, created: () => {}, deleted: () => {} };
let reconnectTimer = null;

export function initRealtime(callbacks = {}) {
  handlers = { ...handlers, ...callbacks };
  connect();
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${proto}//${location.host}/ws`);

  socket.addEventListener('close', () => {
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(connect, 3000);
  });
  socket.addEventListener('error', () => socket.close());
  socket.addEventListener('message', (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === 'project:updated') handlers.changed(msg.payload);
    if (msg.type === 'project:created') handlers.created(msg.payload);
    if (msg.type === 'project:deleted') handlers.deleted(msg.payload);
  });
}
