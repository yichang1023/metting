import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfiguredModel, getGeminiKeySlots } from '../lib/gemini.js';
import { clampInteger, parseJsonBody } from '../lib/http.js';

function withEnv(values, fn) {
  const old = {};
  for (const [key, value] of Object.entries(values)) {
    old[key] = process.env[key];
    if (value == null) delete process.env[key];
    else process.env[key] = value;
  }
  try { return fn(); }
  finally {
    for (const [key, value] of Object.entries(old)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('only configured Gemini keys are returned, without exposing other slots', () => {
  withEnv({
    GEMINI_API_KEY_1: ' key-one ',
    GEMINI_API_KEY_2: '',
    GEMINI_API_KEY_3: 'key-three'
  }, () => {
    assert.deepEqual(getGeminiKeySlots(), [
      { slot: 1, key: 'key-one' },
      { slot: 3, key: 'key-three' }
    ]);
  });
});

test('Gemini model defaults to gemini-3.6-flash', () => {
  withEnv({ GEMINI_MODEL: null, GEMINI_MODEL_POLISH: null }, () => {
    assert.equal(getConfiguredModel('meeting-analysis'), 'gemini-3.6-flash');
    assert.equal(getConfiguredModel('polish'), 'gemini-3.6-flash');
  });
});

test('polish model can be configured separately', () => {
  withEnv({ GEMINI_MODEL: 'model-a', GEMINI_MODEL_POLISH: 'model-b' }, () => {
    assert.equal(getConfiguredModel('meeting-analysis'), 'model-a');
    assert.equal(getConfiguredModel('polish'), 'model-b');
  });
});

test('parseJsonBody accepts object and JSON string', () => {
  assert.deepEqual(parseJsonBody({ body: { a: 1 } }), { a: 1 });
  assert.deepEqual(parseJsonBody({ body: '{"a":2}' }), { a: 2 });
});

test('clampInteger enforces bounds and fallback', () => {
  assert.equal(clampInteger('5', 10, 1, 20), 5);
  assert.equal(clampInteger('100', 10, 1, 20), 20);
  assert.equal(clampInteger('bad', 10, 1, 20), 10);
});
