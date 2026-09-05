package rag

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
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
		model = "@cf/google/gemma-2-9b-it"
	}

	projectID := os.Getenv("GCP_PROJECT_ID")
	if projectID == "" {
		projectID = "elix-498805"
	}

	e := &Engine{
		cloudflareAccountID: os.Getenv("CLOUDFLARE_ACCOUNT_ID"),
		cloudflareAPIToken:  os.Getenv("CLOUDFLARE_API_TOKEN"),
		cloudflareModel:     model,
		gcpProjectID:        projectID,
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
		"./data/debates/nuclear4",
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
			log.Printf("[RAG] Loaded %d debate transcript files from %s", len(e.localDebatesCache), dir)
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

	// 1. Retrieve context & citations from debate transcripts
	relevantExcerpts, citations := e.retrieveContextAndCitations(lastMsg)

	// 2. Build Deliberation System Prompt
	systemPrompt := fmt.Sprintf(`你是由 Topos 驅動的公眾審議引導助手（Topos Deliberative Facilitator）。
目前公民正在探討的公共議題是【%s】。
你的核心目標是協助公民深入理解公共議題，呈現多元且平衡的事實與論述，促進建設性對話，絕不預設立場。

【引導原則】：
1. 若使用者的提問或觀點與當前議題（例如核四重啟、地質耐震、能源轉型、公投或憲政體制等）相關：
   - 【平衡呈現】：清楚梳理正反雙方的核心論據與背後價值觀（例如：環境風險 vs. 供電穩定；三權分立 vs. 五權憲法）。
   - 【事實溯源】：若參考資料中有具體正反方發言，請務必指名誰（如黃士修、許永輝、曾文生、苗博雅等）提出了何種論點與數據依據。
   - 【深化思辨】：在回答末尾以中立客觀的口吻，提出 1~2 個值得反思的延伸爭點，引導公民進一步思考。
2. 若使用者的提問與當前探討的公共議題無關（例如詢問天氣、個人日常、聊天問候等）：
   - 請以友善、自然的口吻簡短回應使用者的問題，並禮貌且親切地說明你的職責是協助公共議題審議，接著主動邀請使用者回到當前議題進行提問或分享看法。請千萬不要生硬地把無關問題套用到公投辯論的爭點上。

【公聽會 / 辯論逐字稿參考資料】：
%s`, topicID, relevantExcerpts)

	// 3. Call LLM (First attempt: Google Vertex AI Gemini on GCP; Fallback: Cloudflare AI)
	replyText, err := e.callVertexAI(ctx, systemPrompt, history)
	if err != nil {
		log.Printf("[RAG] Vertex AI call failed: %v, attempting Cloudflare AI fallback...", err)
		if e.cloudflareAccountID != "" && e.cloudflareAPIToken != "" {
			var cfErr error
			replyText, cfErr = e.callCloudflareAI(ctx, systemPrompt, history)
			if cfErr != nil {
				log.Printf("[RAG] Cloudflare AI call also failed: %v", cfErr)
				return nil, fmt.Errorf("AI 推理服務暫時無法連線: %w", cfErr)
			}
		} else {
			return nil, fmt.Errorf("Vertex AI 推理失敗: %w", err)
		}
	}

	resp := &models.ChatMessage{
		Role:    "assistant",
		Content: replyText,
	}

	if len(citations) > 0 {
		resp.Citations = citations
	}

	return resp, nil
}

