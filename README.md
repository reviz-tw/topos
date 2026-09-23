# Topos (τόπος)

基於公聽會與辯論逐字稿的公眾審議與 AI 觀點探索平台。靈感源自 Talk to the City (T3C)，旨在將大規模質性意見結構化，呈現議題核心爭點（Cruxes），並透過 LLM 引導公眾進行客觀中立的議題思辨。

---

## 架構設計

```
[ 使用者瀏覽器 (React + TypeScript Neo-Brutalist UI) ]
   ├── 模式一：【觀點思辨與爭點探索】(Cruxes & Deliberation Chat)
   └── 模式二：【一對一 AI 訪談 (Harmonica)】
         ├── 連接指定訪談 (預設核電重啟: 6o0ryapw2o / 或貼入任意 Session ID)
         ├── ➕ 「發起新訪談」(可一鍵將議題爭點 Cruxes 自動轉為推薦提綱)
         └── 訪談對話匯出 (tttc.csv / JSON)
                   │
                   ▼ (HTTP API / CORS Proxy)
[ GCP Cloud Run (Go Server: topos-server) ]
   ├─ Google ID Token 驗證 & Rate Limiter (防濫用)
   ├─ 檢索模組 (Vertex AI Search Data Store / 本機逐字稿)
   ├─ Harmonica 服務模組 (/api/harmonica/* 代理與會話關聯)
   └─ 推理模組 (Cloudflare Workers AI: 免費 Google Gemma 4 @cf/google/gemma-4-26b-a4b-it)
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
│       ├── nuclear4/             # 5 場辯論完整逐字稿 (.md)
│       └── sports_station/       # 台北市運動驛站辯論與公聽會資料 (.md)
├── scripts/
│   └── fetch_debates.py          # 下載與整理逐字稿腳本
├── server/                       # Go 後端 (Cloud Run)
│   ├── cmd/server/main.go        # HTTP 路由、審議對話 & Harmonica API
│   ├── internal/auth/            # Google Identity 驗證與 Rate Limiter
│   ├── internal/harmonica/       # Pocket Harmonica 訪談代理與多會話管理服務
│   ├── internal/models/          # 議題、爭點、訊息與訪談資料結構
│   ├── internal/rag/             # 檢索與 Cloudflare Google Gemma 4 推理引擎
│   └── Dockerfile                # 多階段超輕量 Distroless 容器
├── web/                          # 前端 (React + TypeScript + Tailwind)
│   ├── src/components/
│   │   ├── HarmonicaInterview.tsx# 一對一 AI 訪談、進度條、匯出與發起新訪談組件
│   │   └── LanguageSelector.tsx  # 多語系切換器
│   ├── src/App.tsx               # 雙模式切換、議題瀏覽、爭點卡片
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
