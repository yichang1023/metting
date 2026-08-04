import {
  assertAccess,
  handleOptions,
  methodNotAllowed,
  parseJsonBody,
  sendError,
  sendJson
} from '../lib/http.js';
import { generateContent } from '../lib/gemini.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'POST') return methodNotAllowed(req, res, ['POST']);

  try {
    assertAccess(req);
    const body = parseJsonBody(req);
    const { result, keySlot, model } = await generateContent({
      prompt: body.prompt,
      fileUri: body.fileUri,
      mimeType: body.mimeType,
      keySlot: body.keySlot,
      task: body.task || 'meeting-analysis'
    });

    res.setHeader('X-Meeting-Key-Slot', String(keySlot));
    res.setHeader('X-Meeting-Gemini-Model', model);
    // 回傳 Gemini 原始結果，讓既有前端的解析與截斷修復邏輯可以直接沿用。
    sendJson(req, res, 200, result);
  } catch (error) {
    sendError(req, res, error);
  }
}
