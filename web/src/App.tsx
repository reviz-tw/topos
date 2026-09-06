import React, { useState, useEffect } from 'react';
import { Topic, ChatMessage, UserProfile, HistorySession } from './types';
import {
  SupportedLanguage,
  detectUserLanguage,
  setCookie,
  LANGUAGE_COOKIE_NAME,
} from './utils/cookie';
import {
  TRANSLATIONS,
  TOPIC_TRANSLATIONS,
} from './i18n/translations';
import { LanguageSelector } from './components/LanguageSelector';

// Declare Google Identity Services global
declare global {
  interface Window {
    google?: any;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

const CAT_COLORS = [
  { tint: '#FFF1A6', ink: '#3A2D00', dot: '#FFD400' },
  { tint: '#DCFCC4', ink: '#143A00', dot: '#6FE83A' },
  { tint: '#C9F1FF', ink: '#002A45', dot: '#00C2FF' },
  { tint: '#FFD9E8', ink: '#5A0024', dot: '#FF2E88' },
];

const FALLBACK_TOPICS: Topic[] = [
  {
    id: 'nuclear4',
    category: '能源政策',
    title: '台灣是否應該重啟核四（啟封商轉發電）？',
    description: '回顧 2021 公投第 17 案及當前能源轉型爭議，探討地質耐震、工程整合、核廢料處置與供電穩定之交鋒。',
    tags: ['能源', '核能', '公投', '地質安全', '淨零碳排'],
    keyCruxes: [
      {
        title: '地質與耐震安全',
        description: 'S 斷層與外海斷層是否連通，電廠耐震設計與 PGA 加速度能否承受強震？',
        proPoints: ['中央地調所報告載明非活動斷層', '即便保守推估地動值 0.57G 仍低於廠房耐震 0.66G，且可工程加固', '日本女川與柏崎刈羽核電廠均有耐震經驗'],
        conPoints: ['陳文山等學者提出外海活動斷層相連之新事證', '耐震標準若因新斷層大幅調高，核四難以完全保證無虞', '北部人口稠密，承受不起重大核災風險'],
      },
      {
        title: '工程整合與建廠測試',
        description: '試運轉測試未完成 vs. 安檢報告完成，到底能否安全重啟？',
        proPoints: ['2014 年完成 231 份安檢報告', '一號機設備大多完好，缺少零件與數位儀控可洽美商奇異公司重新採購', '國際上有類似封存後重啟並商轉之前例（如美國 Watts Bar）'],
        conPoints: ['許永輝處長指出試運轉測試 308 份未通過原能會審查', '歐美電器設備與日本 ABWR 廠房空間無法相容，管線狹小難以加固', '原廠團隊已解散，關鍵零件停產，重啟耗時且經費深不見底'],
      },
      {
        title: '能源配比、空污與淨零',
        description: '重啟核四是否有助於減碳抑低空污，還是應全力發展綠能與天然氣？',
        proPoints: ['核能為零碳基載電力，可大幅減少中南部燃煤發電與肺腺癌空污風險', '天然氣儲存天數短，過度依賴天然氣有國安與斷氣封鎖風險', '再生能源具有間歇性，大型儲能成本過高'],
        conPoints: ['核四重啟至少需要 7~10 年以上，遠水救不了近火', '現代國際趨勢轉向風電、光電與分散式電網', '核廢料（低放與高放射性）在台灣無縣市願意接納最終處置場，形成世代不正義'],
      },
    ],
  },
];

export default function App() {
  const [currentLang, setCurrentLang] = useState<SupportedLanguage>(() => detectUserLanguage());
  const [topics, setTopics] = useState<Topic[]>(FALLBACK_TOPICS);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(FALLBACK_TOPICS[0].id);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [messagesByTopic, setMessagesByTopic] = useState<Record<string, ChatMessage[]>>({});
  const [historyByTopic, setHistoryByTopic] = useState<Record<string, HistorySession[]>>({});
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [remainingQuota, setRemainingQuota] = useState<number>(5);
  const [googleClientId, setGoogleClientId] = useState<string>(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');

  const t = TRANSLATIONS[currentLang] || TRANSLATIONS['zh-TW'];

  // Update HTML document attributes when language changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = currentLang;
      document.title = t.appTitle;
    }
  }, [currentLang, t.appTitle]);

  const handleLanguageChange = (newLang: SupportedLanguage) => {
    setCurrentLang(newLang);
    setCookie(LANGUAGE_COOKIE_NAME, newLang, 365);
    try {
      localStorage.setItem(LANGUAGE_COOKIE_NAME, newLang);
    } catch {
      // Ignore localStorage errors
    }
  };

  // 1. Restore local storage on initial mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('topos_user');
      let u: UserProfile | null = null;
      if (savedUser) {
        u = JSON.parse(savedUser);
        setUser(u);
      }

      const savedMsgs = localStorage.getItem('topos_messages_by_topic');
      if (savedMsgs) setMessagesByTopic(JSON.parse(savedMsgs));

      const savedHistory = localStorage.getItem('topos_history_by_topic');
      if (savedHistory) setHistoryByTopic(JSON.parse(savedHistory));

      const savedQuota = localStorage.getItem('topos_remaining_quota');
      if (savedQuota) {
        setRemainingQuota(Number(savedQuota));
      } else {
        setRemainingQuota(u && u.token !== 'guest-token' ? 30 : 5);
      }
    } catch (e) {
      console.error('Failed to load local storage state:', e);
    }
  }, []);

  // 2. Fetch Topics & Config from Server
  useEffect(() => {
    fetch(`${API_BASE}/api/topics`)
      .then((res) => res.json())
      .then((data: Topic[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setTopics(data);
          setSelectedTopicId(data[0].id);
        }
      })
      .catch((err) => console.log('Using fallback topics:', err));

    fetch(`${API_BASE}/api/config`)
      .then((res) => res.json())
      .then((cfg) => {
        if (cfg.googleClientId) {
          setGoogleClientId(cfg.googleClientId);
        }
      })
      .catch(() => {});
  }, []);

  // 3. Initialize Google One Tap if valid Google Client ID is configured
  useEffect(() => {
    const handleCredentialResponse = (response: any) => {
      try {
        const base64Url = response.credential.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
          atob(base64)
            .split('')
            .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
            .join('')
        );
        const payload = JSON.parse(jsonPayload);
        const profile: UserProfile = {
          name: payload.name || payload.email,
          email: payload.email,
          picture: payload.picture,
          token: response.credential,
        };
        setUser(profile);
        localStorage.setItem('topos_user', JSON.stringify(profile));
        setRemainingQuota(30);
        localStorage.setItem('topos_remaining_quota', '30');
      } catch (e) {
        console.error('Failed to parse Google JWT:', e);
      }
    };

    if (!googleClientId || googleClientId.includes('TOPOS_CLIENT_ID')) {
      return;
    }

    const renderBtn = () => {
      const btnSlot = document.getElementById('google-btn-slot');
      if (btnSlot && window.google?.accounts?.id) {
        try {
          window.google.accounts.id.renderButton(btnSlot, {
            theme: 'outline',
            size: 'medium',
            shape: 'pill',
            text: 'signin_with',
            locale: currentLang === 'zh-TW' ? 'zh-TW' : currentLang,
          });
        } catch (e) {
          console.warn('Failed to render Google button:', e);
        }
      }
    };

    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
          auto_select: false,
        });

        renderBtn();
        setTimeout(renderBtn, 100);
        setTimeout(renderBtn, 400);

        if (!user) {
          window.google.accounts.id.prompt();
        }
      }
    };

    if (window.google) {
      initGoogle();
    } else {
      const timer = setInterval(() => {
        if (window.google) {
          initGoogle();
          clearInterval(timer);
        }
      }, 300);
      return () => clearInterval(timer);
    }
  }, [googleClientId, user, currentLang]);

  // Actions
  const loginGuest = (): UserProfile => {
    const guestUser: UserProfile = {
      name: t.guestUserName,
      email: 'guest@topos.local',
      token: 'guest-token',
    };
    setUser(guestUser);
    localStorage.setItem('topos_user', JSON.stringify(guestUser));
    setRemainingQuota((prev) => Math.min(prev, 5));
    return guestUser;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('topos_user');
    setRemainingQuota(5);
    localStorage.setItem('topos_remaining_quota', '5');
  };

  const formatNow = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  // Resolve localized topic content
  const getLocalizedTopic = (rawTopic: Topic): Topic => {
    const trans = TOPIC_TRANSLATIONS[rawTopic.id]?.[currentLang];
    if (!trans) return rawTopic;
    return {
      ...rawTopic,
      category: trans.category || rawTopic.category,
      title: trans.title || rawTopic.title,
      description: trans.description || rawTopic.description,
      tags: trans.tags || rawTopic.tags,
      keyCruxes: trans.keyCruxes || rawTopic.keyCruxes,
    };
  };

  const rawSelectedTopic = topics.find((t) => t.id === selectedTopicId) || topics[0] || FALLBACK_TOPICS[0];
  const selectedTopic = getLocalizedTopic(rawSelectedTopic);
  const selIdx = topics.findIndex((t) => t.id === rawSelectedTopic.id);
  const selCat = CAT_COLORS[Math.max(0, selIdx) % CAT_COLORS.length] || CAT_COLORS[0];

  const currentLiveMessages = messagesByTopic[selectedTopic.id] || [];
  const historyList = historyByTopic[selectedTopic.id] || [];
  const viewedSession = viewingSessionId ? historyList.find((h) => h.id === viewingSessionId) : null;
  const activeMessages = viewedSession ? viewedSession.messages : currentLiveMessages;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || loading || viewedSession) return;

    let activeUser = user;
    if (!activeUser) {
      activeUser = loginGuest();
    }

    const userMsg: ChatMessage = { role: 'user', content: text };
    const newHistory = [...currentLiveMessages, userMsg];

    setMessagesByTopic((prev) => {
      const next = { ...prev, [selectedTopic.id]: newHistory };
      localStorage.setItem('topos_messages_by_topic', JSON.stringify(next));
      return next;
    });
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/topics/${selectedTopic.id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeUser.token}`,
        },
        body: JSON.stringify({
          topicId: selectedTopic.id,
          messages: newHistory,
          language: currentLang,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || '討論請求失敗');
      }

      const data = await res.json();
      setMessagesByTopic((prev) => {
        const updated = { ...prev, [selectedTopic.id]: [...newHistory, data.reply] };
        localStorage.setItem('topos_messages_by_topic', JSON.stringify(updated));
        return updated;
      });

      const rem =
        typeof data.remainingRequests === 'number'
          ? data.remainingRequests
          : typeof data.remaining === 'number'
          ? data.remaining
          : null;
      if (rem !== null) {
        setRemainingQuota(rem);
        localStorage.setItem('topos_remaining_quota', String(rem));
      } else {
        setRemainingQuota((prev) => Math.max(0, prev - 1));
      }
    } catch (err: any) {
      setMessagesByTopic((prev) => {
        const fallbackMsg: ChatMessage = {
          role: 'assistant',
          content: `[Topos Facilitator]:\n\n${err.message}`,
        };
        const updated = { ...prev, [selectedTopic.id]: [...newHistory, fallbackMsg] };
        localStorage.setItem('topos_messages_by_topic', JSON.stringify(updated));
        return updated;
      });
    } finally {
      setLoading(false);
    }
  };

  const archiveSession = () => {
    if (currentLiveMessages.length === 0) return;
    const firstQ = (currentLiveMessages.find((m) => m.role === 'user') || { content: t.defaultSessionTitle }).content;
    const session: HistorySession = {
      id: 's' + Date.now(),
      dateLabel: formatNow(),
      firstQuestion: firstQ,
      messages: currentLiveMessages,
    };
    setHistoryByTopic((prev) => {
      const updated = { ...prev, [selectedTopic.id]: [session, ...(prev[selectedTopic.id] || [])] };
      localStorage.setItem('topos_history_by_topic', JSON.stringify(updated));
      return updated;
    });
    setMessagesByTopic((prev) => {
      const updated = { ...prev, [selectedTopic.id]: [] };
      localStorage.setItem('topos_messages_by_topic', JSON.stringify(updated));
      return updated;
    });
    setViewingSessionId(null);
  };

  const proBoxStyle: React.CSSProperties = {
    background: '#C9F1FF',
    color: '#002A45',
    border: '1.5px solid #002A45',
    borderRadius: '6px',
    padding: '8px 10px',
    fontSize: '13px',
    lineHeight: 1.55,
    fontWeight: 600,
  };

  const conBoxStyle: React.CSSProperties = {
    background: '#FFD9E8',
    color: '#5A0024',
    border: '1.5px solid #5A0024',
    borderRadius: '6px',
    padding: '8px 10px',
    fontSize: '13px',
    lineHeight: 1.55,
    fontWeight: 600,
  };

  const isGuest = !user || user.token === 'guest-token';
  const isExhausted = remainingQuota <= 0;
  const canSend = !!inputText.trim() && !loading && !viewedSession && !isExhausted;

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#FFF7E4',
      backgroundImage: 'linear-gradient(90deg, rgba(16,12,10,.04) 1px, transparent 1px), linear-gradient(rgba(16,12,10,.04) 1px, transparent 1px)',
      backgroundSize: '96px 96px',
      fontFamily: "'Space Grotesk', 'Noto Sans TC', system-ui, sans-serif",
      color: '#100C0A',
    }}>
      {/* Sticky Header */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        background: 'rgba(255,247,228,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '2px solid #100C0A',
        padding: '14px clamp(20px,5vw,56px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
      }}>
        {/* Logo & Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#FF2E88', border: '1.5px solid #100C0A', marginRight: '-4px', transform: 'translateY(-2px) rotate(-6deg)', zIndex: 4, position: 'relative' }}></span>
            <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#00C2FF', border: '1.5px solid #100C0A', marginRight: '-4px', transform: 'translateY(2px)', zIndex: 3, position: 'relative' }}></span>
            <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#FFD400', border: '1.5px solid #100C0A', marginRight: '-4px', transform: 'translateY(-1px) rotate(4deg)', zIndex: 2, position: 'relative' }}></span>
            <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#6FE83A', border: '1.5px solid #100C0A', transform: 'translateY(2px)', zIndex: 1, position: 'relative' }}></span>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontFamily: "'Noto Serif TC', serif", fontWeight: 900, fontSize: '26px', letterSpacing: '-0.01em' }}>topos</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, background: '#100C0A', color: '#FFF7E4', padding: '3px 8px', borderRadius: '4px', transform: 'rotate(-2deg)', display: 'inline-block', letterSpacing: '.05em' }}>
                {t.deskBadge}
              </span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: '#6E5F50', marginTop: '3px' }}>
              {t.subtitle}
            </div>
          </div>
        </div>

        {/* Right Header Section: Language Switcher + User Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Language Selector */}
          <LanguageSelector
            currentLang={currentLang}
            onLanguageChange={handleLanguageChange}
            ariaLabel={t.languageSelectAria}
          />

          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#FF2E88', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '14px', border: '2px solid #100C0A' }}>
                {user.name ? user.name.charAt(0) : 'U'}
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700 }}>{user.name}</div>
                <div style={{ fontSize: '11px', color: '#6E5F50', fontFamily: "'JetBrains Mono', monospace" }}>{user.email}</div>
              </div>
              <button
                onClick={logout}
                style={{ border: '2px solid #100C0A', background: '#FFFCF1', padding: '8px 16px', borderRadius: '999px', fontWeight: 900, fontSize: '12px', cursor: 'pointer' }}
              >
                {t.logout}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={loginGuest}
                style={{ background: '#FF2E88', color: '#fff', border: '2px solid #100C0A', borderRadius: '999px', padding: '10px 20px', fontWeight: 900, fontSize: '13px', cursor: 'pointer', boxShadow: '4px 4px 0 #100C0A' }}
              >
                {t.guestButton}
              </button>
              {googleClientId && !googleClientId.includes('TOPOS_CLIENT_ID') ? (
                <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                  <div id="google-btn-slot"></div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    alert(t.googleLoginAlert);
                  }}
                  title="點擊查看設定說明（或使用左側訪客身份）"
                  style={{
                    background: '#FFFCF1',
                    color: '#6E5F50',
                    border: '2px dashed rgba(16,12,10,.4)',
                    borderRadius: '999px',
                    padding: '9px 18px',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {t.googleLoginNotConfigured}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Grid: Topic Selector + Topic Details/Cruxes + Chat */}
      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: 'clamp(20px,5vw,56px)', display: 'flex', flexWrap: 'wrap', gap: '28px' }}>
        
        {/* Left: Topic Selector */}
        <aside style={{ flex: '1 1 260px', minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#6E5F50' }}>
            {t.pickTopicHeading}
          </div>
          {topics.map((rawT, i) => {
            const locT = getLocalizedTopic(rawT);
            const isSel = rawT.id === selectedTopic.id;
            const cc = CAT_COLORS[i % CAT_COLORS.length];
            const cruxLen = locT.keyCruxes?.length || 0;
            return (
              <div
                key={rawT.id}
                onClick={() => {
                  setSelectedTopicId(rawT.id);
                  setViewingSessionId(null);
                }}
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: isSel ? '#FFFCF1' : '#FFF7E4',
                  border: isSel ? '2.5px solid #100C0A' : '2px solid rgba(16,12,10,.18)',
                  boxShadow: isSel ? '4px 4px 0 #100C0A' : 'none',
                  transform: isSel ? 'translate(-2px,-2px)' : 'none',
                  transition: '0.15s ease',
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '3px 10px', borderRadius: '999px', background: cc.tint, color: cc.ink, fontSize: '11px', fontWeight: 900, border: `1px solid ${cc.ink}` }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cc.dot, display: 'inline-block' }}></span>
                  {locT.category}
                </span>
                <div style={{ marginTop: '8px', fontWeight: 900, fontSize: '14px', lineHeight: 1.4 }}>
                  {locT.title}
                </div>
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#6E5F50', fontFamily: "'JetBrains Mono', monospace" }}>
                  {t.cruxCount(cruxLen)}
                </div>
              </div>
            );
          })}
        </aside>

        {/* Right: Main Content */}
        <main style={{ flex: '3 1 480px', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Topic Hero Card with Cruxes */}
          <div style={{ background: '#FFFCF1', border: '2.5px solid #100C0A', borderRadius: '18px', padding: 'clamp(20px,3vw,32px)', boxShadow: '8px 8px 0 #100C0A' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', borderRadius: '999px', background: selCat.tint, color: selCat.ink, fontSize: '12px', fontWeight: 900, border: `1px solid ${selCat.ink}`, marginBottom: '12px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: selCat.dot, display: 'inline-block' }}></span>
              {selectedTopic.category}
            </span>
            <h1 style={{ fontFamily: "'Noto Serif TC', serif", fontWeight: 900, fontSize: 'clamp(26px,3.2vw,40px)', lineHeight: 1.2, margin: '8px 0 12px' }}>
              {selectedTopic.title}
            </h1>
            <p style={{ fontSize: '16px', lineHeight: 1.65, color: '#2A211C', margin: '0 0 20px' }}>
              {selectedTopic.description}
            </p>
            <hr style={{ border: 0, borderTop: '2px dashed rgba(16,12,10,.18)', margin: '0 0 20px' }} />

            <h4 style={{ fontWeight: 900, fontSize: '14px', letterSpacing: '.02em', margin: '0 0 14px' }}>
              {t.keyCruxesHeading}
            </h4>

            {/* Cruxes Grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {selectedTopic.keyCruxes?.map((c, idx) => {
                const pros = c.proPoints || c.pro || [];
                const cons = c.conPoints || c.con || [];
                return (
                  <article key={idx} style={{ flex: '1 1 280px', minWidth: '250px', background: '#FFF7E4', border: '2px solid #100C0A', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', position: 'relative' }}>
                    <span style={{ position: 'absolute', top: '-10px', left: '14px', background: '#100C0A', color: '#FFF7E4', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, padding: '3px 8px', borderRadius: '4px', transform: 'rotate(-2deg)' }}>
                      §0{idx + 1}
                    </span>
                    <h3 style={{ marginTop: '6px', fontWeight: 900, fontSize: '16px', lineHeight: 1.3 }}>
                      {c.title}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#6E5F50', lineHeight: 1.55, margin: 0 }}>
                      {c.description}
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '.04em', color: '#002A45' }}>
                        {t.proLabel}
                      </div>
                      {pros.map((p, pi) => (
                        <div key={pi} style={proBoxStyle}>{p}</div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '.04em', color: '#5A0024' }}>
                        {t.conLabel}
                      </div>
                      {cons.map((p, pi) => (
                        <div key={pi} style={conBoxStyle}>{p}</div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          {/* Deliberation Chat Facilitator */}
          <div style={{ background: '#FFFCF1', border: '2.5px solid #100C0A', borderRadius: '18px', padding: 'clamp(20px,3vw,28px)', boxShadow: '8px 8px 0 #100C0A', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ fontFamily: "'Noto Serif TC', serif", fontWeight: 900, fontSize: '22px', margin: 0 }}>
                  {t.facilitatorTitle}
                </h2>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#6E5F50', marginTop: '4px' }}>
                  {t.facilitatorSubtitle}
                </div>
              </div>
              <span style={{ background: '#100C0A', color: '#FFF7E4', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, padding: '5px 12px', borderRadius: '999px' }}>
                {isGuest
                  ? t.guestQuotaLabel(remainingQuota)
                  : t.memberQuotaLabel(remainingQuota)}
              </span>
            </div>

            {/* If viewing history banner */}
            {viewedSession && (
              <div style={{ background: '#FFF1A6', border: '2px solid #100C0A', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#3A2D00' }}>
                <span>{t.reviewingBanner(viewedSession.dateLabel)}</span>
                <button
                  onClick={() => setViewingSessionId(null)}
                  style={{ border: '2px solid #100C0A', background: '#FFFCF1', padding: '5px 12px', borderRadius: '999px', fontWeight: 900, fontSize: '12px', cursor: 'pointer' }}
                >
                  {t.backToCurrentDialogue}
                </button>
              </div>
            )}

            {/* Chat message bubbles */}
            <div style={{ minHeight: '220px', maxHeight: '440px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 2px' }}>
              {activeMessages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#6E5F50', fontSize: '14px', marginTop: '30px', lineHeight: 1.8 }}>
                  <div>{t.emptyChatPrompt}</div>
                  <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                    {t.sampleQuestions.map((q, qi) => (
                      <span
                        key={qi}
                        onClick={() => {
                          if (!loading && !viewedSession && !isExhausted) {
                            setInputText(q.replace(/^[「"«]+|[」"»]+$/g, ''));
                          }
                        }}
                        style={{
                          cursor: 'pointer',
                          background: '#FFF7E4',
                          border: '1px solid rgba(16,12,10,.25)',
                          borderRadius: '6px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          color: '#100C0A',
                          maxWidth: '90%',
                          transition: 'all 0.1s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#100C0A')}
                        onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(16,12,10,.25)')}
                      >
                        {q}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {activeMessages.map((m, i) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      gap: '4px',
                    }}
                  >
                    <div style={{ fontSize: '11px', fontFamily: "'JetBrains Mono', monospace", color: '#6E5F50', fontWeight: 700 }}>
                      {isUser ? (user?.name || t.userLabel) : t.facilitatorLabel}
                    </div>
                    <div
                      style={{
                        maxWidth: '85%',
                        padding: '14px 18px',
                        borderRadius: isUser ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        border: '2px solid #100C0A',
                        background: isUser ? '#100C0A' : '#FFF7E4',
                        color: isUser ? '#FFF7E4' : '#100C0A',
                        fontSize: '14px',
                        lineHeight: 1.65,
                        whiteSpace: 'pre-wrap',
                        boxShadow: '3px 3px 0 #100C0A',
                      }}
                    >
                      {m.content}
                    </div>

                    {/* Grounded Citations */}
                    {m.citations && m.citations.length > 0 && (
                      <div style={{ maxWidth: '85%', marginTop: '4px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {m.citations.map((c, ci) => (
                          <div
                            key={ci}
                            style={{
                              background: '#FFF1A6',
                              border: '1.5px solid #100C0A',
                              borderRadius: '8px',
                              padding: '6px 10px',
                              fontSize: '11px',
                              color: '#3A2D00',
                            }}
                          >
                            <span style={{ fontWeight: 800 }}>{t.citationSource}{c.sourceTitle}</span>
                            <div style={{ fontStyle: 'italic', marginTop: '2px', color: '#5A4600' }}>
                              「{c.excerpt}」
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6E5F50', fontSize: '13px', fontStyle: 'italic', margin: '10px 0' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FF2E88', animation: 'topos-pulse 1s infinite' }} />
                  {t.loadingMessage}
                </div>
              )}
            </div>

            {/* Input bar */}
            {!viewedSession && (
              <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  disabled={loading || (isGuest && isExhausted)}
                  placeholder={
                    viewedSession
                      ? t.inputPlaceholderReviewing
                      : isGuest && isExhausted
                      ? t.inputPlaceholderExhausted
                      : t.inputPlaceholderNormal
                  }
                  style={{ flex: '1 1 200px', minHeight: '48px', padding: '0 16px', borderRadius: '999px', border: '2px solid #100C0A', background: '#FFF7E4', color: '#100C0A', fontSize: '14px', outline: 'none' }}
                />
                <button
                  type="submit"
                  disabled={!canSend}
                  style={{
                    minHeight: '48px',
                    padding: '0 24px',
                    borderRadius: '999px',
                    border: '2px solid #100C0A',
                    fontWeight: 900,
                    cursor: canSend ? 'pointer' : 'not-allowed',
                    background: canSend ? '#100C0A' : '#F2E5C4',
                    color: canSend ? '#FFF7E4' : '#6E5F50',
                    boxShadow: canSend ? '4px 4px 0 #100C0A' : 'none',
                  }}
                >
                  {t.sendButton}
                </button>
              </form>
            )}

            {/* Bottom action row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              {currentLiveMessages.length > 0 && !viewedSession ? (
                <button
                  onClick={archiveSession}
                  style={{ border: '2px solid #100C0A', background: '#FFFCF1', padding: '8px 16px', borderRadius: '999px', fontWeight: 900, fontSize: '12px', cursor: 'pointer' }}
                >
                  {t.archiveButton}
                </button>
              ) : <div></div>}
              {!user && (
                <span style={{ fontSize: '12px', color: '#6E5F50' }}>
                  {t.guestNotice}
                </span>
              )}
            </div>
          </div>

          {/* History Panel */}
          <div style={{ background: '#FFFCF1', border: '2px solid #100C0A', borderRadius: '14px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '13px', letterSpacing: '.02em', margin: 0 }}>
              {t.historyHeading}
            </h4>
            {historyList.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#6E5F50' }}>
                {t.historyEmpty}
              </div>
            ) : (
              historyList.map((h) => (
                <div
                  key={h.id}
                  onClick={() => setViewingSessionId(h.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: viewingSessionId === h.id ? '#FFF1A6' : '#FFF7E4',
                    border: viewingSessionId === h.id ? '2px solid #100C0A' : '1.5px solid rgba(16,12,10,.18)',
                    boxShadow: viewingSessionId === h.id ? '4px 4px 0 #100C0A' : 'none',
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '10px',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#6E5F50' }}>
                      {h.dateLabel}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 700, marginTop: '2px' }}>
                      {h.firstQuestion}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

        </main>
      </div>
    </div>
  );
}
