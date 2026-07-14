-- ============================================================
-- Meenakshi — Notification & AI Briefing Engine
-- Migration 003: RPC for priority-ordered unread notifications
-- Runs at DB level so JS client gets correct ordering without
-- client-side sorting or multiple round-trips.
-- ============================================================

create or replace function get_unread_notifications(p_user_id uuid)
returns setof notifications
language sql stable security definer as $$
  select n.*
  from notifications n
  join notification_preferences np on np.user_id = p_user_id
  where n.user_id = p_user_id
    and n.read_at is null
    and n.dismissed_at is null
    -- Filter against user preferences in-query — not in JS
    and (
      (n.category = 'financial_alert'       and np.financial_alerts = true)
      or (n.category = 'relationship_reminder' and np.relationship_reminders = true)
      or (n.category = 'renewal'             and np.renewals = true)
      or (n.category = 'opportunity'         and np.opportunities = true)
    )
  order by
    case n.priority
      when 'high'   then 1
      when 'medium' then 2
      else               3
    end asc,
    n.created_at desc;
$$;
