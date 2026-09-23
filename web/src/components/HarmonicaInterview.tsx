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
  MessageSquare,
  Plus,
  ExternalLink,
  Download,
  Sparkles,
  Send,
  CheckCircle2,
  RefreshCw,
  Users,
  BarChart3,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
} from 'lucide-react';
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

export const HarmonicaInterview: React.FC<HarmonicaInterviewProps> = ({ topic, t }) => {
  // Active session
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const list = HarmonicaLocalStore.getTopicSessions(topic.id);
    if (list.length > 0) return list[0].sessionId;
    return topic.id === 'nuclear4' ? '6o0ryapw2o' : 'sports-int-1';
  });

  const [sessionList, setSessionList] = useState<HarmonicaSessionRef[]>(() => {
    return HarmonicaLocalStore.getTopicSessions(topic.id);
  });

  const [sessionData, setSessionData] = useState<HarmonicaSession | null>(() => {
    return HarmonicaLocalStore.getSession(activeSessionId);
  });
  const [loadingSession, setLoadingSession] = useState(false);

  // View mode: 'participant' vs 'host'
  const [viewMode, setViewMode] = useState<'participant' | 'host'>('participant');
  const [hostView, setHostView] = useState<HarmonicaHostView | null>(null);
  const [expandedParticipant, setExpandedParticipant] = useState<number | null>(null);

  // Participant state
  const [alias, setAlias] = useState('');
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [conversation, setConversation] = useState<HarmonicaConversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTopic, setNewTopic] = useState(topic.title);
  const [newGoal, setNewGoal] = useState(`理解參與者對「${topic.title}」的具體考量、價值排序與條件。`);
  const [newContext, setNewContext] = useState('');
  const [newCritical, setNewCritical] = useState('');
  const [newQuestions, setNewQuestions] = useState<string[]>([
    '對於這項議題，您的基本立場與主要考量是什麼？',
  ]);
  const [newMaxTurns, setNewMaxTurns] = useState(6);
  const [newMaxParticipants, setNewMaxParticipants] = useState(50);
  const [creating, setCreating] = useState(false);
  const [createSuccessMsg, setCreateSuccessMsg] = useState<{ participateUrl: string; adminUrl: string } | null>(null);

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
    if (local.length > 0 && !local.some((s) => s.sessionId === activeSessionId)) {
      setActiveSessionId(local[0].sessionId);
    }

    // Try fetching from native API if available
    fetch(`/api/topics/${topic.id}/harmonica/sessions`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: HarmonicaSessionRef[]) => {
        if (Array.isArray(data) && data.length > 0) {
          data.forEach((ref) => HarmonicaLocalStore.addTopicSession(topic.id, ref));
          const updated = HarmonicaLocalStore.getTopicSessions(topic.id);
          setSessionList(updated);
        }
      })
      .catch(() => {});
  }, [topic.id]);

  // Load session metadata when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) return;

    setLoadingSession(true);
    setSendError(null);
    setJoined(false);

    // 1. Load local copy first (0 latency)
    const localSess = HarmonicaLocalStore.getSession(activeSessionId);
    if (localSess) {
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
  const handleJoin = async () => {
    if (!activeSessionId || !sessionData) return;
    setJoining(true);
    setSendError(null);

    const pId = getParticipantId(activeSessionId);
    const cleanAlias = alias.trim();

    try {
      // 1. Try API join
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
        return;
      }
    } catch (_) {
      // Fallback to local native engine
    }

    // Local native engine join
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
      participant: (sessionData.participants || 0) + 1,
      alias: cleanAlias,
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
    setJoining(false);
  };

  // Send message
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending || !conversation || !activeSessionId || !sessionData) return;

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
    setSendError(null);

    let replyMsg: HarmonicaMessage | null = null;

    try {
      // 1. Try sending to edge/backend API
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
      // API call failed, fallback to local intelligent generation
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

  // Auto-fill questions from topic cruxes
  const handleAutoFillCruxes = () => {
    if (!topic.keyCruxes || topic.keyCruxes.length === 0) return;
    const generated = topic.keyCruxes.slice(0, 3).map((crux) => {
      const pro = crux.proPoints?.[0] || crux.pro?.[0] || '正方論據';
      const con = crux.conPoints?.[0] || crux.con?.[0] || '反方論據';
      return `針對「${crux.title}」，正反雙方有不同考量（如 ${pro} vs ${con}）。您的經驗或看法是什麼？`;
    });
    setNewQuestions(generated);
  };

  // Create new session
  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

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

      // Try API create
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

      // Fallback local create if API offline
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

      setCreateSuccessMsg({
        participateUrl: `/s/${createdSessionId}`,
        adminUrl: `/h/${createdSessionId}#admin=${adminToken}`,
      });
    } catch (err: any) {
      alert(`建立失敗：${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Export functions
  const handleExportCsv = () => {
    if (!sessionData) return;
    const convs = hostView?.conversations || (conversation ? [conversation] : []);
    const csvContent = formatTTTCCsv(sessionData, convs);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topos-harmonica-${activeSessionId}-tttc.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    if (!sessionData) return;
    const convs = hostView?.conversations || (conversation ? [conversation] : []);
    const jsonContent = formatTranscriptsJson(sessionData, convs);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topos-harmonica-${activeSessionId}-transcripts.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSendToTTTC = () => {
    window.open('https://ttt-city.mashbean.net', '_blank', 'noopener,noreferrer');
  };

  const currentTurns = conversation?.turns || 0;
  const maxTurns = sessionData?.maxTurns || 6;
  const turnProgressPct = Math.min(100, Math.round((currentTurns / maxTurns) * 100));

  return (
    <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[8px_8px_0_0_#000]">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-block bg-[#00E5A3] border-2 border-black px-3 py-0.5 text-xs font-mono font-bold tracking-wider">
              {t.harmonicaBadge}
            </span>
            <span className="inline-block bg-[#FFF1A6] border-2 border-black px-2 py-0.5 text-xs font-mono font-bold">
              Google Gemma 4 (@cf)
            </span>
          </div>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">{t.harmonicaKicker}</p>
          <h2 className="text-2xl md:text-3xl font-black">{sessionData?.topic || topic.title}</h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Dual View Mode Switcher */}
          <div className="flex border-2 border-black p-0.5 bg-gray-100">
            <button
              onClick={() => setViewMode('participant')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold transition-all ${
                viewMode === 'participant' ? 'bg-black text-white' : 'text-gray-700 hover:text-black'
              }`}
            >
              <MessageSquare size={13} />
              受訪對話室
            </button>
            <button
              onClick={() => setViewMode('host')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-mono font-bold transition-all ${
                viewMode === 'host' ? 'bg-black text-white' : 'text-gray-700 hover:text-black'
              }`}
            >
              <BarChart3 size={13} />
              主辦者控制台
            </button>
          </div>

          <button
            onClick={() => {
              setShowCreateModal(true);
              setCreateSuccessMsg(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF1A6] border-2 border-black font-mono font-bold text-xs hover:bg-[#FFE66D] active:translate-y-0.5 shadow-[2px_2px_0_0_#000]"
          >
            <Plus size={14} />
            {t.harmonicaCreateNew}
          </button>
        </div>
      </div>

      {/* Session Selector Bar */}
      {sessionList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-gray-50 border-2 border-black text-xs font-mono">
          <span className="font-bold text-gray-700">{t.harmonicaSessionSelector}：</span>
          {sessionList.map((s) => {
            const isSelected = s.sessionId === activeSessionId;
            return (
              <button
                key={s.sessionId}
                onClick={() => setActiveSessionId(s.sessionId)}
                className={`px-3 py-1 border-2 border-black font-bold transition-all ${
                  isSelected
                    ? 'bg-black text-white shadow-[2px_2px_0_0_#FFF1A6]'
                    : 'bg-white text-black hover:bg-gray-200'
                }`}
              >
                {s.title || s.sessionId}
                {s.sessionId === '6o0ryapw2o' || s.isDefault ? ' ★' : ''}
              </button>
            );
          })}
        </div>
      )}

      {/* Session Goal Banner */}
      {sessionData && (
        <div className="mb-6 border-l-4 border-[#00C2FF] bg-[#F5FCFF] p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-gray-700">{t.harmonicaGoalLabel}</span>
            <span className="text-xs font-mono bg-white border border-black px-2 py-0.5">
              ID: {sessionData.sessionId} · 模型: {sessionData.model || '@cf/google/gemma-4-26b-a4b-it'}
            </span>
          </div>
          <p className="mt-1 text-sm font-sans font-medium text-gray-900">{sessionData.goal}</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. PARTICIPANT VIEW MODE                                                  */}
      {/* ========================================================================= */}
      {viewMode === 'participant' && (
        <div>
          {/* Start Screen (Before Joining) */}
          {!loadingSession && sessionData && !joined && (
            <div className="border-2 border-black p-6 bg-[#FCFBF7] my-4 shadow-[4px_4px_0_0_#000]">
              <div className="flex items-start gap-3 mb-4">
                <MessageSquare className="mt-1 flex-shrink-0 text-black" size={24} />
                <div>
                  <h3 className="font-bold text-base mb-1">{t.harmonicaInterviewerName}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    這是一位中立的 AI 訪談者。它會問您幾個問題，依您說的內容深入追問，不會評價或試圖說服您。
                    您的想法會被客觀記錄為逐字稿，隨時可以停止或匯出，並將作為審議分析之用。
                  </p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-mono font-bold uppercase mb-1.5 text-gray-700">
                  {t.harmonicaAliasPrompt}
                </label>
                <input
                  type="text"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  placeholder="例如：捷運通勤族、核電工程師、新北市民…"
                  className="w-full max-w-md px-3 py-2 border-2 border-black font-sans text-sm focus:outline-none focus:ring-2 focus:ring-black"
                />
              </div>

              <button
                onClick={handleJoin}
                disabled={joining}
                className="px-6 py-2.5 bg-[#00E5A3] border-2 border-black font-mono font-bold text-sm hover:bg-[#00c78e] active:translate-y-0.5 shadow-[3px_3px_0_0_#000]"
              >
                {joining ? '連線中…' : t.harmonicaStartButton}
              </button>
            </div>
          )}

          {/* Active Conversation Room */}
          {joined && conversation && (
            <div className="space-y-4">
              {/* Turns Progress Tracker */}
              <div className="border-2 border-black p-3 bg-gray-50 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-700">訪談進度：</span>
                  <span className="px-2 py-0.5 bg-black text-white font-bold">
                    第 {currentTurns} / {maxTurns} 輪
                  </span>
                  {conversation.alias && (
                    <span className="text-gray-500">（受訪者：{conversation.alias}）</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-32 bg-gray-200 border border-black h-3 overflow-hidden">
                    <div
                      className="bg-[#00E5A3] h-full transition-all duration-300"
                      style={{ width: `${turnProgressPct}%` }}
                    />
                  </div>
                  <span className="font-bold text-gray-600">{turnProgressPct}%</span>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="border-2 border-black bg-[#FAF9F6] p-4 min-h-[360px] max-h-[540px] overflow-y-auto space-y-4">
                {conversation.messages.map((m, idx) => {
                  const isInterviewer = m.role === 'interviewer';
                  return (
                    <div
                      key={idx}
                      className={`flex flex-col ${isInterviewer ? 'items-start' : 'items-end'}`}
                    >
                      <div className="text-[10px] font-mono text-gray-500 mb-1 px-1">
                        {isInterviewer ? '🤖 AI 訪談者 (Gemma 4)' : `👤 ${conversation.alias || '我'}`}
                      </div>
                      <div
                        className={`max-w-[85%] md:max-w-[75%] p-3.5 border-2 border-black leading-relaxed text-sm ${
                          isInterviewer
                            ? 'bg-white text-gray-900 shadow-[3px_3px_0_0_#E0E7FF]'
                            : 'bg-[#00E5A3] text-black shadow-[3px_3px_0_0_#100C0A]'
                        }`}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })}

                {sending && (
                  <div className="flex flex-col items-start">
                    <div className="text-[10px] font-mono text-gray-500 mb-1 px-1">🤖 AI 訪談者</div>
                    <div className="p-3 bg-white border-2 border-black text-xs font-mono flex items-center gap-2">
                      <RefreshCw className="animate-spin" size={14} />
                      AI 訪談者傾聽中，準備追問…
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Completion Banner */}
              {conversation.done && (
                <div className="border-2 border-black bg-[#E6F9F0] p-4 text-center space-y-3 shadow-[4px_4px_0_0_#000]">
                  <div className="flex items-center justify-center gap-2 text-green-800 font-bold text-sm">
                    <CheckCircle2 size={18} className="text-green-600" />
                    訪談已達設定輪次上限，圓滿結束！非常感謝您的寶貴回饋。
                  </div>
                  <p className="text-xs text-gray-600">
                    您的想法已完整儲存，可匯出為標準 `tttc.csv` 格式，供後續 Talk to the City 主題群聚分析。
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                    <button
                      onClick={handleExportCsv}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-mono font-bold hover:bg-gray-800"
                    >
                      <Download size={13} />
                      匯出我的逐字稿 (tttc.csv)
                    </button>
                    <button
                      onClick={() => setJoined(false)}
                      className="px-3 py-1.5 bg-white border-2 border-black text-xs font-mono font-bold hover:bg-gray-100"
                    >
                      重新開始新對話
                    </button>
                  </div>
                </div>
              )}

              {/* Input Form */}
              {!conversation.done && (
                <form onSubmit={handleSendMessage} className="space-y-2">
                  {sendError && (
                    <div className="p-2 bg-red-100 border border-red-500 text-red-700 text-xs font-mono">
                      ⚠️ {sendError}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(e);
                        }
                      }}
                      placeholder="請表達您的看法、條件或疑慮…（Shift+Enter 換行，Enter 送出）"
                      rows={2}
                      disabled={sending}
                      className="flex-1 p-2.5 border-2 border-black text-sm font-sans focus:outline-none focus:ring-2 focus:ring-black resize-none"
                    />
                    <button
                      type="submit"
                      disabled={sending || !inputText.trim()}
                      className="px-5 bg-black text-white border-2 border-black font-mono font-bold text-sm hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      <Send size={15} />
                      送出
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. HOST / ADMIN VIEW MODE                                                 */}
      {/* ========================================================================= */}
      {viewMode === 'host' && (
        <div className="space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-center">
            <div className="border-2 border-black p-3 bg-gray-50">
              <span className="text-[10px] text-gray-500 uppercase block">總參與者人數</span>
              <span className="text-xl md:text-2xl font-black">
                {hostView?.participants || (conversation ? 1 : 0)}
              </span>
            </div>
            <div className="border-2 border-black p-3 bg-[#E6F9F0]">
              <span className="text-[10px] text-green-700 uppercase block">已完成訪談</span>
              <span className="text-xl md:text-2xl font-black text-green-800">
                {hostView?.completed || (conversation?.done ? 1 : 0)}
              </span>
            </div>
            <div className="border-2 border-black p-3 bg-gray-50">
              <span className="text-[10px] text-gray-500 uppercase block">每人輪數上限</span>
              <span className="text-xl md:text-2xl font-black">{sessionData?.maxTurns || 6} 輪</span>
            </div>
            <div className="border-2 border-black p-3 bg-gray-50">
              <span className="text-[10px] text-gray-500 uppercase block">推理模型</span>
              <span className="text-xs font-bold block mt-1 text-gray-800 truncate">
                Gemma 4 (26B)
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-[#FFFEEB] border-2 border-black">
            <div className="text-xs font-mono font-bold text-gray-700">
              📥 Talk to the City (TTTC) 分析工具鏈：
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleExportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-mono font-bold hover:bg-gray-800"
              >
                <FileSpreadsheet size={14} />
                匯出 tttc.csv
              </button>
              <button
                onClick={handleExportJson}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white border-2 border-black text-xs font-mono font-bold hover:bg-gray-100"
              >
                <Download size={14} />
                匯出 JSON
              </button>
              <button
                onClick={handleSendToTTTC}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00E5A3] border-2 border-black text-xs font-mono font-bold hover:bg-[#00c78e]"
              >
                <ExternalLink size={14} />
                交給 Pocket TTTC 分析 ↗
              </button>
            </div>
          </div>

          {/* Conversations List */}
          <div>
            <h4 className="font-mono font-bold text-sm mb-3 flex items-center gap-2">
              <Users size={16} />
              受訪對話紀錄清單（共{' '}
              {hostView?.conversations?.length || (conversation ? 1 : 0)} 筆）
            </h4>

            {(!hostView?.conversations || hostView.conversations.length === 0) && !conversation ? (
              <div className="p-8 text-center border-2 border-dashed border-gray-400 font-mono text-sm text-gray-500">
                目前尚無參與者對話紀錄。您可以切換至「受訪對話室」進行第一筆對話。
              </div>
            ) : (
              <div className="space-y-3">
                {(hostView?.conversations || (conversation ? [conversation] : [])).map((conv) => {
                  const isExpanded = expandedParticipant === conv.participant;
                  return (
                    <div
                      key={conv.participant}
                      className="border-2 border-black bg-white shadow-[3px_3px_0_0_#000]"
                    >
                      <div
                        onClick={() =>
                          setExpandedParticipant(isExpanded ? null : conv.participant)
                        }
                        className="p-3 bg-gray-50 flex items-center justify-between cursor-pointer hover:bg-gray-100 font-mono text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-bold">
                            受訪者 #{conv.participant}
                            {conv.alias ? ` (${conv.alias})` : ''}
                          </span>
                          <span className="px-2 py-0.5 bg-gray-200 border border-black text-[10px]">
                            {conv.turns} 輪 / {conv.messages.length} 則訊息
                          </span>
                          {conv.done && (
                            <span className="px-2 py-0.5 bg-green-200 text-green-900 border border-green-700 text-[10px] font-bold">
                              已完成
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-gray-500">
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </div>
                      </div>

                      {/* Expanded Messages */}
                      {isExpanded && (
                        <div className="p-4 border-t-2 border-black space-y-3 bg-[#FCFBF7] max-h-96 overflow-y-auto">
                          {conv.messages.map((m, mIdx) => (
                            <div
                              key={mIdx}
                              className={`p-2.5 text-xs rounded border ${
                                m.role === 'interviewer'
                                  ? 'bg-white border-gray-300 text-gray-800'
                                  : 'bg-[#00E5A3]/20 border-green-700 text-black font-medium'
                              }`}
                            >
                              <span className="font-mono font-bold block mb-0.5 text-[10px] text-gray-500">
                                {m.role === 'interviewer' ? '🤖 訪談者：' : `👤 ${conv.alias || '受訪者'}：`}
                              </span>
                              {m.text}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. CREATE SESSION MODAL                                                   */}
      {/* ========================================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black w-full max-w-xl p-6 shadow-[10px_10px_0_0_#000] max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black mb-4 flex items-center gap-2">
              <Plus size={20} />
              {t.harmonicaCreateTitle}
            </h3>

            {createSuccessMsg ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border-2 border-green-600 text-green-800 text-sm font-mono">
                  🎉 訪談建立成功！已同步儲存於 Topos 專案本機與邊緣節點。
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold mb-1">受訪者參與網址：</label>
                  <input
                    type="text"
                    readOnly
                    value={createSuccessMsg.participateUrl}
                    className="w-full p-2 border-2 border-black font-mono text-xs bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-mono font-bold mb-1">主辦者管理後台（請妥善保存）：</label>
                  <input
                    type="text"
                    readOnly
                    value={createSuccessMsg.adminUrl}
                    className="w-full p-2 border-2 border-black font-mono text-xs bg-gray-50"
                  />
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-full py-2.5 bg-black text-white font-mono font-bold text-sm hover:bg-gray-800"
                >
                  關閉並前往該訪談
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-bold mb-1">{t.harmonicaCreateTopicLabel}</label>
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    required
                    className="w-full p-2 border-2 border-black text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold mb-1">{t.harmonicaCreateGoalLabel}</label>
                  <textarea
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    rows={2}
                    required
                    className="w-full p-2 border-2 border-black text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono font-bold mb-1">背景脈絡（選填，供訪談者掌握全局）：</label>
                    <input
                      type="text"
                      value={newContext}
                      onChange={(e) => setNewContext(e.target.value)}
                      placeholder="簡述爭議背景與主要法規或前情提要…"
                      className="w-full p-2 border-2 border-black text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-bold mb-1">不能漏掉的聲音（選填）：</label>
                    <input
                      type="text"
                      value={newCritical}
                      onChange={(e) => setNewCritical(e.target.value)}
                      placeholder="例如：原住民族、深夜女性通勤者…"
                      className="w-full p-2 border-2 border-black text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono font-bold mb-1">每人輪數上限：</label>
                    <input
                      type="number"
                      min={2}
                      max={10}
                      value={newMaxTurns}
                      onChange={(e) => setNewMaxTurns(Number(e.target.value))}
                      className="w-full p-2 border-2 border-black text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono font-bold mb-1">人數上限：</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newMaxParticipants}
                      onChange={(e) => setNewMaxParticipants(Number(e.target.value))}
                      className="w-full p-2 border-2 border-black text-sm font-mono"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-mono font-bold">{t.harmonicaCreateQuestionsLabel}</label>
                    <button
                      type="button"
                      onClick={handleAutoFillCruxes}
                      className="flex items-center gap-1 text-[11px] font-mono font-bold bg-[#E0E7FF] border border-black px-2 py-0.5 hover:bg-[#C7D2FE]"
                    >
                      <Sparkles size={12} />
                      {t.harmonicaCruxAutoFill}
                    </button>
                  </div>

                  {newQuestions.map((q, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input
                        type="text"
                        value={q}
                        onChange={(e) => {
                          const updated = [...newQuestions];
                          updated[idx] = e.target.value;
                          setNewQuestions(updated);
                        }}
                        className="flex-1 p-2 border-2 border-black text-xs"
                      />
                      {newQuestions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setNewQuestions(newQuestions.filter((_, i) => i !== idx))}
                          className="px-2 border-2 border-black text-xs font-mono hover:bg-red-100"
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
                      className="text-xs font-mono text-blue-700 underline font-bold mt-1"
                    >
                      + 新增起始問題（最多 8 個）
                    </button>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t-2 border-black">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border-2 border-black text-xs font-mono font-bold hover:bg-gray-100"
                  >
                    {t.harmonicaCreateCancel}
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-5 py-2 bg-[#00E5A3] border-2 border-black text-xs font-mono font-bold hover:bg-[#00c78e]"
                  >
                    {creating ? '建立中…' : t.harmonicaCreateSubmit}
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
