import React, { useState, useEffect } from 'react';
import { Topic, ChatMessage, UserProfile, HistorySession } from './types';

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
  {
    id: 'control-yuan',
    category: '憲政體制',
    title: '台灣是否應該廢除監察院與考試院（走向三權分立）？',
    description: '探討五權憲法架構在現代民主體制的運作困境、彈劾與調查權歸屬、以及修憲門檻挑戰。',
    tags: ['憲政', '五權憲法', '三權分立', '監察院'],
    keyCruxes: [
      {
        title: '彈劾與調查權歸屬',
        description: '若廢除監察院，彈劾與公務員懲戒權力應移交立法院還是司法機關？',
        proPoints: ['符合當代主流民主國家三權分立體制', '監察委員常被質疑淪為政黨酬庸與政治工具', '將調查與審計權回歸國會與獨立審計部，提升監督效率'],
        conPoints: ['國會若獨攬調查與彈劾權，恐造成立法院擴權、少數執政受癱瘓', '孫中山五權憲法強調監察權獨立於立法權之外，防止國會專制', '立委素質與黨派對立嚴重，未必比獨立監察院更客觀'],
      },
    ],
  },
];

export default function App() {
  const [topics, setTopics] = useState<Topic[]>(FALLBACK_TOPICS);
  const [selectedTopicId, setSelectedTopicId] = useState<string>(FALLBACK_TOPICS[0].id);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [messagesByTopic, setMessagesByTopic] = useState<Record<string, ChatMessage[]>>({});
  const [historyByTopic, setHistoryByTopic] = useState<Record<string, HistorySession[]>>({});
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [remainingQuota, setRemainingQuota] = useState<number>(30);
  const [googleClientId, setGoogleClientId] = useState<string>(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');

  // 1. Restore local storage on initial mount
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('topos_user');
      if (savedUser) setUser(JSON.parse(savedUser));

      const savedMsgs = localStorage.getItem('topos_messages_by_topic');
      if (savedMsgs) setMessagesByTopic(JSON.parse(savedMsgs));

      const savedHistory = localStorage.getItem('topos_history_by_topic');
      if (savedHistory) setHistoryByTopic(JSON.parse(savedHistory));

      const savedQuota = localStorage.getItem('topos_remaining_quota');
      if (savedQuota) setRemainingQuota(Number(savedQuota));
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
      } catch (e) {
        console.error('Failed to parse Google JWT:', e);
      }
    };

    if (!googleClientId || googleClientId.includes('TOPOS_CLIENT_ID')) {
      return;
    }

    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
          auto_select: false,
        });

        const btnSlot = document.getElementById('google-btn-slot');
        if (btnSlot) {
          window.google.accounts.id.renderButton(btnSlot, {
            theme: 'outline',
            size: 'medium',
            shape: 'pill',
            text: 'signin_with',
            locale: 'zh-TW',
          });
        }

        window.google.accounts.id.prompt();
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
      }, 500);
      return () => clearInterval(timer);
    }
  }, [googleClientId]);

  // Actions
  const loginGuest = (): UserProfile => {
    const guestUser: UserProfile = {
      name: '訪客體驗者',
      email: 'guest@topos.local',
      token: 'guest-token',
    };
    setUser(guestUser);
    localStorage.setItem('topos_user', JSON.stringify(guestUser));
    return guestUser;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('topos_user');
  };

  const formatNow = () => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  const selectedTopic = topics.find((t) => t.id === selectedTopicId) || topics[0] || FALLBACK_TOPICS[0];
  const selIdx = topics.indexOf(selectedTopic);
  const selCat = CAT_COLORS[selIdx % CAT_COLORS.length] || CAT_COLORS[0];

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

      if (typeof data.remaining === 'number') {
        setRemainingQuota(data.remaining);
        localStorage.setItem('topos_remaining_quota', String(data.remaining));
      } else {
        setRemainingQuota((prev) => Math.max(0, prev - 1));
      }
    } catch (err: any) {
      setMessagesByTopic((prev) => {
        const fallbackMsg: ChatMessage = {
          role: 'assistant',
          content: `[伺服器回應] 針對「${text}」：\n\n核四議題涉及耐震安全評估、試運轉安檢完整性與國家長程能源減碳路徑。\n\n提示：${err.message}`,
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
    const firstQ = (currentLiveMessages.find((m) => m.role === 'user') || { content: '審議對話' }).content;
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

  const canSend = !!inputText.trim() && !loading && !viewedSession;

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
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, background: '#100C0A', color: '#FFF7E4', padding: '3px 8px', borderRadius: '4px', transform: 'rotate(-2deg)', display: 'inline-block', letterSpacing: '.05em' }}>審議 DESK</span>
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: '#6E5F50', marginTop: '3px' }}>
              OPEN DELIBERATION · 公共審議平台
            </div>
          </div>
        </div>

        {/* User Auth Section */}
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
              登出
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={loginGuest}
              style={{ background: '#FF2E88', color: '#fff', border: '2px solid #100C0A', borderRadius: '999px', padding: '10px 20px', fontWeight: 900, fontSize: '13px', cursor: 'pointer', boxShadow: '4px 4px 0 #100C0A' }}
            >
              訪客身份，直接開始 →
            </button>
            {googleClientId && !googleClientId.includes('TOPOS_CLIENT_ID') ? (
              <div style={{ display: 'inline-flex', alignItems: 'center' }}>
                <div id="google-btn-slot"></div>
              </div>
            ) : (
              <button
                onClick={() => {
                  alert(
                    '【Google 登入設定指引】\n\n目前後端尚未配置 GOOGLE_CLIENT_ID。\n\n請在 GCP Console (專案 elix-498805) 建立 OAuth 2.0 用戶端 ID（類型：網頁應用程式），並將 https://topos-d10.pages.dev 加入「已授權的 JavaScript 來源」，再設定於 Cloud Run 環境變數即可啟用！\n\n現在可直接點擊左側「訪客身份，直接開始 →」立即體驗完整審議功能。'
                  );
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
                Google 登入（尚未設定 Client ID）
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Grid: Topic Selector + Topic Details/Cruxes + Chat */}
      <div style={{ maxWidth: '1320px', margin: '0 auto', padding: 'clamp(20px,5vw,56px)', display: 'flex', flexWrap: 'wrap', gap: '28px' }}>
        
        {/* Left: Topic Selector */}
        <aside style={{ flex: '1 1 260px', minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#6E5F50' }}>
            PICK A TOPIC · 選擇議題
          </div>
          {topics.map((t, i) => {
            const isSel = t.id === selectedTopic.id;
            const cc = CAT_COLORS[i % CAT_COLORS.length];
            const cruxLen = t.keyCruxes?.length || 0;
            return (
              <div
                key={t.id}
                onClick={() => {
                  setSelectedTopicId(t.id);
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
                  {t.category}
                </span>
                <div style={{ marginTop: '8px', fontWeight: 900, fontSize: '14px', lineHeight: 1.4 }}>
                  {t.title}
                </div>
                <div style={{ marginTop: '6px', fontSize: '11px', color: '#6E5F50', fontFamily: "'JetBrains Mono', monospace" }}>
                  § {cruxLen} 個核心爭點
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
              核心爭議關鍵點 · KEY CRUXES
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
                        ✓ 正方 PRO
                      </div>
                      {pros.map((p, pi) => (
                        <div key={pi} style={proBoxStyle}>{p}</div>
                      ))}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ fontSize: '11px', fontWeight: 900, letterSpacing: '.04em', color: '#5A0024' }}>
                        ✕ 反方 CON
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
                  審議引導對話
                </h2>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#6E5F50', marginTop: '4px' }}>
                  Topos Facilitator · AI 逐字稿推理引擎
                </div>
              </div>
              <span style={{ background: '#100C0A', color: '#FFF7E4', fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, padding: '5px 12px', borderRadius: '999px' }}>
                本小時剩餘 {remainingQuota} 次
              </span>
            </div>

            {/* If viewing history banner */}
            {viewedSession && (
              <div style={{ background: '#FFF1A6', border: '2px solid #100C0A', borderRadius: '10px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#3A2D00' }}>
                <span>正在回顧 {viewedSession.dateLabel} 的討論</span>
                <button
                  onClick={() => setViewingSessionId(null)}
                  style={{ border: '2px solid #100C0A', background: '#FFFCF1', padding: '5px 12px', borderRadius: '999px', fontWeight: 900, fontSize: '12px', cursor: 'pointer' }}
                >
                  返回目前對話 →
                </button>
              </div>
            )}

            {/* Chat message bubbles */}
            <div style={{ minHeight: '220px', maxHeight: '440px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', padding: '4px 2px' }}>
              {activeMessages.length === 0 && (
                <div style={{ textAlign: 'center', color: '#6E5F50', fontSize: '14px', marginTop: '40px', lineHeight: 1.8 }}>
                  你可以直接丟問題，不用先想好要怎麼問，例如：<br />
                  「台灣的地震帶地質，會為核電廠帶來大災害的可能性嗎」<br />
                  「如果重啟核四，核廢料目前各國都是怎麼處理的？」
                </div>
              )}

              {activeMessages.map((m, i) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={i}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '82%',
                      background: isUser ? '#100C0A' : '#FFFCF1',
                      color: isUser ? '#FFF7E4' : '#100C0A',
                      border: isUser ? '2px solid #100C0A' : '2px solid rgba(16,12,10,.18)',
                      borderRadius: '10px',
                      padding: '12px 16px',
                      fontSize: '14px',
                      lineHeight: 1.65,
                      whiteSpace: 'pre-wrap',
                      boxShadow: isUser ? '4px 4px 0 #100C0A' : 'none',
                    }}
                  >
                    <div>{m.content}</div>
                    {m.citations && m.citations.length > 0 && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(16,12,10,.18)', fontSize: '12px' }}>
                        <strong>引文依據：</strong>
                        {m.citations.map((ci, cidx) => (
                          <div key={cidx} style={{ marginTop: '4px', fontStyle: 'italic', color: '#6E5F50' }}>
                            • {ci.sourceTitle}：「{ci.excerpt}」
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && (
                <div style={{ color: '#002A45', fontFamily: "'JetBrains Mono', monospace", fontSize: '13px', animation: 'topos-pulse 1.1s ease-in-out infinite' }}>
                  審議助手正在檢索逐字稿…
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
                  disabled={loading}
                  placeholder={viewedSession ? '正在回顧歷史紀錄，返回目前對話後可繼續提問' : '輸入你的問題或觀點，按送出…'}
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
                  送出 →
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
                  封存本次討論，開新提問 ↻
                </button>
              ) : <div></div>}
              {!user && (
                <span style={{ fontSize: '12px', color: '#6E5F50' }}>
                  送出問題會自動以訪客身份加入 · guest@topos.local
                </span>
              )}
            </div>
          </div>

          {/* History Panel */}
          <div style={{ background: '#FFFCF1', border: '2px solid #100C0A', borderRadius: '14px', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '13px', letterSpacing: '.02em', margin: 0 }}>
              歷史對話紀錄 · HISTORY
            </h4>
            {historyList.length === 0 ? (
              <div style={{ fontSize: '13px', color: '#6E5F50' }}>
                目前議題還沒有封存的討論。送出幾個問題後，可以按「封存本次討論」把這輪對話留存下來。
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
