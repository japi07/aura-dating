// Supabase Edge Function: call-match
//
// Pairs two people waiting in the call queue, creates a Daily room for them,
// and writes the calls row both phones then join.
//
// Called by the client immediately after joining the queue, and again on each
// poll. That is deliberate: there is no scheduler in this project, so the only
// thing that can drive matching is somebody being present. Whoever joins
// second is the one whose call to this function actually finds a partner.
//
// The room is created here rather than on the client for two reasons: the
// Daily API key must never reach a phone, and the call length has to be
// enforced by Daily rather than by a countdown a client could ignore.
//
// The deadline itself lives on the meeting tokens (call-token), not on the
// room. Daily documents that eject_at_token_exp overrides eject_at_room_exp
// entirely for a session, so setting both and hoping is not a strategy: the
// token wins. Minting both tokens with the SAME exp is what makes this one
// shared wall clock instead of two per-person timers that drift apart. The
// room keeps its own later exp purely as a join gate and a backstop.
//
// Deploy:
//   npx supabase functions deploy call-match
//   npx supabase secrets set DAILY_API_KEY=<key from daily.co dashboard>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * How long the pair has, measured from the moment they are matched. Short on
 * purpose: a first call between strangers should end while it is still going
 * well. The clock starts at match rather than at join because both tokens have
 * to carry the SAME deadline for the two phones to cut out together.
 */
const CALL_SECONDS = 7 * 60;
/** The room outlives the ejection, so a late rejoin still lands somewhere. */
const ROOM_GRACE_SECONDS = 60;

interface QueueRow {
  id: string;
  user_id: string;
  medium: string;
  topics: string[];
  created_at: string;
}

interface Profile {
  id: string;
  gender: string | null;
  gender_interest: string | null;
  verification_status: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  if (!jwt) return json({ error: 'Not signed in' }, 401);

  const url = Deno.env.get('SUPABASE_URL')!;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  // Identify the caller from their own token, never from the request body
  const { data: userData } = await admin.auth.getUser(jwt);
  const me = userData?.user?.id;
  if (!me) return json({ error: 'Not signed in' }, 401);

  const dailyKey = Deno.env.get('DAILY_API_KEY');
  if (!dailyKey) return json({ error: 'Calling is not configured yet' }, 503);

