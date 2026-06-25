import supabase from '../lib/supabase';

/**
 * Checks for a duplicate financial event in Supabase within a 30-day window.
 * Returns the existing event if found, otherwise returns null.
 */
export async function checkDuplicateEvent(
  userId: string,
  category: string,
  entityName: string | null,
  amount: number | null,
  receivedAt: string
): Promise<any | null> {
  if (!amount || !entityName) {
    // If we don't have enough data to determine a duplicate, assume it's not a duplicate
    return null;
  }

  const receivedDate = new Date(receivedAt);
  const thirtyDaysBefore = new Date(receivedDate.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAfter = new Date(receivedDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Resolve entity ID from entities table
    const { data: entity, error: entityError } = await supabase
      .from('entities')
      .select('id')
      .eq('user_id', userId)
      .eq('name', entityName)
      .maybeSingle();

    if (entityError) {
      console.error('[duplicateDetector] Error looking up entity:', entityError);
      return null;
    }

    if (!entity) {
      // Entity doesn't exist yet, so no duplicate events can exist for it
      return null;
    }

    // 2. Fetch email event links for this entity
    const { data: links, error: linkError } = await supabase
      .from('entity_email_links')
      .select('email_event_id')
      .eq('entity_id', entity.id);

    if (linkError) {
      console.error('[duplicateDetector] Error looking up entity links:', linkError);
      return null;
    }

    if (!links || links.length === 0) {
      return null;
    }

    const linkedEventIds = links.map(l => l.email_event_id);

    // 3. Query email_events within the 30-day range matching the category and amount range
    const { data, error } = await supabase
      .from('email_events')
      .select('*')
      .in('id', linkedEventIds)
      .eq('user_id', userId)
      .eq('category', category)
      .gte('received_at', thirtyDaysBefore)
      .lte('received_at', thirtyDaysAfter)
      // Allow minor variance in amount
      .gte('amount', amount - 1.0)
      .lte('amount', amount + 1.0)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('[duplicateDetector] Error querying duplicate email event:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('[duplicateDetector] Unexpected error during duplicate detection:', err);
    return null;
  }
}

/**
 * Merges duplicate events locally from an array of classified events.
 * Used primarily for testing/visualizing duplicate detection in UI before saving.
 */
export function mergeDuplicateEvents(events: any[]): any[] {
  const merged: any[] = [];

  for (const event of events) {
    // Check if we already have a similar event in our merged list
    const duplicate = merged.find(m => 
      m.category === event.category &&
      (
        (m.amount === null && event.amount === null) ||
        (m.amount !== null && event.amount !== null && Math.abs(m.amount - event.amount) <= 1.0)
      )
    );

    if (duplicate) {
      duplicate.duplicateCount = (duplicate.duplicateCount || 1) + 1;
      if (!duplicate.dueDate && event.dueDate) {
        duplicate.dueDate = event.dueDate;
      }
    } else {
      merged.push({
        ...event,
        duplicateCount: 1
      });
    }
  }

  return merged;
}

