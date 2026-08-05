import {
  handleOptions,
  HttpError,
  methodNotAllowed,
  parseJsonBody,
  sendError,
  sendJson,
  setAccessSessionCookie,
  verifyAccessCode
} from '../lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  try {
    const body = parseJsonBody(req);
    const accessToken = String(body.accessToken || '').trim();
    if (!verifyAccessCode(accessToken)) {
      throw new HttpError(401, 'UNAUTHORIZED', '網站存取碼不正確。');
    }
    const session = setAccessSessionCookie(req, res, Boolean(body.remember));
    sendJson(req, res, 200, { ok: true, ...session });
  } catch (error) {
    sendError(req, res, error);
  }
}
