/**
 * Meenakshi — Financial Timeline Service
 * =======================================
 * Fetches and formats email events from Supabase to render in the Wealth screen.
 */

import supabase from '../lib/supabase';

export interface TimelineEvent {
  id: string;
  date: string;       // Formatted date (e.g. "Jun 18")
  title: string;      // Human-readable title
  subtitle: string;   // e.g. "HDFC Bank • Due Jun 20"
  amount: string;     // Formatted amount text with currency (e.g. "+₹85,000.00")
  description: string;// AI summary
  icon: string;       // Category-based emoji
  type: 'credit' | 'debit';
  category: string;
  rawDate: string;
}

const CATEGORY_STYLES: Record<string, { icon: string; type: 'credit' | 'debit'; label: string }> = {
  salary: { icon: '💰', type: 'credit', label: 'Salary Credit' },
  emi: { icon: '🏠', type: 'debit', label: 'EMI Reminder' },
  credit_card: { icon: '💳', type: 'debit', label: 'Credit Card' },
  insurance: { icon: '🛡️', type: 'debit', label: 'Insurance Premium' },
  tax: { icon: '🏛️', type: 'debit', label: 'Tax' },
  investment: { icon: '📈', type: 'debit', label: 'Investment' },
  loan: { icon: '🏦', type: 'credit', label: 'Loan' },
  bill: { icon: '🧾', type: 'debit', label: 'Bill' },
  renewal: { icon: '🔄', type: 'debit', label: 'Renewal' },
  notice: { icon: '⚠️', type: 'debit', label: 'Official Notice' },
  approval: { icon: '✅', type: 'credit', label: 'Approval' },
  other: { icon: '✉️', type: 'debit', label: 'Update' },
};

/**
 * Fetch and format email events for the Wealth Timeline.
 */
export async function getFinancialEvents(categoryFilter = 'all'): Promise<TimelineEvent[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from('email_events')
    .select('id, received_at, category, amount, due_date, subject, ai_summary, sender_name, entity_email_links(entities(name))')
    .eq('user_id', user.id)
    .eq('is_duplicate', false);

  if (categoryFilter && categoryFilter !== 'all') {
    query = query.eq('category', categoryFilter.toLowerCase());
  } else {
    // Default to showing core financial categories on the Wealth timeline
    query = query.in('category', ['salary', 'emi', 'credit_card', 'insurance', 'tax', 'investment', 'loan', 'bill', 'renewal', 'notice', 'approval']);
  }

  const { data: events, error } = await query
    .order('received_at', { ascending: false })
    .limit(50);

  if (error || !events) {
    console.error('[financialTimelineService] Failed to load email events:', error);
    return [];
  }

  return events.map((event: any) => {
    const style = CATEGORY_STYLES[event.category] || { icon: '✉️', type: 'debit', label: 'Notification' };
    
    // Group received_at date
    const dateObj = new Date(event.received_at);
    const dateText = dateObj.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    });

    const amountVal = event.amount ? Number(event.amount) : 0;
    const amountText = amountVal > 0 
      ? `${style.type === 'credit' ? '+' : '-'}\u20B9${amountVal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` 
      : '';

    // Build subtitle combining Bank and Due Dates
    const subtitleParts = [];
    const entityName = event.entity_email_links?.[0]?.entities?.name || event.sender_name;
    if (entityName) {
      subtitleParts.push(entityName);
    }
    
    if (event.due_date) {
      const dueObj = new Date(event.due_date);
      const dueText = dueObj.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });
      subtitleParts.push(`Due ${dueText}`);
    }

    return {
      id: event.id,
      date: dateText,
      title: style.label,
      subtitle: subtitleParts.join(' • ') || 'Email Update',
      amount: amountText,
      description: event.ai_summary || event.subject || 'No summary available.',
      icon: style.icon,
      type: style.type,
      category: event.category,
      rawDate: event.received_at,
    };
  });
}

export async function getFinancialTimeline(userId: string, limit: number = 50) {
  const { data, error } = await supabase
    .from('email_events')
    .select('*')
    .eq('user_id', userId)
    .order('received_at', { ascending: false })
    .limit(limit);

  if (error || !data) {
    console.error('[financialTimelineService] getFinancialTimeline error:', error);
    return [];
  }

  const grouped: Record<string, any[]> = {};
  for (const event of data) {
    const date = new Date(event.received_at);
    const month = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    if (!grouped[month]) grouped[month] = [];
    grouped[month].push(event);
  }

  return Object.keys(grouped).map(month => ({
    month,
    events: grouped[month]
  }));
}

export async function getUpcomingObligations(userId: string) {
  const now = new Date();
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data, error } = await supabase
    .from('email_events')
    .select('*')
    .eq('user_id', userId)
    .neq('status', 'paid')
    .gte('due_date', now.toISOString())
    .lte('due_date', next30Days.toISOString())
    .order('due_date', { ascending: true });

  if (error || !data) {
    console.error('[financialTimelineService] getUpcomingObligations error:', error);
    return [];
  }

  return data;
}

export async function detectAnomalies(userId: string) {
  const anomalies: { type: string; description: string; event_id: string; severity: 'high' | 'medium' | 'low' }[] = [];

  const { data, error } = await supabase
    .from('email_events')
    .select('*')
    .eq('user_id', userId)
    .order('received_at', { ascending: false });

  if (error || !data) {
    console.error('[financialTimelineService] detectAnomalies error:', error);
    return anomalies;
  }

  const now = new Date();

  // Check rules
  for (let i = 0; i < data.length; i++) {
    const event = data[i];

    // a) Amount > 1,00,000
    if (event.amount && Number(event.amount) > 100000) {
      anomalies.push({
        type: 'large_transaction',
        description: `Unusually large transaction detected: ₹${event.amount}`,
        event_id: event.id,
        severity: 'high'
      });
    }

    // c) EMI or bill passed due date
    if ((event.category === 'emi' || event.category === 'bill') && event.due_date && event.status !== 'paid') {
      const dueDate = new Date(event.due_date);
      if (dueDate < now) {
        anomalies.push({
          type: 'missed_payment',
          description: `Missed payment for ${event.category} due on ${event.due_date}`,
          event_id: event.id,
          severity: 'high'
        });
      }
    }
  }

  // b) Same category > 3 times in 7 days
  const categoryGroups: Record<string, any[]> = {};
  for (const event of data) {
    if (!event.category) continue;
    if (!categoryGroups[event.category]) categoryGroups[event.category] = [];
    categoryGroups[event.category].push(event);
  }

  for (const category in categoryGroups) {
    const events = categoryGroups[category];
    
    // Evaluate sliding window
    for (let i = 0; i < events.length; i++) {
      let count = 1;
      const start = new Date(events[i].received_at).getTime();
      for (let j = i + 1; j < events.length; j++) {
        const end = new Date(events[j].received_at).getTime();
        const diffDays = Math.abs(start - end) / (1000 * 60 * 60 * 24);
        if (diffDays <= 7) {
          count++;
        }
      }
      if (count > 3) {
        anomalies.push({
          type: 'high_frequency',
          description: `Category ${category} appeared ${count} times within 7 days`,
          event_id: events[i].id,
          severity: 'medium'
        });
        break; // Only report once per category per timeframe, simplify logic
      }
    }
  }

  return anomalies;
}
