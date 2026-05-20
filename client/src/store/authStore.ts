import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../lib/api';
import type { User, AuthState } from '../types';

interface AuthStore extends AuthState {
  token: string | null;
  permissions: string[];
  clearToken: () => void;
}

export const useAuthStore = create<AuthStore>()(persist((set) => ({
  user: null,
  token: null,
  permissions: [],
  loading: true,
  login: async (email, password) => {
    const { data } = await api.post<{ user: User & { permissions: string[] }; token: string }>('/auth/login', { email, password });
    set({ user: data.user, token: data.token, permissions: data.user.permissions });
  },
  logout: async () => {
    try { await api.post('/auth/logout'); } catch (e) { console.error('logout failed', e) }
    set({ user: null, token: null, permissions: [] });
  },
  loadUser: async () => {
    try {
      const { data } = await api.get<User & { permissions: string[] }>('/auth/me');
      set({ user: data, permissions: data.permissions, loading: false });
    } catch {
      set({ loading: false });
    }
  },
  clearToken: () => set({ user: null, token: null, permissions: [] })
}), { name: 'auth-storage' }));
