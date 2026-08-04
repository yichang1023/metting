# Meeting 助手（GitHub／Vercel 網路版 V3.0.2）

這個資料夾已整理成可以直接上傳 GitHub，之後由 Vercel 連結部署的完整專案。

## 你現在只要做的 GitHub 步驟

1. 先把下載的 ZIP 解壓縮。
2. 到 GitHub 建立一個新的 Repository，名稱建議：`meeting-assistant`。
3. Repository Visibility 建議選 **Private**。
4. 建立時不要另外勾選 README、`.gitignore` 或 License，因為本專案已經包含。
5. 進入空白 Repository，按 `uploading an existing file` 或 `Add file → Upload files`。
6. 將解壓縮後資料夾裡的**全部內容**拖曳進去，包括：
   - `api` 資料夾
   - `lib` 資料夾
   - `docs` 資料夾
   - `tests` 資料夾
   - `index.html`
   - `package.json`
   - `vercel.json`
   - `.gitignore`
   - `.env.example`
7. Commit message 輸入：`Meeting Assistant V3.0.2 update`
8. 按 `Commit changes`。

> 不要把 ZIP 檔本身直接上傳 Repository；GitHub 不會自動解壓縮成專案結構。

## 專案如何運作

```text
瀏覽器 index.html
    ├─ /api/health
    ├─ /api/gemini-upload-start ── Vercel 讀取三組 Gemini Key並建立上傳工作
    ├─ /api/gemini-upload-chunk ── 2 MiB 分段經 Vercel 安全轉送 Gemini
    ├─ /api/gemini-file-status ─── 等待音檔處理完成
    └─ /api/gemini-generate ────── Vercel 呼叫 Gemini 分析
```

Gemini API Key 只由 Vercel Function 透過 `process.env` 讀取，不會出現在 GitHub、HTML、前端 JavaScript 或瀏覽器 localStorage。

## Vercel 需要設定的變數

至少設定：

```text
GEMINI_API_KEY_1
```

完整建議：

```text
GEMINI_API_KEY_1
GEMINI_API_KEY_2
GEMINI_API_KEY_3
GEMINI_MODEL=gemini-3.6-flash
GEMINI_MODEL_POLISH=gemini-3.6-flash
APP_ACCESS_TOKEN=只有你知道的長字串
```

詳細步驟請看 [`docs/VERCEL_SETUP.md`](docs/VERCEL_SETUP.md)。

## 目前版本的重要界線

本版已將 Gemini Key 安全移到 Vercel，但會議內容仍保存在目前瀏覽器：

- 逐字稿與分析：localStorage
- 錄音檔：IndexedDB

換電腦或換瀏覽器不會自動看到原本的 Meeting。雲端資料庫、登入與跨裝置同步要在下一階段加入。

## 本機檢查（非必要）

安裝 Node.js 20 以上與 Vercel CLI 後：

```bash
npm test
npm run check
npm install -g vercel
vercel dev
```

## 官方技術依據

- Vercel Functions request／response body 上限為 4.5 MB，因此音訊切成 2 MiB 分段，每一段分別經 Function 轉送。
- Vercel Environment Variables 可在 Function 中由 `process.env` 讀取，修改後需重新部署。
- Gemini Files API 用於上傳並在模型請求中引用音訊檔。
- 預設模型設為正式可用的 `gemini-3.6-flash`，也可由 Vercel 變數更換。
