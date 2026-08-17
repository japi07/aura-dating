// Supabase Edge Function: blind-match
//
// Pairs people waiting in the blind date pool and creates a real date row for
// each pair, which the concierge then plans.
//
// Runs with the service role because matching is inherently cross-user: it has
// to read other people's signups, which RLS (correctly) hides from any single
// user. Nothing here is exposed to the client except the summary.
//
// There is no scheduler in this project (no pg_cron, no worker), so this is
// invoked manually from the ops console or by an external cron hitting the
// URL. It is idempotent per run: a signup moved to 'matched' is never picked
// up again.
//
// Deploy:
//   npx supabase functions deploy blind-match --no-verify-jwt
//   supabase secrets set BLIND_MATCH_SECRET=<long random string>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface Signup {
  id: string;
  user_id: string;
  areas: string[];
  date_styles: string[];
  budget: string;
  available_from: string | null;
  available_to: string | null;
  time_bands: string[];
  created_at: string;
}

interface Profile {
  id: string;
  gender: string | null;
  gender_interest: string | null;
  age: number | null;
  verification_status: string | null;
}

const BUDGET_RANK: Record<string, number> = { low: 0, mid: 1, high: 2 };

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('BLIND_MATCH_SECRET');
  if (secret && req.headers.get('Authorization') !== secret) {
    return new Response('Unauthorized', { status: 401 });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    const { dryRun } = await req.json().catch(() => ({ dryRun: false }));

    // Oldest first, so nobody waits indefinitely behind newer signups
    const { data: signups, error: sErr } = await admin
      .from('blind_date_signups')
      .select('*')
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });
    if (sErr) throw sErr;
    if (!signups || signups.length < 2) {
      return json({ matched: 0, note: 'Not enough people waiting' });
    }

    const userIds = signups.map((s: Signup) => s.user_id);
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, gender, gender_interest, age, verification_status')
      .in('id', userIds);

    const byId = new Map<string, Profile>((profiles ?? []).map((p: Profile) => [p.id, p]));

    // Never pair people who have blocked each other, or who have already had
    // a date together.
    const { data: blocks } = await admin.from('blocks').select('blocker_id, blocked_id');
    const blocked = new Set((blocks ?? []).map((b: any) => pairKey(b.blocker_id, b.blocked_id)));

    const { data: priorDates } = await admin.from('dates').select('user_a_id, user_b_id');
    const alreadyDated = new Set(
      (priorDates ?? []).map((d: any) => pairKey(d.user_a_id, d.user_b_id)),
    );

    const taken = new Set<string>();
    const pairs: [Signup, Signup][] = [];

    for (const a of signups as Signup[]) {
      if (taken.has(a.id)) continue;
      let best: { s: Signup; score: number } | null = null;

      for (const b of signups as Signup[]) {
        if (b.id === a.id || taken.has(b.id)) continue;
        if (a.user_id === b.user_id) continue;

        const key = pairKey(a.user_id, b.user_id);
        if (blocked.has(key) || alreadyDated.has(key)) continue;

        const pa = byId.get(a.user_id);
        const pb = byId.get(b.user_id);
        if (!compatible(pa, pb)) continue;

        // Availability is only a constraint when both sides actually stated
        // one. Since 0014 the app stops asking, so most signups carry the
        // default fortnight and this is a no-op.
        if (!datesOverlap(a, b)) continue;

        // Everything below is preference, and preference is now a tiebreak
        // rather than a gate. Requiring an area match was disqualifying most
        // viable pairs: in a pool this size the odds of two people picking
        // the same corner of London are poor, and the concierge can pick a
        // venue between two areas anyway. Better a date slightly across town
        // than no date at all.
        const areas = overlap(a.areas, b.areas);
        const bands = overlap(a.time_bands, b.time_bands);
        const styles = overlap(a.date_styles, b.date_styles);
        const budgetGap = Math.abs(
          (BUDGET_RANK[a.budget] ?? 1) - (BUDGET_RANK[b.budget] ?? 1),
        );

        // Waiting longer beats sharing a postcode. Without this the oldest
        // signups lose every round to whoever happens to match on tags, and
        // somebody sits in the pool indefinitely.
        const waitedHours = Math.min(
          72,
          (Date.now() - new Date(b.created_at).getTime()) / 3600000,
        );

        const score =
          areas.length * 10 + bands.length * 8 + styles.length * 5
          - budgetGap * 6 + waitedHours;

        if (!best || score > best.score) best = { s: b, score };
      }

      if (best) {
        taken.add(a.id);
        taken.add(best.s.id);
        pairs.push([a, best.s]);
      }
    }

    if (dryRun) {
      return json({ matched: pairs.length, dryRun: true });
    }

    let created = 0;
    for (const [a, b] of pairs) {
      // The date is created with no venue and no time — that's what
      // status='planning' means. Ops fills those in.
      const { data: date, error: dErr } = await admin
        .from('dates')
        .insert({
          user_a_id: a.user_id,
          user_b_id: b.user_id,
          mode: 'blind',
          status: 'planning',
          payment: 'split',
        })
        .select('id')
        .single();
      if (dErr || !date) continue;

      const { error: uErr } = await admin
        .from('blind_date_signups')
        .update({ status: 'matched', matched_date_id: date.id, matched_at: new Date().toISOString() })
        .in('id', [a.id, b.id])
        .eq('status', 'waiting'); // guard against a concurrent run
      if (uErr) continue;

      created++;
    }

    return json({ matched: created, considered: signups.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

/** Order-independent key so A→B and B→A collide */
function pairKey(x: string, y: string): string {
  return [x, y].sort().join('|');
}

function overlap(a: string[] = [], b: string[] = []): string[] {
  const set = new Set(b);
  return (a ?? []).filter((x) => set.has(x));
}

/** Null means "whenever" -- 0014 made both columns optional. */
function datesOverlap(a: Signup, b: Signup): boolean {
  if (!a.available_from || !a.available_to) return true;
  if (!b.available_from || !b.available_to) return true;
  return a.available_from <= b.available_to && b.available_from <= a.available_to;
}

/**
 * Mutual gender interest, both verified. Mirrors the client-side rule in
 * lib/roles.ts and store/users.ts so the pool can't pair people who would
 * never see each other elsewhere in the app.
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
