package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/reviz-tw/topos/server/internal/auth"
	"github.com/reviz-tw/topos/server/internal/mcp"
	"github.com/reviz-tw/topos/server/internal/models"
	"github.com/reviz-tw/topos/server/internal/rag"
)

var defaultTopics = []models.Topic{
	{
		ID:          "nuclear4",
		Title:       "台灣是否應該重啟核四（啟封商轉發電）？",
		Description: "回顧 2021 公投第 17 案及當前能源轉型爭議，探討地質耐震、工程整合、核廢料處置與供電穩定之交鋒。",
		Category:    "能源政策",
		Tags:        []string{"能源", "核能", "公投", "地質安全", "淨零碳排"},
		KeyCruxes: []models.Crux{
			{
				Title:       "地質與耐震安全",
				Description: "S 斷層與外海斷層是否連通，電廠耐震設計與 PGA 加速度能否承受強震？",
				ProPoints:   []string{"中央地調所報告載明非活動斷層", "即便保守推估地動值 0.57G 仍低於廠房耐震 0.66G，且可工程加固", "日本女川與柏崎刈羽核電廠均有耐震經驗"},
				ConPoints:   []string{"陳文山等學者提出外海活動斷層相連之新事證", "耐震標準若因新斷層大幅調高，核四難以完全保證無虞", "北部人口稠密，承受不起重大核災風險"},
			},
			{
				Title:       "工程整合與建廠測試",
				Description: "試運轉測試未完成 vs. 安檢報告完成，到底能否安全重啟？",
				ProPoints:   []string{"2014 年完成 231 份安檢報告", "一號機設備大多完好，缺少的零件與數位儀控可洽美商奇異公司重新採購", "國際上有類似封存後重啟並商轉之前例（如美國 Watts Bar）"},
				ConPoints:   []string{"許永輝處長指出試運轉測試 308 份未通過原能會審查", "歐美電器設備與日本 ABWR 廠房空間無法相容，管線狹小難以加固", "原廠團隊已解散，關鍵零件停產，重啟耗時且經費深不見底"},
			},
			{
				Title:       "能源配比、空污與淨零",
				Description: "重啟核四是否有助於減碳抑低空污，還是應全力發展綠能與天然氣？",
				ProPoints:   []string{"核能為零碳基載電力，可大幅減少中南部燃煤發電與肺腺癌空污風險", "天然氣儲存天數短，過度依賴天然氣有國安與斷氣封鎖風險", "再生能源具有間歇性，大型儲能成本過高"},
				ConPoints:   []string{"核四重啟至少需要 7~10 年以上，遠水救不了近火", "現代國際趨勢轉向風電、光電與分散式電網", "核廢料（低放與高放射性）在台灣無縣市願意接納最終處置場，形成世代不正義"},
			},
		},
	},
	{
		ID:          "sports-station",
		Title:       "台北市是否應於捷運站與登山口廣設「運動驛站」？",
		Description: "探討 2026 台北市長選舉中關於在捷運站、登山步道口增設更衣與盥洗設施之政見，權衡日常運動便利性、公共安全隱私與市政財政運維負擔。",
		Category:    "市政空間與體育政策",
		Tags:        []string{"台北市政", "運動友善", "公共設施", "治安隱私", "2026市長選舉", "捷運"},
		KeyCruxes: []models.Crux{
			{
				Title:       "日常運動門檻降低 vs. 現有運動中心資源重疊",
				Description: "點狀分布的簡易盥洗寄物設施是否真能提升運動頻率？還是應優先活化現有 12 區運動中心與特色站？",
				ProPoints:   []string{"降低戶外運動後更衣盥洗門檻，有助通勤族與戶外運動者將運動融入日常", "市民反映爬山、外勤運將等有真實中途整裝與盥洗需求", "串聯山林徑、TPASS 打造完整綠色休閒路網"},
				ConPoints:   []string{"台北市已有 12 座運動中心均有淋浴間，恐造成市政資源重複配置", "特定族群（跑者、登山客）需求不應由全體納稅人買單", "市府已有特色運動站回饋計畫，應務實推動而非倉促普設"},
			},
			{
				Title:       "公共便利開放 vs. 隱私與治安死角風險",
				Description: "公共盥洗更衣設施如何確保女性與公眾安全，避免淪為偷拍、騷擾或管理盲點？",
				ProPoints:   []string{"可採智慧門禁、實名制卡片進出、明亮通透動線設計與定期巡邏防範", "將偏僻出入口活化為有人流的活力節點，反而減少原本的治安死角"},
				ConPoints:   []string{"公共沐浴與更衣空間具高隱私敏感性，極易引發偷拍恐慌與性騷擾疑慮", "深夜或非熱門站點易淪為街友佔用或治安盲點，維安巡檢成本極高"},
			},
			{
				Title:       "公帑基礎建設 vs. 營運清潔維護與自負盈虧",
				Description: "長期耗費的清潔、水電與維修成本，應由市府全額支應，或採使用者付費與公私協力（BOT）？",
				ProPoints:   []string{"促進市民規律運動可降低健保與長照遠期支出，具長期公共利益價值", "可透過悠遊卡微額計費平衡部分耗材清潔成本"},
				ConPoints:   []string{"淋浴設施清潔折舊極快，公部門維管容易淪為蚊子設施", "國外多為民間商業模式（如東京 Run Station），應回歸市場機制"},
			},
		},
	},
}

