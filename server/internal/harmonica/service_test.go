package harmonica

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/reviz-tw/topos/server/internal/models"
)

func TestHarmonicaServiceTopicSessions(t *testing.T) {
	svc := NewService()

	// Default nuclear4 should be preloaded with 6o0ryapw2o
	nukeSessions := svc.GetTopicSessions("nuclear4")
	if len(nukeSessions) == 0 {
		t.Fatalf("expected preloaded sessions for nuclear4, got 0")
	}
	if nukeSessions[0].SessionID != "6o0ryapw2o" {
		t.Errorf("expected session 6o0ryapw2o, got %s", nukeSessions[0].SessionID)
	}

	// Add a new session
	svc.AddTopicSession("nuclear4", models.HarmonicaSessionRef{
		SessionID: "test-session-123",
		Title:     "居民新訪談",
		Goal:      "深入理解居民訴求",
	})

	updated := svc.GetTopicSessions("nuclear4")
	if len(updated) != 2 {
		t.Errorf("expected 2 sessions, got %d", len(updated))
	}
	if updated[0].SessionID != "test-session-123" {
		t.Errorf("expected newest session first, got %s", updated[0].SessionID)
	}
}

type roundTripFunc func(req *http.Request) *http.Response

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req), nil
}

func TestHarmonicaServiceProxyEndpoints(t *testing.T) {
	mockTransport := roundTripFunc(func(req *http.Request) *http.Response {
		rec := httptest.NewRecorder()
		switch req.URL.Path {
		case "/api/sessions/mock-123":
			rec.Header().Set("Content-Type", "application/json")
			rec.WriteHeader(http.StatusOK)
			rec.Write([]byte(`{"sessionId":"mock-123","topic":"測試主題","status":"open","maxTurns":6}`))
		case "/api/sessions/mock-123/join":
			rec.Header().Set("Content-Type", "application/json")
			rec.WriteHeader(http.StatusOK)
			rec.Write([]byte(`{"ok":true,"conversation":{"participant":1,"turns":0,"done":false,"messages":[{"role":"interviewer","text":"歡迎參加"}]}}`))
		case "/api/sessions/mock-123/messages":
			rec.Header().Set("Content-Type", "application/json")
			rec.WriteHeader(http.StatusOK)
			rec.Write([]byte(`{"ok":true,"reply":{"role":"interviewer","text":"謝謝分享，請多說明"},"turn":1,"done":false}`))
		default:
			rec.WriteHeader(http.StatusNotFound)
		}
		return rec.Result()
	})

	svc := &Service{
		origin:     "https://harmonica.test",
		httpClient: &http.Client{Transport: mockTransport},
		sessions:   make(map[string][]models.HarmonicaSessionRef),
	}

	// 1. Test GET session
	req := httptest.NewRequest("GET", "/api/harmonica/sessions/mock-123", nil)
	req.SetPathValue("id", "mock-123")
	rec := httptest.NewRecorder()
	svc.HandleGetSession(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", rec.Code, rec.Body.String())
	}
	var sessionData map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &sessionData); err != nil || sessionData["sessionId"] != "mock-123" {
		t.Errorf("unexpected session response: %v", sessionData)
	}

	// 2. Test Join session
	joinReq := httptest.NewRequest("POST", "/api/harmonica/sessions/mock-123/join", strings.NewReader(`{"participantId":"p1"}`))
	joinReq.SetPathValue("id", "mock-123")
	joinRec := httptest.NewRecorder()
	svc.HandleJoinSession(joinRec, joinReq)

	if joinRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", joinRec.Code, joinRec.Body.String())
	}

	// 3. Test Send message
	msgReq := httptest.NewRequest("POST", "/api/harmonica/sessions/mock-123/messages", strings.NewReader(`{"participantId":"p1","text":"我覺得可以"}`))
	msgReq.SetPathValue("id", "mock-123")
	msgRec := httptest.NewRecorder()
	svc.HandleSendMessage(msgRec, msgReq)

	if msgRec.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d: %s", msgRec.Code, msgRec.Body.String())
	}
}
