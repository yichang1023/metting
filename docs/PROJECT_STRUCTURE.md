# 專案架構

```text
meeting-assistant/
├── index.html                    # 完整前端網頁與既有 Meeting 助手功能
├── api/
│   ├── index.js                  # API 說明
│   ├── health.js                 # 檢查 Vercel、模型與 Key 數量
│   ├── gemini-upload-start.js    # 由伺服器安全建立 Gemini Files API 上傳工作
│   ├── gemini-upload-chunk.js    # 將 2 MiB 音檔分段安全轉送至 Gemini
│   ├── gemini-file-status.js     # 以同一 Key 檢查音檔是否已可供模型使用
│   └── gemini-generate.js        # 由伺服器呼叫 Gemini 分析／潤稿
├── lib/
│   ├── http.js                   # HTTP、JSON、錯誤、存取碼與 CORS 共用邏輯
│   └── gemini.js                 # 三組 Key、模型、上傳工作與 generateContent
├── tests/                        # 不需真實 API Key 的單元測試
├── scripts/check.mjs             # 語法、安全字串與必要檔案檢查
├── docs/
│   ├── PROJECT_STRUCTURE.md
│   ├── SECURITY.md
│   └── VERCEL_SETUP.md
├── .env.example                  # 只有變數名稱，絕不放真實值
├── .gitignore                    # 阻止 .env 與本機機密上傳 GitHub
├── package.json
├── vercel.json
├── robots.txt
├── CHANGELOG.md
└── README.md
```

## 目前資料儲存方式

這個 V3.0.2 基礎版先保留原單機版的資料方式：

- 逐字稿、摘要、任務、筆記：瀏覽器 `localStorage`
- 原始錄音或抽取音訊：瀏覽器 `IndexedDB`
- Gemini API Key：Vercel Environment Variables

因此同一個 Vercel 網址在不同電腦開啟時，會議紀錄仍不會自動同步。雲端資料庫與登入屬於下一階段，不能誤認為本版已完成多人或跨裝置同步。
