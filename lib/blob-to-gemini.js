import { del, head } from '@vercel/blob';
import { HttpError, clampInteger } from './http.js';
import { createUploadSession, uploadBinaryChunkToSession } from './gemini.js';

function validatePrivateBlobUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || ''));
  } catch {
    throw new HttpError(400, 'INVALID_BLOB_URL', 'Vercel Blob 音檔網址格式不正確。');
  }

  const validHost = parsed.hostname.endsWith('.private.blob.vercel-storage.com');
  if (parsed.protocol !== 'https:' || !validHost) {
    throw new HttpError(400, 'INVALID_BLOB_URL', '只接受本專案的 Vercel Private Blob 音檔網址。');
  }
  return parsed.toString();
}

async function fetchPrivateBlobRange(blobUrl, start, endInclusive, totalSize) {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) {
    throw new HttpError(
      503,
      'BLOB_TOKEN_MISSING',
      '尚未連接 Vercel Private Blob，請先在 Storage 建立 Private Blob Store。'
    );
  }

  const response = await fetch(blobUrl, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Range: `bytes=${start}-${endInclusive}`,
      'Cache-Control': 'no-store'
    },
    cache: 'no-store'
  });

  const requestedWholeFile = start === 0 && endInclusive === totalSize - 1;
  if (!(response.status === 206 || (response.status === 200 && requestedWholeFile))) {
    const text = await response.text().catch(() => '');
    throw new HttpError(
      response.status || 502,
      'BLOB_RANGE_READ_FAILED',
      `無法從 Vercel Blob 讀取音檔分段：${text || `HTTP ${response.status}`}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

export async function importPrivateBlobToGemini({ blobUrl, size, mimeType, displayName, ticketPayload }) {
  const safeBlobUrl = validatePrivateBlobUrl(blobUrl);
  const expectedSize = Number(size);
  const normalizedMimeType = String(mimeType || '').trim().toLowerCase();

  if (!ticketPayload || ticketPayload.size !== expectedSize || ticketPayload.mimeType !== normalizedMimeType) {
    throw new HttpError(401, 'UPLOAD_TICKET_MISMATCH', '音檔資料與上傳授權票證不一致。');
  }

  if (!Number.isSafeInteger(expectedSize) || expectedSize <= 0) {
    throw new HttpError(400, 'INVALID_FILE_SIZE', '音檔大小不正確。');
  }
  if (normalizedMimeType !== 'audio/wav') {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', '目前只接受 audio/wav 音檔。');
  }

  const maxBytes = clampInteger(
    process.env.MAX_UPLOAD_BYTES,
    220 * 1024 * 1024,
    1 * 1024 * 1024,
    2 * 1024 * 1024 * 1024
  );
  if (expectedSize > maxBytes) {
    throw new HttpError(413, 'FILE_TOO_LARGE', `檔案超過目前允許上限 ${(maxBytes / 1048576).toFixed(0)} MB。`);
  }

  let metadata;
  try {
    metadata = await head(safeBlobUrl);
  } catch (error) {
    throw new HttpError(502, 'BLOB_HEAD_FAILED', `無法驗證 Vercel Blob 音檔：${error?.message || '未知錯誤'}`);
  }

  if (!metadata || metadata.size !== expectedSize) {
    throw new HttpError(400, 'BLOB_SIZE_MISMATCH', 'Vercel Blob 音檔大小與上傳授權資料不一致。');
  }
  if (metadata.contentType && metadata.contentType !== normalizedMimeType) {
    throw new HttpError(415, 'BLOB_TYPE_MISMATCH', 'Vercel Blob 音檔類型與預期不一致。');
  }

  let uploadedFile = null;
  let keySlot = null;
  try {
    const session = await createUploadSession({
      mimeType: normalizedMimeType,
      size: expectedSize,
      displayName
    });
    keySlot = session.keySlot;

    const granularity = Number.isSafeInteger(session.chunkGranularity) && session.chunkGranularity > 0
      ? session.chunkGranularity
      : 8 * 1024 * 1024;
    const maxGranularity = 64 * 1024 * 1024;
    if (granularity > maxGranularity) {
      throw new HttpError(502, 'UNSUPPORTED_CHUNK_GRANULARITY', 'Gemini 要求的音檔分段大小超過目前安全上限。');
    }

    let offset = 0;
    while (offset < expectedSize) {
      const endExclusive = Math.min(offset + granularity, expectedSize);
      const isFinal = endExclusive === expectedSize;
      const chunk = await fetchPrivateBlobRange(safeBlobUrl, offset, endExclusive - 1, expectedSize);
      const expectedChunkLength = endExclusive - offset;

      if (chunk.length !== expectedChunkLength) {
        throw new HttpError(
          502,
          'BLOB_RANGE_LENGTH_MISMATCH',
          `Vercel Blob 回傳的音檔分段大小不一致：預期 ${expectedChunkLength}，實際 ${chunk.length}。`
        );
      }
      if (!isFinal && chunk.length % granularity !== 0) {
        throw new HttpError(
          500,
          'INTERNAL_CHUNK_ALIGNMENT_ERROR',
          `非最後一段必須是 Gemini 分段粒度 ${granularity} 位元組的整數倍。`
        );
      }

      const result = await uploadBinaryChunkToSession({
        uploadUrl: session.uploadUrl,
        offset,
        totalSize: expectedSize,
        chunk,
        isFinal
      });

      offset = result.nextOffset;
      if (isFinal) uploadedFile = result.file;
    }
  } finally {
    try {
      await del(safeBlobUrl);
    } catch (deleteError) {
      console.warn('[Blob cleanup warning]', deleteError?.message || deleteError);
    }
  }

  if (!uploadedFile?.name) {
    throw new HttpError(502, 'GEMINI_FILE_MISSING', 'Gemini 完成匯入後沒有回傳檔案資訊。');
  }

  return {
    file: uploadedFile,
    keySlot
  };
}
