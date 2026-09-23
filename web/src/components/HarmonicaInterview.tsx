import React, { useState, useEffect, useRef } from 'react';
import {
  Topic,
  HarmonicaSession,
  HarmonicaConversation,
  HarmonicaMessage,
  HarmonicaHostView,
  HarmonicaSessionRef,
} from '../types';
import { TranslationStrings } from '../i18n/translations';
import {
  HarmonicaLocalStore,
  normalizeSettings,
  openingMessage,
  generateLocalReply,
  cleanReply,
  formatTTTCCsv,
  formatTranscriptsJson,
} from '../interview/engine';

interface HarmonicaInterviewProps {
  topic: Topic;
  t: TranslationStrings;
  apiBase?: string;
}

export const HarmonicaInterview: React.FC<HarmonicaInterviewProps> = ({ topic, t: _t }) => {
  // Session selection state
  const [sessionList, setSessionList] = useState<HarmonicaSessionRef[]>(() => {
    return HarmonicaLocalStore.getTopicSessions(topic.id);
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const list = HarmonicaLocalStore.getTopicSessions(topic.id);
    if (list.length > 0) return list[0].sessionId;
    if (topic.id === 'nuclear4') return '6o0ryapw2o';
    if (topic.id === 'control-yuan') return 'cy-voices-01';
    return 'sports-int-1';
  });

  const [sessionData, setSessionData] = useState<HarmonicaSession | null>(() => {
    return HarmonicaLocalStore.getSession(activeSessionId);
  });
  const [_loadingSession, setLoadingSession] = useState(false);

  // Sub-view: 'participant' vs 'host'
  const [viewMode, setViewMode] = useState<'participant' | 'host'>('participant');
  const [hostView, setHostView] = useState<HarmonicaHostView | null>(() => {
    return HarmonicaLocalStore.getHostView(activeSessionId);
  });
  const [expandedParticipant, setExpandedParticipant] = useState<number | null>(null);

  // Participant state
  const [alias, setAlias] = useState('');
  const [_joined, setJoined] = useState(false);
  const [conversation, setConversation] = useState<HarmonicaConversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTopic, setNewTopic] = useState(() => topic.title.replace(/？$/, ''));
  const [newGoal, setNewGoal] = useState(() => `理解參與者對「${topic.title.replace(/？$/, '')}」的具體考量、價值排序與條件。`);
  const [newContext, setNewContext] = useState('');
  const [newCritical, setNewCritical] = useState('');
  const [newQuestions, setNewQuestions] = useState<string[]>([
    '對於這項議題，你的基本立場與主要考量是什麼？',
  ]);
  const [newMaxTurns, setNewMaxTurns] = useState(6);
  const [newMaxParticipants, setNewMaxParticipants] = useState(50);
  const [createdUrls, setCreatedUrls] = useState<{ participate: string; admin: string } | null>(null);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Participant UUID
  const getParticipantId = (sId: string): string => {
    const key = `topos:native_harmonica:participant:${sId}`;
    let pId = localStorage.getItem(key);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!pId || !uuidRegex.test(pId)) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        try {
          pId = crypto.randomUUID();
        } catch (_) {}
      }
      if (!pId || !uuidRegex.test(pId)) {
        pId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      }
      localStorage.setItem(key, pId);
    }
    return pId;
  };

  // Sync sessions when topic changes
  useEffect(() => {
    const local = HarmonicaLocalStore.getTopicSessions(topic.id);
    setSessionList(local);
    const targetSessionId = local.length > 0
      ? local[0].sessionId
      : topic.id === 'nuclear4'
      ? '6o0ryapw2o'
      : topic.id === 'control-yuan'
      ? 'cy-voices-01'
      : 'sports-int-1';
    setActiveSessionId(targetSessionId);
    setNewTopic(topic.title.replace(/？$/, ''));
    setNewGoal(`理解參與者對「${topic.title.replace(/？$/, '')}」的具體考量、價值排序與條件。`);

    // Fetch from native API if available
    fetch(`/api/topics/${topic.id}/harmonica/sessions`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: HarmonicaSessionRef[]) => {
        if (Array.isArray(data) && data.length > 0) {
          data.forEach((ref) => HarmonicaLocalStore.addTopicSession(topic.id, ref));
          setSessionList(HarmonicaLocalStore.getTopicSessions(topic.id));
        }
      })
      .catch(() => {});
  }, [topic.id, topic.title]);

  // Load session metadata when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) return;

    setLoadingSession(true);
    setJoined(false);

    // 1. Load local copy first (0 latency)
    const localSess = HarmonicaLocalStore.getSession(activeSessionId);
    if (localSess) {
      if (localSess.questions?.some((q) => q === '要錢嗎' || q === '支持嗎' || q === '其他原因')) {
        localSess.questions = [
          '對於核電重啟，你的基本立場是什麼？最在意的是哪一點？',
          '如果真的要重啟，你認為必須先滿足哪些條件？',
          '核廢料該怎麼處理，你心中有能接受的做法嗎？',
        ];
        localSess.topic = '核電重啟公眾訪談';
        HarmonicaLocalStore.saveSession(localSess);
      }
      setSessionData(localSess);
    }

    const pId = getParticipantId(activeSessionId);
    const savedConv = HarmonicaLocalStore.getParticipantConversation(activeSessionId, pId);
    if (savedConv) {
      setConversation(savedConv);
      setJoined(true);
    } else {
      setConversation(null);
    }

    // 2. Fetch edge/backend API
    fetch(`/api/harmonica/sessions/${activeSessionId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: HarmonicaSession | null) => {
        if (data && data.sessionId) {
          setSessionData(data);
          HarmonicaLocalStore.saveSession(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        setLoadingSession(false);
      });

    // 3. Load host view data
    const hostData = HarmonicaLocalStore.getHostView(activeSessionId);
    setHostView(hostData);

    fetch(`/api/harmonica/sessions/${activeSessionId}/host`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: HarmonicaHostView | null) => {
        if (data && data.conversations) {
          setHostView(data);
        }
      })
      .catch(() => {});
  }, [activeSessionId]);

  // Scroll to bottom on conversation update
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation?.messages, sending]);

  // Join interview
  const handleJoin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeSessionId || !sessionData) return;

    const pId = getParticipantId(activeSessionId);
    const cleanAlias = alias.trim();

    try {
      const res = await fetch(`/api/harmonica/sessions/${activeSessionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: pId, alias: cleanAlias }),
      });

      const data = await res.json();
      if (res.ok && data.ok && data.conversation) {
        setConversation(data.conversation);
        setJoined(true);
        HarmonicaLocalStore.saveParticipantConversation(activeSessionId, pId, data.conversation);
        setHostView(HarmonicaLocalStore.getHostView(activeSessionId));
        return;
      }
    } catch (_) {
      // Fallback to local native engine
    }

    const openText = openingMessage({
      topic: sessionData.topic,
      goal: sessionData.goal,
      questions: sessionData.questions,
      language: (sessionData.language as any) || 'zh-Hant',
      maxTurns: sessionData.maxTurns,
      maxParticipants: sessionData.maxParticipants,
      askAlias: sessionData.askAlias,
    });

    const newConv: HarmonicaConversation = {
      participant: (hostView?.conversations?.length || 0) + 1,
      alias: cleanAlias || undefined,
      turns: 0,
      done: false,
      messages: [
        {
          seq: 1,
          role: 'interviewer',
          text: openText,
          at: Date.now(),
        },
      ],
      updatedAt: Date.now(),
    };

    setConversation(newConv);
    setJoined(true);
    HarmonicaLocalStore.saveParticipantConversation(activeSessionId, pId, newConv);
    setHostView(HarmonicaLocalStore.getHostView(activeSessionId));
  };

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = inputText.trim();
    if (!text || sending || !conversation || !activeSessionId || !sessionData || conversation.done) return;

    const pId = getParticipantId(activeSessionId);
    const tempMsg: HarmonicaMessage = {
      role: 'participant',
      text,
      at: Date.now(),
    };

    const nextTurns = conversation.turns + 1;
    const isFinal = nextTurns >= sessionData.maxTurns;

    const updatedConv: HarmonicaConversation = {
      ...conversation,
      turns: nextTurns,
      done: isFinal,
      messages: [...conversation.messages, tempMsg],
      updatedAt: Date.now(),
    };

    setConversation(updatedConv);
    setInputText('');
    setSending(true);

    let replyMsg: HarmonicaMessage | null = null;

    try {
      const res = await fetch(`/api/harmonica/sessions/${activeSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantId: pId,
          text,
          turn: nextTurns,
          history: conversation.messages,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok && data.reply) {
        replyMsg = data.reply;
        updatedConv.done = data.done;
        updatedConv.turns = data.turn;
      }
    } catch (_) {
      // API call failed, fallback to local generation
    }

    if (!replyMsg) {
      const generated = generateLocalReply(
        {
          topic: sessionData.topic,
          goal: sessionData.goal,
          questions: sessionData.questions,
          language: (sessionData.language as any) || 'zh-Hant',
          maxTurns: sessionData.maxTurns,
          maxParticipants: sessionData.maxParticipants,
          askAlias: sessionData.askAlias,
        },
        text,
        nextTurns,
        isFinal
      );

      replyMsg = {
        role: 'interviewer',
        text: cleanReply(generated),
        at: Date.now(),
      };
    }

    updatedConv.messages.push(replyMsg);
    setConversation({ ...updatedConv });
    HarmonicaLocalStore.saveParticipantConversation(activeSessionId, pId, updatedConv);
    setHostView(HarmonicaLocalStore.getHostView(activeSessionId));
    setSending(false);
  };

  // Restart / Reset participant conversation
  const handleRestart = () => {
    if (!activeSessionId) return;
    const pId = getParticipantId(activeSessionId);
    try {
      localStorage.removeItem(`topos:native_harmonica:user_conv:${activeSessionId}:${pId}`);
    } catch (_) {}
    setConversation(null);
    setJoined(false);
    setAlias('');
    setInputText('');
  };

  // Export functions
  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleExportMineCsv = () => {
    if (!sessionData || !conversation) return;
    const csv = formatTTTCCsv(sessionData, [conversation]);
    downloadFile(`topos-harmonica-${activeSessionId}-tttc.csv`, csv, 'text/csv;charset=utf-8');
  };

  const handleExportAllCsv = () => {
    if (!sessionData) return;
    const convs = hostView?.conversations || (conversation ? [conversation] : []);
    const csv = formatTTTCCsv(sessionData, convs);
    downloadFile(`topos-harmonica-${activeSessionId}-tttc.csv`, csv, 'text/csv;charset=utf-8');
  };

  const handleExportAllJson = () => {
    if (!sessionData) return;
    const convs = hostView?.conversations || (conversation ? [conversation] : []);
    const json = formatTranscriptsJson(sessionData, convs);
    downloadFile(`topos-harmonica-${activeSessionId}-transcripts.json`, json, 'application/json');
  };

  // Auto-fill questions from topic cruxes
  const handleAutoFillCruxes = () => {
    const cruxes = topic.keyCruxes || [];
    if (cruxes.length === 0) return;
    const generated = cruxes.slice(0, 3).map((c) => {
      const pro = (c.proPoints?.[0] || c.pro?.[0] || '').replace(/。$/, '');
      const con = (c.conPoints?.[0] || c.con?.[0] || '').replace(/。$/, '');
      return `關於「${c.title}」，有人認為${pro}，也有人擔心${con}。你的經驗或看法是什麼？`;
    });
    setNewQuestions(generated);
  };

  // Create new session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const normalized = normalizeSettings({
        topic: newTopic,
        goal: newGoal,
        context: newContext,
        critical: newCritical,
        questions: newQuestions,
        maxTurns: newMaxTurns,
        maxParticipants: newMaxParticipants,
        language: 'zh-Hant',
        askAlias: true,
      });

      let createdSessionId = '';
      let adminToken = '';

      try {
        const res = await fetch(`/api/harmonica/sessions?topicId=${topic.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...normalized, topicId: topic.id }),
        });
        const data = await res.json();
        if (res.ok && data.ok && data.sessionId) {
          createdSessionId = data.sessionId;
          adminToken = data.adminToken || '';
        }
      } catch (_) {}

      if (!createdSessionId) {
        createdSessionId = 'local-' + Math.random().toString(36).substring(2, 9);
        adminToken = 'admin-' + Math.random().toString(36).substring(2, 12);
      }

      const newSess: HarmonicaSession = {
        sessionId: createdSessionId,
        topic: normalized.topic,
        goal: normalized.goal,
        context: normalized.context,
        questions: normalized.questions,
        language: normalized.language,
        status: 'open',
        maxTurns: normalized.maxTurns,
        maxParticipants: normalized.maxParticipants,
        askAlias: true,
        participants: 0,
        completed: 0,
        model: '@cf/google/gemma-4-26b-a4b-it',
        adminToken,
      };

      HarmonicaLocalStore.saveSession(newSess);

      const newRef: HarmonicaSessionRef = {
        sessionId: createdSessionId,
        title: normalized.topic,
        goal: normalized.goal,
        url: `/s/${createdSessionId}`,
        createdAt: Math.floor(Date.now() / 1000),
      };

      HarmonicaLocalStore.addTopicSession(topic.id, newRef);
      setSessionList(HarmonicaLocalStore.getTopicSessions(topic.id));
      setActiveSessionId(createdSessionId);
      setSessionData(newSess);
      setHostView(HarmonicaLocalStore.getHostView(createdSessionId));

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      setCreatedUrls({
        participate: `${origin}/s/${createdSessionId}`,
        admin: `${origin}/h/${createdSessionId}#admin=${adminToken}`,
      });
      setViewMode('participant');
    } catch (err: any) {
      alert(`建立失敗：${err.message}`);
    }
  };

  const curSess = sessionData || {
    sessionId: activeSessionId || '—',
    topic: topic.title,
    goal: '理解參與者的具體考量、價值排序與條件。',
    maxTurns: 6,
    maxParticipants: 50,
    questions: [],
    status: 'open' as const,
    askAlias: true,
  };

  const isHost = viewMode === 'host';
  const tabBaseStyle: React.CSSProperties = {
    border: 0,
    borderRadius: '999px',
    padding: '8px 16px',
    fontWeight: 900,
    fontSize: '13px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.15s ease',
  };
  const activeTabStyle: React.CSSProperties = { ...tabBaseStyle, background: '#100C0A', color: '#FFF7E4' };
  const inactiveTabStyle: React.CSSProperties = { ...tabBaseStyle, background: 'transparent', color: '#100C0A' };

  const currentTurn = conversation ? conversation.turns : 0;
  const canSend = !!inputText.trim() && !sending && !!conversation && !conversation.done;

  const totalParticipants = hostView?.conversations?.length || 0;
  const completedParticipants = hostView?.conversations?.filter((c) => c.done).length || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Session Overview Card */}
      <div style={{
        background: '#FFFCF1',
        border: '2.5px solid #100C0A',
        borderRadius: '18px',
        padding: 'clamp(20px,3vw,32px)',
        boxShadow: '8px 8px 0 #100C0A',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}>
        {/* Header Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{
                background: '#6FE83A',
                color: '#100C0A',
                border: '2px solid #100C0A',
                borderRadius: '6px',
                padding: '3px 10px',
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '.12em',
                transform: 'rotate(-2deg)',
                display: 'inline-block',
                boxShadow: '2px 2px 0 #100C0A',
              }}>
                HARMONICA
              </span>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '11px',
                fontWeight: 700,
                color: '#6E5F50',
                letterSpacing: '.06em',
              }}>
                質性意見訪談 · Gemma 4 @cf
              </span>
            </div>
            <h1 style={{
              fontFamily: "'Noto Serif TC', serif",
              fontWeight: 900,
              fontSize: 'clamp(26px,3.2vw,40px)',
              lineHeight: 1.18,
              margin: 0,
            }}>
              {curSess.topic}
            </h1>
            <p style={{
              fontSize: '15px',
              lineHeight: 1.7,
              color: '#2A211C',
              margin: 0,
            }}>
              補訪審議裡缺席的聲音。公聽會上沒說出口的條件與顧慮，在一對一對話裡慢慢講清楚。
            </p>
          </div>

          <button
            onClick={() => {
              setShowCreateModal(true);
              setCreatedUrls(null);
            }}
            style={{
              background: '#FFD400',
              color: '#100C0A',
              border: '2px solid #100C0A',
              borderRadius: '999px',
              padding: '10px 18px',
              fontWeight: 900,
              fontSize: '13px',
              cursor: 'pointer',
              boxShadow: '4px 4px 0 #100C0A',
              fontFamily: 'inherit',
            }}
          >
            ＋ 發起新訪談
          </button>
        </div>

        {/* Sessions Pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '10px',
            fontWeight: 700,
            letterSpacing: '.16em',
            color: '#6E5F50',
            marginRight: '4px',
          }}>
            SESSIONS · 訪談場次
          </span>
          {sessionList.map((s) => {
            const isSel = s.sessionId === activeSessionId;
            return (
              <button
                key={s.sessionId}
                onClick={() => {
                  setActiveSessionId(s.sessionId);
                  setExpandedParticipant(null);
                }}
                style={{
                  border: '2px solid #100C0A',
                  borderRadius: '999px',
                  padding: '6px 14px',
                  fontSize: '12px',
                  fontWeight: 900,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  background: isSel ? '#100C0A' : '#FFFCF1',
                  color: isSel ? '#FFF7E4' : '#100C0A',
                  boxShadow: isSel ? '3px 3px 0 #6FE83A' : 'none',
                  transition: '0.15s ease',
                }}
              >
                {s.title || s.sessionId}
                {s.sessionId === '6o0ryapw2o' || s.isDefault ? ' ★' : ''}
              </button>
            );
          })}
        </div>

        {/* Goal Box */}
        <div style={{
          background: '#FFF7E4',
          border: '2px solid #100C0A',
          borderRadius: '10px',
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontWeight: 900, fontSize: '13px' }}>這輪訪談想理解什麼</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#6E5F50' }}>
              id: {curSess.sessionId} · {curSess.maxTurns} 輪／人 · 上限 {curSess.maxParticipants} 人
            </span>
          </div>
          <p style={{ fontSize: '15px', lineHeight: 1.65, margin: 0, fontWeight: 500 }}>
            {curSess.goal}
          </p>
        </div>

        {/* Segmented Switcher (Participant vs Host) */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '4px',
          border: '2px solid #100C0A',
          borderRadius: '999px',
          background: '#FFF7E4',
          alignSelf: 'flex-start',
          flexWrap: 'wrap',
        }}>
          <button
            onClick={() => setViewMode('participant')}
            style={!isHost ? activeTabStyle : inactiveTabStyle}
          >
            受訪對話室
          </button>
          <button
            onClick={() => setViewMode('host')}
            style={isHost ? activeTabStyle : inactiveTabStyle}
          >
            主辦者控制台
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. PARTICIPANT VIEW MODE                                                  */}
      {/* ========================================================================= */}
      {!isHost && (
        <div style={{
          background: '#FFFCF1',
          border: '2.5px solid #100C0A',
          borderRadius: '18px',
          padding: 'clamp(20px,3vw,32px)',
          boxShadow: '8px 8px 0 #100C0A',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}>
          {/* Intro Screen (Before Joining) */}
          {!conversation && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <div style={{ position: 'relative', width: '52px', height: '52px', flex: 'none' }}>
                  <span style={{ position: 'absolute', left: 0, top: '4px', width: '40px', height: '40px', borderRadius: '50%', background: '#6FE83A', border: '2px solid #100C0A' }}></span>
                  <span style={{ position: 'absolute', right: 0, top: 0, width: '18px', height: '18px', borderRadius: '50%', background: '#00C2FF', border: '2px solid #100C0A' }}></span>
                  <span style={{ position: 'absolute', right: '4px', bottom: 0, width: '12px', height: '12px', borderRadius: '50%', background: '#FFD400', border: '2px solid #100C0A' }}></span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 }}>
                  <h2 style={{ fontFamily: "'Noto Serif TC', serif", fontWeight: 900, fontSize: '24px', lineHeight: 1.2, margin: 0 }}>
                    嗨，我是 AI 訪談者。
                  </h2>
                  <p style={{ fontSize: '15px', lineHeight: 1.7, margin: 0, color: '#2A211C' }}>
                    我會問你幾個問題，然後順著你說的往下追問。沒有標準答案，想到什麼說什麼。
                  </p>
                </div>
              </div>

              {/* 3 Rule Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
                <div style={{ border: '2px solid #100C0A', borderRadius: '10px', padding: '14px', background: '#FFF7E4', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, color: '#6E5F50' }}>§01</span>
                  <span style={{ fontWeight: 900, fontSize: '15px' }}>中立，不評價</span>
                  <span style={{ fontSize: '13px', lineHeight: 1.6, color: '#2A211C' }}>不說服你，也不替你的立場打分數。</span>
                </div>
                <div style={{ border: '2px solid #100C0A', borderRadius: '10px', padding: '14px', background: '#FFF7E4', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, color: '#6E5F50' }}>§02</span>
                  <span style={{ fontWeight: 900, fontSize: '15px' }}>會追問</span>
                  <span style={{ fontSize: '13px', lineHeight: 1.6, color: '#2A211C' }}>你說「看情況」，它會問是哪些情況。</span>
                </div>
                <div style={{ border: '2px solid #100C0A', borderRadius: '10px', padding: '14px', background: '#FFF7E4', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, color: '#6E5F50' }}>§03</span>
                  <span style={{ fontWeight: 900, fontSize: '15px' }}>你說了算</span>
                  <span style={{ fontSize: '13px', lineHeight: 1.6, color: '#2A211C' }}>隨時可停。逐字稿可匯出，只用於審議分析。</span>
                </div>
              </div>

              {/* Join Form */}
              <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontWeight: 900, fontSize: '13px' }}>
                  怎麼稱呼你？<span style={{ fontWeight: 500, color: '#6E5F50' }}>（選填，暱稱或代表身分）</span>
                </label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="例如：捷運通勤族、核電工程師、新北市民…"
                    style={{
                      flex: '1 1 240px',
                      minHeight: '48px',
                      padding: '0 18px',
                      borderRadius: '999px',
                      border: '2px solid #100C0A',
                      background: '#FFF7E4',
                      color: '#100C0A',
                      fontSize: '14px',
                      outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                  <button
                    type="submit"
                    style={{
                      minHeight: '48px',
                      padding: '0 24px',
                      borderRadius: '999px',
                      border: '2px solid #100C0A',
                      background: '#6FE83A',
                      color: '#100C0A',
                      fontWeight: 900,
                      fontSize: '14px',
                      cursor: 'pointer',
                      boxShadow: '4px 4px 0 #100C0A',
                      fontFamily: 'inherit',
                    }}
                  >
                    開始一對一訪談 →
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Active Conversation Room */}
          {conversation && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Turns Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                  <span style={{
                    background: '#100C0A',
                    color: '#FFF7E4',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '12px',
                    fontWeight: 700,
                    padding: '4px 12px',
                    borderRadius: '999px',
                  }}>
                    第 {conversation.turns} / {curSess.maxTurns} 輪
                  </span>
                  <span style={{ fontSize: '13px', color: '#6E5F50', fontWeight: 700 }}>
                    {conversation.alias ? `受訪者：${conversation.alias}` : `匿名受訪者 #${conversation.participant}`}
                  </span>
                </div>
                {/* Progress Segments */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  {Array.from({ length: curSess.maxTurns }, (_, i) => (
                    <span
                      key={i}
                      style={{
                        width: '22px',
                        height: '10px',
                        borderRadius: '999px',
                        border: '1.5px solid #100C0A',
                        background: i < currentTurn ? '#6FE83A' : '#FFFCF1',
                        transition: 'background 0.2s ease',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Messages Container */}
              <div style={{
                border: '2px solid #100C0A',
                borderRadius: '10px',
                background: '#FFF7E4',
                padding: '16px',
                minHeight: '300px',
                maxHeight: '500px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
              }}>
                {conversation.messages.map((m, i) => {
                  const isMe = m.role === 'participant';
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        alignItems: isMe ? 'flex-end' : 'flex-start',
                      }}
                    >
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '10px',
                        fontWeight: 700,
                        letterSpacing: '.08em',
                        color: '#6E5F50',
                      }}>
                        {isMe ? (conversation.alias || '我') : 'AI 訪談者 · GEMMA 4'}
                      </span>
                      <div style={{
                        maxWidth: '82%',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: '2px solid #100C0A',
                        fontSize: '14px',
                        lineHeight: 1.7,
                        whiteSpace: 'pre-wrap',
                        background: isMe ? '#DCFCC4' : '#FFFCF1',
                        color: isMe ? '#143A00' : '#100C0A',
                        boxShadow: isMe ? '3px 3px 0 #100C0A' : 'none',
                      }}>
                        {m.text}
                      </div>
                    </div>
                  );
                })}
                {sending && (
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '12px',
                    color: '#143A00',
                    animation: 'topos-pulse 1.1s ease-in-out infinite',
                  }}>
                    AI 訪談者在聽，準備追問…
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Completion Alert */}
              {conversation.done && (
                <div style={{
                  background: '#DCFCC4',
                  border: '2px solid #100C0A',
                  borderRadius: '10px',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '4px 4px 0 #100C0A',
                }}>
                  <div style={{ fontWeight: 900, fontSize: '16px', color: '#143A00' }}>
                    訪談完成。謝謝你把想法說清楚。
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: 1.6, color: '#143A00' }}>
                    逐字稿已存下，可匯出為 tttc.csv，交給 Talk to the City 做主題群聚分析。
                  </div>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button
                      onClick={handleExportMineCsv}
                      style={{
                        background: '#100C0A',
                        color: '#FFF7E4',
                        border: '2px solid #100C0A',
                        borderRadius: '999px',
                        padding: '9px 16px',
                        fontWeight: 900,
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      匯出我的逐字稿 · tttc.csv
                    </button>
                    <button
                      onClick={handleRestart}
                      style={{
                        background: '#FFFCF1',
                        color: '#100C0A',
                        border: '2px solid #100C0A',
                        borderRadius: '999px',
                        padding: '9px 16px',
                        fontWeight: 900,
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      重新開始 ↻
                    </button>
                  </div>
                </div>
              )}

              {/* Input Form (if not completed) */}
              {!conversation.done && (
                <>
                  <form
                    onSubmit={handleSendMessage}
                    style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'stretch' }}
                  >
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      disabled={sending}
                      rows={2}
                      placeholder="說說你的看法、條件或疑慮…（Enter 送出，Shift+Enter 換行）"
                      style={{
                        flex: '1 1 240px',
                        padding: '12px 16px',
                        borderRadius: '10px',
                        border: '2px solid #100C0A',
                        background: '#FFF7E4',
                        color: '#100C0A',
                        fontSize: '14px',
                        lineHeight: 1.6,
                        outline: 'none',
                        resize: 'none',
                        fontFamily: 'inherit',
                      }}
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
                        fontSize: '14px',
                        fontFamily: 'inherit',
                        cursor: canSend ? 'pointer' : 'not-allowed',
                        background: canSend ? '#100C0A' : '#F2E5C4',
                        color: canSend ? '#FFF7E4' : '#6E5F50',
                        boxShadow: canSend ? '4px 4px 0 #6FE83A' : 'none',
                      }}
                    >
                      送出 →
                    </button>
                  </form>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      onClick={handleRestart}
                      style={{
                        background: 'transparent',
                        border: 0,
                        color: '#6E5F50',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        fontFamily: 'inherit',
                      }}
                    >
                      先停在這裡
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. HOST VIEW MODE                                                         */}
      {/* ========================================================================= */}
      {isHost && (
        <div style={{
          background: '#FFFCF1',
          border: '2.5px solid #100C0A',
          borderRadius: '18px',
          padding: 'clamp(20px,3vw,32px)',
          boxShadow: '8px 8px 0 #100C0A',
          display: 'flex',
          flexDirection: 'column',
          gap: '22px',
        }}>
          {/* Stat Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '12px' }}>
            <div style={{ border: '2px solid #100C0A', borderRadius: '10px', padding: '14px', background: '#FFF7E4', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, letterSpacing: '.14em', color: '#6E5F50' }}>PARTICIPANTS</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '34px', fontWeight: 700, lineHeight: 1 }}>{totalParticipants}</span>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>參與人數</span>
            </div>
            <div style={{ border: '2px solid #100C0A', borderRadius: '10px', padding: '14px', background: '#DCFCC4', display: 'flex', flexDirection: 'column', gap: '4px', color: '#143A00' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, letterSpacing: '.14em' }}>COMPLETED</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '34px', fontWeight: 700, lineHeight: 1 }}>{completedParticipants}</span>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>完成訪談</span>
            </div>
            <div style={{ border: '2px solid #100C0A', borderRadius: '10px', padding: '14px', background: '#FFF7E4', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, letterSpacing: '.14em', color: '#6E5F50' }}>TURNS / PERSON</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '34px', fontWeight: 700, lineHeight: 1 }}>{curSess.maxTurns}</span>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>每人輪數上限</span>
            </div>
            <div style={{ border: '2px solid #100C0A', borderRadius: '10px', padding: '14px', background: '#FFF7E4', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, letterSpacing: '.14em', color: '#6E5F50' }}>MODEL</span>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '20px', fontWeight: 700, lineHeight: 1.2, marginTop: '6px' }}>Gemma 4 · 26B</span>
              <span style={{ fontSize: '12px', fontWeight: 700 }}>推理模型</span>
            </div>
          </div>

          {/* Talk to the City Banner */}
          <div style={{
            border: '2px solid #100C0A',
            borderRadius: '10px',
            padding: '14px 16px',
            background: '#FFF1A6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontWeight: 900, fontSize: '14px', color: '#3A2D00' }}>送去 Talk to the City 分析</span>
              <span style={{ fontSize: '12px', color: '#3A2D00' }}>把所有逐字稿匯出，做主題群聚與共識地圖。</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                onClick={handleExportAllCsv}
                style={{
                  background: '#100C0A',
                  color: '#FFF7E4',
                  border: '2px solid #100C0A',
                  borderRadius: '999px',
                  padding: '8px 14px',
                  fontWeight: 900,
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                匯出 tttc.csv
              </button>
              <button
                onClick={handleExportAllJson}
                style={{
                  background: '#FFFCF1',
                  color: '#100C0A',
                  border: '2px solid #100C0A',
                  borderRadius: '999px',
                  padding: '8px 14px',
                  fontWeight: 900,
                  fontSize: '12px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                匯出 JSON
              </button>
              <a
                href="https://ttt-city.mashbean.net"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  background: '#6FE83A',
                  color: '#100C0A',
                  border: '2px solid #100C0A',
                  borderRadius: '999px',
                  padding: '8px 14px',
                  fontWeight: 900,
                  fontSize: '12px',
                  textDecoration: 'none',
                  boxShadow: '3px 3px 0 #100C0A',
                }}
              >
                交給 Pocket TTTC ↗
              </a>
            </div>
          </div>

          {/* Conversations Accordion List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <h4 style={{ fontWeight: 900, fontSize: '14px', margin: 0 }}>受訪紀錄 · {totalParticipants} 筆</h4>
            {totalParticipants === 0 ? (
              <div style={{
                border: '2px dashed rgba(16,12,10,.3)',
                borderRadius: '10px',
                padding: '28px',
                textAlign: 'center',
                fontSize: '13px',
                color: '#6E5F50',
              }}>
                還沒有人受訪。切到「受訪對話室」做第一筆吧。
              </div>
            ) : (
              (hostView?.conversations || []).map((c) => {
                const exp = expandedParticipant === c.participant;
                return (
                  <div key={c.participant} style={{ border: '2px solid #100C0A', borderRadius: '10px', background: '#FFF7E4', overflow: 'hidden' }}>
                    <button
                      onClick={() => setExpandedParticipant(exp ? null : c.participant)}
                      style={{
                        width: '100%',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '10px',
                        flexWrap: 'wrap',
                        padding: '12px 14px',
                        background: 'transparent',
                        border: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        color: '#100C0A',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '12px', fontWeight: 700 }}>#{c.participant}</span>
                        <span style={{ fontWeight: 900, fontSize: '14px' }}>{c.alias || '匿名受訪者'}</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', color: '#6E5F50' }}>{c.turns} 輪 · {c.messages?.length || 0} 則</span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 900,
                          padding: '2px 10px',
                          borderRadius: '999px',
                          border: '1.5px solid #100C0A',
                          background: c.done ? '#DCFCC4' : '#FFF1A6',
                          color: c.done ? '#143A00' : '#3A2D00',
                        }}>
                          {c.done ? '已完成' : '進行中'}
                        </span>
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', fontWeight: 700 }}>
                        {exp ? '−' : '+'}
                      </span>
                    </button>
                    {exp && (
                      <div style={{
                        borderTop: '2px solid #100C0A',
                        padding: '14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                        maxHeight: '360px',
                        overflowY: 'auto',
                        background: '#FFFCF1',
                      }}>
                        {c.messages.map((m, mi) => (
                          <div
                            key={mi}
                            style={{
                              fontSize: '13px',
                              lineHeight: 1.6,
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: '1.5px solid ' + (m.role === 'interviewer' ? 'rgba(16,12,10,.18)' : '#143A00'),
                              background: m.role === 'interviewer' ? '#FFF7E4' : '#DCFCC4',
                              color: m.role === 'interviewer' ? '#100C0A' : '#143A00',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            <span style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: '10px',
                              fontWeight: 700,
                              color: '#6E5F50',
                              display: 'block',
                              marginBottom: '2px',
                            }}>
                              {m.role === 'interviewer' ? '訪談者' : (c.alias || '受訪者')}
                            </span>
                            {m.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. NEW SESSION MODAL                                                      */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(16,12,10,.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}>
          <div style={{
            background: '#FFFCF1',
            border: '3px solid #100C0A',
            borderRadius: '18px',
            boxShadow: '14px 14px 0 #100C0A',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: 'clamp(20px,4vw,32px)',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '10px', fontWeight: 700, letterSpacing: '.16em', color: '#6E5F50' }}>
                  NEW SESSION · 發起新訪談
                </span>
                <h2 style={{ fontFamily: "'Noto Serif TC', serif", fontWeight: 900, fontSize: '26px', margin: 0, lineHeight: 1.2 }}>
                  這一輪，你想聽見誰？
                </h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  width: '36px',
                  height: '36px',
                  flex: 'none',
                  borderRadius: '50%',
                  border: '2px solid #100C0A',
                  background: '#FFF7E4',
                  fontWeight: 900,
                  cursor: 'pointer',
                  fontSize: '14px',
                }}
              >
                ✕
              </button>
            </div>

            {/* Created Success View */}
            {createdUrls ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ background: '#DCFCC4', border: '2px solid #100C0A', borderRadius: '10px', padding: '14px', fontWeight: 900, fontSize: '14px', color: '#143A00' }}>
                  訪談建立好了。把參與連結丟出去吧。
                </div>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 900, fontSize: '13px' }}>
                  受訪者參與網址
                  <input
                    type="text"
                    readOnly
                    value={createdUrls.participate}
                    style={{ minHeight: '44px', padding: '0 14px', borderRadius: '6px', border: '2px solid #100C0A', background: '#FFF7E4', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 900, fontSize: '13px' }}>
                  主辦者後台（請妥善保存）
                  <input
                    type="text"
                    readOnly
                    value={createdUrls.admin}
                    style={{ minHeight: '44px', padding: '0 14px', borderRadius: '6px', border: '2px solid #100C0A', background: '#FFF7E4', fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}
                  />
                </label>
                <button
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    minHeight: '48px',
                    borderRadius: '999px',
                    border: '2px solid #100C0A',
                    background: '#100C0A',
                    color: '#FFF7E4',
                    fontWeight: 900,
                    fontSize: '14px',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  前往這場訪談 →
                </button>
              </div>
            ) : (
              /* Create Form */
              <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 900, fontSize: '13px' }}>
                  訪談主題
                  <input
                    type="text"
                    required
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    style={{ minHeight: '44px', padding: '0 14px', borderRadius: '6px', border: '2px solid #100C0A', background: '#FFF7E4', fontSize: '14px', fontFamily: 'inherit', outline: 'none' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 900, fontSize: '13px' }}>
                  想理解什麼
                  <textarea
                    required
                    rows={2}
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: '6px', border: '2px solid #100C0A', background: '#FFF7E4', fontSize: '14px', lineHeight: 1.6, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }}
                  />
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 900, fontSize: '13px' }}>
                    背景脈絡 <span style={{ fontWeight: 500, color: '#6E5F50', fontSize: '12px' }}>選填，讓訪談者掌握全局</span>
                    <input
                      type="text"
                      value={newContext}
                      onChange={(e) => setNewContext(e.target.value)}
                      placeholder="爭議背景、相關法規…"
                      style={{ minHeight: '44px', padding: '0 14px', borderRadius: '6px', border: '2px solid #100C0A', background: '#FFF7E4', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 900, fontSize: '13px' }}>
                    不能漏掉的聲音 <span style={{ fontWeight: 500, color: '#6E5F50', fontSize: '12px' }}>選填</span>
                    <input
                      type="text"
                      value={newCritical}
                      onChange={(e) => setNewCritical(e.target.value)}
                      placeholder="例如：原住民族、深夜女性通勤者…"
                      style={{ minHeight: '44px', padding: '0 14px', borderRadius: '6px', border: '2px solid #100C0A', background: '#FFF7E4', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
                    />
                  </label>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: '12px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 900, fontSize: '13px' }}>
                    每人輪數上限
                    <input
                      type="number"
                      min={2}
                      max={10}
                      value={newMaxTurns}
                      onChange={(e) => setNewMaxTurns(Number(e.target.value))}
                      style={{ minHeight: '44px', padding: '0 14px', borderRadius: '6px', border: '2px solid #100C0A', background: '#FFF7E4', fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', outline: 'none' }}
                    />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 900, fontSize: '13px' }}>
                    人數上限
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newMaxParticipants}
                      onChange={(e) => setNewMaxParticipants(Number(e.target.value))}
                      style={{ minHeight: '44px', padding: '0 14px', borderRadius: '6px', border: '2px solid #100C0A', background: '#FFF7E4', fontFamily: "'JetBrains Mono', monospace", fontSize: '14px', outline: 'none' }}
                    />
                  </label>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ fontWeight: 900, fontSize: '13px' }}>起始問題</span>
                    <button
                      type="button"
                      onClick={handleAutoFillCruxes}
                      style={{
                        background: '#C9F1FF',
                        color: '#002A45',
                        border: '2px solid #100C0A',
                        borderRadius: '999px',
                        padding: '5px 12px',
                        fontWeight: 900,
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      從爭點自動生成
                    </button>
                  </div>
                  {newQuestions.map((q, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '11px', fontWeight: 700, color: '#6E5F50', paddingTop: '14px', width: '22px', flex: 'none' }}>
                        Q{i + 1}
                      </span>
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => {
                          const updated = [...newQuestions];
                          updated[i] = e.target.value;
                          setNewQuestions(updated);
                        }}
                        style={{ flex: 1, minWidth: 0, minHeight: '44px', padding: '0 12px', borderRadius: '6px', border: '2px solid #100C0A', background: '#FFF7E4', fontSize: '13px', fontFamily: 'inherit', outline: 'none' }}
                      />
                      {newQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewQuestions(newQuestions.filter((_, idx) => idx !== i))}
                          style={{ width: '44px', flex: 'none', borderRadius: '6px', border: '2px solid #100C0A', background: '#FFD9E8', color: '#5A0024', fontWeight: 900, cursor: 'pointer' }}
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  {newQuestions.length < 8 && (
                    <button
                      type="button"
                      onClick={() => setNewQuestions([...newQuestions, ''])}
                      style={{
                        alignSelf: 'flex-start',
                        background: 'transparent',
                        border: 0,
                        padding: '4px 0',
                        fontWeight: 900,
                        fontSize: '12px',
                        color: '#002A45',
                        textDecoration: 'underline',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                      }}
                    >
                      ＋ 新增問題（最多 8 題）
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '14px', borderTop: '2px solid #100C0A', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    style={{ minHeight: '44px', padding: '0 18px', borderRadius: '999px', border: '2px solid #100C0A', background: '#FFFCF1', fontWeight: 900, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    style={{ minHeight: '44px', padding: '0 22px', borderRadius: '999px', border: '2px solid #100C0A', background: '#6FE83A', fontWeight: 900, fontSize: '13px', cursor: 'pointer', boxShadow: '4px 4px 0 #100C0A', fontFamily: 'inherit' }}
                  >
                    建立訪談 →
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
