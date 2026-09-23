package harmonica

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestHarmonicaEngine(t *testing.T) {
	// 1. Settings normalization
	raw := SessionSettings{
		Topic:     "  核能未來發展  ",
		Goal:      "  了解民眾對新型核電 SMR 之看法  ",
		Questions: []string{"您支持小型核電廠嗎？", "您對地質安全的考量是什麼？"},
		Language:  "zh-Hant",
		MaxTurns:  5,
	}

	norm, err := NormalizeSettings(raw)
	if err != nil {
		t.Fatalf("NormalizeSettings failed: %v", err)
	}
	if norm.Topic != "核能未來發展" {
		t.Errorf("expected clean topic, got %q", norm.Topic)
	}
	if len(norm.Questions) != 2 {
		t.Errorf("expected 2 questions, got %d", len(norm.Questions))
	}

	// 2. Opening message (0 token)
	openMsg := OpeningMessage(norm)
	if !strings.Contains(openMsg, "謝謝你參加這輪關於「核能未來發展」的對話") {
		t.Errorf("unexpected opening message: %s", openMsg)
	}
	if !strings.Contains(openMsg, "您支持小型核電廠嗎？") {
		t.Errorf("opening message should contain first question: %s", openMsg)
	}

	// 3. System prompt
	sysPrompt := BuildSystemPrompt(norm)
	if !strings.Contains(sysPrompt, "You are a warm, neutral interviewer for a public consultation.") {
		t.Errorf("system prompt missing neutral consultation role: %s", sysPrompt)
	}
	if !strings.Contains(sysPrompt, "Traditional Chinese as used in Taiwan") {
		t.Errorf("system prompt missing output language instruction: %s", sysPrompt)
	}

	// 4. User prompt with FINAL TURN
	history := []Message{
		{Seq: 1, Role: "interviewer", Text: openMsg},
		{Seq: 2, Role: "participant", Text: "我支持，但要做好耐震防護。"},
	}
	userPrompt := BuildUserPrompt(norm, history, "我支持，但要做好耐震防護。", 5, 1)
	if !strings.Contains(userPrompt, "FINAL TURN: thank the participant") {
		t.Errorf("expected FINAL TURN directive in turn 5/5, got: %s", userPrompt)
	}

	// 5. CleanReply
	dirty := "<think>thinking process...</think>```markdown block```訪談者： 謝謝您的分享。請多聊聊耐震。"
	cleaned := CleanReply(dirty, 100)
	if strings.Contains(cleaned, "think") || strings.Contains(cleaned, "訪談者") {
		t.Errorf("CleanReply did not strip tags: %s", cleaned)
	}
	if !strings.Contains(cleaned, "謝謝您的分享") {
		t.Errorf("CleanReply lost core message: %s", cleaned)
	}
}

