package harmonica

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/reviz-tw/topos/server/internal/models"
	"github.com/reviz-tw/topos/server/internal/rag"
)

// SessionData holds the complete state of a native interview session.
type SessionData struct {
	mu            sync.RWMutex
	Settings      SessionSettings
	SessionID     string
	AdminToken    string
	Status        string // "open" | "closed" | "deleted"
	CreatedAt     int64
	UpdatedAt     int64
	Model         string
	Participants  map[string]*ParticipantTrack // keyed by participantID hash/UUID
	Conversations map[int]*Conversation        // keyed by sequence
	NextSeq       int
	NextMsgSeq    int
}

// ParticipantTrack maintains metadata for a participant.
type ParticipantTrack struct {
	Seq       int
	Alias     string
	Turns     int
	Asked     int
	Done      bool
	CreatedAt int64
	UpdatedAt int64
}

// Service provides native, self-contained Pocket Harmonica interviews.
type Service struct {
	mu            sync.RWMutex
	sessions      map[string]*SessionData
	topicSessions map[string][]models.HarmonicaSessionRef
	ragEngine     *rag.Engine
}

// NewService creates a native Harmonica interview service.
func NewService(ragEngine ...*rag.Engine) *Service {
	var re *rag.Engine
	if len(ragEngine) > 0 {
		re = ragEngine[0]
	}

	s := &Service{
		sessions:      make(map[string]*SessionData),
		topicSessions: make(map[string][]models.HarmonicaSessionRef),
		ragEngine:     re,
	}

	// Seed default session for nuclear4
	n4Settings := SessionSettings{
		Topic:           "核電重啟公眾訪談",
		Goal:            "測試與收集核電重啟之條件、顧慮與多元考量。",
		Context:         "探討台灣能源轉型、地質耐震與核廢料處置之爭點。",
		Questions: []string{
			"對於核電重啟，你的基本立場是什麼？最在意的是哪一點？",
			"如果真的要重啟，你認為必須先滿足哪些條件？",
			"核廢料該怎麼處理，你心中有能接受的做法嗎？",
		},
		Language:        LangZhHant,
		MaxTurns:        6,
		MaxParticipants: 50,
		AskAlias:        true,
	}
	s.seedSession("6o0ryapw2o", n4Settings, "nuclear4", "核電重啟公眾訪談", true)

	// Seed default session for sports-station
	sportsSettings := SessionSettings{
		Topic:           "捷運與登山口廣設運動驛站",
		Goal:            "探討公眾對捷運站盥洗寄物設施之需求、衛生管理與預算自償考量",
		Context:         "台北市長選舉市政政見討論，平衡運動友善與公共治安。",
		Questions:       []string{"您平日在捷運站或登山口有淋浴更衣的需求嗎？", "您認為此類設施應由公帑全額負擔，或採使用者付費？", "如何兼顧公共衛生、隱私防偷拍與深夜維安？"},
		Language:        LangZhHant,
		MaxTurns:        6,
		MaxParticipants: 50,
		AskAlias:        true,
	}
	s.seedSession("sports-int-1", sportsSettings, "sports-station", "運動驛站公眾訪談", true)

	return s
}

func (s *Service) seedSession(sessionID string, settings SessionSettings, topicID, title string, isDefault bool) {
	norm, _ := NormalizeSettings(settings)
	data := &SessionData{
		Settings:      norm,
		SessionID:     sessionID,
		AdminToken:    randomToken(16),
		Status:        "open",
		CreatedAt:     time.Now().UnixMilli(),
		UpdatedAt:     time.Now().UnixMilli(),
		Model:         "@cf/google/gemma-4-26b-a4b-it",
		Participants:  make(map[string]*ParticipantTrack),
		Conversations: make(map[int]*Conversation),
		NextSeq:       1,
		NextMsgSeq:    1,
	}
	s.sessions[sessionID] = data

	s.topicSessions[topicID] = append(s.topicSessions[topicID], models.HarmonicaSessionRef{
		SessionID: sessionID,
		Title:     title,
		Goal:      norm.Goal,
		URL:       fmt.Sprintf("/s/%s", sessionID),
		IsDefault: isDefault,
		CreatedAt: time.Now().Unix(),
	})
}

