import { generateGeminiContent } from './geminiService';

interface ClassifiedEmail {
  category: 'salary' | 'emi' | 'bill' | 'renewal' | 'notice' | 'approval' | 'other';
  amount: number | null;
  dueDate: string | null;
  summary: string;
  isFinancial: boolean;
}

export async function classifyEmail(email: { subject: string; body: string; from: string }): Promise<ClassifiedEmail> {
  const prompt = `Classify this email into exactly one category and extract structured data.

Categories: salary, emi, bill, renewal, notice, approval, other

Email from: ${email.from}
Subject: ${email.subject}
Body: ${email.body}

Respond ONLY with valid JSON in this exact format:
{
  "category": "one of the categories above",
  "amount": number or null,
  "dueDate": "YYYY-MM-DD or null",
  "summary": "one sentence summary",
  "isFinancial": true or false
}`;

  const text = await generateGeminiContent(prompt, {
    responseMimeType: 'application/json',
    model: 'gemini-3-flash-preview',
  });

  return JSON.parse(text || '{}');
}

export async function classifyAllEmails(emails: typeof import('../data/mockEmails').mockEmails) {
  const results = [];
  for (const email of emails) {
    const classified = await classifyEmail(email);
    results.push({ ...email, ...classified });
  }
  return results;
}