func TestHarmonicaServiceLifecycle(t *testing.T) {
	svc := NewService(nil)

	// 1. Verify default sessions are pre-seeded
	n4Sessions := svc.GetTopicSessions("nuclear4")
	if len(n4Sessions) == 0 {
		t.Fatalf("expected pre-seeded nuclear4 session")
	}
	if n4Sessions[0].SessionID != "6o0ryapw2o" {
		t.Errorf("expected default session 6o0ryapw2o, got %s", n4Sessions[0].SessionID)
	}

	sportsSessions := svc.GetTopicSessions("sports-station")
	if len(sportsSessions) == 0 {
		t.Fatalf("expected pre-seeded sports-station session")
	}

	// 2. Create custom session
	createReq := SessionSettings{
		Topic:           "AI 時代的高等教育變革",
		Goal:            "探討大學教育中引入生成式 AI 的利弊",
		Questions:       []string{"您在學習中使用 AI 的頻率高嗎？", "您擔心抄襲或批判思考力退化嗎？"},
		Language:        LangZhHant,
		MaxTurns:        3,
		MaxParticipants: 10,
		AskAlias:        true,
	}

	session, err := svc.CreateSession(createReq)
	if err != nil {
		t.Fatalf("CreateSession failed: %v", err)
	}
	if session.SessionID == "" || session.AdminToken == "" {
		t.Fatalf("expected sessionID and adminToken")
	}

	// 3. Join session
	participantID := "p-test-user-1"
	conv, err := svc.JoinSession(session.SessionID, participantID, "測試同學")
	if err != nil {
		t.Fatalf("JoinSession failed: %v", err)
	}
	if len(conv.Messages) != 1 || conv.Messages[0].Role != "interviewer" {
		t.Fatalf("expected 1 interviewer opening message, got %d", len(conv.Messages))
	}

	// 4. Send Message - Turn 1
	httpReq := httptest.NewRequest("POST", "/test", nil)
	reply, turn, done, err := svc.SendMessage(httpReq, session.SessionID, participantID, "我每天都在寫作業時用 AI 輔助思考。")
	if err != nil {
		t.Fatalf("SendMessage turn 1 failed: %v", err)
	}
	if turn != 1 || done {
		t.Errorf("expected turn 1 not done, got turn %d, done %v", turn, done)
	}
	if reply.Role != "interviewer" {
		t.Errorf("expected interviewer reply, got %s", reply.Role)
	}

	// Send Message - Turn 2
	_, turn, done, err = svc.SendMessage(httpReq, session.SessionID, participantID, "確實會有一點依賴，但能省下瑣碎時間。")
	if err != nil {
		t.Fatalf("SendMessage turn 2 failed: %v", err)
	}
	if turn != 2 || done {
		t.Errorf("expected turn 2 not done, got turn %d, done %v", turn, done)
	}

	// Send Message - Turn 3 (Final Turn for maxTurns: 3)
	_, turn, done, err = svc.SendMessage(httpReq, session.SessionID, participantID, "我認為學校應該教我們如何正確提問與查證。")
	if err != nil {
		t.Fatalf("SendMessage turn 3 failed: %v", err)
	}
	if turn != 3 || !done {
		t.Errorf("expected turn 3 and done=true, got turn %d, done %v", turn, done)
	}

	// 5. Host View verification
	hostView, err := svc.GetHostView(session.SessionID, session.AdminToken)
	if err != nil {
		t.Fatalf("GetHostView failed: %v", err)
	}
	if hostView.Participants != 1 || hostView.Completed != 1 {
		t.Errorf("expected 1 participant and 1 completed, got %d and %d", hostView.Participants, hostView.Completed)
	}
	if len(hostView.Conversations) != 1 {
		t.Fatalf("expected 1 conversation track, got %d", len(hostView.Conversations))
	}

	// 6. TTTC CSV Export verification
	csvBytes, err := svc.ExportTTTCCsv(session.SessionID)
	if err != nil {
		t.Fatalf("ExportTTTCCsv failed: %v", err)
	}
	csvStr := string(csvBytes)
	if !strings.HasPrefix(csvStr, "id,interview,comment") {
		t.Errorf("expected TTTC header, got: %s", csvStr)
	}
	if !strings.Contains(csvStr, "AI 時代的高等教育變革 (測試同學)") {
		t.Errorf("expected interview column to include topic & alias: %s", csvStr)
	}
	if !strings.Contains(csvStr, "我每天都在寫作業時用 AI 輔助思考") {
		t.Errorf("expected participant comment in csv: %s", csvStr)
	}

	// 7. Transcripts JSON Export verification
	jsonBytes, err := svc.ExportTranscriptsJSON(session.SessionID)
	if err != nil {
		t.Fatalf("ExportTranscriptsJSON failed: %v", err)
	}
	var parsed struct {
		Session       PublicSession  `json:"session"`
		Conversations []Conversation `json:"conversations"`
	}
	if err := json.Unmarshal(jsonBytes, &parsed); err != nil {
		t.Fatalf("failed to parse transcripts JSON: %v", err)
	}
	if len(parsed.Conversations) != 1 || len(parsed.Conversations[0].Messages) != 7 {
		// 1 opening + 3*(participant + interviewer) = 7 messages
		t.Errorf("expected 7 messages in conversation, got %d", len(parsed.Conversations[0].Messages))
	}
}

func TestHarmonicaHttpHandlers(t *testing.T) {
	svc := NewService(nil)

	// Test GET /api/harmonica/sessions/6o0ryapw2o
	getReq := httptest.NewRequest("GET", "/api/harmonica/sessions/6o0ryapw2o", nil)
	getReq.SetPathValue("id", "6o0ryapw2o")
	w := httptest.NewRecorder()
	svc.HandleGetSession(w, getReq)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}
	var sess PublicSession
	if err := json.NewDecoder(w.Body).Decode(&sess); err != nil || sess.SessionID != "6o0ryapw2o" {
		t.Errorf("failed to decode public session: %v", err)
	}

	// Test POST /api/harmonica/sessions/{id}/join
	joinPayload := `{"participantId":"p-uuid-1234","alias":"綠能倡議者"}`
	joinReq := httptest.NewRequest("POST", "/api/harmonica/sessions/6o0ryapw2o/join", bytes.NewBufferString(joinPayload))
	joinReq.SetPathValue("id", "6o0ryapw2o")
	w = httptest.NewRecorder()
	svc.HandleJoinSession(w, joinReq)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}
	var joinRes struct {
		Ok           bool         `json:"ok"`
		Conversation Conversation `json:"conversation"`
	}
	if err := json.NewDecoder(w.Body).Decode(&joinRes); err != nil || !joinRes.Ok {
		t.Fatalf("failed to decode join response: %v", err)
	}
	if len(joinRes.Conversation.Messages) == 0 {
		t.Errorf("expected opening message in conversation")
	}

	// Test POST /api/harmonica/sessions/{id}/messages
	msgPayload := `{"participantId":"p-uuid-1234","text":"我認為台灣應該加速發展綠能與分散式電網。"}`
	msgReq := httptest.NewRequest("POST", "/api/harmonica/sessions/6o0ryapw2o/messages", bytes.NewBufferString(msgPayload))
	msgReq.SetPathValue("id", "6o0ryapw2o")
	w = httptest.NewRecorder()
	svc.HandleSendMessage(w, msgReq)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d: %s", w.Code, w.Body.String())
	}
	var msgRes struct {
		Ok    bool    `json:"ok"`
		Reply Message `json:"reply"`
		Turn  int     `json:"turn"`
		Done  bool    `json:"done"`
	}
	if err := json.NewDecoder(w.Body).Decode(&msgRes); err != nil || !msgRes.Ok {
		t.Fatalf("failed to decode message response: %v", err)
	}
	if msgRes.Turn != 1 {
		t.Errorf("expected turn 1, got %d", msgRes.Turn)
	}
}
