import { upload } from '@vercel/blob/client';

function safeBaseName(value) {
  return String(value || 'meeting-audio')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'meeting-audio';
}

function extensionForMime(mimeType, displayName) {
  const mime = String(mimeType || '').toLowerCase();
  const extFromName = String(displayName || '').match(/\.([a-z0-9]{2,5})$/i)?.[1]?.toLowerCase();
  if (mime === 'audio/ogg') return 'ogg';
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return 'mp3';
  if (mime === 'audio/aac') return 'aac';
  if (mime === 'audio/flac') return 'flac';
  if (mime === 'audio/aiff') return 'aiff';
  if (mime === 'audio/wav' || mime === 'audio/x-wav') return 'wav';
  return extFromName || 'wav';
}

window.uploadMeetingAudioToPrivateBlob = async function uploadMeetingAudioToPrivateBlob({
  blob,
  displayName,
  mimeType,
  ticket,
  onProgress,
  abortSignal
}) {
  if (!(blob instanceof Blob) || !blob.size) {
    throw new Error('沒有可上傳的音檔內容。');
  }
  if (!ticket) {
    throw new Error('缺少音檔上傳授權票證。');
  }

  const normalizedMimeType = String(mimeType || blob.type || 'audio/wav').toLowerCase();
  const extension = extensionForMime(normalizedMimeType, displayName);
  const base = safeBaseName(String(displayName || 'meeting-audio').replace(/\.[^.]+$/, ''));
  const pathname = `meeting-audio/${Date.now()}-${base}.${extension}`;
  const result = await upload(pathname, blob, {
    access: 'private',
    contentType: normalizedMimeType,
    handleUploadUrl: '/api/blob-upload',
    clientPayload: JSON.stringify({ ticket }),
    multipart: blob.size > 100 * 1024 * 1024,
    abortSignal,
    onUploadProgress(event) {
      if (typeof onProgress !== 'function') return;
      const pct = Math.max(0, Math.min(100, Math.round(Number(event.percentage) || 0)));
      const loaded = Number(event.loaded) || 0;
      const total = Number(event.total) || blob.size;
      onProgress(
        `正在安全上傳至 Vercel Private Blob… ${pct}%（${(loaded / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB）`,
        { percentage: pct, loaded, total }
      );
    }
  });

  if (!result?.url) {
    throw new Error('Vercel Blob 沒有回傳音檔位置。');
  }
  return result;
};
