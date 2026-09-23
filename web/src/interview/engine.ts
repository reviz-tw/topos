import {
  HarmonicaSession,
  HarmonicaMessage,
  HarmonicaConversation,
  HarmonicaHostView,
  HarmonicaSessionRef,
  CreateHarmonicaSessionPayload,
} from '../types';

export const PROMPT_MAX_BYTES = 6000;
export const DEFAULT_MAX_TURNS = 6;
export const MAX_TURNS_CAP = 10;
export const DEFAULT_MAX_PARTICIPANTS = 20;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function utf8ByteLength(text: string): number {
  return encoder.encode(text).length;
}

export function truncateUtf8(text: string, maxBytes: number): string {
  if (maxBytes <= 0) return '';
  const bytes = encoder.encode(text);
  if (bytes.length <= maxBytes) return text;
  let end = maxBytes;
  while (end > 0 && ((bytes[end] ?? 0) & 0b1100_0000) === 0b1000_0000) end -= 1;
  return decoder.decode(bytes.slice(0, end));
}

export function cleanLine(value: unknown, max = 240): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export function cleanText(value: unknown, max = 1000): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

export function cleanReply(text: string, max = 600): string {
  const cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^\s*(Interviewer|訪談者|AI|助手)[:：]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return truncateUtf8(cleaned, max * 3).slice(0, max) || '謝謝你分享，可以再多聊聊具體的考量嗎？';
}

export function normalizeSettings(raw: Partial<CreateHarmonicaSessionPayload>): CreateHarmonicaSessionPayload {
  const topic = cleanLine(raw.topic, 120);
  const goal = cleanText(raw.goal, 500);
  if (!topic) throw new Error('先幫這輪訪談取一個名字');
  if (!goal) throw new Error('請說明希望這輪訪談理解什麼');

  const questions = (Array.isArray(raw.questions) ? raw.questions : [])
    .map((q) => cleanLine(q, 240))
    .filter(Boolean)
    .slice(0, 8);
  if (questions.length === 0) throw new Error('至少給一個起始問題');

  const language = raw.language === 'en' ? 'en' : 'zh-Hant';
  const maxTurns = Math.min(MAX_TURNS_CAP, Math.max(2, raw.maxTurns || DEFAULT_MAX_TURNS));
  const maxParticipants = Math.min(100, Math.max(1, raw.maxParticipants || DEFAULT_MAX_PARTICIPANTS));

  return {
    topic,
    goal,
    context: cleanText(raw.context, 1000),
    critical: cleanText(raw.critical, 500),
    questions,
    language,
    maxTurns,
    maxParticipants,
    askAlias: raw.askAlias !== false,
  };
}

export function openingMessage(settings: CreateHarmonicaSessionPayload): string {
  const first = settings.questions[0] ?? '';
  if (settings.language === 'en') {
    return `Thanks for joining this conversation about "${settings.topic}". ${settings.goal} I'll ask a few questions and follow up on what you say; there are no right answers, and you can stop at any time. To start: ${first}`;
  }
  return `謝謝你參加這輪關於「${settings.topic}」的對話。${settings.goal}我會問幾個問題，並依你說的內容追問；沒有標準答案，隨時可以停。先從這個開始：${first}`;
}

export function buildSystemPrompt(settings: CreateHarmonicaSessionPayload): string {
  const lines = [
    'You are a warm, neutral interviewer for a public consultation. You listen, ask one question at a time, and follow up on concrete experiences, reasons and trade-offs the participant mentions.',
    `Topic: ${settings.topic}`,
    `What the organizer wants to understand: ${settings.goal}`,
    settings.context ? `Background: ${settings.context}` : '',
    settings.critical ? `Voices or issues that must not be missed: ${settings.critical}` : '',
    `Starter questions, in order: ${settings.questions.map((q, i) => `${i + 1}. ${q}`).join(' ')}`,
    'Rules: never argue, evaluate or persuade; do not add facts of your own; reflect briefly what you heard, then ask exactly one question (a follow-up on something specific, or the next starter question when the current one feels answered). Keep each reply under 90 words.',
    settings.language === 'en'
      ? 'Write in English. Reply with plain text only: no lists, no markdown, no preamble.'
      : 'Write in Traditional Chinese as used in Taiwan (zh-Hant-TW). Reply with plain text only: no lists, no markdown, no preamble.',
  ];
  return lines.filter(Boolean).join('\n');
}

