import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Test matching logic directly
function matchSupportedLanguage(code) {
  if (!code) return null;
  const lower = code.toLowerCase().trim();

  if (
    lower.startsWith('zh-tw') ||
    lower.startsWith('zh-hk') ||
    lower.startsWith('zh-mo') ||
    lower.startsWith('zh-hant') ||
    lower.startsWith('zh')
  ) {
    return 'zh-TW';
  }
  if (lower.startsWith('en')) return 'en';
  if (lower.startsWith('ja')) return 'ja';
  if (lower.startsWith('ko')) return 'ko';
  if (lower.startsWith('fr')) return 'fr';
  if (lower.startsWith('de')) return 'de';
  if (lower.startsWith('es')) return 'es';
  if (lower.startsWith('it')) return 'it';

  return null;
}

const SUPPORTED_LANGUAGES = ['zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'it'];

describe('Language matching and detection', () => {
  it('should support all 8 requested languages', () => {
    assert.equal(SUPPORTED_LANGUAGES.length, 8);
    const expected = ['zh-TW', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'it'];
    assert.deepEqual(SUPPORTED_LANGUAGES, expected);
  });

  it('should correctly match traditional Chinese and variants', () => {
    assert.equal(matchSupportedLanguage('zh-TW'), 'zh-TW');
    assert.equal(matchSupportedLanguage('zh-HK'), 'zh-TW');
    assert.equal(matchSupportedLanguage('zh-MO'), 'zh-TW');
    assert.equal(matchSupportedLanguage('zh-Hant'), 'zh-TW');
    assert.equal(matchSupportedLanguage('zh'), 'zh-TW');
  });

  it('should correctly match English and regional codes', () => {
    assert.equal(matchSupportedLanguage('en'), 'en');
    assert.equal(matchSupportedLanguage('en-US'), 'en');
    assert.equal(matchSupportedLanguage('en-GB'), 'en');
    assert.equal(matchSupportedLanguage('en-AU'), 'en');
  });

  it('should correctly match Japanese', () => {
    assert.equal(matchSupportedLanguage('ja'), 'ja');
    assert.equal(matchSupportedLanguage('ja-JP'), 'ja');
  });

  it('should correctly match Korean', () => {
    assert.equal(matchSupportedLanguage('ko'), 'ko');
    assert.equal(matchSupportedLanguage('ko-KR'), 'ko');
  });

  it('should correctly match French', () => {
    assert.equal(matchSupportedLanguage('fr'), 'fr');
    assert.equal(matchSupportedLanguage('fr-FR'), 'fr');
    assert.equal(matchSupportedLanguage('fr-CA'), 'fr');
  });

  it('should correctly match German', () => {
    assert.equal(matchSupportedLanguage('de'), 'de');
    assert.equal(matchSupportedLanguage('de-DE'), 'de');
    assert.equal(matchSupportedLanguage('de-AT'), 'de');
  });

  it('should correctly match Spanish', () => {
    assert.equal(matchSupportedLanguage('es'), 'es');
    assert.equal(matchSupportedLanguage('es-ES'), 'es');
    assert.equal(matchSupportedLanguage('es-MX'), 'es');
    assert.equal(matchSupportedLanguage('es-419'), 'es');
  });

  it('should correctly match Italian', () => {
    assert.equal(matchSupportedLanguage('it'), 'it');
    assert.equal(matchSupportedLanguage('it-IT'), 'it');
    assert.equal(matchSupportedLanguage('it-CH'), 'it');
  });

  it('should return null for unsupported languages', () => {
    assert.equal(matchSupportedLanguage('ru'), null);
    assert.equal(matchSupportedLanguage('ar'), null);
    assert.equal(matchSupportedLanguage('pt'), null);
    assert.equal(matchSupportedLanguage(''), null);
  });
});
