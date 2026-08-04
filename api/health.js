import { assertAccess, handleOptions, methodNotAllowed, sendError, sendJson } from '../lib/http.js';
import { getConfiguredModel, getGeminiKeySlots } from '../lib/gemini.js';

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  if (req.method !== 'GET') return methodNotAllowed(req, res, ['GET']);

  try {
    assertAccess(req);
    const keys = getGeminiKeySlots();
    sendJson(req, res, 200, {
      ok: true,
      service: 'meeting-assistant-api',
      version: '3.0.1',
      model: getConfiguredModel('meeting-analysis'),
      polishModel: getConfiguredModel('polish'),
      keyCount: keys.length,
      protected: Boolean(process.env.APP_ACCESS_TOKEN?.trim()),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    sendError(req, res, error);
  }
}
