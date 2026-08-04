import crypto from 'node:crypto';
import { HttpError } from './http.js';

const TICKET_VERSION = 1;

function b64urlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function b64urlDecode(value) {
  return Buffer.from(String(value || ''), 'base64url').toString('utf8');
}

function getSigningSecret() {
  const secret = process.env.BLOB_UPLOAD_SIGNING_SECRET?.trim()
    || process.env.APP_ACCESS_TOKEN?.trim()
    || process.env.SESSION_SECRET?.trim();

  if (!secret || secret.length < 16) {
    throw new HttpError(
      503,
      'UPLOAD_SIGNING_SECRET_MISSING',
      '請在 Vercel 設定 BLOB_UPLOAD_SIGNING_SECRET（至少 16 個字元），或設定 APP_ACCESS_TOKEN。'
    );
  }
  return secret;
}

function signPayload(encodedPayload) {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(encodedPayload)
    .digest('base64url');
}

export function createUploadTicket({ size, mimeType, ttlMs = 30 * 60 * 1000 }) {
  const now = Date.now();
  const payload = {
    v: TICKET_VERSION,
    exp: now + ttlMs,
    iat: now,
    size,
    mimeType,
    nonce: crypto.randomUUID()
  };
  const encoded = b64urlEncode(JSON.stringify(payload));
  return `${encoded}.${signPayload(encoded)}`;
}

export function verifyUploadTicket(ticket) {
  const [encoded, suppliedSignature, extra] = String(ticket || '').split('.');
  if (!encoded || !suppliedSignature || extra) {
    throw new HttpError(401, 'INVALID_UPLOAD_TICKET', '音檔上傳授權票證格式不正確。');
  }

  const expectedSignature = signPayload(encoded);
  const a = Buffer.from(expectedSignature);
  const b = Buffer.from(suppliedSignature);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!valid) {
    throw new HttpError(401, 'INVALID_UPLOAD_TICKET', '音檔上傳授權票證驗證失敗。');
  }

  let payload;
  try {
    payload = JSON.parse(b64urlDecode(encoded));
  } catch {
    throw new HttpError(401, 'INVALID_UPLOAD_TICKET', '音檔上傳授權票證內容無法解析。');
  }

  if (payload?.v !== TICKET_VERSION) {
    throw new HttpError(401, 'INVALID_UPLOAD_TICKET', '音檔上傳授權票證版本不支援。');
  }
  if (!Number.isSafeInteger(payload.exp) || Date.now() > payload.exp) {
    throw new HttpError(401, 'UPLOAD_TICKET_EXPIRED', '音檔上傳授權票證已過期，請重新開始上傳。');
  }
  if (!Number.isSafeInteger(payload.size) || payload.size <= 0) {
    throw new HttpError(401, 'INVALID_UPLOAD_TICKET', '音檔上傳授權票證的檔案大小不正確。');
  }
  if (!/^audio\//i.test(String(payload.mimeType || ''))) {
    throw new HttpError(401, 'INVALID_UPLOAD_TICKET', '音檔上傳授權票證的檔案類型不正確。');
  }

  return payload;
}
