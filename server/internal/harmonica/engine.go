package harmonica

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"
)

// Supported session languages
const (
	LangZhHant = "zh-Hant"
	LangEn     = "en"
)

// Default constraints aligned with Pocket Harmonica
const (
	DefaultMaxTurns        = 6
	MaxTurnsCap            = 10
	DefaultMaxParticipants = 20
	MaxParticipantsCap     = 100
	PromptMaxBytes         = 6000
)

// SessionSettings holds configuration for an interview session.
type SessionSettings struct {
	Topic           string   `json:"topic"`
	Goal            string   `json:"goal"`
	Context         string   `json:"context,omitempty"`
	Critical        string   `json:"critical,omitempty"`
	Questions       []string `json:"questions"`
	Language        string   `json:"language"`
	MaxTurns        int      `json:"maxTurns"`
	MaxParticipants int      `json:"maxParticipants"`
	AskAlias        bool     `json:"askAlias"`
}

// Message is an individual dialogue entry.
type Message struct {
	Seq  int    `json:"seq"`
	Role string `json:"role"` // "interviewer" | "participant"
	Text string `json:"text"`
	At   int64  `json:"at"`
}

// Conversation records a participant's complete dialogue track.
type Conversation struct {
	Participant int       `json:"participant"`
	Alias       string    `json:"alias"`
	Turns       int       `json:"turns"`
	Done        bool      `json:"done"`
	Messages    []Message `json:"messages"`
	UpdatedAt   int64     `json:"updatedAt"`
}

// PublicSession is the metadata view of an interview.
type PublicSession struct {
	SessionID       string   `json:"sessionId"`
	Topic           string   `json:"topic"`
	Goal            string   `json:"goal"`
	Context         string   `json:"context,omitempty"`
	Critical        string   `json:"critical,omitempty"`
	Questions       []string `json:"questions"`
	Language        string   `json:"language"`
	Status          string   `json:"status"` // "open" | "closed" | "deleted"
	MaxTurns        int      `json:"maxTurns"`
	MaxParticipants int      `json:"maxParticipants"`
	AskAlias        bool     `json:"askAlias"`
	Participants    int      `json:"participants"`
	Completed       int      `json:"completed"`
	CreatedAt       int64    `json:"createdAt"`
	UpdatedAt       int64    `json:"updatedAt"`
	Model           string   `json:"model"`
	AdminToken      string   `json:"adminToken,omitempty"` // only present in creation response
}

// HostConversationSummary is a summary view for the host dashboard.
type HostConversationSummary struct {
	Participant int    `json:"participant"`
	Alias       string `json:"alias"`
	Turns       int    `json:"turns"`
	Done        bool   `json:"done"`
	Messages    int    `json:"messages"`
	UpdatedAt   int64  `json:"updatedAt"`
	LastMessage string `json:"lastMessage,omitempty"`
}

// HostView is the full dashboard view for organizers.
type HostView struct {
	PublicSession
	Conversations []Conversation            `json:"conversations"`
	Summaries     []HostConversationSummary `json:"summaries"`
}

// NormalizeSettings validates and normalizes raw interview settings.
func NormalizeSettings(s SessionSettings) (SessionSettings, error) {
	topic := CleanLine(s.Topic, 120)
	if topic == "" {
		return s, fmt.Errorf("先幫這輪訪談取一個名字 (topic is required)")
	}

	goal := CleanText(s.Goal, 500)
	if goal == "" {
		return s, fmt.Errorf("請說明希望這輪訪談理解什麼 (goal is required)")
	}

	questions := make([]string, 0, len(s.Questions))
	for _, q := range s.Questions {
		cleaned := CleanLine(q, 240)
		if cleaned != "" {
			questions = append(questions, cleaned)
		}
		if len(questions) >= 8 {
			break
		}
	}
	if len(questions) == 0 {
		return s, fmt.Errorf("至少給一個起始問題 (at least one question is required)")
	}

	lang := LangZhHant
	if strings.ToLower(s.Language) == "en" {
		lang = LangEn
	}

	maxTurns := s.MaxTurns
	if maxTurns < 2 {
		maxTurns = DefaultMaxTurns
	}
	if maxTurns > MaxTurnsCap {
		maxTurns = MaxTurnsCap
	}

	maxParticipants := s.MaxParticipants
	if maxParticipants < 1 {
		maxParticipants = DefaultMaxParticipants
	}
	if maxParticipants > MaxParticipantsCap {
		maxParticipants = MaxParticipantsCap
	}

	return SessionSettings{
		Topic:           topic,
		Goal:            goal,
		Context:         CleanText(s.Context, 1000),
		Critical:        CleanText(s.Critical, 500),
		Questions:       questions,
		Language:        lang,
		MaxTurns:        maxTurns,
		MaxParticipants: maxParticipants,
		AskAlias:        s.AskAlias,
	}, nil
}

