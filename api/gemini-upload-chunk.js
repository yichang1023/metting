import {
  assertAccess,
  handleOptions,
  methodNotAllowed,
  parseJsonBody,
  sendError,
  sendJson
} from '../lib/http.js';
import { uploadChunkToSession } from '../lib/gemini.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  try {
    assertAccess(req);
    const body = parseJsonBody(req);
    const data = await uploadChunkToSession({
      uploadUrl: body.uploadUrl,
      offset: body.offset,
      totalSize: body.totalSize,
      dataBase64: body.dataBase64,
      isFinal: body.isFinal
    });
    sendJson(req, res, 200, data);
  } catch (error) {
    sendError(req, res, error);
  }
}
