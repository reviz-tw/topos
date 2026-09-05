package rag

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/reviz-tw/topos/server/internal/models"
)

// Engine defines how to retrieve grounded context and generate deliberative responses.
type Engine struct {
	cloudflareAccountID string
	cloudflareAPIToken  string
	cloudflareModel     string
	gcpProjectID        string
	vertexDataStoreID   string
	httpClient          *http.Client
	localDebatesCache   map[string]string // cached local debates for quick fallback
}

func NewEngine() *Engine {
	model := os.Getenv("CLOUDFLARE_MODEL")
	if model == "" {
		// Default to Google's Gemma on Cloudflare or Qwen 2.5
		model = "@cf/google/gemma-2-9b-it"
	}

	e := &Engine{
		cloudflareAccountID: os.Getenv("CLOUDFLARE_ACCOUNT_ID"),
		cloudflareAPIToken:  os.Getenv("CLOUDFLARE_API_TOKEN"),
		cloudflareModel:     model,
		gcpProjectID:        os.Getenv("GCP_PROJECT_ID"),
		vertexDataStoreID:   os.Getenv("VERTEX_SEARCH_DATASTORE_ID"),
		httpClient:          &http.Client{Timeout: 60 * time.Second},
		localDebatesCache:   make(map[string]string),
	}

	e.loadLocalDebates()
	return e
}

func (e *Engine) loadLocalDebates() {
	candidates := []string{
		"../../data/debates/nuclear4",
		"data/debates/nuclear4",
		"/app/data/debates/nuclear4",
	}

	for _, dir := range candidates {
		files, err := os.ReadDir(dir)
		if err == nil && len(files) > 0 {
			for _, f := range files {
				if strings.HasSuffix(f.Name(), ".md") {
					content, err := os.ReadFile(filepath.Join(dir, f.Name()))
					if err == nil {
						e.localDebatesCache[f.Name()] = string(content)
					}
				}
			}
			break
		}
	}
}

// Deliberate produces a multi-perspective, grounded response to the user's issue inquiry.
func (e *Engine) Deliberate(ctx context.Context, topicID string, history []models.ChatMessage) (*models.ChatMessage, error) {
	if len(history) == 0 {
		return nil, fmt.Errorf("history cannot be empty")
	}

	lastMsg := history[len(history)-1].Content

	// 1. Retrieve context (from Vertex AI Search or local debate transcripts)
	relevantExcerpts := e.retrieveContext(lastMsg)

	// 2. Build Deliberation System Prompt (Emulating Talk to the City)
	systemPrompt := `你是由 Topos 驅動的公眾審議引導助手（Topos Deliberative Facilitator）。
你的目標是協助公民深入理解公共議題，呈現多元且平衡的事實與論述，絕不預設立場。

你的核心任務：
1. 【平衡呈現】：針對使用者的問題或看法，清楚梳理支持方與反對方的核心論據與背後價值觀（例如：環境安全 vs. 能源穩定）。
2. 【事實溯源】：引用提供的公聽會/公投辯論逐字稿中的真實論述，說明誰（如：黃士修、許永輝、曾文生、苗博雅等）提出了哪些觀點。
3. 【深化探討】：以客觀中立的口吻提出 1~2 個具有反思性的延伸問題，幫助使用者釐清自己的核心考量。

【相關公投意見發表會逐字稿片段】：
` + relevantExcerpts

	// 3. Call LLM (Cloudflare Workers AI or fallback mock)
	replyText, err := e.callCloudflareAI(ctx, systemPrompt, history)
	if err != nil {
		// If Cloudflare token is not set yet, return structured placeholder with real debate excerpts
		return &models.ChatMessage{
			Role: "assistant",
			Content: fmt.Sprintf("【審議助手（本機展示模式）】\n\n針對您的問題「%s」，以下整理自 2021 核四公投辯論會的正反關鍵論點：\n\n### 正方核心主張（黃士修等人）\n- 供電安全與空汙：強調核能發電成本穩定且低碳，能減少中南部火力發電產生的空汙。\n- 耐震加固：主張地質報告中 S 斷層非活動斷層，即便最嚴苛假設地動值 0.57G 仍低於廠房耐震標準 0.66G，且可工程補強。\n\n### 反方核心主張（許永輝、曾文生、苗博雅等人）\n- 設備老舊與施工困難：許永輝處長指出核四長達 20 年未通過試運轉測試，內部管線狹窄且歐美設備與日本機型整合困難。\n- 斷層新事證與核廢料處置：反對陣營強調外海存在活動斷層風險，且高低放射性核廢料目前台灣無地方縣市願意接納最終處置場。\n\n*提示：設定 CLOUDFLARE_API_TOKEN 與 CLOUDFLARE_ACCOUNT_ID 後即可啟動即時開源 LLM（Google Gemma / Qwen）動態引導！*", lastMsg),
			Citations: []models.Citation{
				{SourceTitle: "第 2 場發表會 - 許永輝 (台電核能發電處長)", Excerpt: "我過去、現在跟我現在要說的每一句話，都可以被社會大眾檢驗。我是一個工程師，我不懂政治語言，只有安全的電廠與不安全的電廠。"},
				{SourceTitle: "第 2 場發表會 - 黃士修 (正方領銜人)", Excerpt: "根據現有的地質調查資料，S 斷層非活動斷層，造成的地震在場址最大地表加速度低於核四地表耐震 0.66G。"},
			},
		}, nil
	}

	return &models.ChatMessage{
		Role:    "assistant",
		Content: replyText,
		Citations: []models.Citation{
			{SourceTitle: "2021 公投意見發表會逐字稿", Excerpt: "詳見逐字稿論辯摘錄"},
		},
	}, nil
}