// OpeningMessage produces the zero-token greeting and first question.
func OpeningMessage(s SessionSettings) string {
	first := ""
	if len(s.Questions) > 0 {
		first = s.Questions[0]
	}

	if s.Language == LangEn {
		return fmt.Sprintf("Thanks for joining this conversation about \"%s\". %s I'll ask a few questions and follow up on what you say; there are no right answers, and you can stop at any time. To start: %s", s.Topic, s.Goal, first)
	}

	return fmt.Sprintf("謝謝你參加這輪關於「%s」的對話。%s我會問幾個問題，並依你說的內容追問；沒有標準答案，隨時可以停。先從這個開始：%s", s.Topic, s.Goal, first)
}

// BuildSystemPrompt crafts Pocket Harmonica's warm, neutral interviewer persona.
func BuildSystemPrompt(s SessionSettings) string {
	var lines []string

	lines = append(lines, "You are a warm, neutral interviewer for a public consultation. You listen, ask one question at a time, and follow up on concrete experiences, reasons and trade-offs the participant mentions.")
	lines = append(lines, fmt.Sprintf("Topic: %s", s.Topic))
	lines = append(lines, fmt.Sprintf("What the organizer wants to understand: %s", s.Goal))

	if s.Context != "" {
		lines = append(lines, fmt.Sprintf("Background: %s", s.Context))
	}
	if s.Critical != "" {
		lines = append(lines, fmt.Sprintf("Voices or issues that must not be missed: %s", s.Critical))
	}

	var qList []string
	for i, q := range s.Questions {
		qList = append(qList, fmt.Sprintf("%d. %s", i+1, q))
	}
	lines = append(lines, fmt.Sprintf("Starter questions, in order: %s", strings.Join(qList, " ")))

	lines = append(lines, "Rules: never argue, evaluate or persuade; do not add facts of your own; reflect briefly what you heard, then ask exactly one question (a follow-up on something specific, or the next starter question when the current one feels answered). Keep each reply under 90 words.")

	if s.Language == LangEn {
		lines = append(lines, "Write in English. Reply with plain text only: no lists, no markdown, no preamble.")
	} else {
		lines = append(lines, "Write in Traditional Chinese as used in Taiwan (zh-Hant-TW). Reply with plain text only: no lists, no markdown, no preamble.")
	}

	return strings.Join(lines, "\n")
}

// BuildUserPrompt formats conversation history and instructions for the current turn.
func BuildUserPrompt(s SessionSettings, history []Message, latest string, turn int, asked int) string {
	isFinal := turn >= s.MaxTurns
	remaining := []string{}
	if asked < len(s.Questions) {
		remaining = s.Questions[asked:]
	}

	var tailLines []string
	tailLines = append(tailLines, fmt.Sprintf("Turn %d of %d.", turn, s.MaxTurns))

	if isFinal {
		tailLines = append(tailLines, "FINAL TURN: thank the participant, reflect the most important thing they said in one sentence, and close without asking anything.")
	} else if len(remaining) > 0 {
		tailLines = append(tailLines, fmt.Sprintf("Next starter question to ask when the current one feels answered: %s", remaining[0]))
	} else {
		tailLines = append(tailLines, "All starter questions have been asked; follow up on what matters most to them, or gently close if they seem done.")
	}

	tailLines = append(tailLines, fmt.Sprintf("Participant just said: %s", latest))
	tail := strings.Join(tailLines, "\n")

	budget := PromptMaxBytes - len([]byte(tail)) - 40
	if budget < 0 {
		budget = 500
	}

	var transcript []string
	used := 0
	for i := len(history) - 1; i >= 0; i-- {
		m := history[i]
		role := "Participant"
		if m.Role == "interviewer" {
			role = "Interviewer"
		}
		line := fmt.Sprintf("%s: %s", role, m.Text)
		bLen := len([]byte(line)) + 1
		if used+bLen > budget {
			break
		}
		transcript = append([]string{line}, transcript...)
		used += bLen
	}

	historyStr := "(none)"
	if len(transcript) > 0 {
		historyStr = strings.Join(transcript, "\n")
	}

	return fmt.Sprintf("Conversation so far:\n%s\n\n%s", historyStr, tail)
}

