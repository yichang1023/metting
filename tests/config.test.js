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

test('remembered access session uses an HttpOnly cookie and can authenticate later requests', async () => {
  const { setAccessSessionCookie, readAccessSession, assertAccess } = await import('../lib/http.js');
  withEnv({ APP_ACCESS_TOKEN: 'a-strong-access-token-123456', SESSION_SECRET: 'a-separate-session-secret-123456', VERCEL: '1' }, () => {
    const headers = {};
    const req = { headers: { 'x-forwarded-proto': 'https' } };
    const res = { setHeader(name, value) { headers[name] = value; } };
    const session = setAccessSessionCookie(req, res, true);
    assert.equal(session.authenticated, true);
    assert.equal(session.remembered, true);
    assert.match(headers['Set-Cookie'], /HttpOnly/);
    assert.match(headers['Set-Cookie'], /Secure/);
    assert.match(headers['Set-Cookie'], /Max-Age=/);

    const cookieValue = headers['Set-Cookie'].split(';')[0];
    const laterReq = { headers: { cookie: cookieValue } };
    assert.equal(readAccessSession(laterReq)?.authenticated, true);
    assert.doesNotThrow(() => assertAccess(laterReq));
  });
});

test('changing APP_ACCESS_TOKEN invalidates an existing remembered session', async () => {
  const { setAccessSessionCookie, readAccessSession } = await import('../lib/http.js');
  let cookieValue = '';
  withEnv({ APP_ACCESS_TOKEN: 'first-access-token-123456', SESSION_SECRET: 'fixed-session-secret-123456', VERCEL: '1' }, () => {
    const headers = {};
    setAccessSessionCookie({ headers: {} }, { setHeader(name, value) { headers[name] = value; } }, true);
    cookieValue = headers['Set-Cookie'].split(';')[0];
  });
  withEnv({ APP_ACCESS_TOKEN: 'second-access-token-123456', SESSION_SECRET: 'fixed-session-secret-123456', VERCEL: '1' }, () => {
    assert.equal(readAccessSession({ headers: { cookie: cookieValue } }), null);
  });
});
