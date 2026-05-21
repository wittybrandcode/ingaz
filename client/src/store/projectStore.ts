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
      set({ project: data, loading: false })
    } catch {
      set({ loading: false, error: 'فشل تحميل بيانات المشروع' })
    }
  },
}))