func (e *Engine) retrieveContext(query string) string {
	var builder strings.Builder
	keywords := strings.Fields(query)

	for fname, content := range e.localDebatesCache {
		matched := false
		for _, kw := range keywords {
			if len(kw) > 1 && strings.Contains(content, kw) {
				matched = true
				break
			}
		}

		if matched || len(e.localDebatesCache) <= 2 {
			// Extract a snippet
			lines := strings.Split(content, "\n")
			snippetLines := 0
			for _, line := range lines {
				if strings.HasPrefix(line, "###") || strings.Contains(line, "正方") || strings.Contains(line, "反方") {
					builder.WriteString(line + "\n")
					snippetLines++
					if snippetLines > 8 {
						break
					}
				}
			}
			builder.WriteString(fmt.Sprintf("\n(節錄自 %s)\n---\n", fname))
		}
	}

	if builder.Len() == 0 {
		return "（未能匹配到具體發言段落，請根據廣泛事實回答）"
	}
	return builder.String()
}

func (e *Engine) callCloudflareAI(ctx context.Context, systemPrompt string, history []models.ChatMessage) (string, error) {
	if e.cloudflareAccountID == "" || e.cloudflareAPIToken == "" {
		return "", fmt.Errorf("cloudflare credentials not configured")
	}

	url := fmt.Sprintf("https://api.cloudflare.com/client/v4/accounts/%s/ai/run/%s", e.cloudflareAccountID, e.cloudflareModel)

	type cfMsg struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	}

	msgs := []cfMsg{
		{Role: "system", Content: systemPrompt},
	}
	for _, m := range history {
		msgs = append(msgs, cfMsg{Role: m.Role, Content: m.Content})
	}

	reqBody, _ := json.Marshal(map[string]interface{}{
		"messages": msgs,
	})

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(reqBody))
	if err != nil {
		return "", err
	}

	req.Header.Set("Authorization", "Bearer "+e.cloudflareAPIToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("cloudflare AI error (%d): %s", resp.StatusCode, string(b))
	}

	var cfResp struct {
		Result struct {
			Response string `json:"response"`
		} `json:"result"`
		Success bool `json:"success"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&cfResp); err != nil {
		return "", err
	}

	return cfResp.Result.Response, nil
}
