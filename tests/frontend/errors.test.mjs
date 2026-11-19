import assert from 'node:assert/strict';
import test from 'node:test';
import { commandErrorMessage } from '../../src/lib/api/errors.ts';

test('displays the three structured command errors', () => {
  assert.match(commandErrorMessage({ code: 'invalid_request' }), /Недопустимый запрос/);
  assert.match(commandErrorMessage({ code: 'busy' }), /Каталог занят/);
  assert.match(commandErrorMessage({ code: 'unavailable' }), /локальный каталог/);
});

test('replaces unexpected IPC errors with a safe message', () => {
  const fallback = /Не удалось получить данные/;
  for (const error of [null, 'SQLite file path', { code: 123 }, { code: '__proto__' }, {}]) {
    assert.match(commandErrorMessage(error), fallback);
  }
});
