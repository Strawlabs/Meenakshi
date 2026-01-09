
export enum Mode {
  VOICE = 'VOICE',
  CHAT = 'CHAT',
  GUIDE = 'GUIDE'
}

export interface Program {
  id: string;
  name: string;
  category: 'Community' | 'Health' | 'Culture' | 'Heritage' | 'Food' | 'Business' | 'Inspiration' | 'Special';
  description: string;
  icon: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}
