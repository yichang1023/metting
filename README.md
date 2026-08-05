# Meeting 助手（GitHub／Vercel 網路版 V3.3.0）

本專案可直接上傳 GitHub，再由 Vercel 連結部署。Gemini API Key 只存在 Vercel 後端，不會寫入 GitHub、HTML、瀏覽器 localStorage 或前端請求網址。

## V3.3.0 主要功能

- 首次開啟時顯示網站存取碼安全驗證視窗；可選擇在私人裝置安全記住 30 天。
- 網站存取碼不會明文寫入 localStorage；登入狀態由 Vercel 後端簽發 HttpOnly Cookie 保存。
- 手機／平板新增底部快速導覽、左側右滑返回、瀏覽器返回鍵與回頂端按鈕。
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

## 記住登入的安全設計

- 勾選「在此私人裝置記住 30 天」後，後端只在瀏覽器建立簽章 Cookie，不保存明文存取碼。
- Cookie 設為 `HttpOnly`，前端 JavaScript 無法讀取內容。
- 不勾選時使用瀏覽器工作階段 Cookie；通常關閉整個瀏覽器後失效。
- 主動按「登出此裝置」、清除 Cookie、使用無痕模式、換瀏覽器／裝置，或管理者更換 `APP_ACCESS_TOKEN` 後，需重新驗證。
- 請勿在公共電腦勾選記住登入。

## 行動裝置操作

- 底部快速導覽：首頁、上傳、分析、更多。
- 從畫面左側向右滑：回到 Meeting 助手內的上一頁。
- 左上角 `←`：與右滑相同。
- 手機瀏覽器返回鍵：可返回上一個功能頁。
- 向下瀏覽較長內容時，右下角會出現回頂端按鈕。

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
5. Commit message 可填：`Meeting Assistant V3.3.0 remembered login and mobile navigation`。

## Vercel 必要設定

沿用既有設定即可；V3.3.0 不強制新增環境變數：

```text
GEMINI_API_KEY_1=第一組 Gemini Key
GEMINI_API_KEY_2=第二組 Gemini Key（選填）
GEMINI_API_KEY_3=第三組 Gemini Key（選填）
APP_ACCESS_TOKEN=網站存取碼
BLOB_UPLOAD_SIGNING_SECRET=至少 32 字元隨機字串
BLOB_READ_WRITE_TOKEN=Vercel Private Blob 讀寫 Token
# SESSION_SECRET=選填；若未設定，登入 Cookie 會使用 APP_ACCESS_TOKEN 簽章
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
POST /api/session-login
GET  /api/session-status
POST /api/session-logout
```

## 資料保存範圍

逐字稿與分析保存在瀏覽器 localStorage；錄音保存在 IndexedDB，因此不同裝置之間不會自動同步。記住登入只保存本裝置的驗證狀態，不會同步 Meeting 資料。Vercel Private Blob 只作為 Gemini 匯入前的短暫中繼，後端完成或失敗後都會嘗試立即刪除。壓縮輸出只存在目前瀏覽器記憶體，下載、送交分析或清除後即可釋放。

## 本機檢查

```bash
npm install
npm test
npm run check
npm run build
```

真實 Private Blob、Gemini API 與長錄音仍需在部署後以你的 Vercel 專案進行端到端測試。
