# Meeting 助手（GitHub／Vercel 網路版 V3.2.0）

本專案可直接上傳 GitHub，再由 Vercel 連結部署。Gemini API Key 只存在 Vercel 後端，不會寫入 GitHub、HTML、瀏覽器 localStorage 或前端請求網址。

## V3.2.0 主要功能

- 首次開啟時顯示網站存取碼安全驗證視窗；存取碼只暫存在目前分頁的 `sessionStorage`。
- 上傳／壓縮流程新增「暫停／繼續」與「取消並清除」。
- 內建錄音壓縮器，可選 OGG／Opus 或 WAV、壓縮模式與 14.5 MB 目標上限。
- 錄音超過 15 MB 時會主動詢問是否切換壓縮模式。
- 壓縮完成後可直接自動接續 Private Blob 上傳與 Gemini AI 分析，不需重新選擇檔案。
- 專有名詞詞庫、自動校正詞典與老師姓名預設收合，主動點選後才顯示。
- 壓縮工作在瀏覽器本機完成；只有送交 AI 分析時才會將壓縮後音檔安全上傳。

### 暫停行為說明

- 本機壓縮會在可安全停止的檢查點暫停。
- Vercel Blob 上傳可立即中止；按「繼續」時會重新開始目前上傳階段。
- 已在伺服器執行的 Gemini 匯入或 AI 生成不會強制重送，以避免重複用量；暫停會在目前伺服器步驟完成後生效。
- 「取消並清除」只停止目前工作與清除上傳介面，不會刪除已完成的 Meeting 紀錄。

## 安全上傳架構

```text
瀏覽器本機壓縮（選用）
        ↓
瀏覽器把音檔直傳 Vercel Private Blob
        ↓
Vercel Function 從 Private Blob 依 Gemini 分段規格匯入 Files API
        ↓
匯入完成後刪除 Private Blob 暫存音檔
        ↓
Gemini 產生逐字稿與分析結果
```

## 上傳 GitHub

1. 解壓縮 ZIP。
2. 把解壓縮資料夾內的全部內容上傳到 GitHub Repository 根目錄。
3. 根目錄應直接看到 `index.html`、`api`、`lib`、`src`、`package.json`、`vercel.json`。
4. 請特別確認新增／更新：
   - `index.html`
   - `src/audio-compressor.js`
   - `src/blob-upload.js`
   - `api/blob-upload-ticket.js`
   - `api/blob-upload.js`
   - `lib/blob-to-gemini.js`
5. Commit message 可填：`Meeting Assistant V3.2.0 integrated compressor`。

## Vercel 必要設定

沿用既有設定，不需要因 V3.2.0 新增其他環境變數：

```text
GEMINI_API_KEY_1=第一組 Gemini Key
GEMINI_API_KEY_2=第二組 Gemini Key（選填）
GEMINI_API_KEY_3=第三組 Gemini Key（選填）
APP_ACCESS_TOKEN=網站存取碼
BLOB_UPLOAD_SIGNING_SECRET=至少 32 字元隨機字串
BLOB_READ_WRITE_TOKEN=Vercel Private Blob 讀寫 Token
```

Private Blob Store 必須連接目前專案並套用 Production／Preview。詳細步驟見 [`01_先建立Vercel_Private_Blob.txt`](01_先建立Vercel_Private_Blob.txt)。

## 部署後

GitHub Commit 後等待 Vercel 最新 Production Deployment 顯示 `Ready / Current`，再用 `Ctrl + Shift + R` 強制重新載入網站。

## API 路由

```text
GET  /api/health
POST /api/blob-upload-ticket
POST /api/blob-upload
POST /api/gemini-import-blob
POST /api/gemini-file-status
POST /api/gemini-generate
```

## 資料保存範圍

逐字稿與分析保存在瀏覽器 localStorage；錄音保存在 IndexedDB。Vercel Private Blob 只作為 Gemini 匯入前的短暫中繼，後端完成或失敗後都會嘗試立即刪除。壓縮輸出只存在目前瀏覽器記憶體，下載、送交分析或清除後即可釋放。

## 本機檢查

```bash
npm install
npm test
npm run check
npm run build
```

真實 Private Blob、Gemini API 與長錄音仍需在部署後以你的 Vercel 專案進行端到端測試。
