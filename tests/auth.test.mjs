// tests/auth.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../server/auth.js';

test('hashPassword: nunca guarda la contraseña en texto plano', () => {
  const { hash, salt } = hashPassword('miClaveSecreta123');
  assert.notEqual(hash, 'miClaveSecreta123');
  assert.ok(hash.length > 0 && salt.length > 0);
});

test('verifyPassword: acepta la contraseña correcta', () => {
  const { salt, hash } = hashPassword('correcta123');
  assert.equal(verifyPassword('correcta123', salt, hash), true);
});

test('verifyPassword: rechaza una contraseña incorrecta', () => {
  const { salt, hash } = hashPassword('correcta123');
  assert.equal(verifyPassword('incorrecta456', salt, hash), false);
});

test('hashPassword: la misma contraseña genera hashes distintos por la sal aleatoria', () => {
  const a = hashPassword('igual123');
  const b = hashPassword('igual123');
  assert.notEqual(a.hash, b.hash);
  assert.notEqual(a.salt, b.salt);
});
