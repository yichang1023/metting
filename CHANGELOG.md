# Changelog

## 3.2.0

- 首次進入新增網站存取碼安全驗證彈窗，並提示大於 15 MB 可先使用內建壓縮器。
- 上傳與壓縮工作新增暫停／繼續及取消並清除控制。
- 整合單機 Meeting 錄音壓縮器，可輸出 OGG／Opus 或 WAV。
- 壓縮完成後可自動接續 Vercel Private Blob 與 Gemini AI 分析。
- 直接模式選到大於 15 MB 的音訊時，會詢問是否切換壓縮模式。
- 專有名詞詞庫、自動校正詞典與老師姓名改為預設收合。
- Blob 上傳支援 WAV、OGG、MP3、AAC、FLAC 與 AIFF MIME 類型。
- Blob Client Upload 支援 AbortSignal 與實際上傳進度。
- AI 生成與伺服器匯入採安全暫停點，避免中途重送造成重複 API 用量。

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
