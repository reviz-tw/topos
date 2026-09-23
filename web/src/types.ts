export interface Topic {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  keyCruxes: Crux[];
  harmonicaSessions?: HarmonicaSessionRef[];
}

export interface HarmonicaSessionRef {
  sessionId: string;
  title: string;
  goal?: string;
  url?: string;
  isDefault?: boolean;
  createdAt?: number;
}

export interface HarmonicaSession {
  sessionId: string;
  topic: string;
  goal: string;
  context?: string;
  questions: string[];
  language?: string;
  status: 'open' | 'closed' | 'deleted';
  maxTurns: number;
  maxParticipants: number;
  askAlias: boolean;
  participants?: number;
  completed?: number;
  model?: string;
  adminToken?: string;
}

export interface HarmonicaMessage {
  seq?: number;
  role: 'interviewer' | 'participant';
  text: string;
  at?: number;
}

export interface HarmonicaConversation {
  participant: number;
  alias?: string;
  turns: number;
  done: boolean;
  messages: HarmonicaMessage[];
  updatedAt?: number;
}

export interface HostConversationSummary {
  participant: number;
  alias?: string;
  turns: number;
  done: boolean;
  messages: number;
  updatedAt?: number;
  lastMessage?: string;
}

export interface HarmonicaHostView extends HarmonicaSession {
  conversations: HarmonicaConversation[];
  summaries?: HostConversationSummary[];
}

export interface CreateHarmonicaSessionPayload {
  topic: string;
  goal: string;
  context?: string;
  critical?: string;
  questions: string[];
  language: string;
  maxTurns: number;
  maxParticipants: number;
  askAlias: boolean;
}

export interface Crux {
  title: string;
  description: string;
  proPoints?: string[];
  conPoints?: string[];
  pro?: string[];
  con?: string[];
}

export interface HistorySession {
  id: string;
  dateLabel: string;
  firstQuestion: string;
  messages: ChatMessage[];
}

export interface Citation {
  sourceTitle: string;
  excerpt: string;
  url?: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  citations?: Citation[];
}

export interface UserProfile {
  name: string;
  email: string;
  picture?: string;
  token: string;
}