export function buildUserPrompt(
  settings: CreateHarmonicaSessionPayload,
  messages: HarmonicaMessage[],
  latest: string,
  turn: number,
  asked: number
): string {
  const remaining = settings.questions.slice(asked);
  const isFinal = turn >= settings.maxTurns;
  const tail = [
    `Turn ${turn} of ${settings.maxTurns}.`,
    isFinal
      ? 'FINAL TURN: thank the participant, reflect the most important thing they said in one sentence, and close without asking anything.'
      : remaining.length > 0
      ? `Next starter question to ask when the current one feels answered: ${remaining[0]}`
      : 'All starter questions have been asked; follow up on what matters most to them, or gently close if they seem done.',
    `Participant just said: ${latest}`,
  ].join('\n');

  const budget = PROMPT_MAX_BYTES - utf8ByteLength(tail) - 40;
  const transcript: string[] = [];
  let used = 0;

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    const line = `${m.role === 'interviewer' ? 'Interviewer' : 'Participant'}: ${m.text}`;
    const bytes = utf8ByteLength(line) + 1;
    if (used + bytes > budget) break;
    transcript.unshift(line);
    used += bytes;
  }

  return `Conversation so far:\n${transcript.length > 0 ? transcript.join('\n') : '(none)'}\n\n${tail}`;
}

export function generateLocalReply(
  settings: CreateHarmonicaSessionPayload,
  _latestText: string,
  turn: number,
  isFinal: boolean
): string {
  if (isFinal) {
    if (settings.language === 'en') {
      return 'Thank you very much for taking the time to share your perspective. Your input has been recorded and will be summarized for public deliberation.';
    }
    return '非常感謝您撥冗分享寶貴的想法。您的多元觀點已被客觀記錄，將作為公共審議與政策評估的重要參考。訪談在此圓滿結束！';
  }

  // If next question exists, ask it
  if (turn - 1 < settings.questions.length) {
    const nextQ = settings.questions[turn - 1];
    if (settings.language === 'en') {
      return `Thank you for sharing that. Following up on your points: ${nextQ}`;
    }
    return `謝謝您的具體說明。延續剛才的話題，想請教您：${nextQ}`;
  }

  if (settings.language === 'en') {
    return 'That makes a lot of sense. Could you elaborate a bit more on what specific conditions or priorities matter most to you?';
  }
  return '理解您的考量。在剛才提到的內容中，您認為最重要的優先順序或關鍵配套會是什麼？';
}

export function formatTTTCCsv(session: HarmonicaSession, conversations: HarmonicaConversation[]): string {
  const lines = ['id,interview,comment'];
  let id = 1;

  for (const conv of conversations) {
    const alias = conv.alias || `Participant_${conv.participant}`;
    const interview = `"${session.topic} (${alias})".replace(/"/g, '""')`;
    for (const msg of conv.messages) {
      if (msg.role === 'participant' && msg.text.trim()) {
        const escapedComment = `"${msg.text.replace(/"/g, '""')}"`;
        lines.push(`${id},${interview},${escapedComment}`);
        id++;
      }
    }
  }

  return lines.join('\n');
}

export function formatTranscriptsJson(session: HarmonicaSession, conversations: HarmonicaConversation[]): string {
  return JSON.stringify(
    {
      session,
      exportedAt: Date.now(),
      conversations,
    },
    null,
    2
  );
}

// Client-side LocalStorage repository for native Harmonica sessions
export class HarmonicaLocalStore {
  private static PREFIX = 'topos:native_harmonica';

