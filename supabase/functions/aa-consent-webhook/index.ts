// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  try {
    // ─── GET: Browser redirect from Setu consent UI ───────────────────────
    if (req.method === "GET") {
      const url = new URL(req.url);
      const success = url.searchParams.get("success") || url.searchParams.get("status") || "true";
      const id = url.searchParams.get("id") || "";
      console.log(`[webhook] Browser redirect received — success=${success}, id=${id}`);

      const deepLink = `meenakshi://integrations/aa-callback?success=${encodeURIComponent(success)}&id=${encodeURIComponent(id)}`;

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Returning to Meenakshi</title></head>
<body>
  <script>window.location.href = ${JSON.stringify(deepLink)};</script>
  <p>Returning to Meenakshi... if nothing happens, <a href="${deepLink}">tap here</a>.</p>
</body>
</html>`;

      return new Response(html, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    // ─── POST: Server-to-server Setu webhook ─────────────────────────────
    const hasSetuSignature = !!req.headers.get("x-setu-signature");
    const hasJwsSignature = !!req.headers.get("x-jws-signature");
    console.log(`[webhook] Signature headers — x-setu-signature: ${hasSetuSignature}, x-jws-signature: ${hasJwsSignature}`);

    const rawBody = await req.text();
    console.log("[webhook] Raw body:", rawBody.slice(0, 500)); // avoid flooding logs

    if (!rawBody) {
      return new Response(JSON.stringify({ message: "Empty POST body" }), {
        headers: { "content-type": "application/json" },
        status: 400,
      });
    }

    const payload = JSON.parse(rawBody);
    console.log("[webhook] Parsed payload type:", payload.type);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ─── Branch 1: FI_DATA_READY (Auto-Fetch push from Setu) ─────────────
    if (payload.type === 'FI_DATA_READY') {
      console.log(`[webhook] FI_DATA_READY received — consentId=${payload.consentId}, sessionId=${payload.dataSessionId}, status=${payload.status}`);

      if (payload.status !== 'COMPLETED' && payload.status !== 'PARTIAL') {
        console.warn(`[webhook] FI session not ready (status=${payload.status}), skipping.`);
        return new Response(JSON.stringify({ message: `Session status ${payload.status}, skipping` }), {
          headers: { "content-type": "application/json" },
          status: 200,
        });
      }

      // Resolve user_id from consent
      const { data: consentRow, error: consentError } = await supabase
        .from('aa_consents')
        .select('user_id')
        .eq('consent_id', payload.consentId)
        .maybeSingle();

      if (consentError || !consentRow) {
        // Also try via consent_handle (handle may equal consentId in sandbox)
        const { data: fallback, error: fallbackError } = await supabase
          .from('aa_consents')
          .select('user_id')
          .eq('consent_handle', payload.consentId)
          .maybeSingle();

        if (fallbackError || !fallback) {
          console.error(`[webhook] Could not resolve user_id for consentId=${payload.consentId}`);
          return new Response(JSON.stringify({ message: "Unknown consent" }), {
            headers: { "content-type": "application/json" },
            status: 200, // 200 so Setu doesn't retry forever
          });
        }
      }

      const userId = consentRow?.user_id || (await (async () => {
        const { data } = await supabase
          .from('aa_consents')
          .select('user_id')
          .eq('consent_handle', payload.consentId)
          .maybeSingle();
        return data?.user_id;
      })());

      if (!userId) {
        console.error(`[webhook] userId still not resolved for consentId=${payload.consentId}`);
        return new Response(JSON.stringify({ message: "User not resolved" }), {
          headers: { "content-type": "application/json" },
          status: 200,
        });
      }

      console.log(`[webhook] FI_DATA_READY — resolved userId=${userId}`);

      // Parse and flatten all transactions from all FIPs and accounts
      const transactions: any[] = [];
      const fiData = payload.fiData || [];

      for (const fipEntry of fiData) {
        const fipId = fipEntry.fipID || 'unknown';
        const accounts = fipEntry.data || [];

        for (const accountEntry of accounts) {
          const maskedAccNumber = accountEntry.maskedAccNumber;
          const linkRefNumber = accountEntry.linkRefNumber;
          const account = accountEntry.decryptedFI?.account;

          if (!account) {
            console.warn(`[webhook] No decryptedFI.account for linkRef=${linkRefNumber}`);
            continue;
          }

          const txnList = account.transactions?.transaction || [];
          console.log(`[webhook] Processing ${txnList.length} transactions for ${maskedAccNumber}`);

          for (const txn of txnList) {
            transactions.push({
              user_id: userId,
              consent_id: payload.consentId,
              data_session_id: payload.dataSessionId,
              fip_id: fipId,
              masked_account_number: maskedAccNumber,
              link_ref_number: linkRefNumber,
              txn_id: txn.txnId,
              amount: parseFloat(txn.amount),
              txn_type: txn.type,  // 'CREDIT' or 'DEBIT'
              mode: txn.mode,
              narration: txn.narration,
              reference: txn.reference,
              transaction_timestamp: txn.transactionTimestamp,
              value_date: txn.valueDate,
              current_balance: txn.currentBalance ? parseFloat(txn.currentBalance) : null,
              source_type: 'account_aggregator',
            });
          }
        }
      }

      if (transactions.length === 0) {
        console.warn('[webhook] FI_DATA_READY payload contained no transactions.');
        return new Response(JSON.stringify({ message: "No transactions to insert" }), {
          headers: { "content-type": "application/json" },
          status: 200,
        });
      }

      // Upsert on (user_id, txn_id) to be idempotent on Setu retries
      const { error: insertError, count } = await supabase
        .from('bank_transactions')
        .upsert(transactions, { onConflict: 'user_id,txn_id', ignoreDuplicates: true })
        .select('id');

      if (insertError) {
        console.error('[webhook] Failed to upsert bank_transactions:', insertError);
        throw insertError;
      }

      console.log(`[webhook] FI_DATA_READY — inserted/upserted ${transactions.length} transactions for user ${userId}`);

      return new Response(JSON.stringify({ message: "OK", inserted: transactions.length }), {
        headers: { "content-type": "application/json" },
        status: 200,
      });
    }

    // ─── Branch 2: CONSENT_STATUS_UPDATE ─────────────────────────────────
    // Setu's actual payload structure:
    //   payload.consentId  — the consent ID (root level)
    //   payload.data.status — the consent status (inside data)
    const notification = payload.data || payload.ConsentStatusNotification || {};

    const consentId = payload.consentId || notification.consentId || notification.id;
    const consentHandle = payload.consentHandle || notification.consentHandle;
    const rawStatus = (payload.data && payload.data.status) || notification.status || notification.consentStatus;

    console.log(`[webhook] Extracted — consentId=${consentId}, consentHandle=${consentHandle}, status=${rawStatus}`);

    if ((!consentId && !consentHandle) || !rawStatus) {
      console.error("[webhook] Missing identifiers or status after parsing");
      return new Response(JSON.stringify({ message: "Missing identifiers or status", parsed: { consentId, consentHandle, rawStatus } }), {
        headers: { "content-type": "application/json" },
        status: 400,
      });
    }

    const validStatuses = ["ACTIVE", "REJECTED", "REVOKED", "PAUSED", "EXPIRED", "PENDING"];
    const mappedStatus = validStatuses.includes(rawStatus.toUpperCase()) ? rawStatus.toUpperCase() : null;

    if (!mappedStatus) {
      console.warn(`[webhook] Unknown consent status: ${rawStatus}`);
      return new Response(JSON.stringify({ message: `Unknown status: ${rawStatus}` }), {
        headers: { "content-type": "application/json" },
        status: 400,
      });
    }

    const queryIds = [consentHandle, consentId].filter(Boolean);
    const orFilter = queryIds.map(id => `consent_handle.eq.${id}`).join(',');

    const { data: updated, error: updateError } = await supabase
      .from('aa_consents')
      .update({
        status: mappedStatus,
        consent_id: consentId || consentHandle,
        updated_at: new Date().toISOString(),
      })
      .or(orFilter)
      .select('user_id')
      .single();

    if (updateError) {
      console.error("[webhook] Error updating aa_consents:", updateError);
      throw updateError;
    }

    console.log(`[webhook] aa_consents updated → status=${mappedStatus} for handle=${queryIds.join(',')}`);

    if (mappedStatus === 'ACTIVE' && updated?.user_id) {
      const { error: icError } = await supabase
        .from('integration_consents')
        .upsert({
          user_id: updated.user_id,
          integration: 'bank_account',
          status: 'connected',
          connected_at: new Date().toISOString(),
        }, { onConflict: 'user_id,integration' });

      if (icError) {
        console.error("[webhook] Failed to upsert integration_consents:", icError);
      } else {
        console.log(`[webhook] integration_consents bank_account → connected for user ${updated.user_id}`);
        // FI data will arrive shortly via a separate FI_DATA_READY webhook (Auto-Fetch).
      }
    }

    if (['REJECTED', 'REVOKED', 'EXPIRED'].includes(mappedStatus) && updated?.user_id) {
      await supabase
        .from('integration_consents')
        .upsert({
          user_id: updated.user_id,
          integration: 'bank_account',
          status: 'disconnected',
          revoked_at: new Date().toISOString(),
        }, { onConflict: 'user_id,integration' });
      console.log(`[webhook] integration_consents bank_account → disconnected for user ${updated.user_id}`);
    }

    return new Response(JSON.stringify({ status: "OK" }), {
      headers: { "content-type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("[webhook] Unhandled error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "content-type": "application/json" },
      status: 500,
    });
  }
});
