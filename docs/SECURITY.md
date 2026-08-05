# 安全設計

## Gemini API Key

Gemini API Key 只由 Vercel Function 的 `process.env` 讀取，不會傳到瀏覽器。

## 首次網站驗證

- 沒有有效網站存取碼時，首次開啟會顯示安全驗證彈窗。
- `APP_ACCESS_TOKEN` 只暫存在目前分頁的 sessionStorage，關閉分頁後清除。
- 前端彈窗只是使用體驗層；真正的存取限制仍由每個 Vercel API 路由在後端驗證。

## 音檔與壓縮

- 內建壓縮器在瀏覽器本機處理；壓縮階段不會上傳錄音。
- 只有使用者開始 AI 分析後，音檔才透過 Vercel Blob client upload 直接上傳。
- Blob Store 必須為 Private。
- 上傳前由受 `APP_ACCESS_TOKEN` 保護的 API 核發短效 HMAC 票證。
- Blob client token 限定音訊 MIME 類型、最大檔案大小、路徑與短效期限。
- 目前允許 WAV、OGG、MP3、AAC、FLAC 與 AIFF。
- 後端完成或失敗後都會嘗試刪除 Private Blob 暫存音檔。

## 暫停與取消

- Blob 上傳使用 AbortSignal，可在瀏覽器端中止目前傳輸。
- 本機壓縮使用合作式檢查點，避免在音訊資料結構寫入一半時破壞狀態。
- Gemini 匯入與 AI 生成已在伺服器端執行時，不會以重送方式模擬暫停，以避免重複用量。
- 取消目前工作不會刪除既有 Meeting 紀錄。

## 敏感辨識設定

專有名詞詞庫、自動校正詞典與老師姓名預設收合，避免進入設定頁就直接顯示。這些資料仍保存在目前瀏覽器本機；分析時會將必要辨識提示送給 Gemini。

## 尚未涵蓋

- 多使用者帳號與角色權限
- 雲端資料庫
- 完整稽核紀錄
- 每位使用者配額
- 分散式背景工作佇列
