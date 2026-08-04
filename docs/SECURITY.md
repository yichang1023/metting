# 安全規則

## 絕對禁止

- 不得把真實 Gemini API Key 寫進 `index.html`。
- 不得把真實 Gemini API Key 寫進 `.env.example`。
- 不得上傳 `.env`、`.env.local` 或任何含金鑰的截圖到 GitHub。
- 不得將 `GEMINI_API_KEY_1` 改名為任何 `PUBLIC_`、`VITE_` 或 `NEXT_PUBLIC_` 開頭的變數。

## 三組 Key 的用途

- Key 1：主要使用。
- Key 2：建立上傳工作失敗時的備援。
- Key 3：第二備援與輪替。

同一個音檔在 Gemini Files API 建立後，後續分析會沿用建立該檔案的 Key slot。這是為了避免三組 Key 屬於不同 Google Cloud Project 時，另一組 Key 無法讀取該 file URI。

三組 Key 若都屬於同一個 Google Cloud Project，通常仍共用該 Project 的配額；它們不是把官方配額乘以三的機制。

## 網站存取碼

建議在 Vercel 設定：

```text
APP_ACCESS_TOKEN=一組至少24字元的隨機字串
```

使用者進入網站後，在「設定 → Vercel API 連線」輸入同一組存取碼。存取碼只暫存在該分頁的 `sessionStorage`，關閉工作階段後需重新輸入。

## 會議隱私

V3.0 仍將逐字稿與音檔保存在使用者瀏覽器中。請勿在公用電腦處理含學生姓名、醫療資訊或未公開研究資料的錄音。完成後應登出電腦、關閉瀏覽器，必要時清除網站資料。
