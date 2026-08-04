import { HttpError, clampInteger } from './http.js';

const GOOGLE_API_BASE = 'https://generativelanguage.googleapis.com';
let roundRobinCursor = 0;

export function getGeminiKeySlots() {
  return [1, 2, 3]
    .map((slot) => ({ slot, key: process.env[`GEMINI_API_KEY_${slot}`]?.trim() }))
    .filter((item) => Boolean(item.key));
}

export function getConfiguredModel(task = 'meeting-analysis') {
  if (task === 'polish') {
    return process.env.GEMINI_MODEL_POLISH?.trim()
      || process.env.GEMINI_MODEL?.trim()
      || 'gemini-3.6-flash';
  }
  return process.env.GEMINI_MODEL?.trim() || 'gemini-3.6-flash';
}

function keySlotByNumber(slot) {
  const slots = getGeminiKeySlots();
  return slots.find((item) => item.slot === Number(slot));
}

function orderedKeySlots(preferredSlot = null) {
  const slots = getGeminiKeySlots();
  if (!slots.length) {
    throw new HttpError(
      503,
      'NO_GEMINI_KEY',
      'Vercel 尚未設定 GEMINI_API_KEY_1。請先在 Environment Variables 加入 Gemini API Key。'
    );
  }

  if (preferredSlot != null) {
    const preferred = keySlotByNumber(preferredSlot);
    if (!preferred) {
      throw new HttpError(400, 'INVALID_KEY_SLOT', '上傳工作使用的 Gemini Key 已不存在，請重新上傳錄音。');
    }
    return [preferred];
  }

  const start = roundRobinCursor % slots.length;
  roundRobinCursor = (roundRobinCursor + 1) % slots.length;
  return [...slots.slice(start), ...slots.slice(0, start)];
}

function isRetryableStatus(status) {
  return status === 401 || status === 403 || status === 429 || status >= 500;
}

async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new HttpError(504, 'GEMINI_TIMEOUT', 'Gemini 處理時間過長，請稍後重試或使用較短的錄音。');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function readGoogleError(response) {
  const text = await response.text().catch(() => '');
  let parsed = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  const message = parsed?.error?.message || text || `HTTP ${response.status}`;
  return { message, raw: parsed || text };
}

export async function createUploadSession({ mimeType, size, displayName }) {
  const maxBytes = clampInteger(
    process.env.MAX_UPLOAD_BYTES,
    220 * 1024 * 1024,
    1 * 1024 * 1024,
    2 * 1024 * 1024 * 1024
  );

  if (!Number.isFinite(size) || size <= 0) {
    throw new HttpError(400, 'INVALID_FILE_SIZE', '檔案大小不正確。');
  }
  if (size > maxBytes) {
    throw new HttpError(
      413,
      'FILE_TOO_LARGE',
      `檔案超過目前允許上限 ${(maxBytes / 1048576).toFixed(0)} MB。`
    );
  }
  if (!/^audio\//i.test(mimeType)) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', '後端只接受已抽取完成的音訊檔。');
  }

  const slots = orderedKeySlots();
  let lastError = null;

  for (const { slot, key } of slots) {
    const response = await fetchWithTimeout(
      `${GOOGLE_API_BASE}/upload/v1beta/files`,
      {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(size),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          file: { display_name: String(displayName || 'meeting-audio').slice(0, 180) }
        })
      },
      30_000
    );

    if (response.ok) {
      const uploadUrl = response.headers.get('x-goog-upload-url');
      if (!uploadUrl) {
        throw new HttpError(502, 'UPLOAD_URL_MISSING', 'Gemini Files API 未回傳上傳網址。');
      }
      return { uploadUrl, keySlot: slot };
    }

    const detail = await readGoogleError(response);
    lastError = new HttpError(
      response.status,
      'GEMINI_UPLOAD_START_FAILED',
      `Gemini 建立上傳工作失敗：${detail.message}`,
      { keySlot: slot }
    );

    if (!isRetryableStatus(response.status)) break;
  }

  throw lastError || new HttpError(502, 'GEMINI_UPLOAD_START_FAILED', '無法建立 Gemini 上傳工作。');
}

export async function getFileStatus({ fileName, keySlot }) {
  const normalizedName = String(fileName || '').trim();
  if (!/^files\/[A-Za-z0-9._-]+$/.test(normalizedName)) {
    throw new HttpError(400, 'INVALID_FILE_NAME', 'Gemini 檔案名稱格式不正確。');
  }

  const selected = keySlotByNumber(keySlot);
  if (!selected) {
    throw new HttpError(400, 'INVALID_KEY_SLOT', '找不到建立此音檔的 Gemini Key。');
  }

  const response = await fetchWithTimeout(
    `${GOOGLE_API_BASE}/v1beta/${normalizedName}`,
    {
      method: 'GET',
      headers: { 'x-goog-api-key': selected.key }
    },
    30_000
  );

  if (!response.ok) {
    const detail = await readGoogleError(response);
    throw new HttpError(
      response.status,
      'GEMINI_FILE_STATUS_FAILED',
      `無法取得 Gemini 音檔狀態：${detail.message}`
    );
  }

  const data = await response.json();
  return {
    name: data.name || normalizedName,
    uri: data.uri || '',
    mimeType: data.mimeType || data.mime_type || '',
    state: data.state || 'ACTIVE'
  };
}

export async function generateContent({ prompt, fileUri, mimeType, keySlot, task = 'meeting-analysis' }) {
  if (typeof prompt !== 'string' || prompt.trim().length < 10) {
    throw new HttpError(400, 'INVALID_PROMPT', '分析指令內容不足。');
  }
  if (prompt.length > 500_000) {
    throw new HttpError(413, 'PROMPT_TOO_LARGE', '分析指令內容過長。');
  }

  const model = getConfiguredModel(task);
  const maxOutputTokens = clampInteger(process.env.GEMINI_MAX_OUTPUT_TOKENS, 65536, 1024, 131072);
  const hasFile = Boolean(fileUri);
  const slots = orderedKeySlots(hasFile ? keySlot : null);
  let lastError = null;

  const parts = [];
  if (hasFile) {
    if (!mimeType || !/^audio\//i.test(mimeType)) {
      throw new HttpError(400, 'INVALID_MIME_TYPE', '音訊 MIME 類型不正確。');
    }
    parts.push({ fileData: { mimeType, fileUri } });
  }
  parts.push({ text: prompt });

  for (const { slot, key } of slots) {
    const response = await fetchWithTimeout(
      `${GOOGLE_API_BASE}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            maxOutputTokens,
            responseMimeType: 'application/json'
          }
        })
      },
      clampInteger(process.env.GEMINI_TIMEOUT_MS, 285000, 30_000, 295_000)
    );

    if (response.ok) {
      return {
        result: await response.json(),
        keySlot: slot,
        model
      };
    }

    const detail = await readGoogleError(response);
    lastError = new HttpError(
      response.status,
      'GEMINI_GENERATE_FAILED',
      `Gemini 分析失敗：${detail.message}`,
      { keySlot: slot, model }
    );

    // File URI 通常隸屬建立它的專案／金鑰，因此有檔案時不跨 Key 重試。
    if (hasFile || !isRetryableStatus(response.status)) break;
  }

  throw lastError || new HttpError(502, 'GEMINI_GENERATE_FAILED', 'Gemini 沒有回傳分析結果。');
}
