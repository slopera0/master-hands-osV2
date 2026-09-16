// server/realtime.js
// PERSONA 1 (Arquitectura): sincronización "en vivo" entre dispositivos conectados al MISMO
// servidor (misma red local, o la misma instancia si la despliegas online). Cuando alguien
// edita un proyecto desde una tablet en obra, la oficina que tiene el mismo proyecto abierto
// lo ve actualizarse sin recargar. Es last-write-wins (el último guardado gana), no fusión de
// cambios en conflicto -> honesto decirlo: no reemplaza un control de versiones real.

const { WebSocketServer } = require('ws');

let wss = null;

function initRealtime(httpServer) {
  wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wss.on('connection', (socket) => {
    socket.send(JSON.stringify({ type: 'connected' }));
    socket.on('error', () => {}); // evita que un socket roto tumbe el proceso
  });
}

function broadcast(type, payload) {
  if (!wss) return;
  const msg = JSON.stringify({ type, payload });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) client.send(msg);
  });
}

module.exports = { initRealtime, broadcast };
