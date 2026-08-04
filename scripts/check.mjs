import { readFile, readdir, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = [
  'index.html',
  'package.json',
  'vercel.json',
  'api/health.js',
  'api/gemini-upload-start.js',
  'api/gemini-file-status.js',
  'api/gemini-generate.js',
  'lib/http.js',
  'lib/gemini.js'
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
  'AIza'
];
for (const value of forbidden) {
  if (index.includes(value)) throw new Error(`index.html 仍含不安全字串：${value}`);
}

const requiredFrontendRoutes = [
  '/api/health',
  '/api/gemini-upload-start',
  '/api/gemini-file-status',
  '/api/gemini-generate'
];
for (const route of requiredFrontendRoutes) {
  if (!index.includes(route)) throw new Error(`index.html 尚未接上 Vercel 後端：${route}`);
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

for (const dir of ['api', 'lib']) {
  for (const file of await readdir(path.join(root, dir))) {
    if (!file.endsWith('.js')) continue;
    const checked = spawnSync(process.execPath, ['--check', path.join(root, dir, file)], { encoding: 'utf8' });
    if (checked.status !== 0) throw new Error(checked.stderr || `${dir}/${file} 語法錯誤`);
  }
}

console.log('✓ 必要檔案完整');
console.log('✓ 前端沒有 Gemini API Key 輸入欄位、儲存邏輯或帶 key 的 Google API URL');
console.log('✓ 前端已接上四個 Vercel API 端點');
console.log('✓ 網站存取碼只暫存在 sessionStorage');
console.log('✓ index.html 與 Vercel Functions JavaScript 語法正確');
