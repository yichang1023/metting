import { handleUpload } from '@vercel/blob/client';
import { handleOptions, methodNotAllowed, parseJsonBody, sendError, sendJson, HttpError } from '../lib/http.js';
import { verifyUploadTicket } from '../lib/upload-ticket.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  try {
    const body = parseJsonBody(req);
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let parsedPayload;
        try {
          parsedPayload = JSON.parse(String(clientPayload || ''));
        } catch {
          throw new HttpError(401, 'INVALID_UPLOAD_PAYLOAD', '缺少有效的音檔上傳授權資訊。');
        }

        const ticketPayload = verifyUploadTicket(parsedPayload.ticket);
        const normalizedPathname = String(pathname || '');
        if (!normalizedPathname.startsWith('meeting-audio/') || !normalizedPathname.endsWith('.wav')) {
          throw new HttpError(400, 'INVALID_BLOB_PATH', '音檔儲存路徑不正確。');
        }

        return {
          allowedContentTypes: [ticketPayload.mimeType],
          maximumSizeInBytes: ticketPayload.size,
          addRandomSuffix: true,
          allowOverwrite: false,
          validUntil: Math.min(ticketPayload.exp, Date.now() + 30 * 60 * 1000),
          cacheControlMaxAge: 60,
          tokenPayload: JSON.stringify({
            exp: ticketPayload.exp,
            size: ticketPayload.size,
            mimeType: ticketPayload.mimeType,
            nonce: ticketPayload.nonce
          })
        };
      },
      onUploadCompleted: async () => {
        // 音檔完成上傳後，由前端立即呼叫 /api/gemini-import-blob。
        // 不在 callback 內執行長時間 Gemini 匯入，避免 callback 重試與逾時。
      }
    });

    sendJson(req, res, 200, result);
  } catch (error) {
    sendError(req, res, error);
  }
}
