import {
  assertAccess,
  handleOptions,
  methodNotAllowed,
  parseJsonBody,
  sendError,
  sendJson
} from '../lib/http.js';
import { createUploadSession } from '../lib/gemini.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  try {
    assertAccess(req);
    const body = parseJsonBody(req);
    const data = await createUploadSession({
      mimeType: String(body.mimeType || ''),
      size: Number(body.size),
      displayName: String(body.displayName || 'meeting-audio')
    });
    sendJson(req, res, 200, data);
  } catch (error) {
    sendError(req, res, error);
  }
}
