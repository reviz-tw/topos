package models

// Topic represents an issue open for public deliberation.
type Topic struct {
	ID          string   `json:"id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Tags        []string `json:"tags"`
	KeyCruxes   []Crux   `json:"keyCruxes"` // 核心爭議焦點
}

// Crux represents a critical disagreement point within an issue.
type Crux struct {
	Title       string   `json:"title"`
	Description string   `json:"description"`
	ProPoints   []string `json:"proPoints"` // 正方主張
	ConPoints   []string `json:"conPoints"` // 反方主張
}

// UserContext contains authenticated user information extracted from Google ID Token.
type UserContext struct {
	Email         string `json:"email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	Subject       string `json:"sub"`
	EmailVerified bool   `json:"email_verified"`
}

// ChatMessage represents a single message in a deliberation session.
type ChatMessage struct {
	Role      string     `json:"role"`      // "user" | "assistant" | "system"
	Content   string     `json:"content"`   // Markdown message text
	Citations []Citation `json:"citations"` // 引用回溯來源
}

// Citation points to the grounded quote in the source documents.
type Citation struct {
	SourceTitle string `json:"sourceTitle"` // e.g. "第2場公投發表會 - 許永輝"
	Excerpt     string `json:"excerpt"`     // 原始發言引文
	URL         string `json:"url,omitempty"`
}

// ChatRequest is the payload sent from the frontend to discuss an issue.
type ChatRequest struct {
	TopicID  string        `json:"topicId"`
	Messages []ChatMessage `json:"messages"`
}

// ChatResponse is returned to the frontend.
type ChatResponse struct {
	Reply     ChatMessage `json:"reply"`
	Remaining int         `json:"remainingRequests"` // 剩餘額度
}
