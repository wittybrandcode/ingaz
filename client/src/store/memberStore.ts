import { create } from 'zustand'
import api from '../lib/api'

export interface MemberProfile {
  id: number
  name: string
  email: string
  avatar: string | null
  role_id: number | null
  role_name: string | null
  is_manager: number | null
  frozen_at: string | null
  active_tasks: number
  warnings_count: number
  projects_count: number
  can_assign: boolean
  online: boolean
  unread_count: number
}

interface MemberStore {
  members: MemberProfile[]
  onlineUsers: Set<number>
  selectedMemberId: number | null
  loading: boolean
  error: string | null
  loadMembers: () => Promise<void>
  selectMember: (id: number | null) => void
  setOnline: (userId: number, online: boolean) => void
}

export const useMemberStore = create<MemberStore>((set) => ({
  members: [],
  onlineUsers: new Set(),
  selectedMemberId: null,
  loading: false,
  error: null,
  loadMembers: async () => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get<MemberProfile[]>('/members')
      set({ members: data, loading: false })
    } catch {
      set({ loading: false, error: 'فشل تحميل قائمة الأعضاء' })
    }
  },
  selectMember: (id) => set({ selectedMemberId: id }),
  setOnline: (userId, online) => {
    set((s) => {
      const next = new Set(s.onlineUsers)
      if (online) next.add(userId)
      else next.delete(userId)
      return {
        onlineUsers: next,
        members: s.members.map(m =>
          m.id === userId ? { ...m, online } : m
        ),
      }
    })
  },
}))
