import supabase from '../lib/supabase';
import { generateGeminiContent } from './geminiService';
import { detectAnomalies, getUpcomingObligations } from './financialTimelineService';

export async function generateFinancialHealthSnapshot(userId: string) {
  // a) fetch the last 90 days of email_events
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const { data: events, error } = await supabase
    .from('email_events')
    .select('*')
    .eq('user_id', userId)
    .gte('received_at', ninetyDaysAgo.toISOString());

  if (error || !events) {
    console.error('[financialHealthService] Failed to fetch events:', error);
    return null;
  }

  // b) group by category and calculate totals
  const categoryTotals: Record<string, number> = {};
  for (const event of events) {
    if (!event.category) continue;
    const amount = event.amount ? Number(event.amount) : 0;
    categoryTotals[event.category] = (categoryTotals[event.category] || 0) + amount;
  }

  // c) detect upcoming obligations (due in 30 days)
  const upcomingObligations = await getUpcomingObligations(userId);

  // d) run anomaly detection
  const anomalies = await detectAnomalies(userId);

  // e) send all this as context to Gemini
  const context = JSON.stringify({
    categoryTotals,
    upcomingObligations: upcomingObligations.map((o: any) => ({
      category: o.category,
      amount: o.amount,
      due_date: o.due_date,
      subject: o.subject
    })),
    anomalies
  }, null, 2);

  const prompt = `Based on these financial events for the last 90 days, generate: 1) a health_score from 0-100 based on cash flow, obligations, and anomalies, 2) a 2-sentence summary of the user financial situation, 3) up to 3 specific actionable recommendations as an array of strings, 4) list upcoming obligations as array of {description, due_date, amount}. Return as JSON only with keys: health_score, summary, recommendations, upcoming_obligations.

Context:
${context}`;

  const geminiResponseText = await generateGeminiContent(prompt, {
    model: 'gemini-3-flash-preview',
    responseMimeType: 'application/json'
  });

  let snapshotData;
  try {
    snapshotData = JSON.parse(geminiResponseText);
  } catch (err) {
    console.error('[financialHealthService] Failed to parse Gemini response:', err);
    return null;
  }

  // f) Save the result to financial_health_snapshots table
  const { data: snapshot, error: insertError } = await supabase
    .from('financial_health_snapshots')
    .insert({
      user_id: userId,
      health_score: snapshotData.health_score,
      summary: snapshotData.summary,
      recommendations: snapshotData.recommendations,
      upcoming_obligations: snapshotData.upcoming_obligations,
      anomalies: anomalies,
      generated_at: new Date().toISOString()
    })
    .select()
    .single();

  if (insertError) {
    console.error('[financialHealthService] Failed to save snapshot:', insertError);
    // Return the data anyway even if save fails
    return snapshotData;
  }

  // g) Return the snapshot
  return snapshot;
}

export async function getLatestSnapshot(userId: string) {
  // Fetch the most recent row
  const { data, error } = await supabase
    .from('financial_health_snapshots')
    .select('*')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  const now = new Date();
  
  if (error || !data) {
    // If not found or error, generate it
    return await generateFinancialHealthSnapshot(userId);
  }

  const generatedAt = new Date(data.generated_at);
  const diffHours = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60);

  // If older than 24 hours, generate a new one
  if (diffHours > 24) {
    return await generateFinancialHealthSnapshot(userId);
  }

  return data;
}
