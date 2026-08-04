# 安全設計

## Gemini API Key

Gemini API Key 只由 Vercel Function 的 `process.env` 讀取，不會傳到瀏覽器。

## 音檔

- 瀏覽器使用 Vercel Blob client upload 直接上傳，避免經過 Vercel Function 4.5 MB request body 限制。
- Blob Store 必須為 Private。
- 上傳前由受 `APP_ACCESS_TOKEN` 保護的 API 核發短效 HMAC 票證。
- Blob client token 只允許 `audio/wav`、限定最大檔案大小、限定路徑與短效期限。
- 後端完成或失敗後都會嘗試刪除 Private Blob 暫存音檔。

## 網站存取碼

前端只將 `APP_ACCESS_TOKEN` 暫存在 sessionStorage，關閉分頁後清除。正式多人環境仍建議改用真正的帳號登入與使用者權限。

## 尚未涵蓋

- 多使用者帳號與角色權限
- 雲端資料庫
- 完整稽核紀錄
- 每位使用者配額
- 分散式背景工作佇列
