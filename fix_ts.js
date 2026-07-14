const fs = require('fs');
const file = '/Users/kavya/Desktop/Dev-Zone/Kavya/Strawlabs/meenakshi/services/systemPromptService.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  /supabase\n\s*\.from\('email_events'\)[\s\S]*?\.limit\(10\)\n\s*\.catch\(\(\) => \(\{ data: null \}\)\)/,
  `(async () => { try { return await supabase.from('email_events').select('received_at, category, amount, ai_summary, sender_name, entity_email_links(entities(name))').eq('user_id', user.id).order('received_at', { ascending: false }).limit(10); } catch { return { data: null }; } })()`
);

fs.writeFileSync(file, content);
console.log('Fixed TS error');
