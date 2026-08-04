import { upload } from '@vercel/blob/client';

function safeBaseName(value) {
  return String(value || 'meeting-audio')
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}._-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'meeting-audio';
}

window.uploadMeetingAudioToPrivateBlob = async function uploadMeetingAudioToPrivateBlob({
  blob,
  displayName,
  ticket,
  onProgress
}) {
  if (!(blob instanceof Blob) || !blob.size) {
    throw new Error('沒有可上傳的音檔內容。');
  }
  if (!ticket) {
    throw new Error('缺少音檔上傳授權票證。');
  }

  const pathname = `meeting-audio/${Date.now()}-${safeBaseName(displayName)}.wav`;
  const result = await upload(pathname, blob, {
    access: 'private',
    contentType: 'audio/wav',
    handleUploadUrl: '/api/blob-upload',
    clientPayload: JSON.stringify({ ticket }),
    multipart: blob.size > 100 * 1024 * 1024,
    onUploadProgress(event) {
      if (typeof onProgress !== 'function') return;
      const pct = Math.max(0, Math.min(100, Math.round(Number(event.percentage) || 0)));
      const loaded = Number(event.loaded) || 0;
      const total = Number(event.total) || blob.size;
      onProgress(`正在安全上傳至 Vercel Private Blob… ${pct}%（${(loaded / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB）`);
    }
  });

  if (!result?.url) {
    throw new Error('Vercel Blob 沒有回傳音檔位置。');
  }
  return result;
};
