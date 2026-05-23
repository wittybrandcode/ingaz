import { create } from 'zustand'
import api from '../lib/api'
import type { ProjectDetail, ProjectMember } from '../types'

interface ProjectStore {
  project: ProjectDetail | null
  members: ProjectMember[]
  error: string | null
  loading: boolean
  setProject: (project: ProjectDetail | null) => void
  setMembers: (members: ProjectMember[]) => void
  loadProject: (id: number) => Promise<void>
  updateProjectDesc: (id: number, description: string) => Promise<boolean>
  addMember: (projectId: number, userId: number) => Promise<boolean>
  removeMember: (projectId: number, userId: number) => Promise<boolean>
}

export const useProjectStore = create<ProjectStore>((set) => ({
  project: null,
  members: [],
  error: null,
  loading: false,
  setProject: (project) => set({ project }),
  setMembers: (members) => set({ members }),
  loadProject: async (id) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get<ProjectDetail>(`/projects/${id}`)
      set({ project: data, members: data.members || [], loading: false })
    } catch {
      set({ loading: false, error: 'فشل تحميل بيانات المشروع' })
    }
  },
  updateProjectDesc: async (id, description) => {
    try {
      await api.put(`/projects/${id}`, { description })
      set(s => ({ project: s.project ? { ...s.project, description } : null }))
      return true
    } catch {
      return false
    }
  },
  addMember: async (projectId, userId) => {
    try {
      await api.post(`/projects/${projectId}/members`, { user_id: userId })
      const { data } = await api.get<ProjectMember[]>(`/projects/${projectId}/members`)
      set({ members: data })
      return true
    } catch {
      return false
    }
  },
  removeMember: async (projectId, userId) => {
    try {
      await api.delete(`/projects/${projectId}/members/${userId}`)
      set(s => ({ members: s.members.filter(m => m.user_id !== userId) }))
      return true
    } catch {
      return false
    }
  },
}))
