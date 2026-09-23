package harmonica

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/reviz-tw/topos/server/internal/models"
)

const (
	DefaultHarmonicaOrigin = "https://harmonica.mashbean.net"
)

// Service provides proxying and orchestration with Pocket Harmonica.
type Service struct {
	origin     string
	httpClient *http.Client
	mu         sync.RWMutex
	sessions   map[string][]models.HarmonicaSessionRef
}

func NewService() *Service {
	origin := os.Getenv("HARMONICA_ORIGIN")
	if origin == "" {
		origin = DefaultHarmonicaOrigin
	}
	origin = strings.TrimRight(origin, "/")

	s := &Service{
		origin:     origin,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		sessions:   make(map[string][]models.HarmonicaSessionRef),
	}

	// Preload default session for nuclear4
	s.sessions["nuclear4"] = []models.HarmonicaSessionRef{
		{
			SessionID: "6o0ryapw2o",
			Title:     "核電重啟公眾訪談",
			Goal:      "測試與收集核電重啟之條件、顧慮與多元考量",
			URL:       origin + "/s/6o0ryapw2o",
			IsDefault: true,
			CreatedAt: time.Now().Unix(),
		},
	}

	return s
}

// GetTopicSessions returns all Harmonica sessions linked to a topic.
func (s *Service) GetTopicSessions(topicID string) []models.HarmonicaSessionRef {
	s.mu.RLock()
	defer s.mu.RUnlock()

	list, exists := s.sessions[topicID]
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
		ref.URL = fmt.Sprintf("%s/s/%s", s.origin, ref.SessionID)
	}
	if ref.CreatedAt == 0 {
		ref.CreatedAt = time.Now().Unix()
	}

	list := s.sessions[topicID]
	// Avoid duplicates
	for i, existing := range list {
		if existing.SessionID == ref.SessionID {
			list[i] = ref
			s.sessions[topicID] = list
			return
		}
	}
	s.sessions[topicID] = append([]models.HarmonicaSessionRef{ref}, list...)
}

// HandleGetTopicSessions serves GET /api/topics/{id}/harmonica/sessions
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

// HandleAddTopicSession serves POST /api/topics/{id}/harmonica/sessions
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

// HandleGetSession serves GET /api/harmonica/sessions/{id}
func (s *Service) HandleGetSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	if sessionID == "" {
		http.Error(w, `{"error":"session id required"}`, http.StatusBadRequest)
		return
	}

	targetURL := fmt.Sprintf("%s/api/sessions/%s", s.origin, sessionID)
	req, err := http.NewRequestWithContext(r.Context(), "GET", targetURL, nil)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[Harmonica] Proxy GET session %s error: %v", sessionID, err)
		http.Error(w, fmt.Sprintf(`{"error":"failed to connect to Harmonica: %s"}`, err.Error()), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// HandleCreateSession serves POST /api/harmonica/sessions
func (s *Service) HandleCreateSession(w http.ResponseWriter, r *http.Request) {
	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"failed to read request body"}`, http.StatusBadRequest)
		return
	}

	targetURL := fmt.Sprintf("%s/api/sessions", s.origin)
	req, err := http.NewRequestWithContext(r.Context(), "POST", targetURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[Harmonica] Create session error: %v", err)
		http.Error(w, fmt.Sprintf(`{"error":"failed to create session on Harmonica: %s"}`, err.Error()), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		http.Error(w, `{"error":"failed to read Harmonica response"}`, http.StatusBadGateway)
		return
	}

	// If successful and topicId query param was supplied, auto-bind
	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated {
		topicID := r.URL.Query().Get("topicId")
		if topicID != "" {
			var created struct {
				SessionID string `json:"sessionId"`
				Topic     string `json:"topic"`
			}
			if err := json.Unmarshal(respBytes, &created); err == nil && created.SessionID != "" {
				s.AddTopicSession(topicID, models.HarmonicaSessionRef{
					SessionID: created.SessionID,
					Title:     created.Topic,
					URL:       fmt.Sprintf("%s/s/%s", s.origin, created.SessionID),
					CreatedAt: time.Now().Unix(),
				})
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(respBytes)
}

// HandleJoinSession serves POST /api/harmonica/sessions/{id}/join
func (s *Service) HandleJoinSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	if sessionID == "" {
		http.Error(w, `{"error":"session id required"}`, http.StatusBadRequest)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"failed to read request body"}`, http.StatusBadRequest)
		return
	}

	targetURL := fmt.Sprintf("%s/api/sessions/%s/join", s.origin, sessionID)
	req, err := http.NewRequestWithContext(r.Context(), "POST", targetURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[Harmonica] Proxy join session %s error: %v", sessionID, err)
		http.Error(w, fmt.Sprintf(`{"error":"failed to connect to Harmonica: %s"}`, err.Error()), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// HandleSendMessage serves POST /api/harmonica/sessions/{id}/messages
func (s *Service) HandleSendMessage(w http.ResponseWriter, r *http.Request) {
	sessionID := r.PathValue("id")
	if sessionID == "" {
		http.Error(w, `{"error":"session id required"}`, http.StatusBadRequest)
		return
	}

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, `{"error":"failed to read request body"}`, http.StatusBadRequest)
		return
	}

	targetURL := fmt.Sprintf("%s/api/sessions/%s/messages", s.origin, sessionID)
	req, err := http.NewRequestWithContext(r.Context(), "POST", targetURL, bytes.NewBuffer(bodyBytes))
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":"%s"}`, err.Error()), http.StatusInternalServerError)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[Harmonica] Proxy message to session %s error: %v", sessionID, err)
		http.Error(w, fmt.Sprintf(`{"error":"failed to connect to Harmonica: %s"}`, err.Error()), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}
