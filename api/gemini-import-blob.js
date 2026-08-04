import {
  assertAccess,
  handleOptions,
  methodNotAllowed,
  parseJsonBody,
  sendError,
  sendJson
} from '../lib/http.js';
import { importPrivateBlobToGemini } from '../lib/blob-to-gemini.js';
import { verifyUploadTicket } from '../lib/upload-ticket.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  try {
    assertAccess(req);
    const body = parseJsonBody(req);
    const ticketPayload = verifyUploadTicket(body.ticket);
    const result = await importPrivateBlobToGemini({
      blobUrl: body.blobUrl,
      size: body.size,
      mimeType: body.mimeType,
      displayName: body.displayName,
      ticketPayload
    });
    sendJson(req, res, 200, result);
  } catch (error) {
    sendError(req, res, error);
  }
}
