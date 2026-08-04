import {
  assertAccess,
  handleOptions,
  methodNotAllowed,
  parseJsonBody,
  sendError,
  sendJson
} from '../lib/http.js';
import { getFileStatus } from '../lib/gemini.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  try {
    assertAccess(req);
    const body = parseJsonBody(req);
    const data = await getFileStatus({
      fileName: body.fileName,
      keySlot: body.keySlot
    });
    sendJson(req, res, 200, data);
  } catch (error) {
    sendError(req, res, error);
  }
}
