import { handleOptions, sendJson } from '../lib/http.js';

export default function handler(req, res) {
  if (handleOptions(req, res)) return;
  sendJson(req, res, 410, {
    error: {
      code: 'ENDPOINT_RETIRED',
      message: '此舊版音檔上傳端點已停用，請更新前端至 V3.1.0 Private Blob 架構。'
    }
  });
}