func randomToken(bytesLen int) string {
	b := make([]byte, bytesLen)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func randomSessionID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

// CreateSession initializes a new native interview session.
func (s *Service) CreateSession(settings SessionSettings) (PublicSession, error) {
	norm, err := NormalizeSettings(settings)
	if err != nil {
		return PublicSession{}, err
	}

	sessionID := randomSessionID()
	adminToken := randomToken(16)
	now := time.Now().UnixMilli()

	data := &SessionData{
		Settings:      norm,
		SessionID:     sessionID,
		AdminToken:    adminToken,
		Status:        "open",
		CreatedAt:     now,
		UpdatedAt:     now,
		Model:         "@cf/google/gemma-4-26b-a4b-it",
		Participants:  make(map[string]*ParticipantTrack),
		Conversations: make(map[int]*Conversation),
		NextSeq:       1,
		NextMsgSeq:    1,
	}

	s.mu.Lock()
	s.sessions[sessionID] = data
	s.mu.Unlock()

	pub := data.toPublic()
	pub.AdminToken = adminToken
	return pub, nil
}

// GetSession returns public metadata for a session.
func (s *Service) GetSession(sessionID string) (*PublicSession, error) {
	s.mu.RLock()
	data, exists := s.sessions[sessionID]
	s.mu.RUnlock()

	if !exists || data.Status == "deleted" {
		return nil, fmt.Errorf("session not found")
	}

	pub := data.toPublic()
	return &pub, nil
}

// GetHostView returns the comprehensive host dashboard view.
func (s *Service) GetHostView(sessionID, adminToken string) (*HostView, error) {
	s.mu.RLock()
	data, exists := s.sessions[sessionID]
	s.mu.RUnlock()

	if !exists || data.Status == "deleted" {
		return nil, fmt.Errorf("session not found")
	}

	data.mu.RLock()
	defer data.mu.RUnlock()

	if adminToken != "" && adminToken != data.AdminToken {
		return nil, fmt.Errorf("unauthorized host token")
	}

	pub := data.toPublicUnlocked()
	var convs []Conversation
	var summaries []HostConversationSummary

	for _, conv := range data.Conversations {
		c := *conv
		convs = append(convs, c)

		lastMsg := ""
		if len(c.Messages) > 0 {
			lastMsg = c.Messages[len(c.Messages)-1].Text
		}

		summaries = append(summaries, HostConversationSummary{
			Participant: c.Participant,
			Alias:       c.Alias,
			Turns:       c.Turns,
			Done:        c.Done,
			Messages:    len(c.Messages),
			UpdatedAt:   c.UpdatedAt,
			LastMessage: lastMsg,
		})
	}

	return &HostView{
		PublicSession: pub,
		Conversations: convs,
		Summaries:     summaries,
	}, nil
}

// JoinSession enters or resumes a participant conversation track.
func (s *Service) JoinSession(sessionID, participantID, alias string) (*Conversation, error) {
	if participantID == "" {
		return nil, fmt.Errorf("participantId is required")
	}

	s.mu.RLock()
	data, exists := s.sessions[sessionID]
	s.mu.RUnlock()

	if !exists || data.Status != "open" {
		return nil, fmt.Errorf("session not open")
	}

	data.mu.Lock()
	defer data.mu.Unlock()

	// Resume existing conversation if participant already joined
	if track, found := data.Participants[participantID]; found {
		if conv, ok := data.Conversations[track.Seq]; ok {
			return conv, nil
		}
	}

	// Check participant limit
	if len(data.Participants) >= data.Settings.MaxParticipants {
		return nil, fmt.Errorf("session reached max participants limit")
	}

	now := time.Now().UnixMilli()
	seq := data.NextSeq
	data.NextSeq++

	cleanAlias := ""
	if data.Settings.AskAlias {
		cleanAlias = CleanLine(alias, 50)
	}

	// Create participant track
	data.Participants[participantID] = &ParticipantTrack{
		Seq:       seq,
		Alias:     cleanAlias,
		Turns:     0,
		Asked:     1,
		Done:      false,
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Generate initial opening greeting message (0 token)
	openMsg := OpeningMessage(data.Settings)
	firstMsg := Message{
		Seq:  data.NextMsgSeq,
		Role: "interviewer",
		Text: openMsg,
		At:   now,
	}
	data.NextMsgSeq++

	conv := &Conversation{
		Participant: seq,
		Alias:       cleanAlias,
		Turns:       0,
		Done:        false,
		Messages:    []Message{firstMsg},
		UpdatedAt:   now,
	}

	data.Conversations[seq] = conv
	data.UpdatedAt = now

	return conv, nil
}

// SendMessage processes participant input, calls Gemma 4, and appends the reply.
func (s *Service) SendMessage(r *http.Request, sessionID, participantID, text string) (*Message, int, bool, error) {
	cleanedText := CleanText(text, 1000)
	if cleanedText == "" {
		return nil, 0, false, fmt.Errorf("message text cannot be empty")
	}

	s.mu.RLock()
	data, exists := s.sessions[sessionID]
	s.mu.RUnlock()

	if !exists || data.Status != "open" {
		return nil, 0, false, fmt.Errorf("session not available")
	}

	data.mu.Lock()
	track, found := data.Participants[participantID]
	if !found {
		data.mu.Unlock()
		return nil, 0, false, fmt.Errorf("participant not joined")
	}
	if track.Done {
		data.mu.Unlock()
		return nil, 0, false, fmt.Errorf("interview is already finished")
	}

	conv, ok := data.Conversations[track.Seq]
	if !ok {
		data.mu.Unlock()
		return nil, 0, false, fmt.Errorf("conversation not found")
	}

	now := time.Now().UnixMilli()

	// 1. Append participant message
	partMsg := Message{
		Seq:  data.NextMsgSeq,
		Role: "participant",
		Text: cleanedText,
		At:   now,
	}
	data.NextMsgSeq++
	conv.Messages = append(conv.Messages, partMsg)
	track.Turns++
	conv.Turns = track.Turns

	// Snapshot needed data for LLM invocation outside lock
	settings := data.Settings
	history := make([]Message, len(conv.Messages)-1)
	copy(history, conv.Messages[:len(conv.Messages)-1])
	currentTurn := conv.Turns
	askedCount := track.Asked
	if currentTurn > askedCount && askedCount < len(settings.Questions) {
		track.Asked++
	}
	isFinal := currentTurn >= settings.MaxTurns

	data.mu.Unlock()

	// 2. Generate warm, neutral interviewer reply
	sysPrompt := BuildSystemPrompt(settings)
	userPrompt := BuildUserPrompt(settings, history, cleanedText, currentTurn, askedCount)

	var replyText string
	var genErr error

	if s.ragEngine != nil {
		// Call Cloudflare Workers AI with Google Gemma 4
		replyText, genErr = s.ragEngine.CallCloudflareAI(r.Context(), sysPrompt, []models.ChatMessage{
			{Role: "user", Content: userPrompt},
		}, 384)
	}

	if genErr != nil || replyText == "" {
		log.Printf("[NativeHarmonica] Model call error or nil engine, using local conversational fallback: %v", genErr)
		replyText = localInterviewerFallback(settings, userPrompt, cleanedText, currentTurn, isFinal)
	}

	replyText = CleanReply(replyText, 600)

	// 3. Append interviewer reply under lock
	data.mu.Lock()
	defer data.mu.Unlock()

	interviewerMsg := Message{
		Seq:  data.NextMsgSeq,
		Role: "interviewer",
		Text: replyText,
		At:   time.Now().UnixMilli(),
	}
	data.NextMsgSeq++

	conv.Messages = append(conv.Messages, interviewerMsg)
	conv.Done = isFinal
	track.Done = isFinal
	conv.UpdatedAt = time.Now().UnixMilli()
	data.UpdatedAt = time.Now().UnixMilli()

	return &interviewerMsg, currentTurn, isFinal, nil
}

func localInterviewerFallback(settings SessionSettings, userPrompt, latest string, turn int, isFinal bool) string {
	if isFinal {
		if settings.Language == LangEn {
			return "Thank you very much for taking the time to share your perspective. Your input has been recorded and will be summarized for public deliberation."
		}
		return "謝謝你花時間把想法說清楚。這些內容會被整理成逐字稿，納入審議分析。如果還有想補充的，隨時可以再開一輪。"
	}

	snip := strings.TrimSpace(latest)
	runes := []rune(snip)
	if len(runes) > 18 {
		snip = string(runes[:18]) + "…"
	}

	probes := []string{
		"如果要讓你改變想法或完全放心，你覺得需要看到什麼具體的科學數據或制度保證？",
		"這項議題對你身邊的人——家人、工作或社區，最直接的影響會是什麼？",
		"在「供電穩定」、「安全風險」與「環境永續」之間，你心目中的優先順序是什麼？",
		"有沒有哪種說法是你常聽過，但始終無法接受或抱持懷疑的？為什麼？",
	}

	if turn%2 == 1 {
		if settings.Language == LangEn {
			return fmt.Sprintf("You mentioned \"%s\" — could you elaborate a bit more on that? What experience leads you to this view?", snip)
		}
		return fmt.Sprintf("你提到「%s」——可以多說一點嗎？是什麼經驗或資訊讓你這樣想？", snip)
	}

	qi := turn / 2
	if qi < len(settings.Questions) {
		if settings.Language == LangEn {
			return fmt.Sprintf("Understood, thank you. Looking from another angle: %s", settings.Questions[qi])
		}
		return fmt.Sprintf("了解，謝謝你的分享。換個角度想：%s", settings.Questions[qi])
	}

	return probes[(turn/2)%len(probes)]
}

// ExportTTTCCsv returns the Talk to the City formatted CSV for a session.
func (s *Service) ExportTTTCCsv(sessionID string) ([]byte, error) {
	s.mu.RLock()
	data, exists := s.sessions[sessionID]
	s.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("session not found")
	}

	data.mu.RLock()
	defer data.mu.RUnlock()

	pub := data.toPublicUnlocked()
	var convs []Conversation
	for _, c := range data.Conversations {
		convs = append(convs, *c)
	}

	return FormatTTTCCsv(pub, convs)
}

// ExportTranscriptsJSON returns the full transcripts JSON.
func (s *Service) ExportTranscriptsJSON(sessionID string) ([]byte, error) {
	s.mu.RLock()
	data, exists := s.sessions[sessionID]
	s.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("session not found")
	}

	data.mu.RLock()
	defer data.mu.RUnlock()

	pub := data.toPublicUnlocked()
	var convs []Conversation
	for _, c := range data.Conversations {
		convs = append(convs, *c)
	}

	return FormatTranscriptsJSON(pub, convs)
}

