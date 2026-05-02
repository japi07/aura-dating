/**
 * Proposals store — persists per-day proposals, accept/decline state.
 * Backed by AsyncStorage so user state survives app restarts.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LONDON_VENUES, randomVenue, type Venue } from '@/constants/london';

const STORAGE_KEY_PROPOSALS = 'aura.proposals.v1';
const STORAGE_KEY_DECISIONS = 'aura.decisions.v1';

export interface ProposalUser {
  id: string;
  name: string;
  age: number;
  area: string;
  job: string;
  photoUrl: string;
  verified: boolean;
  lat: number;
  lng: number;
}

export interface Proposal {
  id: string;
  createdAt: string; // ISO
  expiresAt: string; // ISO
  from: ProposalUser;
  matchScore: number;
  matchReason: string;
  venue: Venue;
  startsAt: string; // ISO datetime
  payment: 'he-pays' | 'split' | 'she-pays';
  message: string;
}

export type Decision = 'accepted' | 'declined' | 'expired';

export interface DecisionRecord {
  proposalId: string;
  decision: Decision;
  decidedAt: string;
}

interface ProposalsState {
  proposals: Proposal[];
  decisions: Record<string, DecisionRecord>;
  isLoading: boolean;
  isHydrated: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  refreshProposals: () => Promise<void>;
  acceptProposal: (id: string) => Promise<Proposal | null>;
  declineProposal: (id: string) => Promise<void>;
  pendingForToday: () => Proposal[];
}

/* ─── seed generators ─── */

const FIRST_NAMES = ['James', 'Oliver', 'Henry', 'Edward', 'Thomas', 'Charlie', 'Hugo', 'Theo', 'Felix', 'Jack', 'Alex', 'Daniel', 'Marcus', 'Arthur', 'Benjamin'];
const SURNAMES = ['Whitfield', 'Hamilton', 'Carter', 'Bennett', 'Spencer', 'Ashford', 'Lawson', 'Holmes', 'Davies', 'Pearce'];
const JOBS = ['Architect', 'Curator at Tate', 'Software engineer', 'Barrister', 'Strategy consultant', 'Chef at Brat', 'Wine importer', 'NHS doctor', 'Documentary editor', 'Investment manager', 'Producer at the BBC', 'Furniture designer'];
const REASONS = [
  'You both prioritise culture and meaningful conversation',
  'Same love for hidden cafés and weekend markets',
  'Both of you mentioned wanting someone you can plan trips with',
  'Strong overlap on art, food and not-too-late nights',
  'You both said you want a serious relationship — not just dating',
  'Similar humour, similar pace of life',
];
const PAYMENTS: Proposal['payment'][] = ['he-pays', 'split', 'he-pays', 'split', 'he-pays'];

const SAMPLE_MESSAGES_BY_CATEGORY: Record<Venue['category'], string[]> = {
  dinner: [
    'I\'ve been wanting to take someone to {venue} for ages — booking is hard but I got us a table. Just good food, slow pace, no rush.',
    'I\'d love to take you to {venue}. Their food does the talking, so we don\'t have to fill silence with small talk.',
  ],
  lunch: [
    'Saturday lunch at {venue}? Easy first-date energy — relaxed, daylight, no pressure.',
  ],
  coffee: [
    'No-pressure coffee at {venue}. If we vibe, we wander to the {area} galleries. If not, no awkward 3-hour dinner.',
    'Coffee at {venue} — they roast their own beans and the tables are big enough for a proper conversation.',
  ],
  drinks: [
    'Cocktails at {venue} — I think you\'d like the vibe. One drink, see how it goes.',
  ],
  walk: [
    'A wander around {venue} on Sunday morning. I\'ll bring takeaway flat whites. Honest, easy, hopefully sunny.',
    'Walk through {venue} — apparently the cherry blossoms are peaking. Felt like a properly unhurried way to meet.',
  ],
  gallery: [
    'There\'s an exhibition at {venue} I\'ve been meaning to see. Walk through it, then a coffee nearby?',
  ],
  cooking: [
    'A pasta-making class at {venue} — proper hands-on, half terrible, half hilarious. Way better than awkward dinner.',
  ],
  concert: [
    'Live music at {venue} — intimate venue, decent seats, drinks beforehand if you fancy.',
  ],
  workshop: [
    'Pottery at {venue}. We make ridiculous bowls, drink wine, and you learn very quickly if I\'m fun under pressure.',
  ],
  sport: [
    'Cycle through {area} on Sunday morning. London Fields → Victoria Park → coffee somewhere good.',
  ],
};

function isoFutureDayHour(daysAhead: number, hour: number) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

/**
 * Build today's curated proposal. Quality > quantity — one carefully-chosen
 * match per day. Same proposal stays stable for the day (deterministic by date).
 */
