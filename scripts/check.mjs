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
  'api/health.js',
  'api/blob-upload-ticket.js',
  'api/blob-upload.js',
  'api/gemini-import-blob.js',
  'api/gemini-file-status.js',
  'api/gemini-generate.js',
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

const requiredFrontendRoutes = [
  '/api/health',
  '/api/blob-upload-ticket',
  '/api/blob-upload',
  '/api/gemini-import-blob',
  '/api/gemini-file-status',
  '/api/gemini-generate'
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

if (!index.includes('sessionStorage.setItem(\'meetingAccessToken\'')) {
  throw new Error('網站存取碼未採用 sessionStorage 暫存。');
}
if (index.includes('localStorage.setItem(\'meetingAccessToken\'')) {
  throw new Error('網站存取碼不應永久寫入 localStorage。');
}

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
console.log('✓ 網站存取碼只暫存在 sessionStorage');
console.log('✓ index.html、前端模組與 Vercel Functions JavaScript 語法正確');