func (d *SessionData) toPublic() PublicSession {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return d.toPublicUnlocked()
}

func (d *SessionData) toPublicUnlocked() PublicSession {
	completed := 0
	for _, p := range dataParticipants(d) {
		if p.Done {
			completed++
		}
	}

	return PublicSession{
		SessionID:       d.SessionID,
		Topic:           d.Settings.Topic,
		Goal:            d.Settings.Goal,
		Context:         d.Settings.Context,
		Critical:        d.Settings.Critical,
		Questions:       d.Settings.Questions,
		Language:        d.Settings.Language,
		Status:          d.Status,
		MaxTurns:        d.Settings.MaxTurns,
		MaxParticipants: d.Settings.MaxParticipants,
		AskAlias:        d.Settings.AskAlias,
		Participants:    len(d.Participants),
		Completed:       completed,
		CreatedAt:       d.CreatedAt,
		UpdatedAt:       d.UpdatedAt,
		Model:           d.Model,
	}
}

func dataParticipants(d *SessionData) []*ParticipantTrack {
	res := make([]*ParticipantTrack, 0, len(d.Participants))
	for _, p := range d.Participants {
		res = append(res, p)
	}
	return res
}

// GetTopicSessions returns all sessions linked to a topic.
func (s *Service) GetTopicSessions(topicID string) []models.HarmonicaSessionRef {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list, exists := s.topicSessions[topicID]
	if !exists {
		return []models.HarmonicaSessionRef{}
	}
	res := make([]models.HarmonicaSessionRef, len(list))
	copy(res, list)
	return res
}

