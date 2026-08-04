import { sendJson } from '../lib/http.js';

export default function handler(req, res) {
  sendJson(req, res, 200, {
    name: 'Meeting 助手 API',
    version: '3.0.2',
    endpoints: [
      'GET /api/health',
      'POST /api/gemini-upload-start',
      'POST /api/gemini-upload-chunk',
      'POST /api/gemini-file-status',
      'POST /api/gemini-generate'
    ]
  });
}
