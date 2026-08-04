# Meeting 助手（GitHub／Vercel 網路版 V3.1.0）

本專案可直接上傳 GitHub，再由 Vercel 連結部署。Gemini API Key 只存在 Vercel 後端，不會寫入 GitHub、HTML、瀏覽器 localStorage 或前端請求網址。

## V3.1.0 為什麼改用 Vercel Private Blob

舊版把音檔切成 2 MiB 後逐段經 Vercel Function 轉送 Gemini，但 Gemini 回傳的 resumable upload 分段粒度為 8 MiB；非最後一段若不是該粒度的整數倍就會失敗。另一方面，Vercel Function 的 request／response body 上限是 4.5 MB，因此不能直接把 8 MiB 音檔段由瀏覽器送進 Function。

新版流程：

```text
瀏覽器把 WAV 直傳 Vercel Private Blob
        ↓
Vercel Function 從 Private Blob 讀取 8 MiB 對齊分段
        ↓
Vercel Function 將分段送進 Gemini Files API
        ↓
匯入完成後刪除 Private Blob 暫存音檔
        ↓
Gemini 產生逐字稿與分析結果
```

## 上傳 GitHub

1. 解壓縮 ZIP。
2. 把解壓縮資料夾內的全部內容上傳到 GitHub Repository 根目錄。
3. 根目錄應直接看到 `index.html`、`api`、`lib`、`src`、`package.json`、`vercel.json`。
4. Commit message 可填：`Meeting Assistant V3.1.0`。

## Vercel 必要設定

### 1. Environment Variables

```text
GEMINI_API_KEY_1=第一組 Gemini Key
GEMINI_API_KEY_2=第二組 Gemini Key（選填）
GEMINI_API_KEY_3=第三組 Gemini Key（選填）
APP_ACCESS_TOKEN=網站存取碼（強烈建議）
BLOB_UPLOAD_SIGNING_SECRET=至少 32 字元隨機字串（強烈建議）
```

### 2. 建立 Private Blob Store

進入 Vercel 專案的 `Storage`，建立 Blob Store，Access 必須選 **Private**，並連接目前專案。建立後 Vercel 會自動新增：

```text
BLOB_READ_WRITE_TOKEN
```

詳細步驟請先看：[`01_先建立Vercel_Private_Blob.txt`](01_先建立Vercel_Private_Blob.txt)。

### 3. 重新部署

環境變數或 Blob Store 設定完成後，到 `Deployments` 對最新部署執行 `Redeploy`，或重新提交一次 GitHub Commit。

## 部署後健康檢查

在網頁設定頁輸入 `APP_ACCESS_TOKEN` 後按「檢查連線」。正常健康狀態應包含：

```json
{
  "keyCount": 1,
  "blobConfigured": true,
  "uploadTicketConfigured": true
}
```

`keyCount` 會依實際設定的 Gemini Key 數量顯示 1～3。

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

目前逐字稿與分析仍保存在瀏覽器 localStorage；原始錄音保存在 IndexedDB。Vercel Private Blob 只作為 Gemini 匯入前的短暫中繼，後端完成或失敗後都會嘗試立即刪除。

## 本機檢查

```bash
npm install
npm test
npm run check
npm run build
```

本機完整測試 Private Blob callback 時，仍需使用 Vercel 開發環境或可公開回呼的測試網址。
