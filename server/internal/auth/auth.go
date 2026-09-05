package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/reviz-tw/topos/server/internal/models"
)

type contextKey string

const UserContextKey contextKey = "topos_user"

// RateLimiter tracks user requests per hour based on email.
type RateLimiter struct {
	mu           sync.Mutex
	limits       map[string][]time.Time
	maxPerHour   int
	windowPeriod time.Duration
}

func NewRateLimiter(maxPerHour int) *RateLimiter {
	return &RateLimiter{
		limits:       make(map[string][]time.Time),
		maxPerHour:   maxPerHour,
		windowPeriod: time.Hour,
	}
}

// Allow checks if the user is allowed to make a request and returns remaining attempts.
func (rl *RateLimiter) Allow(email string, maxLimit int) (bool, int) {
	if maxLimit <= 0 {
		maxLimit = rl.maxPerHour
	}
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	cutoff := now.Add(-rl.windowPeriod)

	// Filter out expired timestamps
	var validTimes []time.Time
	for _, t := range rl.limits[email] {
		if t.After(cutoff) {
			validTimes = append(validTimes, t)
		}
	}

	if len(validTimes) >= maxLimit {
		rl.limits[email] = validTimes
		return false, 0
	}

	validTimes = append(validTimes, now)
	rl.limits[email] = validTimes
	return true, maxLimit - len(validTimes)
}

// Authenticator validates Google ID Tokens and enforces rate limits.
type Authenticator struct {
	expectedClientID string
	limiter          *RateLimiter
	httpClient       *http.Client
}

func NewAuthenticator(clientID string, maxRequestsPerHour int) *Authenticator {
	if maxRequestsPerHour <= 0 {
		maxRequestsPerHour = 30
	}
	return &Authenticator{
		expectedClientID: clientID,
		limiter:          NewRateLimiter(maxRequestsPerHour),
		httpClient:       &http.Client{Timeout: 10 * time.Second},
	}
}

// VerifyGoogleToken calls Google's tokeninfo endpoint to validate the ID token.
func (a *Authenticator) VerifyGoogleToken(idToken string) (*models.UserContext, error) {
	// Bypass verification in local dev if explicitly requested
	if os.Getenv("TOPOS_DEV_MOCK_AUTH") == "true" && idToken == "dev-token" {
		return &models.UserContext{
			Email:         "developer@example.com",
			Name:          "Topos Developer",
			EmailVerified: true,
			Subject:       "dev-12345",
		}, nil
	}

	url := fmt.Sprintf("https://oauth2.googleapis.com/tokeninfo?id_token=%s", idToken)
	resp, err := a.httpClient.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to reach google tokeninfo: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("invalid google id token (status %d)", resp.StatusCode)
	}

	var tokenInfo struct {
		Email         string `json:"email"`
		EmailVerified string `json:"email_verified"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
		Aud           string `json:"aud"`
		Sub           string `json:"sub"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenInfo); err != nil {
		return nil, fmt.Errorf("failed to parse token info: %w", err)
	}

	if a.expectedClientID != "" && tokenInfo.Aud != a.expectedClientID {
		return nil, fmt.Errorf("audience mismatch: got %s, expected %s", tokenInfo.Aud, a.expectedClientID)
	}

	if tokenInfo.Email == "" {
		return nil, fmt.Errorf("token does not contain email")
	}

	return &models.UserContext{
		Email:         tokenInfo.Email,
		Name:          tokenInfo.Name,
		Picture:       tokenInfo.Picture,
		Subject:       tokenInfo.Sub,
		EmailVerified: tokenInfo.EmailVerified == "true",
	}, nil
}

// Middleware returns an HTTP handler that enforces Google authentication and rate limiting.
func (a *Authenticator) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			http.Error(w, `{"error":"missing Authorization header, please sign in with Google"}`, http.StatusUnauthorized)
			return
		}

		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
			http.Error(w, `{"error":"invalid Authorization format, expected Bearer <token>"}`, http.StatusUnauthorized)
			return
		}

		clientToken := parts[1]
		var user *models.UserContext
		var err error

		if clientToken == "guest-token" {
			clientIP := r.Header.Get("X-Forwarded-For")
			if clientIP == "" {
				clientIP = r.RemoteAddr
			} else {
				clientIP = strings.Split(clientIP, ",")[0]
			}
			user = &models.UserContext{
				Email:         fmt.Sprintf("guest@%s", strings.TrimSpace(clientIP)),
				Name:          "訪客體驗者",
				EmailVerified: false,
				Subject:       "guest",
			}
		} else {
			user, err = a.VerifyGoogleToken(clientToken)
			if err != nil {
				http.Error(w, fmt.Sprintf(`{"error":"unauthorized: %s"}`, err.Error()), http.StatusUnauthorized)
				return
			}
		}

		quotaLimit := 30
		if user.Subject == "guest" {
			quotaLimit = 5
		}

		allowed, remaining := a.limiter.Allow(user.Email, quotaLimit)
		if !allowed {
			if user.Subject == "guest" {
				http.Error(w, `{"error":"訪客體驗額度（每小時 5 次）已達上限，請點擊右上角「Google 登入」以解鎖每小時 30 次對話額度！"}`, http.StatusTooManyRequests)
			} else {
				http.Error(w, `{"error":"每小時對話額度（30 次）已用畢，請稍候再試"}`, http.StatusTooManyRequests)
			}
			return
		}

		ctx := context.WithValue(r.Context(), UserContextKey, user)
		ctx = context.WithValue(ctx, "remaining_quota", remaining)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetUserFromContext retrieves the authenticated UserContext.
func GetUserFromContext(ctx context.Context) (*models.UserContext, bool) {
	user, ok := ctx.Value(UserContextKey).(*models.UserContext)
	return user, ok
}
