// Supabase Edge Function: moderate-image
//
// Screens an image URL with OpenAI's omni-moderation model (free) and returns
// whether it should be blocked. Called by the app right after a photo is
// uploaded; if flagged, the app deletes the upload and asks for another.
//
// Apple requires content moderation for dating apps. This covers still images
// (profile photos, proposal/verification poster frames). Full video moderation
// would additionally sample frames — noted as a follow-up.
//
// Setup:
//   supabase secrets set OPENAI_API_KEY=sk-...
//   npx supabase functions deploy moderate-image
//
// Until OPENAI_API_KEY is set the function returns { flagged:false,
// configured:false } so uploads are never blocked before moderation is live.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Categories that should block a dating-app profile image
const BLOCK_CATEGORIES = [
  'sexual', 'sexual/minors', 'violence', 'violence/graphic',
  'hate', 'hate/threatening', 'harassment/threatening', 'self-harm',
];

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('OPENAI_API_KEY');
    const { imageUrl } = await req.json();
    if (!imageUrl) return json({ error: 'imageUrl required' }, 400);

    // Not configured yet — allow, so uploads keep working until moderation is on
    if (!apiKey) return json({ flagged: false, configured: false });

    const res = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'omni-moderation-latest',
        input: [{ type: 'image_url', image_url: { url: imageUrl } }],
      }),
    });

    if (!res.ok) {
      // Fail open on provider errors so we don't block legitimate users,
      // but report it so issues are visible in logs.
      const text = await res.text();
      return json({ flagged: false, configured: true, error: `moderation ${res.status}: ${text}` }, 200);
    }

    const data = await res.json();
    const result = data?.results?.[0];
    const categories = result?.categories ?? {};
    const flaggedCats = BLOCK_CATEGORIES.filter((c) => categories[c]);
    const flagged = flaggedCats.length > 0;

    return json({ flagged, configured: true, categories: flaggedCats });
  } catch (e) {
    return json({ flagged: false, error: String(e) }, 200);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
