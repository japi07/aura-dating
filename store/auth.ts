import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface User {
  id: string;
  email: string;
  name: string;
  profileComplete: boolean;
  age?: number;
  birthday?: string;
  city?: string;
  bio?: string;
  interests?: string[];
  gender?: string;
  genderInterest?: string;
  photoUrl?: string;
  verified?: boolean;
  verifiedAt?: string;
}

interface AuthStore {
  token: string | null;
  user: User | null;
  isLoading: boolean;
  isHydrated: boolean;
  setToken: (token: string | null) => Promise<void>;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,
  isLoading: false,
  isHydrated: false,

  setToken: async (token: string | null) => {
    if (token) {
      try {
        await SecureStore.setItemAsync('authToken', token);
      } catch (error) {
        console.error('Failed to store token:', error);
      }
    } else {
      try {
        await SecureStore.deleteItemAsync('authToken');
      } catch (error) {
        console.error('Failed to delete token:', error);
      }
    }
    set({ token });
  },

  setUser: (user: User | null) => {
    // Persist user to SecureStore
    if (user) {
      try {
        SecureStore.setItemAsync('userData', JSON.stringify(user));
      } catch (error) {
        console.error('Failed to store user:', error);
      }
    } else {
      try {
        SecureStore.deleteItemAsync('userData');
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    }
    set({ user });
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync('userData');
    } catch (error) {
      console.error('Failed to delete data during logout:', error);
    }
    set({ token: null, user: null });
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      const userJson = await SecureStore.getItemAsync('userData');
      const user = userJson ? JSON.parse(userJson) : null;
      set({ token: token || null, user, isHydrated: true });
    } catch (error) {
      console.error('Failed to hydrate auth store:', error);
      set({ isHydrated: true });
    }
  },
}));