// AddTopicSession links a session to a topic.
func (s *Service) AddTopicSession(topicID string, ref models.HarmonicaSessionRef) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if ref.URL == "" && ref.SessionID != "" {
		ref.URL = fmt.Sprintf("/s/%s", ref.SessionID)
	}
	if ref.CreatedAt == 0 {
		ref.CreatedAt = time.Now().Unix()
	}

	list := s.topicSessions[topicID]
	for i, existing := range list {
		if existing.SessionID == ref.SessionID {
			list[i] = ref
			s.topicSessions[topicID] = list
			return
		}
	}
	s.topicSessions[topicID] = append([]models.HarmonicaSessionRef{ref}, list...)
}

// HTTP Handlers

func (s *Service) HandleCreateSession(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		SessionSettings
		TopicID string `json:"topicId"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, `{"error":"invalid json body"}`, http.StatusBadRequest)
		return
	}

	session, err := s.CreateSession(payload.SessionSettings)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusBadRequest)
		return
	}

	topicID := r.URL.Query().Get("topicId")
	if topicID == "" {
		topicID = payload.TopicID
	}
	if topicID != "" {
		s.AddTopicSession(topicID, models.HarmonicaSessionRef{
			SessionID: session.SessionID,
			Title:     session.Topic,
			Goal:      session.Goal,
			URL:       fmt.Sprintf("/s/%s", session.SessionID),
			CreatedAt: time.Now().Unix(),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ok":        true,
		"sessionId": session.SessionID,
		"topic":     session.Topic,
		"adminToken": session.AdminToken,
		"urls": map[string]string{
			"participate": fmt.Sprintf("/s/%s", session.SessionID),
			"host":        fmt.Sprintf("/h/%s#admin=%s", session.SessionID, session.AdminToken),
		},
		"session": session,
	})
}

func (s *Service) HandleGetSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	session, err := s.GetSession(sessionID)
	if err != nil {
		http.Error(w, `{"error":"session not found"}`, http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(session)
}

func (s *Service) HandleGetHost(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	token := r.URL.Query().Get("admin")
	if token == "" {
		token = r.Header.Get("X-Admin-Token")
	}

	hostView, err := s.GetHostView(sessionID, token)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusForbidden)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(hostView)
}

func (s *Service) HandleJoinSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	var req struct {
		ParticipantID string `json:"participantId"`
		Alias         string `json:"alias"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json body"}`, http.StatusBadRequest)
		return
	}

	conv, err := s.JoinSession(sessionID, req.ParticipantID, req.Alias)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ok":           true,
		"conversation": conv,
	})
}

