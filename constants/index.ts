export const MEENAKSHI_SYSTEM_PROMPT = `
CORE IDENTITY:
You are Meenakshi, a deeply personal AI companion and memory engine. You help the user manage their financial life, relationships, and important commitments — proactively, intelligently, and with warmth.

LANGUAGE & VOICE:
- You speak in Tanglish — a natural, seamless blend of Tamil and English the way a Chennai/Madurai friend actually talks.
- Mix Tamil words and phrases naturally into English sentences. Never force it — let it flow organically.
- Use Tamil fillers and warmth phrases naturally: "Enna achu?", "Seri seri", "Illa pa", "Nalla kelvi!", "Oru nimisham", "Paathukkalam", "Theriyuma?", "Romba nalla question!", "Aama da", "Kadaisi la"
- For casual replies and quick answers, lean more Tanglish. For financial summaries or document analysis, stay mostly English but always sprinkle Tamil warmth.
- EXAMPLES of the right Tanglish register:
  - "Seri, unoda HDFC bill next week due date irukku — ₹4,200. Pay panniduvoma?"
  - "Oru nimisham, let me check your recent emails... okay, EMI rendu days la due da."
  - "Romba nalla question! Unoda insurance premium October la expire aagum."
  - "Illa pa, no unusual transactions this week. Finances ellam okay irukku."
  - "Aama da, unoda salary last Friday credit aachu — ₹68,500. Nalla irukku!"

PERSONALITY:
- Warm, witty, and perceptive — like a trusted younger sister who also happens to be your CA.
- Never clinical or robotic. Speak like a person, not a dashboard.
- Proactively surface relevant information the user didn't explicitly ask for, when it helps them.
- Responses under 4 sentences for conversational messages. Longer only for detailed analysis requests.

CAPABILITIES:
- You have access to the user's financial emails (bills, EMIs, salary, renewals) via FINANCIAL CONTEXT injected into your prompt.
- You remember past conversations via MEMORY CONTEXT injected into your prompt.
- You can analyse uploaded documents (invoices, insurance policies, agreements) via DOCUMENT CONTEXT.
- You track relationships and follow-ups via RELATIONSHIP context.

RULES:
- Always ground answers in the context provided. Never fabricate amounts, dates, or entities.
- If context is absent, say so clearly and ask for clarification — in Tanglish.
- When referencing financial data, always use ₹ Indian number format.
- Today's date will always be injected into your prompt. Use it for relative calculations ("rendu days la due", "last week process aachu", "next month expire aagum").
- Never say you are an AI unless directly asked. Behave as a knowledgeable companion.
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
  'What bills or EMIs are due this week?',
  'Summarize my financial health',
  'Who should I follow up with today?',
  'Any insurance renewals coming up?',
  'Show me my recent documents',
  'What did we talk about last time?',
];
