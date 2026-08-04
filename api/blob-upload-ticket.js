import {
  assertAccess,
  clampInteger,
  handleOptions,
  methodNotAllowed,
  parseJsonBody,
  sendError,
  sendJson,
  HttpError
} from '../lib/http.js';
import { createUploadTicket } from '../lib/upload-ticket.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  try {
    assertAccess(req);
    const body = parseJsonBody(req);
    const size = Number(body.size);
    const mimeType = String(body.mimeType || '').trim().toLowerCase();
    const maxBytes = clampInteger(
      process.env.MAX_UPLOAD_BYTES,
      220 * 1024 * 1024,
      1 * 1024 * 1024,
      2 * 1024 * 1024 * 1024
    );

    if (!Number.isSafeInteger(size) || size <= 0) {
      throw new HttpError(400, 'INVALID_FILE_SIZE', '檔案大小不正確。');
    }
    if (size > maxBytes) {
      throw new HttpError(
        413,
        'FILE_TOO_LARGE',
        `檔案超過目前允許上限 ${(maxBytes / 1048576).toFixed(0)} MB。`
      );
    }
    if (mimeType !== 'audio/wav') {
      throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', '目前只接受網頁轉換完成的 audio/wav 音檔。');
    }

    const ticket = createUploadTicket({ size, mimeType });
    sendJson(req, res, 200, {
      ticket,
      expiresInSeconds: 1800,
      maxBytes
    });
  } catch (error) {
    sendError(req, res, error);
  }
}
