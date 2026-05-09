/**
 * Users directory — every account that has ever registered or logged in
 * on this device. Used to power the recipient picker in the proposal
 * composer (so you can choose the actual person you're proposing to,
 * not type their email).
 *
 * In production this is replaced by a backend search/discovery API.
 * For local-only testing it gives us a real cross-account flow.
 */
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from './auth';

const KEY = 'aura.usersDirectory.v1';

export interface DirectoryUser {
  id: string;
  email: string;
  name: string;
  age?: number;
  city?: string;
  bio?: string;
  gender?: string;
  genderInterest?: string;
  photoUrl?: string;
  verified?: boolean;
  /** When the entry was added or last refreshed */
  updatedAt: string;
}

interface UsersState {
  users: DirectoryUser[];
  isHydrated: boolean;
  hydrate: () => Promise<void>;
  /** Insert or update a user by email */
  upsertUser: (u: User) => Promise<void>;
  /** Remove from directory by email */
  removeUser: (email: string) => Promise<void>;
  /** All users except the given email */
  candidatesFor: (currentUserEmail: string, opts?: { genderInterest?: string }) => DirectoryUser[];
}

const persist = async (users: DirectoryUser[]) => AsyncStorage.setItem(KEY, JSON.stringify(users));

export const useUsersStore = create<UsersState>((set, get) => ({
  users: [],
  isHydrated: false,

  hydrate: async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      const users: DirectoryUser[] = raw ? JSON.parse(raw) : [];
      set({ users, isHydrated: true });
    } catch {
      set({ isHydrated: true });
    }
  },

  upsertUser: async (u: User) => {
    if (!u?.email) return;
    const lc = u.email.toLowerCase().trim();
    const next: DirectoryUser = {
      id: u.id,
      email: lc,
      name: u.name,
      age: u.age,
      city: u.city,
      bio: u.bio,
      gender: u.gender?.toLowerCase(),
      genderInterest: u.genderInterest?.toLowerCase(),
      photoUrl: u.photoUrl,
      verified: u.verified,
      updatedAt: new Date().toISOString(),
    };
    const others = get().users.filter(x => x.email !== lc);
    const list = [next, ...others];
    set({ users: list });
    await persist(list);
  },

  removeUser: async (email: string) => {
    const lc = email.toLowerCase().trim();
    const list = get().users.filter(u => u.email !== lc);
    set({ users: list });
    await persist(list);
  },

  candidatesFor: (currentUserEmail: string, opts) => {
    const lc = currentUserEmail?.toLowerCase().trim();
    const gi = opts?.genderInterest?.toLowerCase();
    return get().users
      .filter(u => u.email !== lc)
      .filter(u => {
        // If we know what the sender is interested in, only show matching gender.
        // 'everyone' / unspecified => no filter.
        if (!gi || gi === 'everyone') return true;
        return !u.gender || u.gender === gi;
      })
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  },
}));
