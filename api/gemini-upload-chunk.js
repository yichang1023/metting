import { handleOptions, sendJson } from '../lib/http.js';

export default function handler(req, res) {
  if (handleOptions(req, res)) return;
  sendJson(req, res, 410, {
    error: {
      code: 'ENDPOINT_RETIRED',
      message: '2 MiB Gemini 分段代理已停用；請使用 V3.2.0 Private Blob 上傳流程。'
    }
  });
}
