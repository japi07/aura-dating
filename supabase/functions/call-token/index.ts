// Supabase Edge Function: call-token
//
// Mints one Daily meeting token for one person for one call.
//
// The room is private, so a token is the only way in — which makes this
// function the access check for the whole call. It refuses unless the caller
// is genuinely one of the two participants, and it takes the identity from the
// caller's own JWT rather than from anything in the request body.
//
// The token also carries the deadline. Daily documents that eject_at_token_exp
// overrides the room's eject settings for the session, so this is the single
// place the call length is decided, and both participants get the same exp
// because it is read from calls.expires_at rather than computed per request.
//
// Tokens are never stored. They are bearer credentials with a few minutes of
// life; they go back in the response and die there.
//
// Deploy:
//   npx supabase functions deploy call-token
//   npx supabase secrets set DAILY_API_KEY=<key from daily.co dashboard>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Not signed in' }, 401);

  const dailyKey = Deno.env.get('DAILY_API_KEY');
  if (!dailyKey) return json({ error: 'Calling is not configured yet' }, 503);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { data: userData } = await admin.auth.getUser(jwt);
    const me = userData?.user?.id;
    if (!me) return json({ error: 'Not signed in' }, 401);

    const { callId } = await req.json().catch(() => ({}));
    if (!callId) return json({ error: 'Missing callId' }, 400);

    const { data: call } = await admin
      .from('calls')
      .select('id, user_a_id, user_b_id, medium, status, room_name, room_url, expires_at')
      .eq('id', callId)
      .maybeSingle();

    if (!call) return json({ error: 'Call not found' }, 404);
    if (call.user_a_id !== me && call.user_b_id !== me) {
      // Same 404 as a missing call — whether a given call exists is not
      // something a stranger gets to learn.
      return json({ error: 'Call not found' }, 404);
    }
    if (!call.room_name || !call.room_url) return json({ error: 'Room is not ready' }, 409);
    if (call.status !== 'ringing' && call.status !== 'active') {
      return json({ error: 'This call has ended' }, 409);
    }

    const expiresAt = call.expires_at ? new Date(call.expires_at) : null;
    if (!expiresAt || expiresAt.getTime() <= Date.now()) {
      return json({ error: 'This call has ended' }, 409);
    }

    // First name only. The token pins the display name server-side — Daily
    // deliberately refuses client-side setUserName() overrides — so this is
    // also the guarantee that nobody can join calling themselves someone else.
    const { data: profile } = await admin
      .from('profiles')
      .select('name')
      .eq('id', me)
      .maybeSingle();
    const firstName = (profile?.name ?? 'Someone').split(' ')[0];

    const res = await fetch('https://api.daily.co/v1/meeting-tokens', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${dailyKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        properties: {
          // Without room_name a token is valid for every room on the domain
          room_name: call.room_name,
          user_name: firstName,
          user_id: me, // a UUID is 36 chars, exactly Daily's limit
          is_owner: false, // symmetric call; neither side controls the room
          exp: Math.floor(expiresAt.getTime() / 1000),
          eject_at_token_exp: true,
          enable_screenshare: false,
          start_video_off: call.medium !== 'video',
          start_audio_off: false,
        },
      }),
    });

    if (!res.ok) {
      return json({ error: `Daily token failed: ${res.status} ${await res.text()}` }, 502);
    }
    const { token } = await res.json();

    return json({
      token,
      roomUrl: call.room_url,
      medium: call.medium,
      expiresAt: call.expires_at,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
