package mcp

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"

	"github.com/reviz-tw/topos/server/internal/models"
	"github.com/reviz-tw/topos/server/internal/rag"
)

// JSONRPCRequest represents an incoming MCP request.
type JSONRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// JSONRPCResponse represents an outgoing MCP response.
type JSONRPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id,omitempty"`
	Result  interface{} `json:"result,omitempty"`
	Error   *RPCError   `json:"error,omitempty"`
}

type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type Session struct {
	ID     string
	Events chan string
}

// Server provides SSE and HTTP endpoints for Model Context Protocol.
type Server struct {
	ragEngine *rag.Engine
	topics    []models.Topic
	sessions  map[string]*Session
	mu        sync.RWMutex
}

func NewServer(ragEngine *rag.Engine, topics []models.Topic) *Server {
	return &Server{
		ragEngine: ragEngine,
		topics:    topics,
		sessions:  make(map[string]*Session),
	}
}

// HandleSSE establishes an SSE stream for MCP clients.
func (s *Server) HandleSSE(w http.ResponseWriter, r *http.Request) {
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
		return
	}

	sessionID := generateSessionID()
	sess := &Session{
		ID:     sessionID,
		Events: make(chan string, 10),
	}

	s.mu.Lock()
	s.sessions[sessionID] = sess
	s.mu.Unlock()

	defer func() {
		s.mu.Lock()
		delete(s.sessions, sessionID)
		s.mu.Unlock()
	}()

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Send endpoint event according to MCP SSE specification
	endpointURL := fmt.Sprintf("/mcp/message?sessionId=%s", sessionID)
	fmt.Fprintf(w, "event: endpoint\ndata: %s\n\n", endpointURL)
	flusher.Flush()

	ctx := r.Context()
	for {
		select {
		case <-ctx.Done():
			return
		case eventMsg, ok := <-sess.Events:
			if !ok {
				return
			}
			fmt.Fprintf(w, "event: message\ndata: %s\n\n", eventMsg)
			flusher.Flush()
		}
	}
}

// HandleMessage receives JSON-RPC commands from MCP clients.
func (s *Server) HandleMessage(w http.ResponseWriter, r *http.Request) {
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Cannot read body", http.StatusBadRequest)
		return
	}

	var req JSONRPCRequest
	if err := json.Unmarshal(body, &req); err != nil {
		s.sendJSON(w, JSONRPCResponse{
			JSONRPC: "2.0",
			Error:   &RPCError{Code: -32700, Message: "Parse error"},
		})
		return
	}

	resp := s.processRequest(r.Context(), req)
	s.sendJSON(w, resp)
}

func (s *Server) processRequest(ctx context.Context, req JSONRPCRequest) JSONRPCResponse {
	resp := JSONRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
	}

	switch req.Method {
	case "initialize":
		resp.Result = map[string]interface{}{
			"protocolVersion": "2024-11-05",
			"capabilities": map[string]interface{}{
				"tools": map[string]bool{"listChanged": false},
			},
			"serverInfo": map[string]string{
				"name":    "topos-mcp-server",
				"version": "1.0.0",
			},
		}

	case "notifications/initialized":
		resp.Result = true

	case "tools/list":
		resp.Result = map[string]interface{}{
			"tools": []map[string]interface{}{
				{
					"name":        "list_topics",
					"description": "List all public policy deliberation issues currently tracked by Topos.",
					"inputSchema": map[string]interface{}{
						"type":       "object",
						"properties": map[string]interface{}{},
					},
				},
				{
					"name":        "get_topic_cruxes",
					"description": "Retrieve key controversies (cruxes) and pro/con viewpoints for a topic (e.g. nuclear4).",
					"inputSchema": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"topicId": map[string]interface{}{
								"type":        "string",
								"description": "The topic ID, e.g. 'nuclear4'",
							},
						},
						"required": []string{"topicId"},
					},
				},
				{
					"name":        "deliberate_issue",
					"description": "Engage in grounded, multi-perspective deliberation on a topic based on official debate transcripts.",
					"inputSchema": map[string]interface{}{
						"type": "object",
						"properties": map[string]interface{}{
							"topicId": map[string]interface{}{
								"type":        "string",
								"description": "Topic ID, e.g. 'nuclear4'",
							},
							"query": map[string]interface{}{
								"type":        "string",
								"description": "The user's question, perspective, or concern to deliberate on.",
							},
						},
						"required": []string{"topicId", "query"},
					},
				},
			},
		}

	case "tools/call":
		var params struct {
			Name      string                 `json:"name"`
			Arguments map[string]interface{} `json:"arguments"`
		}
		if err := json.Unmarshal(req.Params, &params); err != nil {
			resp.Error = &RPCError{Code: -32602, Message: "Invalid params"}
			return resp
		}

		resultText, err := s.callTool(ctx, params.Name, params.Arguments)
		if err != nil {
			resp.Result = map[string]interface{}{
				"isError": true,
				"content": []map[string]string{
					{"type": "text", "text": err.Error()},
				},
			}
		} else {
			resp.Result = map[string]interface{}{
				"content": []map[string]string{
					{"type": "text", "text": resultText},
				},
			}
		}

	default:
		resp.Error = &RPCError{Code: -32601, Message: fmt.Sprintf("Method '%s' not found", req.Method)}
	}

	return resp
}

func (s *Server) callTool(ctx context.Context, name string, args map[string]interface{}) (string, error) {
	switch name {
	case "list_topics":
		b, err := json.MarshalIndent(s.topics, "", "  ")
		return string(b), err

	case "get_topic_cruxes":
		topicID, _ := args["topicId"].(string)
		for _, t := range s.topics {
			if t.ID == topicID {
				b, err := json.MarshalIndent(t.KeyCruxes, "", "  ")
				return string(b), err
			}
		}
		return "", fmt.Errorf("topic '%s' not found", topicID)

	case "deliberate_issue":
		topicID, _ := args["topicId"].(string)
		query, _ := args["query"].(string)
		if query == "" {
			return "", fmt.Errorf("query cannot be empty")
		}

		chatMsg, err := s.ragEngine.Deliberate(ctx, topicID, []models.ChatMessage{
			{Role: "user", Content: query},
		})
		if err != nil {
			return "", err
		}

		output := chatMsg.Content
		if len(chatMsg.Citations) > 0 {
			output += "\n\n### 來源依據：\n"
			for _, c := range chatMsg.Citations {
				output += fmt.Sprintf("- **%s**: %s\n", c.SourceTitle, c.Excerpt)
			}
		}
		return output, nil

	default:
		return "", fmt.Errorf("unknown tool: %s", name)
	}
}

func (s *Server) sendJSON(w http.ResponseWriter, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Access-Control-Allow-Origin", "*")
	json.NewEncoder(w).Encode(v)
}

func generateSessionID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}
