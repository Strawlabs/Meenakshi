/**
 * Meenakshi — Document Service
 * =============================
 * Handles document upload to Supabase Storage, AI processing via Gemini,
 * and CRUD operations against the `documents` table.
 */

import * as FileSystem from 'expo-file-system/legacy';
import supabase from '../lib/supabase';
import { generateGeminiContent } from './geminiService';

export interface DocumentEntity {
  name: string;
  type: 'person' | 'org' | 'amount' | 'date';
  value: string;
}

export interface DocumentKeyDate {
  label: string;
  date: string; // YYYY-MM-DD
  description: string;
}

export interface DocumentObligation {
  description: string;
  amount: number | null;
  due_date: string | null;
}

export interface DocumentAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Document {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  storage_path: string;
  document_type: string | null;
  summary: string | null;
  key_dates: DocumentKeyDate[];
  obligations: DocumentObligation[];
  actions: DocumentAction[];
  entities: DocumentEntity[];
  raw_extracted_text: string | null;
  processed: boolean;
  uploaded_at: string;
}

const PROCESS_PROMPT = `You are a document intelligence engine. Analyze this document carefully and return ONLY a JSON object with these exact keys:
{
  "document_type": "salary_slip|bank_statement|insurance|rent_agreement|loan|other",
  "summary": "2-4 sentence summary of what this document is and its importance",
  "key_dates": [{"label": "string", "date": "YYYY-MM-DD", "description": "string"}],
  "obligations": [{"description": "string", "amount": null_or_number, "due_date": "YYYY-MM-DD or null"}],
  "actions": [{"action": "string", "priority": "high|medium|low"}],
  "entities": [{"name": "string", "type": "person|org|amount|date", "value": "string"}],
  "raw_extracted_text": "full verbatim text extracted from the document"
}
Return as JSON only. No markdown, no code fences.`;

/**
 * Upload a document to Supabase Storage and create a DB row.
 */
export async function uploadDocument(
  userId: string,
  fileUri: string,
  fileName: string,
  fileType: string // MIME type e.g. 'application/pdf' or 'image/jpeg'
): Promise<Document | null> {
  try {
    // Read file via React Native's fetch which handles file:// URIs better than FileSystem.readAsStringAsync
    // and is more memory efficient as it doesn't need to load the whole file into a base64 string.
    const response = await fetch(fileUri);
    const arrayBuffer = await response.arrayBuffer();

    const storagePath = `${userId}/${Date.now()}_${fileName}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, arrayBuffer, {
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      console.error('[documentService] Storage upload failed:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Insert DB row
    const simpleType = fileType.includes('pdf') ? 'pdf' : 'image';
    const { data, error: insertError } = await supabase
      .from('documents')
      .insert({
        user_id: userId,
        file_name: fileName,
        file_type: simpleType,
        storage_path: storagePath,
        processed: false,
      })
      .select()
      .single();

    if (insertError || !data) {
      console.error('[documentService] DB insert failed:', insertError);
      throw new Error(`DB insert failed: ${insertError?.message}`);
    }

    return data as Document;
  } catch (err) {
    console.error('[documentService] uploadDocument error:', err);
    return null;
  }
}

/**
 * Download a document from storage, send to Gemini for analysis,
 * and update the DB row with extracted fields.
 */
export async function processDocument(documentId: string): Promise<Document | null> {
  try {
    // Fetch doc row
    const { data: doc, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (fetchError || !doc) {
      console.error('[documentService] processDocument fetch error:', fetchError);
      return null;
    }

    // Get a signed URL for the private document
    const { data: urlData, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(doc.storage_path, 60);

    if (urlError || !urlData) {
      console.error('[documentService] Storage signed URL error:', urlError);
      return null;
    }

    // Download the file locally to the cache directory
    const localUri = `${FileSystem.cacheDirectory}processing_${documentId}.tmp`;
    const { uri } = await FileSystem.downloadAsync(urlData.signedUrl, localUri);

    // Read the file as base64 for Gemini
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const mimeType = doc.file_type === 'pdf' ? 'application/pdf' : 'image/jpeg';

    // Call Gemini for document analysis
    const geminiResponse = await generateGeminiContent(PROCESS_PROMPT, {
      model: 'gemini-3-flash-preview',
      responseMimeType: 'application/json',
      imagePart: {
        mimeType,
        data: base64,
      },
    });

    let parsed: any;
    try {
      const clean = geminiResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(clean);
    } catch (parseErr) {
      console.error('[documentService] Failed to parse Gemini response:', geminiResponse);
      throw new Error('Could not parse AI document analysis.');
    }

    // Update DB row with AI results
    const { data: updated, error: updateError } = await supabase
      .from('documents')
      .update({
        document_type: parsed.document_type || 'other',
        summary: parsed.summary || null,
        key_dates: parsed.key_dates || [],
        obligations: parsed.obligations || [],
        actions: parsed.actions || [],
        entities: parsed.entities || [],
        raw_extracted_text: parsed.raw_extracted_text || null,
        processed: true,
      })
      .eq('id', documentId)
      .select()
      .single();

    if (updateError || !updated) {
      console.error('[documentService] DB update error:', updateError);
      return null;
    }

    return updated as Document;
  } catch (err) {
    console.error('[documentService] processDocument error:', err);
    return null;
  }
}

/**
 * Fetch all documents for a user, newest first.
 */
export async function getUserDocuments(userId: string): Promise<Document[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('user_id', userId)
    .order('uploaded_at', { ascending: false });

  if (error || !data) {
    console.error('[documentService] getUserDocuments error:', error);
    return [];
  }

  return data as Document[];
}

/**
 * Fetch a single document by id.
 */
export async function getDocumentById(documentId: string): Promise<Document | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error || !data) {
    console.error('[documentService] getDocumentById error:', error);
    return null;
  }

  return data as Document;
}

/**
 * Delete a document from Storage and the DB.
 */
export async function deleteDocument(
  documentId: string,
  storagePath: string
): Promise<boolean> {
  // Delete from Storage
  const { error: storageError } = await supabase.storage
    .from('documents')
    .remove([storagePath]);

  if (storageError) {
    console.error('[documentService] Storage delete error:', storageError);
  }

  // Delete DB row (cascade deletes Q&A sessions)
  const { error: dbError } = await supabase
    .from('documents')
    .delete()
    .eq('id', documentId);

  if (dbError) {
    console.error('[documentService] DB delete error:', dbError);
    return false;
  }

  return true;
}
