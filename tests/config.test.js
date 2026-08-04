import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfiguredModel, getGeminiKeySlots, uploadBinaryChunkToSession } from '../lib/gemini.js';
import { clampInteger, parseJsonBody } from '../lib/http.js';
import { createUploadTicket, verifyUploadTicket } from '../lib/upload-ticket.js';

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

test('short-lived upload ticket can be verified and tampering is rejected', () => {
  withEnv({ BLOB_UPLOAD_SIGNING_SECRET: '0123456789abcdef0123456789abcdef' }, () => {
    const ticket = createUploadTicket({ size: 1234, mimeType: 'audio/wav' });
    const payload = verifyUploadTicket(ticket);
    assert.equal(payload.size, 1234);
    assert.equal(payload.mimeType, 'audio/wav');
    assert.throws(
      () => verifyUploadTicket(`${ticket}x`),
      (error) => error?.code === 'INVALID_UPLOAD_TICKET'
    );
  });
});

test('binary upload rejects non-Gemini upload URL', async () => {
  await assert.rejects(
    uploadBinaryChunkToSession({
      uploadUrl: 'https://example.com/upload/file',
      offset: 0,
      totalSize: 3,
      chunk: Buffer.from('abc'),
      isFinal: true
    }),
    (error) => error?.code === 'INVALID_UPLOAD_URL'
  );
});

test('final binary chunk is forwarded to Gemini and returns file metadata', async () => {
  const originalFetch = globalThis.fetch;
  let seen = null;
  globalThis.fetch = async (url, options) => {
    seen = { url, options };
    return new Response(JSON.stringify({
      file: {
        name: 'files/test-audio',
        uri: 'https://generativelanguage.googleapis.com/v1beta/files/test-audio',
        mimeType: 'audio/wav',
        state: 'ACTIVE'
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  try {
    const result = await uploadBinaryChunkToSession({
      uploadUrl: 'https://generativelanguage.googleapis.com/upload/v1beta/files?upload_id=test',
      offset: 0,
      totalSize: 3,
      chunk: Buffer.from('abc'),
      isFinal: true
    });
    assert.equal(result.file.name, 'files/test-audio');
    assert.equal(result.nextOffset, 3);
    assert.equal(seen.options.headers['X-Goog-Upload-Command'], 'upload, finalize');
    assert.equal(seen.options.headers['X-Goog-Upload-Offset'], '0');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
