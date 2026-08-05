import { clearAccessSessionCookie, handleOptions, methodNotAllowed, sendJson } from '../lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  clearAccessSessionCookie(req, res);
  sendJson(req, res, 200, { ok: true, authenticated: false });
}
