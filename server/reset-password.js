#!/usr/bin/env node
// server/reset-password.js
// Herramienta de recuperación: úsala cuando el único administrador pierda su contraseña
// y no haya forma de recuperarla desde la interfaz web (a propósito: las contraseñas se
// guardan como hash, no se pueden "leer" ni recuperar, solo reemplazar).
//
// IMPORTANTE: detén el servidor (Ctrl+C en la terminal donde corre "npm start") antes de
// ejecutar esto, para que no haya dos procesos escribiendo el mismo archivo a la vez.
//
// Uso:
//   node server/reset-password.js                     -> modo interactivo
//   node server/reset-password.js admin nuevaClave123  -> modo directo (usuario + contraseña)

const readline = require('readline');
const db = require('./db');
const { hashPassword } = require('./auth');

function hiddenPrompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const stdin = process.stdin;
    process.stdout.write(question);
    let value = '';
    const onData = (char) => {
      char = char.toString('utf8');
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.removeListener('data', onData);
        stdin.setRawMode?.(false);
        process.stdout.write('\n');
        rl.close();
        resolve(value);
        return;
      }
      if (char === '\u0003') { process.exit(1); } // Ctrl+C
      if (char === '\u007f') { value = value.slice(0, -1); return; } // backspace
      value += char;
    };
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on('data', onData);
  });
}

function plainPrompt(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer.trim()); });
  });
}

async function main() {
  const [, , argUsername, argPassword] = process.argv;

  console.log('=== Master Hands — Recuperación de contraseña ===\n');

  const users = db.listUsers();
  if (!users.length) {
    console.log('No hay usuarios creados todavía. Simplemente abre la app y crea la cuenta de administrador.');
    process.exit(0);
  }

  let username = argUsername;
  if (!username) {
    console.log('Usuarios existentes:', users.map((u) => `${u.username} (${u.role})`).join(', '));
    username = await plainPrompt('¿A qué usuario le vas a cambiar la contraseña? ');
  }

  const user = db.getUserByUsername(username);
  if (!user) {
    console.error(`No existe ningún usuario con el nombre "${username}".`);
    process.exit(1);
  }

  let password = argPassword;
  if (!password) {
    password = await hiddenPrompt('Nueva contraseña (mínimo 6 caracteres, no se mostrará en pantalla): ');
    const confirm = await hiddenPrompt('Confírmala de nuevo: ');
    if (password !== confirm) {
      console.error('\nLas dos contraseñas no coinciden. Intenta de nuevo.');
      process.exit(1);
    }
  }

  if (!password || password.length < 6) {
    console.error('La contraseña debe tener al menos 6 caracteres.');
    process.exit(1);
  }

  const { salt, hash } = hashPassword(password);
  db.updateUserPassword(user.id, salt, hash);
  db.clearFailedLogins(user.username);
  console.log(`\nListo. La contraseña de "${user.username}" (${user.role}) fue actualizada.`);
  console.log('Ya puedes iniciar el servidor de nuevo con "npm start" e ingresar con la nueva contraseña.');
  process.exit(0);
}

main();