  try {
    // Already in a live call? Hand it back rather than starting a second one.
    const { data: live } = await admin
      .from('calls')
      .select('id')
      .or(`user_a_id.eq.${me},user_b_id.eq.${me}`)
      .in('status', ['ringing', 'active'])
      .gt('expires_at', new Date().toISOString())
      .limit(1);
    if (live && live.length > 0) return json({ matched: true, callId: live[0].id });

    const { data: mine } = await admin
      .from('call_queue')
      .select('*')
      .eq('user_id', me)
      .eq('status', 'waiting')
      .maybeSingle();
    if (!mine) return json({ matched: false, note: 'Not in the queue' });

    const { data: others } = await admin
      .from('call_queue')
      .select('*')
      .eq('status', 'waiting')
      .eq('medium', mine.medium)
      .neq('user_id', me)
      .order('created_at', { ascending: true }); // longest wait first
    if (!others || others.length === 0) return json({ matched: false, note: 'Nobody else waiting' });

    const ids = [me, ...others.map((o: QueueRow) => o.user_id)];
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, gender, gender_interest, verification_status')
      .in('id', ids);
    const byId = new Map<string, Profile>((profiles ?? []).map((p: Profile) => [p.id, p]));

    const { data: blocks } = await admin.from('blocks').select('blocker_id, blocked_id');
    const blocked = new Set((blocks ?? []).map((b: any) => pairKey(b.blocker_id, b.blocked_id)));

    // Two people who have already spoken should meet in person or not at all,
    // so the queue never serves the same voice twice.
    const { data: priorCalls } = await admin
      .from('calls')
      .select('user_a_id, user_b_id')
      .or(`user_a_id.eq.${me},user_b_id.eq.${me}`);
    const spokenBefore = new Set(
      (priorCalls ?? []).map((c: any) => pairKey(c.user_a_id, c.user_b_id)),
    );

    const mineProfile = byId.get(me);
    const partner = (others as QueueRow[]).find((o) => {
      const key = pairKey(me, o.user_id);
      if (blocked.has(key) || spokenBefore.has(key)) return false;
      return compatible(mineProfile, byId.get(o.user_id));
    });
    if (!partner) return json({ matched: false, note: 'Nobody compatible waiting' });

    // Claim both queue rows BEFORE spending anything on a room. The status
    // filter is the whole concurrency story: if another invocation got here
    // first, this update touches fewer than two rows and we back out.
    const { data: claimed } = await admin
      .from('call_queue')
      .update({ status: 'matched' })
      .in('id', [mine.id, partner.id])
      .eq('status', 'waiting')
      .select('id');

    if (!claimed || claimed.length < 2) {
      // Put back whichever row we did take, so nobody is stranded
      if (claimed && claimed.length > 0) {
        await admin
          .from('call_queue')
          .update({ status: 'waiting' })
          .in('id', claimed.map((c: any) => c.id));
      }
      return json({ matched: false, note: 'Someone got there first' });
    }

    const expiresAt = new Date(Date.now() + CALL_SECONDS * 1000);

    try {
      const room = await createDailyRoom(dailyKey, mine.medium, expiresAt);

      const { data: call, error: cErr } = await admin
        .from('calls')
        .insert({
          user_a_id: mine.user_id,
          user_b_id: partner.user_id,
          medium: mine.medium,
          status: 'ringing',
          room_url: room.url,
          room_name: room.name,
          expires_at: expiresAt.toISOString(),
        })
        .select('id')
        .single();
      if (cErr || !call) throw cErr ?? new Error('Could not create the call');

      // Only now does the queue row point at something joinable — the client
      // polls for exactly this.
      await admin.from('call_queue').update({ call_id: call.id }).in('id', [mine.id, partner.id]);

      return json({ matched: true, callId: call.id, expiresAt: expiresAt.toISOString() });
    } catch (e) {
      // Room or insert failed: release both people rather than leaving them
      // matched to a call that does not exist.
      await admin
        .from('call_queue')
        .update({ status: 'waiting' })
        .in('id', [mine.id, partner.id]);
      throw e;
    }
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

interface DailyRoom { url: string; name: string }

async function createDailyRoom(apiKey: string, medium: string, expiresAt: Date): Promise<DailyRoom> {
  const res = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      privacy: 'private', // joining needs a meeting token, minted per person
      properties: {
        // Later than the tokens on purpose. This is the join gate and the
        // backstop; the tokens are what actually end the conversation.
        exp: Math.floor(expiresAt.getTime() / 1000) + ROOM_GRACE_SECONDS,
        eject_at_room_exp: true,
        max_participants: 2,
        // Knocking is the only other way into a private room, so it stays
        // off: a minted token is the sole way in.
        enable_knocking: false,
        enable_prejoin_ui: false,
        enable_chat: false,
        enable_screenshare: false,
        // Audio-only is billed at roughly a quarter of the video rate, so
        // this flag is a cost decision as much as a product one.
        start_video_off: medium !== 'video',
        start_audio_off: false,
      },
    }),
  });

  if (!res.ok) throw new Error(`Daily room failed: ${res.status} ${await res.text()}`);
  const room = await res.json();
  return { url: room.url, name: room.name };
}

/** Order-independent key so A-B and B-A collide */
function pairKey(x: string, y: string): string {
  return [x, y].sort().join('|');
}

/**
 * Mutual gender interest, both verified. Mirrors lib/roles.ts and the
 * blind-match function, so the queue cannot pair people who would never see
 * each other anywhere else in the app.
 */
function compatible(a?: Profile, b?: Profile): boolean {
  if (!a || !b) return false;
  if (a.verification_status !== 'verified' || b.verification_status !== 'verified') return false;

  const wants = (p: Profile, other: Profile) => {
    const gi = (p.gender_interest ?? '').toLowerCase();
    const og = (other.gender ?? '').toLowerCase();
    if (!gi || gi === 'everyone') return true;
    return !!og && gi === og;
  };
  return wants(a, b) && wants(b, a);
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
