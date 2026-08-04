# Vercel 設定清單

## 必填環境變數

```text
GEMINI_API_KEY_1
```

## 建議一起設定

```text
GEMINI_API_KEY_2
GEMINI_API_KEY_3
GEMINI_MODEL=gemini-3.6-flash
GEMINI_MODEL_POLISH=gemini-3.6-flash
APP_ACCESS_TOKEN=自行產生的長字串
MAX_PROXY_CHUNK_BYTES=2097152
```

## Vercel 操作位置

1. Vercel Dashboard 選擇專案。
2. 進入 `Settings`。
3. 選擇 `Environment Variables`。
4. 逐一新增上述變數。
5. Environment 建議同時勾選 `Production`、`Preview`。
6. 儲存後進入 `Deployments`，對最新部署按 `Redeploy`。

環境變數的修改不會套用到已經完成的舊部署，必須重新部署。

## 部署後檢查

先開啟：

```text
https://你的網址.vercel.app/api/health
```

若未設定 `APP_ACCESS_TOKEN`，應看到類似：

```json
{
  "ok": true,
  "keyCount": 3,
  "model": "gemini-3.6-flash"
}
```

若已設定 `APP_ACCESS_TOKEN`，直接開 `/api/health` 會顯示未授權；請從 Meeting 助手設定頁輸入存取碼後按「檢查連線」。

## 若曾出現 Failed to fetch

V3.0.2 已取消瀏覽器直接跨網域上傳 Google 的方式，改成 2 MiB 分段經 `/api/gemini-upload-chunk` 轉送。更新 GitHub 後請等待 Vercel 自動部署完成，或手動 Redeploy。

部署後可開啟 `/api`，確認端點清單包含：

```text
POST /api/gemini-upload-chunk
```
