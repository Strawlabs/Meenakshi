/**
 * Meenakshi — generate-weekly-digest
 * =====================================
 * Supabase Edge Function (Deno).
 * Scheduled weekly on Sunday at 6:00 PM IST (12:30 UTC) via pg_cron.
 *
 * Same structure as generate-daily-briefing but:
 * - Summarises past 7 days instead of yesterday only.
 * - briefing_type = 'weekly'.
 * - Prompt framing uses week-in-review language.
 */

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function makeDedupKey(category: string, sourceEventId: string | null): string {
  return `${category}:${sourceEventId ?? 'none'}`;
}

async function callGemini(prompt: string): Promise<Record<string, unknown> | null> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
    const json = await res.json();
    let raw: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    raw = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error('[generate-weekly-digest] Gemini parse error:', err);
    return null;
  }
}

async function sendExpoPush(tokens: string[], title: string, body: string): Promise<void> {
  if (tokens.length === 0) return;
  const messages = tokens.map((to) => ({ to, title, body, sound: 'default' }));
  try {
    await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error('[generate-weekly-digest] Expo push error:', err);
  }
}

Deno.serve(async (_req: Request) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // Active users: session in last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('user_id')
    .gte('created_at', thirtyDaysAgo);

  let userIds: string[] = [];
  if (sessErr || !sessions || sessions.length === 0) {
    const { data: users } = await supabase.auth.admin.listUsers();
    userIds = (users?.users ?? []).map((u: { id: string }) => u.id);
  } else {
    userIds = [...new Set<string>(sessions.map((s: { user_id: string }) => s.user_id))];
  }

  if (userIds.length === 0) {
    return new Response(JSON.stringify({ message: 'No active users found.' }), { status: 200 });
  }

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const results = { processed: 0, skipped: 0, errors: 0 };

  for (const userId of userIds) {
    try {
      // ── Past 7 days of email_events ──
      const { data: emailEvents } = await supabase
        .from('email_events')
        .select('id, category, subject, ai_summary, amount, due_date, sender_name, received_at')
        .eq('user_id', userId)
        .eq('is_duplicate', false)
        .gte('received_at', sevenDaysAgo.toISOString())
        .order('received_at', { ascending: false })
        .limit(50);

      // ── Latest financial_health_snapshot ──
      const { data: snapshot } = await supabase
        .from('financial_health_snapshots')
        .select('health_score, summary, recommendations, upcoming_obligations, anomalies')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // ── Pending follow-ups (overdue or due this week) ──
      let pendingFollowUps: unknown[] = [];
      try {
        const { data: followUps } = await supabase
          .from('follow_ups')
          .select('id, description, due_date, status, contacts(name)')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .lte('due_date', sevenDaysLater.toISOString());
        pendingFollowUps = followUps ?? [];
      } catch {
        // Safe skip
      }

      // ── Upcoming renewals in 7 days ──
      const { data: renewals } = await supabase
        .from('email_events')
        .select('id, subject, ai_summary, amount, due_date')
        .eq('user_id', userId)
        .eq('category', 'renewal')
        .eq('is_duplicate', false)
        .gte('due_date', now.toISOString())
        .lte('due_date', sevenDaysLater.toISOString());

      const context = JSON.stringify({
        weeklyEmailEvents: emailEvents ?? [],
        financialSnapshot: snapshot ?? null,
        pendingFollowUps,
        upcomingRenewals: renewals ?? [],
        weekPeriod: {
          from: sevenDaysAgo.toISOString(),
          to: now.toISOString(),
        },
      });

      const prompt = `Generate a weekly digest with a one-line headline summarising the past 7 days, and up to 4 sections (Financial, Relationships, Renewals, Opportunities), each with up to 3 short items. Use week-in-review framing — what happened, what's coming. Only include sections with real content — omit empty sections entirely. Return JSON only, no markdown fences, with keys: headline, sections: [{title, items}].

User context for the past week:
${context}`;

      const briefingData = await callGemini(prompt);
      if (!briefingData) {
        console.warn(`[generate-weekly-digest] Skipping user ${userId}: Gemini failed`);
        results.skipped++;
        continue;
      }

      // Insert into ai_briefings with type 'weekly'
      await supabase.from('ai_briefings').insert({
        user_id: userId,
        briefing_type: 'weekly',
        content: briefingData,
        generated_at: now.toISOString(),
      });

      // High-priority notifications (same logic as daily)
      const highPriorityItems: Array<{
        category: string;
        priority: string;
        title: string;
        body: string;
        sourceEventId: string | null;
      }> = [];

      const anomalies: unknown[] = (snapshot?.anomalies as unknown[]) ?? [];
      for (const anomaly of anomalies) {
        const a = anomaly as Record<string, unknown>;
        if (typeof a.amount === 'number' && a.amount > 100000) {
          highPriorityItems.push({
            category: 'financial_alert',
            priority: 'high',
            title: '⚠️ Large Financial Anomaly — Weekly Review',
            body: `₹${a.amount.toLocaleString('en-IN')} unusual transaction this week. ${a.description ?? ''}`.trim(),
            sourceEventId: (a.event_id as string) ?? null,
          });
        }
      }

      const overdueEvents = (emailEvents ?? []).filter((e: any) => {
        if (!e.due_date) return false;
        return new Date(e.due_date) < now && ['bill', 'emi', 'credit_card'].includes(e.category);
      });
      for (const e of overdueEvents) {
        highPriorityItems.push({
          category: 'financial_alert',
          priority: 'high',
          title: `🔴 Still Overdue: ${e.subject ?? e.category}`,
          body: e.ai_summary ?? `Overdue payment from ${e.sender_name ?? 'unknown'}`,
          sourceEventId: e.id,
        });
      }

      const urgentRenewals = (renewals ?? []).filter((r: any) => {
        if (!r.due_date) return false;
        return new Date(r.due_date) <= threeDaysLater;
      });
      for (const r of urgentRenewals) {
        highPriorityItems.push({
          category: 'renewal',
          priority: 'high',
          title: `🔄 Urgent Renewal: ${r.subject ?? 'Subscription'}`,
          body: r.ai_summary ?? `Renewal due by ${r.due_date}`,
          sourceEventId: r.id,
        });
      }

      if (highPriorityItems.length > 0) {
        const notifRows = highPriorityItems.map((item) => ({
          user_id: userId,
          category: item.category,
          priority: item.priority,
          title: item.title,
          body: item.body,
          source_event_id: item.sourceEventId,
          dedup_key: makeDedupKey(item.category, item.sourceEventId),
          created_at: now.toISOString(),
        }));

        await supabase
          .from('notifications')
          .upsert(notifRows, { onConflict: 'user_id,dedup_key', ignoreDuplicates: true });

        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('push_token')
          .eq('user_id', userId)
          .maybeSingle();

        if (prefs?.push_token) {
          await sendExpoPush(
            [prefs.push_token],
            '📅 Your Weekly Meenakshi Digest',
            highPriorityItems[0].title
          );
        }
      }

      results.processed++;
    } catch (err) {
      console.error(`[generate-weekly-digest] Error for user ${userId}:`, err);
      results.errors++;
    }
  }

  return new Response(
    JSON.stringify({ success: true, ...results }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