func main() {
	log.Println("[STARTUP] Topos Server is initializing...")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("[STARTUP] Binding to port: %s", port)

	googleClientID := os.Getenv("GOOGLE_CLIENT_ID")
	authHandler := auth.NewAuthenticator(googleClientID, 30)
	ragEngine := rag.NewEngine()
	mcpServer := mcp.NewServer(ragEngine, defaultTopics)

	mux := http.NewServeMux()

	// 1. Health check
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	// Public Config
	mux.HandleFunc("GET /api/config", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"googleClientId": googleClientID,
		})
	})

	// 2. Model Context Protocol (MCP) Endpoints
	mux.HandleFunc("GET /sse", mcpServer.HandleSSE)
	mux.HandleFunc("POST /mcp/message", mcpServer.HandleMessage)
	mux.HandleFunc("POST /mcp", mcpServer.HandleMessage)

	// 3. Topics listing (Public)
	mux.HandleFunc("GET /api/topics", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(defaultTopics)
	})

	// 4. Topic detail / summary (Public)
	mux.HandleFunc("GET /api/topics/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		for _, t := range defaultTopics {
			if t.ID == id {
				w.Header().Set("Content-Type", "application/json")
				json.NewEncoder(w).Encode(t)
				return
			}
		}
		http.Error(w, `{"error":"topic not found"}`, http.StatusNotFound)
	})

	// 5. Topic deliberation chat (Protected by Google Auth & Rate Limiter)
	chatHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		user, _ := auth.GetUserFromContext(r.Context())
		remaining, _ := r.Context().Value("remaining_quota").(int)

		var req models.ChatRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"invalid request payload"}`, http.StatusBadRequest)
			return
		}

		reply, err := ragEngine.Deliberate(r.Context(), id, req.Messages, req.Language)
		if err != nil {
			log.Printf("[ERROR] Deliberation failed for user %s: %v", user.Email, err)
			http.Error(w, fmt.Sprintf(`{"error":"deliberation error: %s"}`, err.Error()), http.StatusInternalServerError)
			return
		}

		resp := models.ChatResponse{
			Reply:     *reply,
			Remaining: remaining,
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(resp)
	})

	mux.Handle("POST /api/topics/{id}/chat", authHandler.Middleware(chatHandler))

	// 6. Serve React SPA frontend from web/dist
	findDistDir := func() string {
		candidates := []string{
			"./web/dist",
			"../web/dist",
			"/app/web/dist",
		}
		for _, d := range candidates {
			if fi, err := os.Stat(d); err == nil && fi.IsDir() {
				return d
			}
		}
		return ""
	}

	distDir := findDistDir()
	if distDir != "" {
		log.Printf("Serving static frontend from: %s", distDir)
		fs := http.FileServer(http.Dir(distDir))
		mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
			path := filepath.Join(distDir, r.URL.Path)
			if fi, err := os.Stat(path); err == nil && !fi.IsDir() {
				fs.ServeHTTP(w, r)
				return
			}
			http.ServeFile(w, r, filepath.Join(distDir, "index.html"))
		})
	} else {
		mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
			if r.URL.Path != "/" {
				http.NotFound(w, r)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]interface{}{
				"service":     "Topos Deliberation & MCP Server",
				"version":     "1.0.0",
				"description": "Public Deliberation & Policy Analysis Engine",
				"endpoints": map[string]string{
					"mcp_sse":     "/sse",
					"mcp_message": "/mcp",
					"topics":      "/api/topics",
					"config":      "/api/config",
					"healthz":     "/healthz",
				},
			})
		})
	}

	// Wrap with basic CORS middleware
	handlerWithCORS := enableCORS(mux)

	log.Printf("Topos Server starting on port %s ...", port)
	if err := http.ListenAndServe(":"+port, handlerWithCORS); err != nil {
		log.Fatalf("Server stopped: %v", err)
	}
}

func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
