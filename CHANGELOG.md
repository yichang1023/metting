# Changelog

## 3.0.1 - 2026-08-05

- 修正 `index.html` 仍顯示 Gemini API Key 輸入欄位的重大問題。
- 移除前端 `geminiApiKey`、`saveApiKey()` 與直接呼叫帶 Key 的 Google API。
- 所有錄音分析與 AI 潤稿改由 Vercel Functions 代理。
- 所有音檔統一由 Vercel 建立 Gemini Files API 上傳工作，再由瀏覽器使用一次性上傳網址送檔。
- 新增 Vercel 後端健康檢查與選填網站存取碼。
- 強化自動檢查，若前端再次出現 API Key 輸入或 `?key=` URL，建置檢查會直接失敗。

## 3.0.0 — GitHub / Vercel 網路版基礎架構

- 保留原單機版的儀表板、錄音上傳、逐字稿、摘要、下次作業、待辦、多加留意、老師提醒、日曆、研究進度與垃圾桶。
- Gemini API Key 不再寫入 `index.html` 或瀏覽器 `localStorage`。
- 新增 Vercel Functions：
  - `GET /api/health`
  - `POST /api/gemini-upload-start`
  - `POST /api/gemini-file-status`
  - `POST /api/gemini-generate`
- 支援三組 Gemini API Key 的伺服器端選擇與文字請求故障轉移。
- 音訊由 Vercel 建立上傳工作後，瀏覽器直接傳送至 Gemini Files API，避免 Vercel Function 4.5 MB request body 限制。
- 新增可選的 `APP_ACCESS_TOKEN` 網站存取保護。
- 修正 Prompt 中 speaker 規則與 JSON 範例互相矛盾的問題。
- 保留原始逐字稿解析、截斷 JSON 修復、說話者顛倒偵測與校正詞庫。

## 2.1.0 — 原單機版基準

- AI 潤稿、逐字稿編輯、校正學習、音檔 IndexedDB 保存等既有功能。
