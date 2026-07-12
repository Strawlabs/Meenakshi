const fs = require('fs');
const file = '/Users/kavya/Desktop/Dev-Zone/Kavya/Strawlabs/meenakshi/screens/ChatScreen.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add import
content = content.replace(
  "import { MEENAKSHI_SYSTEM_PROMPT } from '../constants';",
  "import { buildSystemPrompt } from '../services/systemPromptService';"
);

// Delete imports no longer needed if we remove them from ChatScreen?
// actually we might still need buildMemoryContext for something else?
// no, buildMemoryContext is only used there. But let's just do the block replacement.

const startDel = "      // Build enriched system prompt with memory and email contexts";
const endDel = "      let responseText = '';";

const p1 = content.indexOf(startDel);
const p2 = content.indexOf(endDel);

if (p1 !== -1 && p2 !== -1) {
  const newBlock = `      // Build enriched system prompt from the centralized service
      let enrichedSystemPrompt = await buildSystemPrompt();
      
      // Chat-specific context extensions
      const emailCtx = await buildEmailContext();
      if (emailCtx) {
        enrichedSystemPrompt += \`\\n\\n\${emailCtx}\`;
      }

      // Active document (if launched from DocumentDetailScreen or uploaded in chat)
      let documentContext = '';
      const documentId = activeDocumentId;
      if (documentId) {
        const doc = await getDocumentById(documentId);
        if (doc) {
          const rawText = (doc.raw_extracted_text || '').slice(0, 3000);
          documentContext = \`DOCUMENT CONTEXT: The user is asking about a document they uploaded.
TYPE: \${doc.document_type || 'unknown'}
SUMMARY: \${doc.summary || 'No summary available.'}
KEY DATES: \${JSON.stringify(doc.key_dates || [])}
OBLIGATIONS: \${JSON.stringify(doc.obligations || [])}
RAW TEXT (truncated):\\n\${rawText}\`;
          enrichedSystemPrompt += \`\\n\\n\${documentContext}\`;
        }
      }

      // Recent documents (if no specific active document)
      const { data: { user } } = await supabase.auth.getUser();
      if (!documentId && user) {
        const recentDocs = await getUserDocuments(user.id);
        const topDocs = recentDocs.slice(0, 3);
        if (topDocs.length > 0) {
          const recentDocumentsContext = \`RECENT UPLOADED DOCUMENTS (for budget planning and general context):
\${topDocs.map((doc: Document) => \`- [\${doc.file_name}] (\${doc.document_type}): \${doc.summary || 'No summary'} | Obligations: \${JSON.stringify(doc.obligations || [])}\`).join('\\n')}\`;
          enrichedSystemPrompt += \`\\n\\n\${recentDocumentsContext}\`;
        }
      }

`;
  content = content.substring(0, p1) + newBlock + content.substring(p2);
}

fs.writeFileSync(file, content);
console.log('Fixed ChatScreen');
