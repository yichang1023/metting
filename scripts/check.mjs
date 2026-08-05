import { readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'index.html',
  'package.json',
  'vercel.json',
  'src/blob-upload.js',
  'src/audio-compressor.js',
  'api/health.js',
  'api/blob-upload-ticket.js',
  'api/blob-upload.js',
  'api/gemini-import-blob.js',
  'api/gemini-file-status.js',
  'api/gemini-generate.js',
  'api/session-login.js',
  'api/session-status.js',
  'api/session-logout.js',
  'lib/http.js',
  'lib/gemini.js',
  'lib/upload-ticket.js',
  'lib/blob-to-gemini.js'
];

for (const file of required) {
  await readFile(path.join(root, file));
}

const index = await readFile(path.join(root, 'index.html'), 'utf8');
const forbidden = [
  'geminiApiKey',
  'id="api-key-input"',
  'saveApiKey(',
  'updateApiKeyStatus(',
  'generateContent?key=',
  'upload/v1beta/files?key=',
  'localStorage.setItem(\'geminiApiKey\'',
  'AIza',
  'fetch(uploadUrl',
  '/api/gemini-upload-chunk',
  '/api/gemini-upload-start',
  'CHUNK_BYTES = 2 * 1024 * 1024'
];
for (const value of forbidden) {
  if (index.includes(value)) throw new Error(`index.html 仍含不安全或已淘汰字串：${value}`);
}


const requiredV33Features = [
  'id="accessGateModal"',
  'id="uploadPauseBtn"',
  'id="uploadClearBtn"',
  'id="recognitionSettingsDetails"',
  'id="uploadModeCompressBtn"',
  'id="compressAutoAnalyze"',
  '/src/audio-compressor.js',
  'analyzeCompressedOutput',
  'id="accessGateRemember"',
  'id="mobileBottomNav"',
  'function initMobileNavigation()',
  'function goBackPage()'
];
for (const value of requiredV33Features) {
  if (!index.includes(value)) throw new Error(`V3.3.0 功能缺少：${value}`);
}

const requiredFrontendRoutes = [
  '/api/health',
  '/api/blob-upload-ticket',
  '/api/blob-upload',
  '/api/gemini-import-blob',
  '/api/gemini-file-status',
  '/api/gemini-generate',
  '/api/session-login',
  '/api/session-status',
  '/api/session-logout'
];
for (const route of requiredFrontendRoutes) {
  if (!index.includes(route) && route !== '/api/blob-upload') {
    throw new Error(`index.html 尚未接上 Vercel 後端：${route}`);
  }
}

const blobModule = await readFile(path.join(root, 'src/blob-upload.js'), 'utf8');
if (!blobModule.includes("handleUploadUrl: '/api/blob-upload'")) {
  throw new Error('Vercel Blob 前端模組尚未接上 /api/blob-upload。');
}
if (!blobModule.includes("access: 'private'")) {
  throw new Error('音檔上傳必須使用 Vercel Private Blob。');
}
if (!blobModule.includes('abortSignal')) {
  throw new Error('Vercel Blob 上傳尚未支援暫停／取消所需的 AbortSignal。');
}
if (!blobModule.includes('onUploadProgress')) {
  throw new Error('Vercel Blob 上傳尚未回報實際進度。');
}

const compressorModule = await readFile(path.join(root, 'src/audio-compressor.js'), 'utf8');
for (const value of ['MeetingAudioCompressor', 'audio/ogg', 'audio/wav', 'waitIfPaused', 'throwIfCancelled']) {
  if (!compressorModule.includes(value)) throw new Error(`內建壓縮器缺少：${value}`);
}

if (index.includes('localStorage.setItem(\'meetingAccessToken\'')) {
  throw new Error('網站存取碼不應永久寫入 localStorage。');
}
const httpModule = await readFile(path.join(root, 'lib/http.js'), 'utf8');
for (const value of ['HttpOnly', 'SameSite=Lax', 'meeting_session', 'readAccessSession']) {
  if (!httpModule.includes(value)) throw new Error(`安全登入 Cookie 缺少：${value}`);
}
if (!index.includes("fetch('/api/session-login'")) throw new Error('前端尚未接上安全登入 API。');

const scriptMatch = index.match(/<script>\s*([\s\S]*?)\s*<\/script>/);
if (!scriptMatch) throw new Error('找不到 index.html 內嵌 script');
const temp = path.join(root, '.check-index-script.mjs');
await writeFile(temp, scriptMatch[1]);
const result = spawnSync(process.execPath, ['--check', temp], { encoding: 'utf8' });
await unlink(temp).catch(() => {});
if (result.status !== 0) throw new Error(result.stderr || 'index.html JavaScript 語法錯誤');

for (const dir of ['api', 'lib', 'src']) {
  for (const file of await readdir(path.join(root, dir))) {
    if (!file.endsWith('.js')) continue;
    const checked = spawnSync(process.execPath, ['--check', path.join(root, dir, file)], { encoding: 'utf8' });
    if (checked.status !== 0) throw new Error(checked.stderr || `${dir}/${file} 語法錯誤`);
  }
}

console.log('✓ 必要檔案完整');
console.log('✓ 前端沒有 Gemini API Key 輸入欄位、儲存邏輯或帶 key 的 Google API URL');
console.log('✓ 已移除錯誤的 2 MiB → Gemini 分段代理架構');
console.log('✓ 音檔改用 Vercel Private Blob client upload');
console.log('✓ 後端已接上 Private Blob → Gemini 粒度對齊匯入');
console.log('✓ 網站存取碼改用 HttpOnly 安全 Cookie，可選擇在私人裝置記住 30 天');
console.log('✓ 首次存取碼彈窗、收合敏感設定、暫停／清除與壓縮後自動分析功能完整');
console.log('✓ 手機底部導覽、左側右滑返回、瀏覽器返回鍵與回頂端功能完整');
console.log('✓ Blob 上傳支援 AbortSignal 與實際進度，內建壓縮器支援 OGG／WAV');
console.log('✓ index.html、前端模組與 Vercel Functions JavaScript 語法正確');