func (e *Engine) retrieveContextAndCitations(query string) (string, []models.Citation) {
	var builder strings.Builder
	var citations []models.Citation

	keywords := strings.Fields(query)
	matchedCount := 0

	for fname, content := range e.localDebatesCache {
		matched := false
		for _, kw := range keywords {
			if len(kw) >= 2 && strings.Contains(content, kw) {
				matched = true
				break
			}
		}

		if matched {
			matchedCount++
			lines := strings.Split(content, "\n")
			snippetLines := 0
			title := strings.TrimSuffix(fname, ".md")

			for _, line := range lines {
				trimmed := strings.TrimSpace(line)
				if strings.HasPrefix(trimmed, "###") || strings.Contains(trimmed, "正方") || strings.Contains(trimmed, "反方") {
					builder.WriteString(trimmed + "\n")
					snippetLines++

					if len(citations) < 2 && len(trimmed) > 10 && len(trimmed) < 200 {
						citations = append(citations, models.Citation{
							SourceTitle: title,
							Excerpt:     strings.TrimPrefix(trimmed, "### "),
						})
					}

					if snippetLines > 8 {
						break
					}
				}
			}
			builder.WriteString(fmt.Sprintf("\n(節錄自 %s)\n---\n", fname))
			if matchedCount >= 2 {
				break
			}
		}
	}

	if builder.Len() == 0 {
		return "（未檢索到直接相關的逐字稿片段，若問題屬於該議題範疇，請以客觀中立之通用知識與爭點架構進行審議引導）", nil
	}

	return builder.String(), citations
}

func getGCPToken(ctx context.Context) (string, error) {
	// 1. Fetch from Google Compute / Cloud Run Metadata Server
	client := &http.Client{Timeout: 3 * time.Second}
	req, err := http.NewRequestWithContext(ctx, "GET", "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token", nil)
	if err == nil {
		req.Header.Set("Metadata-Flavor", "Google")
		resp, err := client.Do(req)
		if err == nil {
			defer resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				var tokenData struct {
					AccessToken string `json:"access_token"`
				}
				if err := json.NewDecoder(resp.Body).Decode(&tokenData); err == nil && tokenData.AccessToken != "" {
					return tokenData.AccessToken, nil
				}
			}
		}
	}

	// 2. Check environment variable
	if tok := os.Getenv("GCP_ACCESS_TOKEN"); tok != "" {
		return tok, nil
	}

	// 3. For local development
	if out, err := exec.CommandContext(ctx, "gcloud", "auth", "print-access-token").Output(); err == nil {
		token := strings.TrimSpace(string(out))
		if token != "" {
			return token, nil
		}
	}

	return "", fmt.Errorf("could not obtain GCP access token")
}

func (e *Engine) callVertexAI(ctx context.Context, systemPrompt string, history []models.ChatMessage) (string, error) {
	projectID := e.gcpProjectID
	if projectID == "" {
		projectID = "elix-498805"
	}
	region := "us-central1"
	model := "gemini-2.5-flash"

	token, err := getGCPToken(ctx)
	if err != nil {
		return "", fmt.Errorf("vertex auth failed: %w", err)
	}

	url := fmt.Sprintf("https://%s-aiplatform.googleapis.com/v1/projects/%s/locations/%s/publishers/google/models/%s:generateContent",
		region, projectID, region, model)

	type Part struct {
		Text string `json:"text"`
	}
	type Content struct {
		Role  string `json:"role"`
		Parts []Part `json:"parts"`
	}
	type SystemInstruction struct {
		Parts []Part `json:"parts"`
	}
	type VertexReq struct {
		SystemInstruction *SystemInstruction `json:"systemInstruction,omitempty"`
		Contents          []Content          `json:"contents"`
	}

	var contents []Content
	for _, m := range history {
		role := "user"
		if m.Role == "assistant" {
			role = "model"
		}
		contents = append(contents, Content{
			Role:  role,
			Parts: []Part{{Text: m.Content}},
		})
	}

	reqBodyObj := VertexReq{
		SystemInstruction: &SystemInstruction{
			Parts: []Part{{Text: systemPrompt}},
		},
		Contents: contents,
	}

	reqBytes, err := json.Marshal(reqBodyObj)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(reqBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("vertex AI error (%d): %s", resp.StatusCode, string(b))
	}

	var vertexResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&vertexResp); err != nil {
		return "", err
	}

	if len(vertexResp.Candidates) == 0 || len(vertexResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from vertex AI")
	}

	return vertexResp.Candidates[0].Content.Parts[0].Text, nil
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
