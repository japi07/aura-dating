// Supabase Edge Function: notify
//
// Sends an Expo push notification for a proposal event. Called by the app
// (supabase.functions.invoke('notify', { body: { proposalId, event } }))
// right after it creates or accepts a proposal.
//
// Runs with the service role so it can read the *recipient's* push tokens,
// which RLS otherwise hides from everyone but the owner. We still verify the
// caller is actually a party to the proposal before sending anything.
//
// Deploy:  npx supabase functions deploy notify --project-ref <ref>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const { proposalId, event } = await req.json();
    if (!proposalId || !['new', 'accepted'].includes(event)) {
      return json({ error: 'Bad request' }, 400);
    }

    // Who's calling?
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const callerId = userData?.user?.id;
    if (!callerId) return json({ error: 'Not authenticated' }, 401);

    // Load the proposal with both parties' names (service role bypasses RLS)
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: proposal, error: pErr } = await admin
      .from('proposals')
      .select('id, sender_id, recipient_id, venue_name, ' +
        'sender:profiles!proposals_sender_id_fkey(name), ' +
        'recipient:profiles!proposals_recipient_id_fkey(name)')
      .eq('id', proposalId)
      .single();
    if (pErr || !proposal) return json({ error: 'Proposal not found' }, 404);

    // Decide who to notify + the copy, and authorise the caller
    let targetUserId: string;
    let title: string;
    let body: string;
    if (event === 'new') {
      if (callerId !== proposal.sender_id) return json({ error: 'Forbidden' }, 403);
      targetUserId = proposal.recipient_id;
      const senderName = (proposal as any).sender?.name ?? 'Someone';
      title = 'New date proposal ✨';
      body = `${senderName} would love to take you to ${proposal.venue_name}.`;
    } else {
      // accepted
      if (callerId !== proposal.recipient_id) return json({ error: 'Forbidden' }, 403);
      targetUserId = proposal.sender_id;
      const recipientName = (proposal as any).recipient?.name ?? 'She';
      title = 'Your proposal was accepted! 🎉';
      body = `${recipientName} said yes to ${proposal.venue_name}.`;
    }

    // Look up the target's push tokens
    const { data: tokens } = await admin
      .from('push_tokens')
      .select('expo_push_token')
      .eq('user_id', targetUserId);

    const messages = (tokens ?? [])
      .map((t: any) => t.expo_push_token)
      .filter((t: string) => !!t)
      .map((to: string) => ({
        to,
        sound: 'default',
        title,
        body,
        data: { proposalId, event },
      }));

    if (messages.length === 0) {
      return json({ sent: 0, note: 'No push tokens for target user' }, 200);
    }

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(messages),
    });
    const expoResult = await res.json();

    return json({ sent: messages.length, expo: expoResult }, 200);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(payload: unknown, status: number): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