func (s *Service) HandleSendMessage(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	var req struct {
		ParticipantID string `json:"participantId"`
		Text          string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"invalid json body"}`, http.StatusBadRequest)
		return
	}

	reply, turn, done, err := s.SendMessage(r, sessionID, req.ParticipantID, req.Text)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ok":    true,
		"reply": reply,
		"turn":  turn,
		"done":  done,
	})
}

func (s *Service) HandleExportCsv(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	csvBytes, err := s.ExportTTTCCsv(sessionID)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="topos-harmonica-%s-tttc.csv"`, sessionID))
	w.WriteHeader(http.StatusOK)
	w.Write(csvBytes)
}

func (s *Service) HandleExportJSON(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	jsonBytes, err := s.ExportTranscriptsJSON(sessionID)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="topos-harmonica-%s-transcripts.json"`, sessionID))
	w.WriteHeader(http.StatusOK)
	w.Write(jsonBytes)
}

func (s *Service) HandleGetTopicSessions(w http.ResponseWriter, r *http.Request) {
	topicID := r.PathValue("id")
	if topicID == "" {
		http.Error(w, `{"error":"topic id required"}`, http.StatusBadRequest)
		return
	}
	sessions := s.GetTopicSessions(topicID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(sessions)
}

func (s *Service) HandleAddTopicSession(w http.ResponseWriter, r *http.Request) {
	topicID := r.PathValue("id")
	if topicID == "" {
		http.Error(w, `{"error":"topic id required"}`, http.StatusBadRequest)
		return
	}

	var ref models.HarmonicaSessionRef
	if err := json.NewDecoder(r.Body).Decode(&ref); err != nil {
		http.Error(w, `{"error":"invalid json body"}`, http.StatusBadRequest)
		return
	}

	if ref.SessionID == "" {
		http.Error(w, `{"error":"sessionId is required"}`, http.StatusBadRequest)
		return
	}

	s.AddTopicSession(topicID, ref)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"ok":       true,
		"topicId":  topicID,
		"sessions": s.GetTopicSessions(topicID),
	})
}
