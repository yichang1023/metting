import { sendJson } from '../lib/http.js';

export default function handler(req, res) {
  sendJson(req, res, 200, {
    name: 'Meeting 助手 API',
    version: '3.2.0',
    endpoints: [
      'GET /api/health',
      'POST /api/blob-upload-ticket',
      'POST /api/blob-upload',
      'POST /api/gemini-import-blob',
      'POST /api/gemini-file-status',
      'POST /api/gemini-generate'
    ]
  });
}
