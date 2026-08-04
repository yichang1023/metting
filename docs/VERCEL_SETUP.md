# Vercel 設定

## 一、Environment Variables

至少需要：

```text
GEMINI_API_KEY_1
APP_ACCESS_TOKEN
BLOB_UPLOAD_SIGNING_SECRET
```

可再加入：

```text
GEMINI_API_KEY_2
GEMINI_API_KEY_3
GEMINI_MODEL
GEMINI_MODEL_POLISH
ALLOWED_ORIGIN
MAX_UPLOAD_BYTES
GEMINI_MAX_OUTPUT_TOKENS
GEMINI_TIMEOUT_MS
GEMINI_UPLOAD_CHUNK_TIMEOUT_MS
```

`BLOB_UPLOAD_SIGNING_SECRET` 建議使用至少 32 字元隨機字串，不要使用 Gemini Key。

## 二、建立 Vercel Private Blob

1. Project → Storage。
2. Create Database / Create Store。
3. 選 Blob。
4. Access 選 Private。
5. 連接目前 Project。
6. 確認 Environment Variables 自動出現 `BLOB_READ_WRITE_TOKEN`。

不要建立 Public Blob，因為會議錄音可能包含個人資料與研究內容。

## 三、部署設定

- Framework Preset 可由 Vercel自動偵測 Vite。
- Build Command 使用 `npm run build`。
- Output Directory 由 Vite 預設為 `dist`。
- Root Directory 必須是直接包含 `index.html` 與 `package.json` 的位置。

## 四、重新部署

環境變數或 Blob Store 新增後，必須建立新的部署：

```text
Deployments → 最新部署右側 ⋯ → Redeploy
```

## 五、健康檢查

正常應顯示：

```text
keyCount: 1～3
blobConfigured: true
uploadTicketConfigured: true
```

若 `blobConfigured: false`，代表 `BLOB_READ_WRITE_TOKEN` 尚未連接到目前環境。

若 `uploadTicketConfigured: false`，請新增 `BLOB_UPLOAD_SIGNING_SECRET`，或確認 `APP_ACCESS_TOKEN` 已設定。
