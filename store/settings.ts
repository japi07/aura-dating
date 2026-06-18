/**
 * Settings store — all persistent user preferences in one place.
 * Backed by AsyncStorage so toggles survive restarts.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'aura.settings.v1';

export interface NotificationPrefs {
  newProposal: boolean;
  proposalReminder: boolean;
  proposalExpiring: boolean;
  dateConfirmed: boolean;
  dateReminder: boolean;
  dateRescheduled: boolean;
  dateRecap: boolean;
  eventNearby: boolean;
  newsletter: boolean;
  productUpdates: boolean;
  allMuted: boolean;
}

export interface PrivacyPrefs {
  visibility: 'all' | 'verifiedOnly' | 'paused';
  hideJob: boolean;
  hideAge: boolean;
  showLastSeen: boolean;
  readReceipts: boolean;
  incognito: boolean;
  shareAnalytics: boolean;
}

export interface DatePrefs {
  intention: 'serious' | 'dating' | 'open';
  ageMin: number;
  ageMax: number;
  radiusKm: number;
  dateTypes: string[];     // category ids the user accepts
  availableDays: string[]; // ['Mon','Tue',...]
  proposalsPerDay: 1 | 2 | 3 | 5;
}

export interface SafetyPrefs {
  emergencyContacts: { id: string; name: string; phone: string }[];
  blockedUserIds: string[];
}

export interface AppSettings {
  notifications: NotificationPrefs;
  privacy: PrivacyPrefs;
  dates: DatePrefs;
  safety: SafetyPrefs;
}

const DEFAULT_SETTINGS: AppSettings = {
  notifications: {
    newProposal: true,
    proposalReminder: true,
    proposalExpiring: true,
    dateConfirmed: true,
    dateReminder: true,
    dateRescheduled: true,
    dateRecap: true,
    eventNearby: true,
    newsletter: false,
    productUpdates: false,
    allMuted: false,
  },
  privacy: {
    visibility: 'all',
    hideJob: false,
    hideAge: false,
    showLastSeen: false,
    readReceipts: true,
    incognito: false,
    shareAnalytics: true,
  },
  dates: {
    intention: 'serious',
    ageMin: 26,
    ageMax: 38,
    radiusKm: 15,
    dateTypes: ['dinner', 'coffee', 'walk', 'gallery'],
    availableDays: ['Fri', 'Sat', 'Sun'],
    proposalsPerDay: 3,
  },
  safety: {
    emergencyContacts: [],
    blockedUserIds: [],
  },
};

interface SettingsState extends AppSettings {
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  updateNotifications: (patch: Partial<NotificationPrefs>) => Promise<void>;
  updatePrivacy: (patch: Partial<PrivacyPrefs>) => Promise<void>;
  updateDates: (patch: Partial<DatePrefs>) => Promise<void>;
  blockUser: (id: string) => Promise<void>;
  unblockUser: (id: string) => Promise<void>;
  addEmergencyContact: (name: string, phone: string) => Promise<void>;
  removeEmergencyContact: (id: string) => Promise<void>;
  resetAll: () => Promise<void>;
}

const persist = async (s: AppSettings) => AsyncStorage.setItem(KEY, JSON.stringify(s));

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...DEFAULT_SETTINGS,
  isHydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw) {
        const stored = JSON.parse(raw) as AppSettings;
        // Merge with defaults so newly-added settings still get sane initial values
        set({
          notifications: { ...DEFAULT_SETTINGS.notifications, ...stored.notifications },
          privacy: { ...DEFAULT_SETTINGS.privacy, ...stored.privacy },
          dates: { ...DEFAULT_SETTINGS.dates, ...stored.dates },
          safety: { ...DEFAULT_SETTINGS.safety, ...stored.safety },
          isHydrated: true,
        });
      } else {
        set({ isHydrated: true });
      }
    } catch {
      set({ isHydrated: true });
    }
  },

  updateNotifications: async (patch) => {
    const next = { ...get().notifications, ...patch };
    set({ notifications: next });
    await persist({ notifications: next, privacy: get().privacy, dates: get().dates, safety: get().safety });
  },

  updatePrivacy: async (patch) => {
    const next = { ...get().privacy, ...patch };
    set({ privacy: next });
    await persist({ notifications: get().notifications, privacy: next, dates: get().dates, safety: get().safety });
  },

  updateDates: async (patch) => {
    const next = { ...get().dates, ...patch };
    set({ dates: next });
    await persist({ notifications: get().notifications, privacy: get().privacy, dates: next, safety: get().safety });
  },

  blockUser: async (id) => {
    const list = Array.from(new Set([...get().safety.blockedUserIds, id]));
    const next = { ...get().safety, blockedUserIds: list };
    set({ safety: next });
    await persist({ notifications: get().notifications, privacy: get().privacy, dates: get().dates, safety: next });
  },

  unblockUser: async (id) => {
    const list = get().safety.blockedUserIds.filter(x => x !== id);
    const next = { ...get().safety, blockedUserIds: list };
    set({ safety: next });
    await persist({ notifications: get().notifications, privacy: get().privacy, dates: get().dates, safety: next });
  },

  addEmergencyContact: async (name, phone) => {
    const contact = { id: `ec_${Date.now()}`, name: name.trim(), phone: phone.trim() };
    const list = [...get().safety.emergencyContacts, contact];
    const next = { ...get().safety, emergencyContacts: list };
    set({ safety: next });
    await persist({ notifications: get().notifications, privacy: get().privacy, dates: get().dates, safety: next });
  },

  removeEmergencyContact: async (id) => {
    const list = get().safety.emergencyContacts.filter(c => c.id !== id);
    const next = { ...get().safety, emergencyContacts: list };
    set({ safety: next });
    await persist({ notifications: get().notifications, privacy: get().privacy, dates: get().dates, safety: next });
  },

  resetAll: async () => {
    set({ ...DEFAULT_SETTINGS });
    await persist(DEFAULT_SETTINGS);
  },
}));
