package rag

import (
	"strings"
	"testing"
)

func TestEngineLoadLocalDebates(t *testing.T) {
	engine := NewEngine()

	if len(engine.localDebatesCache) == 0 {
		t.Fatalf("expected debate files to be loaded into localDebatesCache, got 0")
	}

	foundNuclear := false
	foundSportsStation := false

	for fname := range engine.localDebatesCache {
		if strings.Contains(fname, "huang_vs_") {
			foundNuclear = true
		}
		if strings.Contains(fname, "sports_station") || strings.Contains(fname, "citizen_voices") {
			foundSportsStation = true
		}
	}

	if !foundNuclear {
		t.Errorf("expected nuclear4 debates to be loaded")
	}
	if !foundSportsStation {
		t.Errorf("expected sports_station debates to be loaded")
	}

	// Test retrieval
	excerpts, citations := engine.retrieveContextAndCitations("運動驛站 偷拍 跑者驛站")
	if len(citations) == 0 {
		t.Errorf("expected citations for query '運動驛站 偷拍 跑者驛站', got 0")
	}
	if excerpts == "" {
		t.Errorf("expected non-empty excerpts")
	}
}
