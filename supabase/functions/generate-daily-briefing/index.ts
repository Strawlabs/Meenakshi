/**
 * Meenakshi — generate-daily-briefing
 * =====================================
 * Supabase Edge Function (Deno).
 * Scheduled daily at 7:00 AM IST (01:30 UTC) via pg_cron.
 *
 * For each active user (session in last 30 days):
 * 1. Pulls yesterday's email_events, latest financial_health_snapshot,
 *    relationship follow-ups due today, and renewals due in 7 days.
 * 2. Sends combined context to Gemini → generates structured briefing JSON.
 * 3. Inserts into ai_briefings (briefing_type = 'daily').
 * 4. For high-priority items, inserts into notifications with dedup.
 * 5. Sends Expo push notification to users with push_token.
 */

// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')!;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function isoDateOnly(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Deterministic dedup key: category:sourceEventId */
function makeDedupKey(category: string, sourceEventId: string | null): string {
  return `${category}:${sourceEventId ?? 'none'}`;
}

/** Call Gemini REST API with defensive JSON parsing */
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
    // Strip markdown fences if Gemini wraps them anyway
    raw = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    return JSON.parse(raw);
  } catch (err) {
    console.error('[generate-daily-briefing] Gemini parse error:', err);
    return null;
  }
}

/** Send Expo push notification (fire-and-forget, never crash batch) */
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
    console.error('[generate-daily-briefing] Expo push error:', err);
  }
}

// ────────────────────────────────────────────────────────────
// Main handler
// ────────────────────────────────────────────────────────────

Deno.serve(async (_req: Request) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // ── Step 1: Get active users (session in last 30 days) ──
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('user_id')
    .gte('created_at', thirtyDaysAgo);

  // Fallback: if sessions table not accessible, try auth.users directly
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
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const results = { processed: 0, skipped: 0, errors: 0 };

  for (const userId of userIds) {
    try {
      // ── Step 2a: Yesterday's email_events ──
      const { data: emailEvents } = await supabase
        .from('email_events')
        .select('id, category, subject, ai_summary, amount, due_date, sender_name')
        .eq('user_id', userId)
        .eq('is_duplicate', false)
        .gte('received_at', yesterdayStart.toISOString())
        .lt('received_at', todayStart.toISOString())
        .order('received_at', { ascending: false })
        .limit(20);

      // ── Step 2b: Latest financial_health_snapshot ──
      const { data: snapshot } = await supabase
        .from('financial_health_snapshots')
        .select('health_score, summary, recommendations, upcoming_obligations, anomalies')
        .eq('user_id', userId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // ── Step 2c: Follow-ups due today ──
      let followUpsDueToday: unknown[] = [];
      try {
        const { data: followUps } = await supabase
          .from('follow_ups')
          .select('id, description, due_date, contacts(name)')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .gte('due_date', isoDateOnly(todayStart))
          .lte('due_date', isoDateOnly(todayStart));
        followUpsDueToday = followUps ?? [];
      } catch {
        // Table may not exist yet — safe to skip
      }

      // ── Step 2d: Renewals due in next 7 days ──
      const { data: renewals } = await supabase
        .from('email_events')
        .select('id, subject, ai_summary, amount, due_date')
        .eq('user_id', userId)
        .eq('category', 'renewal')
        .eq('is_duplicate', false)
        .gte('due_date', now.toISOString())
        .lte('due_date', sevenDaysLater.toISOString());

      // ── Step 3: Build Gemini prompt ──
      const context = JSON.stringify({
        emailEventsYesterday: emailEvents ?? [],
        financialSnapshot: snapshot ?? null,
        followUpsDueToday,
        renewalsDueIn7Days: renewals ?? [],
      });

      const prompt = `Generate a daily briefing with a one-line headline and up to 4 sections (Financial, Relationships, Renewals, Opportunities), each with up to 3 short items. Only include sections with real content — omit empty sections entirely. Return JSON only, no markdown fences, with keys: headline, sections: [{title, items}].

User context:
${context}`;

      const briefingData = await callGemini(prompt);
      if (!briefingData) {
        console.warn(`[generate-daily-briefing] Skipping user ${userId}: Gemini failed`);
        results.skipped++;
        continue;
      }

      // ── Step 4: Insert into ai_briefings ──
      await supabase.from('ai_briefings').insert({
        user_id: userId,
        briefing_type: 'daily',
        content: briefingData,
        generated_at: now.toISOString(),
      });

      // ── Step 5: High-priority notification detection ──
      const highPriorityItems: Array<{
        category: string;
        priority: string;
        title: string;
        body: string;
        sourceEventId: string | null;
      }> = [];

      // Financial anomalies > ₹1,00,000
      const anomalies: unknown[] = (snapshot?.anomalies as unknown[]) ?? [];
      for (const anomaly of anomalies) {
        const a = anomaly as Record<string, unknown>;
        if (typeof a.amount === 'number' && a.amount > 100000) {
          highPriorityItems.push({
            category: 'financial_alert',
            priority: 'high',
            title: '⚠️ Large Financial Anomaly Detected',
            body: `Unusual transaction of ₹${a.amount.toLocaleString('en-IN')} detected. ${a.description ?? ''}`.trim(),
            sourceEventId: (a.event_id as string) ?? null,
          });
        }
      }

      // Overdue bills (due_date < now, unpaid)
      const overdueEvents = (emailEvents ?? []).filter((e: any) => {
        if (!e.due_date) return false;
        return new Date(e.due_date) < now && ['bill', 'emi', 'credit_card'].includes(e.category);
      });
      for (const e of overdueEvents) {
        highPriorityItems.push({
          category: 'financial_alert',
          priority: 'high',
          title: `🔴 Overdue: ${e.subject ?? e.category}`,
          body: e.ai_summary ?? `Payment overdue from ${e.sender_name ?? 'unknown'}`,
          sourceEventId: e.id,
        });
      }

      // Renewals due within 3 days
      const urgentRenewals = (renewals ?? []).filter((r: any) => {
        if (!r.due_date) return false;
        return new Date(r.due_date) <= threeDaysLater;
      });
      for (const r of urgentRenewals) {
        highPriorityItems.push({
          category: 'renewal',
          priority: 'high',
          title: `🔄 Renewal Due Soon: ${r.subject ?? 'Subscription'}`,
          body: r.ai_summary ?? `Renewal due by ${r.due_date}`,
          sourceEventId: r.id,
        });
      }

      // ── Step 5b: Upsert high-priority notifications (dedup enforced) ──
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
          .upsert(notifRows, {
            onConflict: 'user_id,dedup_key',
            ignoreDuplicates: true,
          });

        // ── Step 5c: Push notification ──
        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('push_token')
          .eq('user_id', userId)
          .maybeSingle();

        if (prefs?.push_token) {
          const pushTitle = '🔔 Meenakshi Alert';
          const pushBody = highPriorityItems[0].title; // Lead with highest priority item
          await sendExpoPush([prefs.push_token], pushTitle, pushBody);
        }
      }

      results.processed++;
    } catch (err) {
      console.error(`[generate-daily-briefing] Error for user ${userId}:`, err);
      results.errors++;
      // Do NOT rethrow — continue batch
    }
  }

  return new Response(
    JSON.stringify({ success: true, ...results }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
