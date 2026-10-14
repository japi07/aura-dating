// Supabase Edge Function: delete-account
//
// Permanently deletes the calling user's account. Apple requires that any
// app offering account creation also offers in-app account deletion.
//
// The client calls this with its normal auth JWT. We verify the token, then
// use the service-role key to delete the auth user — which cascades to every
// row that references profiles(id) (see migration 0029 for the references
// that used to block it). The member's uploaded files go too.
//
// Every failure answers with { error, code } so the app can say what went
// wrong instead of "Edge Function returned a non-2xx status code":
//   401 not_signed_in    no or unreadable session — the app asks to sign in again
//   500 delete_failed    the database refused; the message says why
//
// Deploy:
//   npx supabase functions deploy delete-account
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the platform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Every bucket keeps a member's files under "<user id>/".
const BUCKETS = [
  'profile-photos',
  'verification-photos',
  'verification-videos',
  'proposal-videos',
  'proposal-attachments',
];

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Identify the caller from their own access token.
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    const { data: userData, error: userErr } = token
      ? await admin.auth.getUser(token)
      : { data: { user: null }, error: null };
    if (userErr || !userData?.user) {
      console.warn('delete-account: no session', userErr?.message ?? 'missing token');
      return json(401, { code: 'not_signed_in', error: 'Your session has expired. Please sign in again.' });
    }
    const userId = userData.user.id;

    // Files first: once the user is gone nothing ties these folders to anyone.
    // Best effort — a storage hiccup must not keep the account alive.
    for (const bucket of BUCKETS) {
      try {
        const { data: files } = await admin.storage.from(bucket).list(userId, { limit: 1000 });
        const paths = (files ?? []).map((f) => `${userId}/${f.name}`);
        if (paths.length) await admin.storage.from(bucket).remove(paths);
      } catch (e) {
        console.warn(`delete-account: could not clear ${bucket}/${userId}`, String(e));
      }
    }

    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) {
      console.error('delete-account: deleteUser failed', userId, delErr.message);
      return json(500, { code: 'delete_failed', error: delErr.message });
    }

    return json(200, { success: true });
  } catch (e) {
    console.error('delete-account: crashed', String(e));
    return json(500, { code: 'delete_failed', error: String(e) });
  }
});