function buildSeedProposals(): Proposal[] {
  // Pool of beautifully-curated London proposals; we'll rotate one per day
  const candidates: Array<{ venueId: string; photoIdx: number }> = [
    { venueId: 'v_padella',     photoIdx: 11 },
    { venueId: 'v_monmouth',    photoIdx: 13 },
    { venueId: 'v_tate_modern', photoIdx: 15 },
    { venueId: 'v_dishoom_sho', photoIdx: 17 },
    { venueId: 'v_lyaness',     photoIdx: 18 },
    { venueId: 'v_hampstead',   photoIdx: 20 },
    { venueId: 'v_columbia',    photoIdx: 22 },
  ];
  // Use day-of-year as a stable seed so the proposal doesn't change mid-day
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const choice = candidates[dayOfYear % candidates.length];
  const venue = LONDON_VENUES.find(v => v.id === choice.venueId)!;

  const name = pick(FIRST_NAMES);
  const age = 28 + Math.floor(Math.random() * 7);
  const messageTpl = pick(SAMPLE_MESSAGES_BY_CATEGORY[venue.category] || ['I\'d love to take you to {venue}.']);
  const message = messageTpl.replace('{venue}', venue.name).replace('{area}', venue.area);

  // Pick a thoughtful date/time depending on category
  let startsAt: string;
  if (venue.category === 'coffee' || venue.category === 'walk' || venue.category === 'gallery') {
    startsAt = isoFutureDayHour(2, 11); // weekend morning
  } else if (venue.category === 'drinks') {
    startsAt = isoFutureDayHour(2, 19);
  } else {
    startsAt = isoFutureDayHour(2, 19); // dinner-ish
  }

  return [{
    id: `prop_${dayOfYear}`,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    from: {
      id: `usr_today`,
      name,
      age,
      area: pick(['Shoreditch', 'Notting Hill', 'Hampstead', 'Chelsea', 'Islington', 'Marylebone']),
      job: pick(JOBS),
      photoUrl: `https://i.pravatar.cc/600?img=${choice.photoIdx}`,
      verified: true,
      lat: 51.5 + (Math.random() - 0.5) * 0.05,
      lng: -0.12 + (Math.random() - 0.5) * 0.05,
    },
    matchScore: 89 + Math.floor(Math.random() * 9),
    matchReason: pick(REASONS),
    venue,
    startsAt,
    payment: pick(PAYMENTS),
    message,
  }];
}

/* ─── store ─── */

export const useProposalsStore = create<ProposalsState>((set, get) => ({
  proposals: [],
  decisions: {},
  isLoading: false,
  isHydrated: false,
  error: null,

  hydrate: async () => {
    try {
      const [propRaw, decRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_PROPOSALS),
        AsyncStorage.getItem(STORAGE_KEY_DECISIONS),
      ]);
      const proposals: Proposal[] = propRaw ? JSON.parse(propRaw) : [];
      const decisions: Record<string, DecisionRecord> = decRaw ? JSON.parse(decRaw) : {};
      set({ proposals, decisions, isHydrated: true });

      // If we have no fresh proposals (or they're stale), pull new ones
      const today = new Date().toDateString();
      const haveFreshToday = proposals.some(p => new Date(p.createdAt).toDateString() === today);
      if (!haveFreshToday) {
        await get().refreshProposals();
      }
    } catch (e: any) {
      set({ error: e?.message || 'Failed to load proposals', isHydrated: true });
    }
  },

  refreshProposals: async () => {
    set({ isLoading: true, error: null });
    try {
      // In production: const fresh = await api.getProposals();
      const fresh = buildSeedProposals();
      set({ proposals: fresh, isLoading: false });
      await AsyncStorage.setItem(STORAGE_KEY_PROPOSALS, JSON.stringify(fresh));
    } catch (e: any) {
      set({ isLoading: false, error: e?.message || 'Could not refresh' });
    }
  },

  acceptProposal: async (id: string) => {
    const p = get().proposals.find(x => x.id === id);
    if (!p) return null;
    const decisions = {
      ...get().decisions,
      [id]: { proposalId: id, decision: 'accepted' as const, decidedAt: new Date().toISOString() },
    };
    set({ decisions });
    await AsyncStorage.setItem(STORAGE_KEY_DECISIONS, JSON.stringify(decisions));
    return p;
  },

  declineProposal: async (id: string) => {
    const decisions = {
      ...get().decisions,
      [id]: { proposalId: id, decision: 'declined' as const, decidedAt: new Date().toISOString() },
    };
    set({ decisions });
    await AsyncStorage.setItem(STORAGE_KEY_DECISIONS, JSON.stringify(decisions));
  },

  pendingForToday: () => {
    const { proposals, decisions } = get();
    return proposals.filter(p => !decisions[p.id]);
  },
}));
