import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import supabase from '../lib/supabase';
import { generateGeminiContent } from './geminiService';

export interface CreditReport {
  id: string;
  user_id: string;
  file_url: string;
  credit_score: number | null;
  extracted_data: any;
  status: 'pending' | 'parsed' | 'failed';
  error_message: string | null;
  uploaded_at: string;
}

const PARSE_PROMPT = `You are a credit report analyzer. Extract the following from the document and return ONLY a JSON object:
{
  "credit_score": number or null,
  "active_loans": [{"type": "string", "amount": number, "status": "string"}],
  "credit_card_utilization": "string representing percentage or description",
  "payment_history_flags": ["string"],
  "hard_inquiries": [{"lender": "string", "date": "YYYY-MM-DD"}]
}
Return as JSON only. No markdown, no code fences.`;

export async function uploadCreditReport(
  userId: string,
  fileUri: string,
  fileName: string,
  fileType: string
): Promise<CreditReport> {
  let arrayBuffer: ArrayBuffer;

  if (Platform.OS === 'web') {
    const response = await fetch(fileUri);
    arrayBuffer = await response.arrayBuffer();
  } else {
    // In React Native, fetch(fileUri) for local files is unreliable and often produces 0-byte blobs.
    // We must read it as base64 and decode it into an ArrayBuffer.
    const base64 = await FileSystem.readAsStringAsync(fileUri, { encoding: FileSystem.EncodingType.Base64 });
    const { decode } = require('base64-arraybuffer');
    arrayBuffer = decode(base64);
  }

  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('Selected file is empty (0 bytes). Please re-select the file.');
  }

  const storagePath = `${userId}/${Date.now()}_${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('credit_reports_bucket')
    .upload(storagePath, arrayBuffer, {
      contentType: fileType,
      upsert: false,
    });

  if (uploadError) {
    console.error('[creditReportService] Storage upload failed:', uploadError);
    throw new Error(`Upload failed: ${uploadError.message}`);
  }

  const { data: urlData, error: urlError } = await supabase.storage
    .from('credit_reports_bucket')
    .createSignedUrl(storagePath, 60 * 60 * 24);

  if (urlError || !urlData?.signedUrl) {
    console.error('[creditReportService] Signed URL generation failed:', urlError);
    throw new Error(`Signed URL failed: ${urlError?.message || 'no URL returned'}`);
  }

  // Store the raw storage path separately from the signed URL — signed URLs expire in 24h,
  // so re-parsing later needs a fresh one generated from storagePath, not a stale signed URL.
  const { data, error: insertError } = await supabase
    .from('credit_reports')
    .insert({
      user_id: userId,
      file_url: urlData.signedUrl,
      storage_path: storagePath,
      file_type: fileType,
      status: 'pending',
      error_message: null,
    })
    .select()
    .single();

  if (insertError || !data) {
    console.error('[creditReportService] DB insert failed:', insertError);
    throw new Error(`DB insert failed: ${insertError?.message}`);
  }

  return data as CreditReport;
}

export async function parseCreditReport(reportId: string): Promise<CreditReport> {
  const { data: report, error: fetchError } = await supabase
    .from('credit_reports')
    .select('*')
    .eq('id', reportId)
    .single();

  if (fetchError || !report) {
    throw new Error(`Could not load credit report ${reportId}: ${fetchError?.message || 'not found'}`);
  }

  try {
    // Signed URL may have expired since upload — regenerate from the stored path rather than
    // trusting the possibly-stale file_url. Falls back to file_url if storage_path is missing
    // (older rows created before this column existed).
    let downloadUrl = report.file_url;
    if (report.storage_path) {
      const { data: freshUrl, error: freshUrlError } = await supabase.storage
        .from('credit_reports_bucket')
        .createSignedUrl(report.storage_path, 60 * 60);
      if (!freshUrlError && freshUrl?.signedUrl) {
        downloadUrl = freshUrl.signedUrl;
      }
    }

    let base64 = '';

    if (Platform.OS === 'web') {
      const fileRes = await fetch(downloadUrl);
      if (!fileRes.ok) {
        throw new Error(`File download failed (HTTP ${fileRes.status}). Signed URL may have expired.`);
      }
      const blob = await fileRes.blob();
      if (blob.size === 0) {
        throw new Error('Downloaded file is empty (0 bytes).');
      }
      base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          resolve(dataUrl.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      const localUri = `${FileSystem.cacheDirectory}credit_${reportId}_${Date.now()}.tmp`;
      const downloadResult = await FileSystem.downloadAsync(downloadUrl, localUri);

      if (downloadResult.status !== 200) {
        throw new Error(`File download failed (HTTP ${downloadResult.status}). Signed URL may have expired.`);
      }

      const fileInfo = await FileSystem.getInfoAsync(downloadResult.uri);
      if (!fileInfo.exists || (fileInfo.size ?? 0) === 0) {
        throw new Error('Downloaded file is empty (0 bytes).');
      }

      base64 = await FileSystem.readAsStringAsync(downloadResult.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Clean up temp file regardless of outcome
      FileSystem.deleteAsync(downloadResult.uri, { idempotent: true }).catch(() => {});
    }

    if (!base64 || base64.length < 100) {
      throw new Error('Downloaded file content is too small to be a valid document.');
    }

    // Strip query string before checking extension — signed URLs have `?token=...` appended,
    // and determine mimeType from the stored file_type first (set at upload time), not by
    // sniffing the URL, which is unreliable once query params are present.
    const urlPath = report.file_url.split('?')[0].toLowerCase();
    const isPdf = report.file_type === 'application/pdf' || urlPath.endsWith('.pdf');
    const mimeType = isPdf ? 'application/pdf' : (report.file_type || 'image/jpeg');

    // Validate PDF magic bytes before sending to Gemini — this is what actually catches the
    // "document has no pages" failure mode: a corrupted or non-PDF file masquerading as one.
    if (isPdf) {
      const decodedHeader = atob(base64.slice(0, 8));
      if (!decodedHeader.startsWith('%PDF')) {
        throw new Error('File does not appear to be a valid PDF (missing %PDF header). It may be corrupted or the download returned an error page instead of the file.');
      }
    }

    const geminiResponse = await generateGeminiContent(PARSE_PROMPT, {
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
      console.error('[creditReportService] Parse error:', parseErr, 'Raw response:', geminiResponse);
      throw new Error('AI could not extract structured data from this document.');
    }

    const { data: updated, error: updateError } = await supabase
      .from('credit_reports')
      .update({
        credit_score: parsed.credit_score ?? null,
        extracted_data: parsed,
        status: 'parsed',
        error_message: null,
      })
      .eq('id', reportId)
      .select()
      .single();

    if (updateError || !updated) {
      throw new Error(`Failed to save parsed data: ${updateError?.message}`);
    }

    return updated as CreditReport;
  } catch (err: any) {
    console.error('[creditReportService] parseCreditReport error:', err);

    // Persist the failure so the UI has a durable status to check — this is what fixes the
    // false-positive success bug. The screen must check `.status === 'parsed'`, not just
    // "no exception was thrown" or "row exists".
    await supabase
      .from('credit_reports')
      .update({
        status: 'failed',
        error_message: err?.message || 'Unknown error during parsing',
      })
      .eq('id', reportId);

    // Re-throw so the caller's try/catch actually fires and cannot show a success message.
    throw err;
  }
}
