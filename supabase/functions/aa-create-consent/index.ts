// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SETU_CLIENT_ID = Deno.env.get("SETU_CLIENT_ID");
const SETU_CLIENT_SECRET = Deno.env.get("SETU_CLIENT_SECRET");
const SETU_PRODUCT_INSTANCE_ID = Deno.env.get("SETU_PRODUCT_INSTANCE_ID");

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw { type: "AUTH_ERROR", message: "Missing Authorization header" };
    }

    const { fiTypes, vua } = await req.json();

    // Validate VUA (Must be 10 digits)
    if (!vua || !/^[6-9]\d{9}$/.test(vua)) {
      return new Response(JSON.stringify({
        isSetuError: true,
        errorCode: "INVALID_VUA",
        errorMsg: "A valid 10-digit Indian mobile number is required"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Initialize Supabase client with forwarded auth header
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw { type: "AUTH_ERROR", message: "Unauthorized or invalid token" };
    }
    const userId = user.id;

    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 29);
    
    // Setu V2 Sandbox requires flat structure, not nested under "Detail"
    const consentBody = {
      vua: vua, // Use the dynamically supplied valid mobile number
      consentDuration: {
        unit: "MONTH",
        value: 1
      },
      dataRange: {
        from: dateFrom.toISOString(),
        to: new Date().toISOString()
      },
      purpose: {
        code: "102",
        refUri: "https://api.rebit.org.in/aa/purpose/102.xml",
        text: "Customer spending and budget analysis",
        category: { type: "Personal Finance" }
      },
      fetchType: "ONETIME",
      frequency: {
        unit: "MONTH",
        value: 1
      },
      dataLife: {
        unit: "MONTH",
        value: 0
      },
      consentMode: "VIEW",
      consentTypes: ["TRANSACTIONS", "SUMMARY"],
      context: [
        {
          key: "fipId",
          value: "setu-fip,setu-fip-2"
        }
      ],
      fiTypes: ["DEPOSIT"]
    };

    // TASK 4: Better diagnostic logging before calling Setu
    console.log("--- DIAGNOSTIC LOGGING BEFORE SETU CALL ---");
    console.log(`API Endpoint: https://fiu-sandbox.setu.co/v2/consents`);
    console.log(`SETU_PRODUCT_INSTANCE_ID present: ${!!SETU_PRODUCT_INSTANCE_ID}`);
    console.log(`SETU_CLIENT_ID present: ${!!SETU_CLIENT_ID}`);
    console.log(`Authorization header present: true`);
    console.log(`purpose code: ${consentBody.purpose.code}`);
    console.log(`fiTypes: ${JSON.stringify(consentBody.fiTypes)}`);
    console.log(`fetchType: ${consentBody.fetchType}`);
    console.log(`consentMode: ${consentBody.consentMode}`);
    console.log(`consentTypes: ${JSON.stringify(consentBody.consentTypes)}`);
    console.log(`dataRange: ${JSON.stringify(consentBody.dataRange)}`);
    // Mask mobile number in VUA: "999999XXXX" or "XXXXXX9999@setu"
    const maskedVua = consentBody.vua.replace(/^(.{2})(.*)(.{2})(@.*)?$/, (m, p1, p2, p3, p4) => p1 + '*'.repeat(p2.length) + p3 + (p4 || ''));
    console.log(`VUA format (masked): ${maskedVua}`);
    console.log("-------------------------------------------");

    const response = await fetch("https://fiu-sandbox.setu.co/v2/consents", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-client-id": SETU_CLIENT_ID,
        "x-client-secret": SETU_CLIENT_SECRET,
        "x-product-instance-id": SETU_PRODUCT_INSTANCE_ID
      },
      body: JSON.stringify(consentBody)
    });

    const data = await response.json();
    
    // TASK 4: After response, log specific fields
    console.log("--- DIAGNOSTIC LOGGING AFTER SETU CALL ---");
    console.log(`HTTP status: ${response.status}`);
    console.log(`Setu traceId: ${data.traceId || 'N/A'}`);
    console.log(`errorCode: ${data.errorCode || 'N/A'}`);
    console.log(`errorMsg: ${data.errorMsg || 'N/A'}`);
    console.log("------------------------------------------");
    
    if (!response.ok) {
      // Throw with the raw data so the catch block can parse it
      throw { type: "SETU_ERROR", responseStatus: response.status, data };
    }

    const consentHandle = data.id || data.ConsentHandle;
    
    console.log("[DIAGNOSTIC] SETU RAW SUCCESS RESPONSE:", JSON.stringify(data));
    
    // Setu V2 returns an official 'url' field for the approval webview.
    // We append our redirect_url to it.
    let url = data.url;
    if (!url) {
      console.warn("Setu did not return a 'url' field. Falling back to sandbox webview URL.");
      url = `https://fiu-sandbox.setu.co/v2/consents/webview/${consentHandle}`;
    }
    
    // Append the mobile redirect URL if Setu hasn't already included it or if we need to force it.
    // Setu often allows passing redirect_url as a query parameter to the webview.
    const redirectUrl = "https://meenakshi-aa-redirect.vercel.app";
    if (url.includes("?")) {
      url += `&redirect_url=${encodeURIComponent(redirectUrl)}`;
    } else {
      url += `?redirect_url=${encodeURIComponent(redirectUrl)}`;
    }

    const { error } = await supabase
      .from('aa_consents')
      .insert({
        user_id: userId,
        consent_handle: consentHandle,
        status: 'PENDING',
        fi_types: fiTypes || ['DEPOSIT']
      });

    if (error) {
      throw { type: "DATABASE_ERROR", message: error.message, details: error };
    }

    return new Response(JSON.stringify({ url, consentHandle }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    // TASK 5: Return 400 for Setu errors, but preserve full error body
    if (err.type === "SETU_ERROR") {
      const errorData = err.data || {};
      return new Response(JSON.stringify({ 
        isSetuError: true, 
        errorCode: errorData.errorCode || "Unknown",
        errorMsg: errorData.errorMsg || err.message,
        traceId: errorData.traceId || "",
        error: `Setu API error: ${JSON.stringify(errorData)}`
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    if (err.type === "AUTH_ERROR") {
      return new Response(JSON.stringify({
        isSetuError: false,
        errorType: "AUTH_ERROR",
        errorMsg: err.message
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    if (err.type === "DATABASE_ERROR") {
      return new Response(JSON.stringify({
        isSetuError: false,
        errorType: "DATABASE_ERROR",
        errorMsg: err.message
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      });
    }

    // Generic error fallback
    return new Response(JSON.stringify({
      isSetuError: false,
      errorType: "UNKNOWN_ERROR",
      errorMsg: err.message || "An unknown error occurred"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