  static getTopicSessions(topicId: string): HarmonicaSessionRef[] {
    try {
      const raw = localStorage.getItem(`${this.PREFIX}:topic_sessions:${topicId}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (_) {}

    // Pre-seeded defaults
    if (topicId === 'nuclear4') {
      return [
        {
          sessionId: '6o0ryapw2o',
          title: '核電重啟公眾訪談',
          goal: '測試與收集核電重啟之條件、顧慮與多元考量',
          url: '/s/6o0ryapw2o',
          isDefault: true,
          createdAt: 1790167501,
        },
      ];
    }

    if (topicId === 'sports-station') {
      return [
        {
          sessionId: 'sports-int-1',
          title: '運動驛站公眾訪談',
          goal: '探討公眾對捷運站盥洗寄物設施之需求、衛生管理與預算自償考量',
          url: '/s/sports-int-1',
          isDefault: true,
          createdAt: 1790167501,
        },
      ];
    }

    if (topicId === 'control-yuan') {
      return [
        {
          sessionId: 'cy-voices-01',
          title: '監察與考試權公眾訪談',
          goal: '理解民眾對監察權、考試權存廢的經驗、擔憂與期待。',
          url: '/s/cy-voices-01',
          isDefault: true,
          createdAt: 1790170000,
        },
      ];
    }

    return [];
  }

  static addTopicSession(topicId: string, ref: HarmonicaSessionRef): void {
    const list = this.getTopicSessions(topicId);
    const filtered = list.filter((s) => s.sessionId !== ref.sessionId);
    const updated = [ref, ...filtered];
    try {
      localStorage.setItem(`${this.PREFIX}:topic_sessions:${topicId}`, JSON.stringify(updated));
    } catch (_) {}
  }

  static getSession(sessionId: string): HarmonicaSession | null {
    try {
      const raw = localStorage.getItem(`${this.PREFIX}:session:${sessionId}`);
      if (raw) return JSON.parse(raw);
    } catch (_) {}

    // Pre-seeded defaults
    if (sessionId === '6o0ryapw2o') {
      return {
        sessionId: '6o0ryapw2o',
        topic: '核電重啟公眾訪談',
        goal: '測試與收集核電重啟之條件、顧慮與多元考量。',
        context: '探討台灣能源轉型與核四重啟之關鍵爭點與各方考量。',
        questions: [
          '對於核電重啟，你的基本立場是什麼？最在意的是哪一點？',
          '如果真的要重啟，你認為必須先滿足哪些條件？',
          '核廢料該怎麼處理，你心中有能接受的做法嗎？',
        ],
        language: 'zh-Hant',
        status: 'open',
        maxTurns: 6,
        maxParticipants: 50,
        askAlias: true,
        participants: 2,
        completed: 1,
        model: '@cf/google/gemma-4-26b-a4b-it',
        adminToken: 'admin-nuclear4-topos',
      };
    }

    if (sessionId === 'sports-int-1') {
      return {
        sessionId: 'sports-int-1',
        topic: '運動驛站市民訪談',
        goal: '探討公眾對捷運站盥洗寄物設施之需求、衛生管理與預算自償考量',
        context: '台北市長選舉市政政見討論，平衡運動友善與公共治安。',
        questions: [
          '您平日在捷運站或登山口有淋浴更衣的需求嗎？',
          '您認為此類設施應由公帑全額負擔，或採使用者付費？',
          '如何兼顧公共衛生、隱私防偷拍與深夜維安？',
        ],
        language: 'zh-Hant',
        status: 'open',
        maxTurns: 6,
        maxParticipants: 50,
        askAlias: true,
        participants: 0,
        completed: 0,
        model: '@cf/google/gemma-4-26b-a4b-it',
        adminToken: 'admin-sports-topos',
      };
    }

    if (sessionId === 'cy-voices-01') {
      return {
        sessionId: 'cy-voices-01',
        topic: '監察與考試權公眾訪談',
        goal: '理解民眾對監察權、考試權存廢的經驗、擔憂與期待。',
        context: '五權憲法架構在現代民主體制的運作困境、彈劾與調查權歸屬。',
        questions: [
          '你對監察院或考試院的印象是什麼？有沒有具體經驗？',
          '如果彈劾與調查權移到國會，你最擔心什麼？',
          '什麼樣的制度設計，會讓你覺得監督是可信的？',
        ],
        language: 'zh-Hant',
        status: 'open',
        maxTurns: 5,
        maxParticipants: 50,
        askAlias: true,
        participants: 0,
        completed: 0,
        model: '@cf/google/gemma-4-26b-a4b-it',
        adminToken: 'admin-cy-topos',
      };
    }

    return null;
  }

  static saveSession(session: HarmonicaSession): void {
    try {
      localStorage.setItem(`${this.PREFIX}:session:${session.sessionId}`, JSON.stringify(session));
    } catch (_) {}
  }

  static getConversations(sessionId: string): HarmonicaConversation[] {
    try {
      const raw = localStorage.getItem(`${this.PREFIX}:conversations:${sessionId}`);
      if (raw) return JSON.parse(raw);
    } catch (_) {}

    if (sessionId === '6o0ryapw2o') {
      return [
        {
          participant: 1,
          alias: '新北通勤族',
          turns: 2,
          done: false,
          messages: [
            { role: 'interviewer', text: '你好，新北通勤族！謝謝你願意聊聊「核電重啟公眾訪談」。\n\n第一個問題：對於核電重啟，你的基本立場是什麼？最在意的是哪一點？' },
            { role: 'participant', text: '我其實不反對，但住在北部，最擔心的是真的出事的時候疏散怎麼辦。' },
            { role: 'interviewer', text: '你提到「疏散怎麼辦」——可以多說一點嗎？是什麼經驗或資訊讓你這樣想？' },
            { role: 'participant', text: '福島那時候的畫面吧。新北人口這麼多，塞車就走不了。' },
            { role: 'interviewer', text: '了解，謝謝你。換個角度：如果真的要重啟，你認為必須先滿足哪些條件？' },
          ],
        },
        {
          participant: 2,
          alias: '南部家長',
          turns: 6,
          done: true,
          messages: [
            { role: 'interviewer', text: '你好，南部家長！謝謝你願意聊聊「核電重啟公眾訪談」。\n\n第一個問題：對於核電重啟，你的基本立場是什麼？最在意的是哪一點？' },
            { role: 'participant', text: '我比較支持，因為中南部空污真的很嚴重，孩子常常咳嗽。' },
            { role: 'interviewer', text: '謝謝你花時間把想法說清楚。這些內容會被整理成逐字稿，納入審議分析。如果還有想補充的，隨時可以再開一輪。' },
          ],
        },
      ];
    }

    return [];
  }

  static saveConversations(sessionId: string, convs: HarmonicaConversation[]): void {
    try {
      localStorage.setItem(`${this.PREFIX}:conversations:${sessionId}`, JSON.stringify(convs));
    } catch (_) {}
  }

  static getParticipantConversation(sessionId: string, participantId: string): HarmonicaConversation | null {
    try {
      const raw = localStorage.getItem(`${this.PREFIX}:user_conv:${sessionId}:${participantId}`);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  static saveParticipantConversation(
    sessionId: string,
    participantId: string,
    conv: HarmonicaConversation
  ): void {
    try {
      localStorage.setItem(`${this.PREFIX}:user_conv:${sessionId}:${participantId}`, JSON.stringify(conv));
    } catch (_) {}

    // Also update overall conversations for this session
    const list = this.getConversations(sessionId);
    const idx = list.findIndex((c) => c.participant === conv.participant);
    if (idx >= 0) {
      list[idx] = conv;
    } else {
      list.push(conv);
    }
    this.saveConversations(sessionId, list);

    // Update session participant counters
    const session = this.getSession(sessionId);
    if (session) {
      session.participants = list.length;
      session.completed = list.filter((c) => c.done).length;
      this.saveSession(session);
    }
  }

  static getHostView(sessionId: string): HarmonicaHostView | null {
    const session = this.getSession(sessionId);
    if (!session) return null;
    const conversations = this.getConversations(sessionId);

    const summaries = conversations.map((c) => ({
      participant: c.participant,
      alias: c.alias,
      turns: c.turns,
      done: c.done,
      messages: c.messages.length,
      updatedAt: c.updatedAt,
      lastMessage: c.messages.length > 0 ? c.messages[c.messages.length - 1].text : '',
    }));

    return {
      ...session,
      conversations,
      summaries,
    };
  }
}
