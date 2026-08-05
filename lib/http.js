import crypto from 'node:crypto';

const SESSION_COOKIE_NAME = 'meeting_session';
const REMEMBER_SECONDS = 30 * 24 * 60 * 60;
const SESSION_SECONDS = 24 * 60 * 60;

export function setApiHeaders(req, res) {
  const configuredOrigin = process.env.ALLOWED_ORIGIN?.trim();
  const requestOrigin = req.headers?.origin;
  const allowOrigin = configuredOrigin || requestOrigin || '*';

  res.setHeader('Access-Control-Allow-Origin', allowOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

export function handleOptions(req, res) {
  if (req.method !== 'OPTIONS') return false;
  setApiHeaders(req, res);
  res.status(204).end();
  return true;
}

export function sendJson(req, res, status, payload) {
  setApiHeaders(req, res);
  res.status(status).json(payload);
}

export function methodNotAllowed(req, res, allowed) {
  res.setHeader('Allow', allowed.join(', '));
  sendJson(req, res, 405, {
    error: {
      code: 'METHOD_NOT_ALLOWED',
      message: `僅支援 ${allowed.join('、')} 請求。`
    }
  });
}

export function parseJsonBody(req) {
  if (req.body == null) return {};
  if (typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      throw new HttpError(400, 'INVALID_JSON', '請求內容不是有效的 JSON。');
    }
  }
  throw new HttpError(400, 'INVALID_BODY', '不支援的請求內容格式。');
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function getSessionSecret() {
  return process.env.SESSION_SECRET?.trim() || process.env.APP_ACCESS_TOKEN?.trim() || '';
}

function parseCookies(req) {
  const header = String(req.headers?.cookie || '');
  const cookies = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try { cookies[key] = decodeURIComponent(value); }
    catch { cookies[key] = value; }
  }
  return cookies;
}

function signPayload(payload) {
  return crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
}

function currentAccessKeyHash() {
  return crypto.createHash('sha256').update(process.env.APP_ACCESS_TOKEN?.trim() || '').digest('base64url').slice(0, 22);
}

function createSessionValue(expiresAt) {
  const payload = Buffer.from(JSON.stringify({
    v: 1,
    exp: expiresAt,
    k: currentAccessKeyHash(),
    nonce: crypto.randomBytes(12).toString('base64url')
  })).toString('base64url');
  return `${payload}.${signPayload(payload)}`;
}

export function readAccessSession(req) {
  const requiredToken = process.env.APP_ACCESS_TOKEN?.trim();
  if (!requiredToken) {
    return { authenticated: true, protected: false, expiresAt: null, remembered: false };
  }

  const value = parseCookies(req)[SESSION_COOKIE_NAME];
  if (!value) return null;
  const [payload, signature] = value.split('.');
  if (!payload || !signature || !safeEqual(signature, signPayload(payload))) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    const expiresAt = Number(decoded.exp || 0);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
    if (!safeEqual(decoded.k || '', currentAccessKeyHash())) return null;
    return {
      authenticated: true,
      protected: true,
      expiresAt: new Date(expiresAt).toISOString(),
      remembered: expiresAt - Date.now() > 2 * 24 * 60 * 60 * 1000
    };
  } catch {
    return null;
  }
}

export function verifyAccessCode(supplied) {
  const requiredToken = process.env.APP_ACCESS_TOKEN?.trim();
  if (!requiredToken) return true;
  return safeEqual(requiredToken, supplied);
}

function secureCookieAttribute(req) {
  const forwarded = String(req.headers?.['x-forwarded-proto'] || '').toLowerCase();
  return process.env.VERCEL || forwarded === 'https' ? ['Secure'] : [];
}

export function setAccessSessionCookie(req, res, remember = false) {
  const requiredToken = process.env.APP_ACCESS_TOKEN?.trim();
  if (!requiredToken) return { authenticated: true, protected: false, expiresAt: null, remembered: false };

  const lifetimeSeconds = remember ? REMEMBER_SECONDS : SESSION_SECONDS;
  const expiresAt = Date.now() + lifetimeSeconds * 1000;
  const cookie = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(createSessionValue(expiresAt))}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    ...secureCookieAttribute(req),
    ...(remember ? [`Max-Age=${lifetimeSeconds}`] : [])
  ].join('; ');
  res.setHeader('Set-Cookie', cookie);
  return {
    authenticated: true,
    protected: true,
    expiresAt: new Date(expiresAt).toISOString(),
    remembered: Boolean(remember)
  };
}

export function clearAccessSessionCookie(req, res) {
  const secure = secureCookieAttribute(req).length ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`);
}

export function assertAccess(req) {
  const requiredToken = process.env.APP_ACCESS_TOKEN?.trim();
  if (!requiredToken) return;

  const header = String(req.headers?.authorization || '');
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (safeEqual(requiredToken, supplied)) return;
  if (readAccessSession(req)?.authenticated) return;

  throw new HttpError(401, 'UNAUTHORIZED', '登入狀態已失效，請重新輸入網站存取碼。');
}

export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function sendError(req, res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  const code = error?.code || 'INTERNAL_ERROR';
  const message = error?.message || '伺服器發生未預期錯誤。';

  if (status >= 500) {
    console.error('[API error]', {
      code,
      message,
      stack: error?.stack,
      details: error?.details
    });
  }

  sendJson(req, res, status, {
    error: {
      code,
      message,
      ...(error?.details ? { details: error.details } : {})
    }
  });
}

export function clampInteger(value, fallback, min, max) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
