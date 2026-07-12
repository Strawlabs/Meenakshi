const fs = require('fs');
const file = '/Users/kavya/Desktop/Dev-Zone/Kavya/Strawlabs/meenakshi/services/systemPromptService.ts';
let content = fs.readFileSync(file, 'utf8');

// add buildEmailContext to imports
content = content.replace(
  "import { buildMemoryContext } from './memoryService';",
  "import { buildMemoryContext, buildEmailContext } from './memoryService';"
);

// add emailCtx logic
content = content.replace(
  "  // Memory context (last 3 sessions)\n  const memCtx = await buildMemoryContext().catch(() => '');\n  if (memCtx) prompt += `\\n\\n${memCtx}`;\n\n  // Financial health snapshot + relationship context — run in parallel",
  `  // Memory context (last 3 sessions)
  const memCtx = await buildMemoryContext().catch(() => '');
  if (memCtx) prompt += \`\\n\\n\${memCtx}\`;

  const emailCtx = await buildEmailContext().catch(() => '');
  if (emailCtx) prompt += \`\\n\\n\${emailCtx}\`;

  // Financial health snapshot + relationship context — run in parallel`
);

// add historyEvents logic inside supabase fetch
content = content.replace(
  "      const [snapshot, contacts, followUps] = await Promise.all([",
  `      const [snapshot, contacts, followUps, historyRes] = await Promise.all([`
);

content = content.replace(
  "        getFollowUps().catch(() => [] as any[]),",
  `        getFollowUps().catch(() => [] as any[]),
        supabase
          .from('email_events')
          .select('received_at, category, amount, ai_summary, sender_name, entity_email_links(entities(name))')
          .eq('user_id', user.id)
          .order('received_at', { ascending: false })
          .limit(10)
          .catch(() => ({ data: null }))`
);

// update financial block
content = content.replace(
  "        prompt +=\n          `\\n\\nFINANCIAL CONTEXT: ${snapshot.summary ?? 'No summary available.'}` +\n          `\\n\\nUPCOMING OBLIGATIONS:\\n${obligations}`;\n      }",
  `        let eventsStr = 'None';
        const historyEvents = historyRes?.data;
        if (historyEvents && historyEvents.length > 0) {
          eventsStr = historyEvents.map((e: any) => {
            const dateStr = new Date(e.received_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            const amountStr = e.amount ? e.amount : '0';
            const entityStr = e.entity_email_links?.[0]?.entities?.name || e.sender_name || 'Unknown Entity';
            return \`- [\${dateStr}] [\${e.category}] [\${entityStr}]: ₹\${amountStr} — [\${e.ai_summary || ''}]\`;
          }).join('\\n');
        }

        prompt +=
          \`\\n\\nFINANCIAL CONTEXT: \${snapshot.summary ?? 'No summary available.'}\` +
          \`\\n\\nUPCOMING OBLIGATIONS:\\n\${obligations}\` +
          \`\\n\\nRECENT FINANCIAL EVENTS:\\n\${eventsStr}\`;
      }`
);

fs.writeFileSync(file, content);
console.log('updated systemPromptService');
