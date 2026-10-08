// =====================================================================
// Supabase Edge Function: paystack-sponsor-webhook
//
// Receives Paystack events for SPONSOR payments only. These go to the
// PLATFORM OWNER's Paystack account (PAYSTACK_PLATFORM_SECRET_KEY).
//
// Keep it separate from the dues webhook (paystack-dues-webhook), which
// uses each association's own Paystack account/subaccount. Each function
// has its own secret, its own URL and ignores the other's events:
//   - sponsor payments carry  metadata.type = "sponsor"
//   - dues payments carry     metadata.type = "dues"
//
// Deploy:  supabase functions deploy paystack-sponsor-webhook --no-verify-jwt
// Secrets: supabase secrets set PAYSTACK_PLATFORM_SECRET_KEY=sk_live_xxx
//          (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase)
// Paystack dashboard (platform account) > Settings > API > Webhook URL:
//          https://<project-ref>.functions.supabase.co/paystack-sponsor-webhook
//
// Creating the payment (server side, platform secret key), for example:
//   POST https://api.paystack.co/transaction/initialize
//   { email, amount: <weeks * rate in kobo>, currency: "NGN",
//     metadata: { type: "sponsor", sponsor_id: "<uuid>", weeks: 4 } }
// =====================================================================
import { createClient } from "jsr:@supabase/supabase-js@2";

const enc = new TextEncoder();

async function hmacSha512Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("PAYSTACK_PLATFORM_SECRET_KEY");
  if (!secret) return json({ error: "Server is not configured" }, 500);

  // 1. Verify the signature on the raw body
  const raw = await req.text();
  const signature = req.headers.get("x-paystack-signature") ?? "";
  if (!safeEqual(signature, await hmacSha512Hex(secret, raw))) return json({ error: "Invalid signature" }, 401);

  // 2. Only handle successful sponsor charges; acknowledge everything else
  const event = JSON.parse(raw);
  if (event.event !== "charge.success") return json({ ignored: "not a charge.success event" });
  const data = event.data ?? {};
  const meta = data.metadata ?? {};
  if (meta.type !== "sponsor") return json({ ignored: "not a sponsor payment" });
  if (data.currency !== "NGN") return json({ error: "Unexpected currency" }, 400);

  // 3. Confirm with Paystack before trusting the event
  const verify = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const verified = await verify.json();
  if (!verified.status || verified.data?.status !== "success" || verified.data?.amount !== data.amount) {
    return json({ error: "Payment could not be verified" }, 400);
  }

  // 4. Record it. The database checks the amount against the rate, ignores duplicates,
  //    adds the kobo to revenue_kobo and extends expires_at.
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: result, error } = await supabase.rpc("apply_sponsor_payment", {
    p_reference: data.reference,
    p_sponsor_id: meta.sponsor_id,
    p_amount_kobo: data.amount,
    p_weeks: Number(meta.weeks),
    p_raw: event,
  });
  if (error) {
    console.error("apply_sponsor_payment failed", error.message);
    return json({ error: "Could not record the payment" }, 500); // Paystack will retry
  }
  return json(result);
});