// CleanReply scrubs unwanted reasoning tokens, markdown symbols, and interviewer labels.
func CleanReply(text string, maxLen int) string {
	// Strip <think>...</think> or reasoning tags if present
	reTag := regexp.MustCompile(`(?s)<(?:think|reasoning)>.*?</(?:think|reasoning)>`)
	cleaned := reTag.ReplaceAllString(text, "")

	// Strip markdown blocks
	reCode := regexp.MustCompile("(?s)```.*?```")
	cleaned = reCode.ReplaceAllString(cleaned, "")

	// Strip leading role labels e.g. "Interviewer:" or "訪談者："
	reLabel := regexp.MustCompile(`(?i)^\s*(Interviewer|訪談者|AI|助手)[:：]\s*`)
	cleaned = reLabel.ReplaceAllString(cleaned, "")

	// Normalize spaces
	reSpace := regexp.MustCompile(`\s+`)
	cleaned = strings.TrimSpace(reSpace.ReplaceAllString(cleaned, " "))

	if maxLen <= 0 {
		maxLen = 600
	}

	if utf8.RuneCountInString(cleaned) > maxLen {
		runes := []rune(cleaned)
		cleaned = string(runes[:maxLen])
	}

	if cleaned == "" {
		cleaned = "謝謝你的分享，能再多聊聊具體的考量嗎？"
	}

	return cleaned
}

// CleanLine removes control characters and trims string.
func CleanLine(v string, maxLen int) string {
	cleaned := strings.Map(func(r rune) rune {
		if r < 32 && r != '\t' {
			return ' '
		}
		return r
	}, v)
	cleaned = strings.TrimSpace(strings.Join(strings.Fields(cleaned), " "))
	if maxLen > 0 && utf8.RuneCountInString(cleaned) > maxLen {
		runes := []rune(cleaned)
		cleaned = string(runes[:maxLen])
	}
	return cleaned
}

// CleanText normalizes multi-line text.
func CleanText(v string, maxLen int) string {
	cleaned := strings.ReplaceAll(v, "\r\n", "\n")
	cleaned = strings.ReplaceAll(cleaned, "\r", "\n")
	cleaned = strings.TrimSpace(cleaned)
	if maxLen > 0 && utf8.RuneCountInString(cleaned) > maxLen {
		runes := []rune(cleaned)
		cleaned = string(runes[:maxLen])
	}
	return cleaned
}

// FormatTTTCCsv exports all conversations in Talk to the City CSV format: id,interview,comment
func FormatTTTCCsv(session PublicSession, conversations []Conversation) ([]byte, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	// TTTC standard headers
	if err := writer.Write([]string{"id", "interview", "comment"}); err != nil {
		return nil, err
	}

	msgID := 1
	for _, conv := range conversations {
		alias := conv.Alias
		if alias == "" {
			alias = fmt.Sprintf("Participant_%d", conv.Participant)
		}
		interviewName := fmt.Sprintf("%s (%s)", session.Topic, alias)

		for _, msg := range conv.Messages {
			if msg.Role == "participant" && strings.TrimSpace(msg.Text) != "" {
				row := []string{
					fmt.Sprintf("%d", msgID),
					interviewName,
					msg.Text,
				}
				if err := writer.Write(row); err != nil {
					return nil, err
				}
				msgID++
			}
		}
	}

	writer.Flush()
	return buf.Bytes(), writer.Error()
}

// FormatTranscriptsJSON exports all conversations in full structured JSON format.
func FormatTranscriptsJSON(session PublicSession, conversations []Conversation) ([]byte, error) {
	out := map[string]interface{}{
		"session":       session,
		"exportedAt":    session.UpdatedAt,
		"conversations": conversations,
	}
	return json.MarshalIndent(out, "", "  ")
}
