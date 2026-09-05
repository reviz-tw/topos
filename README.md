# Topos (τόπος)

基於公聽會與辯論逐字稿的公眾審議與 AI 觀點探索平台。靈感源自 Talk to the City (T3C)，旨在將大規模質性意見結構化，呈現議題核心爭點（Cruxes），並透過 LLM 引導公眾進行客觀中立的議題思辨。

---

## 架構設計

```
[ 使用者瀏覽器 (React + Google One Tap) ]
                   │
                   ▼ (Authorization: Bearer <Google ID Token>)
[ GCP Cloud Run (Go Server: topos-server) ]
     ├─ Google ID Token 驗證 & 每小時 Rate Limiting (防濫用)
     ├─ 檢索模組 (Vertex AI Search Data Store / 本機逐字稿)
     └─ 推理模組 (Cloudflare Workers AI 支援 Google Gemma / Qwen)
                   │
                   ▼
[ GCP GCS Bucket (gs://topos-data-elix-498805) ]
     └─ 2021 核四公投 5 場辯論會逐字稿 (READr CC0 授權)
```

---

## 專案結構

```
topos/
├── data/
│   └── debates/
│       └── nuclear4/             # 5 場辯論完整逐字稿 (.md)
├── scripts/
│   └── fetch_debates.py          # 下載與整理逐字稿腳本
├── server/                       # Go 後端 (Cloud Run)
│   ├── cmd/server/main.go        # HTTP 路由、審議對話 API
│   ├── internal/auth/            # Google Identity 驗證與 Rate Limiter
│   ├── internal/models/          # 議題、爭點、訊息資料結構
│   ├── internal/rag/             # 檢索與 Cloudflare Google Gemma 推理引擎
│   └── Dockerfile                # 多階段超輕量 Distroless 容器
├── web/                          # 前端 (React + TypeScript)
│   ├── src/App.tsx               # 議題瀏覽、爭點卡片、Google One Tap 登入
│   └── index.html                # 引入 Google Identity Services
└── cloudbuild.yaml               # GCP Cloud Build 自動部署至 Cloud Run
```

---

## 快速上手與部署

### 1. 建立 GCS 儲存桶並上傳素材

在專案 `elix-498805` 建立儲存桶並上傳 5 場辯論逐字稿：

```bash
# 建立 GCS 儲存桶 (建議設在台灣 asia-east1)
gcloud storage buckets create gs://topos-data-elix-498805 \
  --project=elix-498805 \
  --location=asia-east1

# 上傳逐字稿
gcloud storage cp -r data/debates/nuclear4 gs://topos-data-elix-498805/debates/
```

### 2. 本地啟動 Go 伺服器

```bash
cd server
# 本地開發測試模式 (可使用 TOPOS_DEV_MOCK_AUTH=true 繞過 Google Token 驗證)
TOPOS_DEV_MOCK_AUTH=true go run ./cmd/server
```

伺服器將在 `http://localhost:8080` 啟動，可測試：
* `http://localhost:8080/healthz`
* `http://localhost:8080/api/topics`

### 3. GCP Cloud Run CI/CD (Cloud Build Trigger)

在 GCP Console 的 **Cloud Build > Triggers** 建立觸發條件：
* **Event**: Push to branch (main)
* **Configuration**: Cloud Build configuration file (`cloudbuild.yaml`)
* **Substitutions 變數**:
  * `_LOCATION`: `asia-east1`
  * `_SERVICE_NAME`: `topos-server`
  * `_CLOUDFLARE_ACCOUNT_ID`: 您的 Cloudflare Account ID
  * `_VERTEX_SEARCH_DATASTORE_ID`: 您的 Vertex AI Data Store ID

### 4. 前端 Google One Tap 設定

1. 前往 [Google Cloud Console Credentials](https://console.cloud.google.com/apis/credentials?project=elix-498805)。
2. 建立 **OAuth 2.0 Client ID**（Web application）。
3. 在「已授權的 JavaScript 來源」填入前端網址（如 `http://localhost:5173` 或 Cloudflare Pages 網址）。
4. 將產生的 Client ID 設定在前端環境變數或 `App.tsx` 即可啟用右上角自動彈出的 One Tap 登入卡片。
