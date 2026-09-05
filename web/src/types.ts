export interface Topic {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  keyCruxes: Crux[];
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
