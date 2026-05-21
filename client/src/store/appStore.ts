import { create } from 'zustand'
import api from '../lib/api'
import type { User, Role, Project } from '../types'

interface AppState {
  users: User[]
  roles: Role[]
  projects: Project[]
  usersLoading: boolean
  rolesLoading: boolean
  projectsLoading: boolean
  usersError: string
  rolesError: string
  projectsError: string
  loadUsers: () => Promise<void>
  loadRoles: () => Promise<void>
  loadProjects: () => Promise<void>
  updateUsers: (fn: (prev: User[]) => User[]) => void
  lastSubtaskUpdate: { id: number; status: string } | null
  lastListUpdate: { type: string; action: string; data: Record<string, unknown> } | null
  pushSubtaskUpdate: (update: { id: number; status: string }) => void
  pushListUpdate: (update: { type: string; action: string; data: Record<string, unknown> }) => void
}

export const useAppStore = create<AppState>((set) => ({
  users: [],
  roles: [],
  projects: [],
  usersLoading: false,
  rolesLoading: false,
  projectsLoading: false,
  usersError: '',
  rolesError: '',
  projectsError: '',

  loadUsers: async () => {
    set({ usersLoading: true, usersError: '' })
    try {
      const { data } = await api.get<User[]>('/users')
      set({ users: data, usersLoading: false })
    } catch { set({ usersLoading: false, usersError: 'فشل تحميل المستخدمين' }) }
  },

  loadRoles: async () => {
    set({ rolesLoading: true, rolesError: '' })
    try {
      const { data } = await api.get<Role[]>('/roles')
      set({ roles: data, rolesLoading: false })
    } catch { set({ rolesLoading: false, rolesError: 'فشل تحميل الأدوار' }) }
  },

  loadProjects: async () => {
    set({ projectsLoading: true, projectsError: '' })
    try {
      const { data } = await api.get<Project[]>('/projects')
      set({ projects: data, projectsLoading: false })
    } catch { set({ projectsLoading: false, projectsError: 'فشل تحميل المشاريع' }) }
  },

  updateUsers: (fn) => set(s => ({ users: fn(s.users) })),

  lastSubtaskUpdate: null,
  lastListUpdate: null,
  pushSubtaskUpdate: (update) => set({ lastSubtaskUpdate: update }),
  pushListUpdate: (update) => set({ lastListUpdate: update }),
}))
