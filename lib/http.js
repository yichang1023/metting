import crypto from 'node:crypto';

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

export function assertAccess(req) {
  const requiredToken = process.env.APP_ACCESS_TOKEN?.trim();
  if (!requiredToken) return;

  const header = String(req.headers?.authorization || '');
  const supplied = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  const a = Buffer.from(requiredToken);
  const b = Buffer.from(supplied);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) {
    throw new HttpError(401, 'UNAUTHORIZED', '網站存取碼不正確，請到「設定」頁重新輸入。');
  }
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
