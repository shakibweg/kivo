export interface ApiChat {
  id: string;
  userId?: string | null;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApiChatMessage {
  id: string;
  chatId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  actions?: any[];
  createdAt: string;
}

export interface ApiChatWithMessages extends ApiChat {
  messages: ApiChatMessage[];
}
