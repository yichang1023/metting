# 專案結構

```text
meeting-assistant/
├── index.html                     # Meeting 助手主介面、首次驗證、壓縮／分析流程
├── src/
│   ├── audio-compressor.js        # 瀏覽器本機 OGG／WAV 壓縮器
│   └── blob-upload.js             # 瀏覽器直傳 Vercel Private Blob
├── api/
│   ├── index.js                   # API 路由摘要
│   ├── health.js                  # Gemini Key／Blob／票證設定檢查
│   ├── blob-upload-ticket.js      # 核發短效 HMAC 上傳票證
│   ├── blob-upload.js             # Vercel Blob client upload token route
│   ├── gemini-import-blob.js      # Private Blob → Gemini Files API
│   ├── gemini-file-status.js      # 查詢 Gemini 音檔處理狀態
│   └── gemini-generate.js         # 逐字稿、摘要與分析生成
├── lib/
│   ├── http.js                    # API 回應、錯誤與存取驗證
│   ├── gemini.js                  # Gemini Key、Files API 與生成請求
│   ├── upload-ticket.js           # 上傳票證簽章與驗證
│   └── blob-to-gemini.js          # 粒度對齊匯入與暫存刪除
├── tests/
│   └── config.test.js
├── scripts/
│   └── check.mjs
├── package.json
├── vercel.json
└── .env.example
```

## 音檔資料流

```text
原始錄音
→（選用）瀏覽器本機壓縮成 OGG／Opus 或 WAV
→ @vercel/blob/client upload（Private）
→ /api/gemini-import-blob
→ 依 Gemini 回傳的 chunk granularity 讀取 Private Blob
→ Gemini resumable upload
→ 刪除 Private Blob
→ 逐字稿與研究分析
```

## 本版仍使用瀏覽器本機保存

- 逐字稿與分析：localStorage
- 錄音：IndexedDB
- 網站存取碼：sessionStorage
- 尚未送出或下載的壓縮結果：目前分頁記憶體

雲端帳號、跨裝置同步與研究資料庫尚未加入。
