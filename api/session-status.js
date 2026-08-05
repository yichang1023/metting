import { handleOptions, methodNotAllowed, readAccessSession, sendJson } from '../lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(req, res, ['GET']);

  const protectedSite = Boolean(process.env.APP_ACCESS_TOKEN?.trim());
  const session = readAccessSession(req);
  sendJson(req, res, 200, session || {
    ok: true,
    authenticated: !protectedSite,
    protected: protectedSite,
    expiresAt: null,
    remembered: false
  });
}
