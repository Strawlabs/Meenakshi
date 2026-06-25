export const MEENAKSHI_SYSTEM_PROMPT = `
CORE IDENTITY:
You are "Meenakshi," a sophisticated, warm, and highly intelligent AI Personal Memory and Financial Assistant built for India.
You act as the user's second brain — helping them reason over their financial records (bank statements, bills, credit score reports, insurance) and personal professional history (emails, calendar meetings, business cards, contacts).
Never speak like a generic chatbot. Speak with natural human clarity, warmth, and professionalism, like a trusted friend who also happens to be a financial expert.

THE MEENAKSHI VOICE:
1. CLEAR & SIMPLE: Explain complex financial terms in plain, jargon-free English or Hinglish when appropriate.
2. SECURE & PRIVATE: Remind the user their data is encrypted and processed privately.
3. PROACTIVE & HELPFUL: Always orient towards next steps — scheduling payments, setting reminders, preparing follow-up replies, flagging risks early.
4. CONTEXT-AWARE: Reference past conversations and the user's financial context naturally.

INTERACTION RULES:
- Keep responses concise — usually 2-4 sentences for voice, up to a short paragraph for text.
- Offer actionable help but NEVER execute transactions, buy/sell stocks, or give certified investment advice.
- Use natural phrasing like "I noticed your credit card bill is due soon" or "Based on your salary pattern..."
- For financial questions, always add a note to consult a certified financial advisor for major decisions.
- You understand Indian financial products: SIP, CIBIL, EMI, HDFC, ICICI, Zerodha, Account Aggregator, UPI, etc.
`.trim();

export const MOCK_BRIEFINGS = [
  {
    id: 'b1',
    title: 'Credit Card Due in 4 Days',
    description: 'Your ICICI Amazon Pay bill of ₹18,720 is due. Shall I schedule a transfer from your savings account?',
    type: 'alert' as const,
    icon: 'bell',
    actionText: 'Schedule',
    secondaryText: 'Remind Later',
  },
  {
    id: 'b2',
    title: 'Rajesh Kumar Follow-up',
    description: "HDFC's Rajesh followed up on your home loan docs. I've drafted a reply — want to review it?",
    type: 'email' as const,
    icon: 'mail',
    actionText: 'Review Draft',
  },
  {
    id: 'b3',
    title: 'Insurance Renewal — 6 Days',
    description: 'HDFC Ergo health policy (₹15,450) renews Oct 24. Let me know if you want to compare plans.',
    type: 'alert' as const,
    icon: 'shield',
    actionText: 'Compare Plans',
    secondaryText: 'Renew Now',
  },
];

export const MOCK_TIMELINE = [
  {
    id: 't1',
    date: 'OCT 24',
    title: 'Insurance Renewal',
    description: 'HDFC Ergo policy renewal approaching',
    amount: 15450,
    type: 'alert' as const,
    category: 'Insurance',
    icon: 'shield',
  },
  {
    id: 't2',
    date: 'OCT 20',
    title: 'Home Loan EMI',
    description: 'HDFC Home Loan Auto-Debit',
    amount: 42500,
    type: 'debit' as const,
    category: 'Loan',
    icon: 'home',
  },
  {
    id: 't3',
    date: 'OCT 12',
    title: 'Credit Card Bill',
    description: 'ICICI Amazon Pay Statement Generated',
    amount: 18720,
    type: 'alert' as const,
    category: 'Card',
    icon: 'credit-card',
  },
  {
    id: 't4',
    date: 'OCT 05',
    title: 'Monthly SIP',
    description: 'Zerodha Coin Auto-Debit',
    amount: 10000,
    type: 'debit' as const,
    category: 'SIP',
    icon: 'trending-up',
  },
  {
    id: 't5',
    date: 'OCT 01',
    title: 'Salary Credited',
    description: 'Straw Labs Genesis Cohort 01',
    amount: 125000,
    type: 'credit' as const,
    category: 'Salary',
    icon: 'dollar-sign',
  },
];

export const MOCK_CONTACTS = [
  {
    id: 'c1',
    name: 'Rajesh Kumar',
    role: 'Home Loan Officer',
    company: 'HDFC Bank',
    lastInteraction: '2 days ago',
    initials: 'RK',
    color: '#7C3AED',
  },
  {
    id: 'c2',
    name: 'Priya Sharma',
    role: 'Financial Advisor',
    company: 'ICICI Securities',
    lastInteraction: '1 week ago',
    initials: 'PS',
    color: '#0EA5E9',
  },
  {
    id: 'c3',
    name: 'Vikram Nair',
    role: 'Insurance Agent',
    company: 'HDFC Ergo',
    lastInteraction: '3 weeks ago',
    initials: 'VN',
    color: '#10B981',
  },
];

export const SUGGESTED_PROMPTS = [
  'What do I need to know today?',
  'Explain my recent financial activity',
  'When is my next bill due?',
  'How is my CIBIL score?',
];
