import React, { useState, useEffect, useRef } from 'react';
import {
  Topic,
  HarmonicaSession,
  HarmonicaConversation,
  HarmonicaMessage,
  HarmonicaSessionRef,
} from '../types';
import { TranslationStrings } from '../i18n/translations';
import { MessageSquare, Plus, ExternalLink, Download, Sparkles, Send, CheckCircle2, RefreshCw } from 'lucide-react';

interface HarmonicaInterviewProps {
  topic: Topic;
  t: TranslationStrings;
  apiBase: string;
}

export const HarmonicaInterview: React.FC<HarmonicaInterviewProps> = ({ topic, t, apiBase }) => {
  // Current active session ID
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    if (topic.harmonicaSessions && topic.harmonicaSessions.length > 0) {
      const def = topic.harmonicaSessions.find((s) => s.isDefault);
      return def ? def.sessionId : topic.harmonicaSessions[0].sessionId;
    }
    return topic.id === 'nuclear4' ? '6o0ryapw2o' : '';
  });

  const [sessionList, setSessionList] = useState<HarmonicaSessionRef[]>(() => {
    return topic.harmonicaSessions || (topic.id === 'nuclear4' ? [
      {
        sessionId: '6o0ryapw2o',
        title: '核電重啟公眾訪談',
        goal: '測試與收集核電重啟之條件、顧慮與多元考量',
        url: 'https://harmonica.mashbean.net/s/6o0ryapw2o',
        isDefault: true,
      }
    ] : []);
  });

  const [sessionData, setSessionData] = useState<HarmonicaSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(false);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Participant state
  const [alias, setAlias] = useState('');
  const [joined, setJoined] = useState(false);
  const [joining, setJoining] = useState(false);
  const [conversation, setConversation] = useState<HarmonicaConversation | null>(null);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  // Modals & inputs
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTopic, setNewTopic] = useState(topic.title);
  const [newGoal, setNewGoal] = useState(`理解參與者對「${topic.title}」的具體考量、價值排序與條件。`);
  const [newQuestions, setNewQuestions] = useState<string[]>(['對於這項議題，您的基本立場與主要考量是什麼？']);
  const [creating, setCreating] = useState(false);
  const [createSuccessMsg, setCreateSuccessMsg] = useState<{ participateUrl: string; adminUrl: string } | null>(null);

  const [externalInput, setExternalInput] = useState('');
  const [showConnectInput, setShowConnectInput] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Get or create participant UUID
  const getParticipantId = (sId: string) => {
    const key = `topos:harmonica:participant:${sId}`;
    let pId = localStorage.getItem(key);
    if (!pId) {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        pId = crypto.randomUUID();
      } else {
        pId = 'p-' + Math.random().toString(36).substring(2, 15);
      }
      localStorage.setItem(key, pId);
    }
    return pId;
  };

  // Sync session list when topic changes
  useEffect(() => {
    fetch(`${apiBase}/api/topics/${topic.id}/harmonica/sessions`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: HarmonicaSessionRef[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setSessionList(data);
          if (!data.some((s) => s.sessionId === activeSessionId)) {
            setActiveSessionId(data[0].sessionId);
          }
        }
      })
      .catch(() => {});
  }, [topic.id, apiBase]);

  // Load session metadata when activeSessionId changes
  useEffect(() => {
    if (!activeSessionId) {
      setSessionData(null);
      setJoined(false);
      setConversation(null);
      return;
    }

    setLoadingSession(true);
    setSessionError(null);
    setJoined(false);
    setConversation(null);

    fetch(`${apiBase}/api/harmonica/sessions/${activeSessionId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `無法取得訪談資料（HTTP ${res.status}）`);
        }
        return res.json();
      })
      .then((data: HarmonicaSession) => {
        setSessionData(data);
        // Automatically attempt to join silently to resume existing session if available
        const pId = getParticipantId(activeSessionId);
        fetch(`${apiBase}/api/harmonica/sessions/${activeSessionId}/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId: pId, alias: '' }),
        })
          .then((jRes) => (jRes.ok ? jRes.json() : null))
          .then((jData) => {
            if (jData && jData.ok && jData.conversation) {
              setConversation(jData.conversation);
              setJoined(true);
            }
          })
          .catch(() => {});
      })
      .catch((err: any) => {
        setSessionError(err.message);
      })
      .finally(() => {
        setLoadingSession(false);
      });
  }, [activeSessionId, apiBase]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [conversation?.messages, sending]);

  const handleJoin = async () => {
    if (!activeSessionId) return;
    setJoining(true);
    setSendError(null);
    const pId = getParticipantId(activeSessionId);

    try {
      const res = await fetch(`${apiBase}/api/harmonica/sessions/${activeSessionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: pId, alias: alias.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '加入訪談失敗');
      }
      setConversation(data.conversation);
      setJoined(true);
    } catch (err: any) {
      setSendError(err.message);
    } finally {
      setJoining(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = inputText.trim();
    if (!text || sending || !conversation || !activeSessionId) return;

    const pId = getParticipantId(activeSessionId);
    const tempMsg: HarmonicaMessage = {
      role: 'participant',
      text,
      at: Date.now(),
    };

    setConversation((prev) =>
      prev ? { ...prev, messages: [...prev.messages, tempMsg] } : null
    );
    setInputText('');
    setSending(true);
    setSendError(null);

    try {
      const res = await fetch(`${apiBase}/api/harmonica/sessions/${activeSessionId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: pId, text }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || '送出訪談訊息失敗');
      }

      setConversation((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          turns: data.turn,
          done: data.done,
          messages: [...prev.messages, data.reply],
        };
      });
    } catch (err: any) {
      setSendError(err.message);
      // Remove temp message if failed
      setConversation((prev) =>
        prev
          ? {
              ...prev,
              messages: prev.messages.filter((m) => m !== tempMsg),
            }
          : null
      );
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const handleConnectExternal = () => {
    const trimmed = externalInput.trim();
    if (!trimmed) return;

    // Match either full URL or 10-char ID
    const match = trimmed.match(/\/s\/([a-z0-9]{10})/i) || trimmed.match(/^([a-z0-9]{10})$/i);
    const sId = match ? match[1] : trimmed;

    // Add to session list and switch
    const newRef: HarmonicaSessionRef = {
      sessionId: sId,
      title: `外部訪談 (${sId})`,
      url: `https://harmonica.mashbean.net/s/${sId}`,
      createdAt: Date.now(),
    };

    fetch(`${apiBase}/api/topics/${topic.id}/harmonica/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRef),
    }).catch(() => {});

    setSessionList((prev) => [newRef, ...prev.filter((p) => p.sessionId !== sId)]);
    setActiveSessionId(sId);
    setExternalInput('');
    setShowConnectInput(false);
  };

  // Populate questions from topic cruxes
  const handleAutoFillCruxes = () => {
    if (!topic.keyCruxes || topic.keyCruxes.length === 0) return;
    const generated = topic.keyCruxes.slice(0, 3).map((crux) => {
      return `針對「${crux.title}」，正反雙方有不同顧慮（如 ${crux.proPoints?.[0] || '正方論據'} vs ${crux.conPoints?.[0] || '反方論據'}）。您的看法或條件是什麼？`;
    });
    setNewQuestions(generated);
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim() || !newGoal.trim() || newQuestions.filter(Boolean).length === 0) return;
    setCreating(true);

    try {
      const res = await fetch(`${apiBase}/api/harmonica/sessions?topicId=${topic.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: newTopic.trim(),
          goal: newGoal.trim(),
          questions: newQuestions.filter(Boolean),
          language: 'zh-Hant',
          maxTurns: 6,
          maxParticipants: 20,
          askAlias: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.sessionId) {
        throw new Error(data.error || '建立訪談失敗');
      }

      setCreateSuccessMsg({
        participateUrl: data.urls?.participate || `https://harmonica.mashbean.net/s/${data.sessionId}`,
        adminUrl: data.urls?.host || '',
      });

      const ref: HarmonicaSessionRef = {
        sessionId: data.sessionId,
        title: data.topic || newTopic,
        goal: newGoal,
        url: data.urls?.participate,
        createdAt: Date.now(),
      };

      setSessionList((prev) => [ref, ...prev]);
      setActiveSessionId(data.sessionId);
    } catch (err: any) {
      alert(`建立失敗：${err.message}`);
    } finally {
      setCreating(false);
    }
  };

  // Export transcripts
  const exportCsv = () => {
    if (!conversation || conversation.messages.length === 0) return;
    const rows = [['id', 'interview', 'comment']];
    conversation.messages.forEach((m, idx) => {
      const speaker = m.role === 'interviewer' ? 'Interviewer' : (conversation.alias || 'Participant');
      const cleanComment = m.text.replace(/"/g, '""');
      rows.push([String(idx + 1), speaker, `"${cleanComment}"`]);
    });
    const csvContent = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topos-harmonica-${activeSessionId}-tttc.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    if (!conversation) return;
    const blob = new Blob([JSON.stringify({ session: sessionData, conversation }, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `topos-harmonica-${activeSessionId}-transcript.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white border-4 border-black p-6 md:p-8 shadow-[8px_8px_0_0_#000]">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b-2 border-black pb-4 mb-6">
        <div>
          <span className="inline-block bg-[#00E5A3] border-2 border-black px-3 py-0.5 text-xs font-mono font-bold tracking-wider mb-2">
            {t.harmonicaBadge}
          </span>
          <p className="text-xs font-mono text-gray-500 uppercase tracking-wider">{t.harmonicaKicker}</p>
          <h2 className="text-2xl md:text-3xl font-black">{sessionData?.topic || topic.title}</h2>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setShowCreateModal(true);
              setCreateSuccessMsg(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#FFF1A6] border-2 border-black font-mono font-bold text-xs hover:bg-[#FFE66D] active:translate-y-0.5"
          >
            <Plus size={14} />
            {t.harmonicaCreateNew}
          </button>
          <button
            onClick={() => setShowConnectInput(!showConnectInput)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 border-2 border-black font-mono font-bold text-xs hover:bg-gray-200 active:translate-y-0.5"
          >
            <ExternalLink size={14} />
            {t.harmonicaConnectUrl}
          </button>
        </div>
      </div>

      {/* Description */}
      <p className="text-sm font-sans text-gray-700 leading-relaxed mb-6 bg-[#FFFBEB] border-2 border-dashed border-black p-3.5">
        {t.harmonicaDesc}
      </p>

      {/* Connect External URL Dropdown */}
      {showConnectInput && (
        <div className="mb-6 p-4 bg-[#F0F8FF] border-2 border-black">
          <label className="block text-xs font-mono font-bold uppercase mb-2">
            {t.harmonicaConnectUrl}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={externalInput}
              onChange={(e) => setExternalInput(e.target.value)}
              placeholder={t.harmonicaConnectPlaceholder}
              className="flex-1 border-2 border-black px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-black"
            />
            <button
              onClick={handleConnectExternal}
              className="px-4 py-2 bg-black text-white font-mono font-bold text-sm hover:bg-gray-800"
            >
              {t.harmonicaConnectButton}
            </button>
          </div>
        </div>
      )}

      {/* Sessions Selector Bar */}
      {sessionList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6 p-3 bg-gray-50 border-2 border-black text-xs font-mono">
          <span className="font-bold text-gray-600">{t.harmonicaSessionSelector}：</span>
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
                {s.sessionId === '6o0ryapw2o' ? ' ★ 預設' : ''}
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
              ID: {sessionData.sessionId} · {sessionData.model || '@cf/google/gemma-4-26b-a4b-it'}
            </span>
          </div>
          <p className="mt-1 text-sm font-sans font-medium text-gray-900">{sessionData.goal}</p>
        </div>
      )}

      {/* Loading & Errors */}
      {loadingSession && (
        <div className="p-8 text-center font-mono text-sm border-2 border-dashed border-gray-400 my-6">
          <RefreshCw className="animate-spin inline-block mr-2" size={16} />
          載入訪談工作階段中…
        </div>
      )}

      {sessionError && (
        <div className="p-4 bg-red-50 border-2 border-red-500 text-red-700 text-sm font-mono my-4">
          ⚠️ {sessionError}
        </div>
      )}

      {/* Start Interview (Before Joining) */}
      {!loadingSession && sessionData && !joined && (
        <div className="border-2 border-black p-6 bg-[#FCFBF7] my-6">
          <div className="flex items-start gap-3 mb-4">
            <MessageSquare className="mt-1 flex-shrink-0 text-black" size={24} />
            <div>
              <h3 className="font-bold text-base mb-1">{t.harmonicaInterviewerName}</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                這是一位 AI 訪談者。它會問你幾個問題，依你說的內容深入追問，不會評價或說服你。你的想法會被客觀記錄為逐字稿，隨時可以停止或匯出。
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
              placeholder={t.harmonicaAliasPlaceholder}
              className="w-full md:w-80 border-2 border-black px-3 py-2 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>

          <button
            onClick={handleJoin}
            disabled={joining}
            className="px-6 py-2.5 bg-black text-white font-mono font-bold text-sm hover:bg-gray-800 disabled:opacity-50 shadow-[4px_4px_0_0_#00E5A3] active:translate-y-0.5"
          >
            {joining ? '正在進入訪談室…' : t.harmonicaStartButton}
          </button>
        </div>
      )}

      {/* Active Conversation Room */}
      {joined && conversation && (
        <div className="space-y-4 my-6">
          {/* Turn progress indicator */}
          <div className="flex items-center justify-between border-b-2 border-black pb-2 text-xs font-mono">
            <span className="font-bold">
              {t.harmonicaTurnProgress(conversation.turns, sessionData?.maxTurns || 6)}
            </span>
            <div className="w-32 bg-gray-200 border border-black h-2.5 overflow-hidden">
              <div
                className="bg-[#00E5A3] h-full transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    (conversation.turns / (sessionData?.maxTurns || 6)) * 100
                  )}%`,
                }}
              />
            </div>
          </div>

          {/* Messages list */}
          <div className="border-2 border-black p-4 md:p-6 bg-[#FAF9F5] max-h-[500px] overflow-y-auto space-y-4">
            {conversation.messages.map((msg, i) => {
              const isInterviewer = msg.role === 'interviewer';
              return (
                <div
                  key={i}
                  className={`flex flex-col ${isInterviewer ? 'items-start' : 'items-end'}`}
                >
                  <span className="text-[11px] font-mono font-bold text-gray-500 mb-1">
                    {isInterviewer
                      ? t.harmonicaInterviewerName
                      : `${conversation.alias || t.userLabel}`}
                  </span>
                  <div
                    className={`max-w-[85%] p-4 text-sm font-sans leading-relaxed border-2 border-black ${
                      isInterviewer
                        ? 'bg-white shadow-[3px_3px_0_0_#00C2FF]'
                        : 'bg-[#FFF1A6] shadow-[3px_3px_0_0_#000]'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {sending && (
              <div className="flex items-center gap-2 text-xs font-mono text-gray-500 py-2">
                <Sparkles className="animate-spin text-black" size={14} />
                <span>{t.harmonicaThinking}</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Error notice */}
          {sendError && (
            <div className="p-3 bg-red-100 border-2 border-red-500 text-xs font-mono text-red-800">
              ⚠️ {sendError}
            </div>
          )}

          {/* Input Form or Done Banner */}
          {!conversation.done ? (
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    handleSendMessage(e);
                  }
                }}
                disabled={sending}
                placeholder="說說你的真實想法與考量… (Ctrl+Enter 送出)"
                rows={2}
                className="flex-1 border-2 border-black p-3 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-black disabled:bg-gray-100"
              />
              <button
                type="submit"
                disabled={sending || !inputText.trim()}
                className="px-5 bg-black text-white border-2 border-black font-mono font-bold text-sm hover:bg-gray-800 disabled:opacity-40 flex items-center justify-center gap-1 shadow-[3px_3px_0_0_#00E5A3]"
              >
                <Send size={16} />
                <span>{t.sendButton}</span>
              </button>
            </form>
          ) : (
            <div className="border-4 border-[#00E5A3] bg-[#E8FFF7] p-6 text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-green-800 font-bold text-lg">
                <CheckCircle2 size={24} />
                <span>{t.harmonicaDoneTitle}</span>
              </div>
              <p className="text-sm font-sans text-gray-700 max-w-xl mx-auto">
                {t.harmonicaDoneDesc}
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <button
                  onClick={exportCsv}
                  className="flex items-center gap-1.5 px-4 py-2 bg-black text-white font-mono font-bold text-xs hover:bg-gray-800"
                >
                  <Download size={14} />
                  {t.harmonicaExportCsv}
                </button>
                <button
                  onClick={exportJson}
                  className="flex items-center gap-1.5 px-4 py-2 bg-white text-black border-2 border-black font-mono font-bold text-xs hover:bg-gray-100"
                >
                  <Download size={14} />
                  {t.harmonicaExportJson}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Model footer badge */}
      <div className="mt-8 pt-4 border-t-2 border-dashed border-gray-300 flex items-center justify-between text-[11px] font-mono text-gray-500">
        <span>{t.harmonicaModelNotice}</span>
        {sessionData?.sessionId && (
          <a
            href={`https://harmonica.mashbean.net/s/${sessionData.sessionId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline flex items-center gap-1 text-black font-bold"
          >
            <span>開啟獨立訪談網頁</span>
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* Create New Interview Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border-4 border-black p-6 md:p-8 max-w-2xl w-full shadow-[12px_12px_0_0_#000] max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-black mb-4 border-b-2 border-black pb-2">
              {t.harmonicaCreateTitle}
            </h3>

            {createSuccessMsg ? (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border-2 border-green-600 text-green-900 text-sm font-mono">
                  ✅ 訪談建立成功！已自動切換為當前訪談會話。
                </div>
                <div className="space-y-2 text-xs font-mono">
                  <p>
                    <strong>參與者公開連結：</strong>
                    <br />
                    <a
                      href={createSuccessMsg.participateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline break-all"
                    >
                      {createSuccessMsg.participateUrl}
                    </a>
                  </p>
                  {createSuccessMsg.adminUrl && (
                    <p className="bg-[#FFFBEB] p-2 border border-black">
                      <strong>主辦者管理連結（只顯示這一次，含匯出與管理權限）：</strong>
                      <br />
                      <a
                        href={createSuccessMsg.adminUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-800 underline break-all"
                      >
                        {createSuccessMsg.adminUrl}
                      </a>
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="w-full py-2 bg-black text-white font-mono font-bold text-sm"
                >
                  開始訪談
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreateSession} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono font-bold uppercase mb-1">
                    {t.harmonicaCreateTopicLabel}
                  </label>
                  <input
                    type="text"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                    required
                    className="w-full border-2 border-black px-3 py-2 text-sm font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold uppercase mb-1">
                    {t.harmonicaCreateGoalLabel}
                  </label>
                  <textarea
                    value={newGoal}
                    onChange={(e) => setNewGoal(e.target.value)}
                    required
                    rows={2}
                    className="w-full border-2 border-black px-3 py-2 text-sm font-sans"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-mono font-bold uppercase">
                      {t.harmonicaCreateQuestionsLabel}
                    </label>
                    <button
                      type="button"
                      onClick={handleAutoFillCruxes}
                      className="text-xs font-mono text-blue-700 hover:underline flex items-center gap-1 font-bold"
                    >
                      <Sparkles size={12} />
                      {t.harmonicaCruxAutoFill}
                    </button>
                  </div>
                  <textarea
                    value={newQuestions.join('\n')}
                    onChange={(e) => setNewQuestions(e.target.value.split('\n'))}
                    required
                    rows={4}
                    placeholder="每行一個問題"
                    className="w-full border-2 border-black px-3 py-2 text-sm font-sans"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t-2 border-black">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 border-2 border-black font-mono font-bold text-sm hover:bg-gray-100"
                  >
                    {t.harmonicaCreateCancel}
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-6 py-2 bg-black text-white font-mono font-bold text-sm hover:bg-gray-800 disabled:opacity-50"
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
