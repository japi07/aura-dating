// Supabase Edge Function: persona-webhook
//
// Receives Persona ID-verification events and updates the user's
// verification status. Persona inquiries carry a `reference-id` we set to the
// Supabase user id, so we can map an event back to the right profile.
//
// Setup:
//   supabase secrets set PERSONA_WEBHOOK_SECRET=<from Persona dashboard>
//   npx supabase functions deploy persona-webhook --no-verify-jwt
//   In Persona → Webhooks, point it at:
//     https://<ref>.supabase.co/functions/v1/persona-webhook
//
// Deployed with verify_jwt = false (Persona doesn't send a Supabase JWT).
// Authenticity is checked via Persona's HMAC signature when the secret is set.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Map Persona event names → our verification_status
function statusForEvent(name: string): 'verified' | 'rejected' | 'pending' | null {
  if (name === 'inquiry.approved') return 'verified';
  if (['inquiry.declined', 'inquiry.failed', 'inquiry.expired'].includes(name)) return 'rejected';
  if (['inquiry.completed', 'inquiry.pending', 'inquiry.created', 'inquiry.marked-for-review'].includes(name)) return 'pending';
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const rawBody = await req.text();

  // Verify Persona's HMAC signature when a secret is configured
  const secret = Deno.env.get('PERSONA_WEBHOOK_SECRET');
  if (secret) {
    const ok = await verifyPersonaSignature(req.headers.get('Persona-Signature'), rawBody, secret);
    if (!ok) return json({ error: 'Invalid signature' }, 401);
  }

  try {
    const body = JSON.parse(rawBody);
    const attrs = body?.data?.attributes ?? {};
    const eventName: string = attrs?.name ?? '';
    const inquiry = attrs?.payload?.data ?? {};
    const referenceId: string | undefined = inquiry?.attributes?.['reference-id'];
    const inquiryId: string | undefined = inquiry?.id;

    const status = statusForEvent(eventName);
    if (!status || !referenceId) {
      return json({ ok: true, note: `ignored ${eventName || 'event'}` });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Update the profile's verification status
    const profilePatch: Record<string, any> = { verification_status: status };
    if (status === 'verified') profilePatch.verified_at = new Date().toISOString();
    if (status === 'rejected') profilePatch.verification_reason = 'ID verification was not approved';
    await admin.from('profiles').update(profilePatch).eq('id', referenceId);

    // Record on the verifications table (best-effort; columns may differ)
    try {
      await admin.from('verifications').insert({
        user_id: referenceId,
        photo_path: `persona:${inquiryId ?? 'inquiry'}`,
        video_path: `persona:${inquiryId ?? 'inquiry'}`,
        status: status === 'verified' ? 'verified' : status === 'rejected' ? 'rejected' : 'pending',
        reviewer_notes: `Persona ${eventName}`,
      });
    } catch { /* non-fatal */ }

    return json({ ok: true, status, referenceId });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
});

async function verifyPersonaSignature(header: string | null, body: string, secret: string): Promise<boolean> {
  if (!header) return false;
  // Header format: "t=timestamp,v1=signature"
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex === v1;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}
