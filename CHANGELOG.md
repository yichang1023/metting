# Changelog

## 3.3.0

- 網站存取碼新增「在此私人裝置記住 30 天」。
- 不將網站存取碼明文寫入 localStorage；改由 Vercel 後端簽發 `HttpOnly`、`SameSite=Lax` 安全 Cookie。
- 新增 `/api/session-login`、`/api/session-status`、`/api/session-logout`。
- 關閉分頁或重新開啟網站後，只要安全 Cookie 尚未到期，即可自動通過驗證。
- 使用者主動登出、清除瀏覽器 Cookie、切換裝置／瀏覽器，或管理者變更 `APP_ACCESS_TOKEN` 後，仍需重新輸入。
- 行動裝置新增底部快速導覽列：首頁、上傳、分析、更多。
- 手機／平板可從畫面左側向右滑，返回 Meeting 助手內的上一頁。
- 支援瀏覽器返回鍵、行動版上一頁按鈕與回到頁面頂端按鈕。
- 行動版觸控目標加大，加入安全區 padding，降低誤觸與被瀏海／Home Indicator 遮住的情形。

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
- 新增 Vercel Private Blob client upload、短效 HMAC 上傳票證與 Gemini 匯入流程。

## 3.0.1

- 移除前端 Gemini API Key 輸入與 localStorage 保存。
- Gemini 請求改由 Vercel Functions 代理。
