# Changelog

## 3.1.1

- 修正 Content Security Policy 阻擋 Vercel Blob Client Upload。
- 在 `connect-src` 加入 `https://vercel.com`，允許 `@vercel/blob/client` 呼叫 `https://vercel.com/api/blob/`。
- 保留 Private Blob 與既有 Gemini、Google API 連線白名單。

## 3.1.0

- 修正 Gemini resumable upload 的 8 MiB chunk granularity 錯誤。
- 移除錯誤的 2 MiB Vercel Function → Gemini 分段代理。
- 新增 Vercel Private Blob client upload。
- 新增短效 HMAC 上傳票證。
- 新增 `/api/blob-upload-ticket`。
- 新增 `/api/blob-upload`。
- 新增 `/api/gemini-import-blob`。
- 後端依 Gemini 回傳的 `x-goog-upload-chunk-granularity` 分段匯入，缺省為 8 MiB。
- 匯入完成或失敗後嘗試刪除暫存 Blob。
- 新增 Vite 建置與 `@vercel/blob` 依賴。
- 健康檢查新增 `blobConfigured` 與 `uploadTicketConfigured`。

## 3.0.2

- 曾嘗試將音檔切成 2 MiB 後經 Vercel Function 轉送 Gemini。
- 此方式因 Gemini 非最後分段要求 8 MiB 粒度而淘汰。

## 3.0.1

- 移除前端 Gemini API Key 輸入與 localStorage 保存。
- Gemini 請求改由 Vercel Functions 代理。
