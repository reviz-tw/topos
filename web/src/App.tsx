import React, { useState, useEffect } from 'react';
import { Topic, ChatMessage, UserProfile } from './types';

// Declare Google Identity Services global
declare global {
  interface Window {
    google?: any;
  }
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

export default function App() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  const [googleClientId, setGoogleClientId] = useState<string>(import.meta.env.VITE_GOOGLE_CLIENT_ID || '');

  const loginAsGuest = (): UserProfile => {
    const guestUser: UserProfile = {
      name: '訪客體驗者',
      email: 'guest@topos.local',
      token: 'guest-token',
    };
    setUser(guestUser);
    localStorage.setItem('topos_user', JSON.stringify(guestUser));
    return guestUser;
  };

  // 1. Fetch Topics & Server Config
  useEffect(() => {
    fetch(`${API_BASE}/api/topics`)
      .then((res) => res.json())
      .then((data: Topic[]) => {
        setTopics(data);
        if (data.length > 0) {
          setSelectedTopic(data[0]);
        }
      })
      .catch((err) => console.error('Failed to load topics:', err));

    fetch(`${API_BASE}/api/config`)
      .then((res) => res.json())
      .then((cfg) => {
        if (cfg.googleClientId) {
          setGoogleClientId(cfg.googleClientId);
        }
      })
      .catch(() => {});
  }, []);

  // 2. Initialize Google One Tap if valid Google Client ID is configured
  useEffect(() => {
    const handleCredentialResponse = (response: any) => {
      try {
        const payload = JSON.parse(atob(response.credential.split('.')[1]));
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

    // Restore cached user
    const saved = localStorage.getItem('topos_user');
    if (saved) {
      try {
        setUser(JSON.parse(saved));
      } catch (e) {}
    }

    if (!googleClientId || googleClientId.includes('TOPOS_CLIENT_ID')) {
      return;
    }

    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: handleCredentialResponse,
          auto_select: true,
        });
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

  // Handle Send Message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !selectedTopic) return;

    let activeUser = user;
    if (!activeUser) {
      // Auto fallback to guest if Google is not configured or user hasn't logged in
      activeUser = loginAsGuest();
    }

    const userMsg: ChatMessage = { role: 'user', content: inputText.trim() };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
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
        const errData = await res.json();
        throw new Error(errData.error || '討論請求失敗');
      }

      const data = await res.json();
      setMessages([...newHistory, data.reply]);
      setRemainingQuota(data.remainingRequests);
    } catch (err: any) {
      setMessages([
        ...newHistory,
        { role: 'assistant', content: `[錯誤] ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', paddingBottom: '16px', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', margin: 0, color: '#38bdf8' }}>Topos 公共審議平台</h1>
          <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '14px' }}>
            基於公聽會與辯論逐字稿的 AI 議題思辨與觀點探索
          </p>
        </div>

        <div>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {user.picture && <img src={user.picture} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%' }} />}
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500' }}>{user.name}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{user.email}</div>
              </div>
              <button
                onClick={() => {
                  setUser(null);
                  localStorage.removeItem('topos_user');
                }}
                style={{ background: '#334155', color: '#f8fafc', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
              >
                登出
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={loginAsGuest}
                style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', fontSize: '13px' }}
              >
                訪客即刻體驗
              </button>
              {googleClientId && !googleClientId.includes('TOPOS_CLIENT_ID') && (
                <button
                  onClick={() => window.google?.accounts?.id?.prompt()}
                  style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                >
                  Google 登入
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Main Grid: Topic Selector + Cruxes + Chat */}
      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px' }}>
        {/* Left: Topics List */}
        <aside>
          <h3 style={{ fontSize: '16px', color: '#cbd5e1', marginBottom: '12px' }}>選擇探討議題</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {topics.map((t) => (
              <div
                key={t.id}
                onClick={() => {
                  setSelectedTopic(t);
                  setMessages([]);
                }}
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  background: selectedTopic?.id === t.id ? '#1e293b' : '#0f172a',
                  border: selectedTopic?.id === t.id ? '1px solid #38bdf8' : '1px solid #1e293b',
                  transition: '0.2s',
                }}
              >
                <div style={{ fontSize: '12px', color: '#38bdf8', fontWeight: 'bold' }}>{t.category}</div>
                <div style={{ fontSize: '14px', fontWeight: '600', marginTop: '4px' }}>{t.title}</div>
              </div>
            ))}
          </div>
        </aside>

        {/* Right: Workspace */}
        <main>
          {selectedTopic && (
            <div>
              {/* Topic Header & Key Cruxes Cards */}
              <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
                <h2 style={{ fontSize: '20px', margin: '0 0 8px 0', color: '#f8fafc' }}>{selectedTopic.title}</h2>
                <p style={{ color: '#94a3b8', fontSize: '14px', margin: '0 0 16px 0' }}>{selectedTopic.description}</p>

                <h4 style={{ fontSize: '14px', color: '#cbd5e1', margin: '0 0 10px 0' }}>核心爭議關鍵點 (Cruxes)</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                  {selectedTopic.keyCruxes?.map((crux, idx) => (
                    <div key={idx} style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', border: '1px solid #334155' }}>
                      <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#38bdf8', marginBottom: '4px' }}>{crux.title}</div>
                      <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>{crux.description}</div>
                      <div style={{ fontSize: '11px', color: '#4ade80' }}>✓ 正方：{crux.proPoints?.[0]}</div>
                      <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>✕ 反方：{crux.conPoints?.[0]}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Deliberation Chat Box */}
              <div style={{ background: '#1e293b', borderRadius: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, fontSize: '16px' }}>審議引導對話 (Topos Facilitator)</h3>
                  {remainingQuota !== null && (
                    <span style={{ fontSize: '12px', color: '#94a3b8' }}>本小時剩餘額度：{remainingQuota} 次</span>
                  )}
                </div>

                <div style={{ minHeight: '260px', maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  {messages.length === 0 && (
                    <div style={{ color: '#64748b', fontSize: '14px', textAlign: 'center', marginTop: '40px' }}>
                      您可以直接提問或表達看法，例如：<br />
                      「重啟核四的 S 斷層到底危不危險？」<br />
                      「如果重啟核四，核廢料目前各國都是怎麼處理的？」
                    </div>
                  )}

                  {messages.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                        maxWidth: '85%',
                        background: m.role === 'user' ? '#2563eb' : '#0f172a',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        fontSize: '14px',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      <div>{m.content}</div>
                      {m.citations && m.citations.length > 0 && (
                        <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #334155', fontSize: '12px', color: '#38bdf8' }}>
                          <strong>引文依據：</strong>
                          {m.citations.map((c, cIdx) => (
                            <div key={cIdx} style={{ marginTop: '4px', fontStyle: 'italic', color: '#94a3b8' }}>
                              • {c.sourceTitle}: 「{c.excerpt}」
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {loading && <div style={{ color: '#38bdf8', fontSize: '13px' }}>AI 正在從發表會逐字稿檢索正反論述中...</div>}
                </div>

                {/* Input Form */}
                <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '10px' }}>
                  <input
                    type="text"
                    placeholder={user ? "請輸入您的問題或觀點..." : "請先在右上角 Google 登入以開始對話"}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    disabled={!user || loading}
                    style={{
                      flex: 1,
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #334155',
                      background: '#0f172a',
                      color: '#fff',
                      fontSize: '14px',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!user || loading || !inputText.trim()}
                    style={{
                      padding: '10px 20px',
                      borderRadius: '8px',
                      border: 'none',
                      background: user && inputText.trim() ? '#38bdf8' : '#334155',
                      color: user && inputText.trim() ? '#0f172a' : '#64748b',
                      fontWeight: 'bold',
                      cursor: user && inputText.trim() ? 'pointer' : 'not-allowed',
                    }}
                  >
                    發送
                  </button>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
