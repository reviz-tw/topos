export type SupportedLanguage = 'zh-TW' | 'en' | 'ja' | 'ko' | 'fr' | 'de' | 'es' | 'it';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  'zh-TW',
  'en',
  'ja',
  'ko',
  'fr',
  'de',
  'es',
  'it',
];

export const LANGUAGE_COOKIE_NAME = 'topos_lang';

/**
 * Retrieve a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

/**
 * Set a cookie with path, SameSite, and max-age
 */
export function setCookie(name: string, value: string, days: number = 365): void {
  if (typeof document === 'undefined') return;
  const maxAge = days * 24 * 60 * 60;
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Match a raw language code string (e.g. "zh-TW", "en-US", "ja", "ko-KR")
 * to one of our 8 supported languages.
 */
export function matchSupportedLanguage(code: string): SupportedLanguage | null {
  if (!code) return null;
  const lower = code.toLowerCase().trim();

  // Traditional Chinese / Chinese variants
  if (
    lower.startsWith('zh-tw') ||
    lower.startsWith('zh-hk') ||
    lower.startsWith('zh-mo') ||
    lower.startsWith('zh-hant') ||
    lower.startsWith('zh')
  ) {
    return 'zh-TW';
  }

  // English
  if (lower.startsWith('en')) {
    return 'en';
  }

  // Japanese
  if (lower.startsWith('ja')) {
    return 'ja';
  }

  // Korean
  if (lower.startsWith('ko')) {
    return 'ko';
  }

  // French
  if (lower.startsWith('fr')) {
    return 'fr';
  }

  // German
  if (lower.startsWith('de')) {
    return 'de';
  }

  // Spanish
  if (lower.startsWith('es')) {
    return 'es';
  }

  // Italian
  if (lower.startsWith('it')) {
    return 'it';
  }

  return null;
}

/**
 * Detect user language with priority:
 * 1. Saved in Cookie (topos_lang)
 * 2. Saved in LocalStorage (topos_lang)
 * 3. Browser language (navigator.languages / navigator.language)
 * 4. Fallback to default 'zh-TW'
 */
export function detectUserLanguage(): SupportedLanguage {
  // 1. Check Cookie
  const cookieLang = getCookie(LANGUAGE_COOKIE_NAME);
  if (cookieLang && SUPPORTED_LANGUAGES.includes(cookieLang as SupportedLanguage)) {
    return cookieLang as SupportedLanguage;
  }

  // 2. Check LocalStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const localLang = localStorage.getItem(LANGUAGE_COOKIE_NAME);
      if (localLang && SUPPORTED_LANGUAGES.includes(localLang as SupportedLanguage)) {
        // Ensure cookie is synced
        setCookie(LANGUAGE_COOKIE_NAME, localLang);
        return localLang as SupportedLanguage;
      }
    } catch {
      // Ignore localStorage access errors
    }
  }

  // 3. Check browser languages
  if (typeof navigator !== 'undefined') {
    const browserLangs =
      navigator.languages && navigator.languages.length > 0
        ? navigator.languages
        : [navigator.language];

    for (const rawLang of browserLangs) {
      const matched = matchSupportedLanguage(rawLang);
      if (matched) {
        // Save matched browser language to cookie so it persists
        setCookie(LANGUAGE_COOKIE_NAME, matched);
        return matched;
      }
    }
  }

  // 4. Default Fallback
  return 'zh-TW';
}
