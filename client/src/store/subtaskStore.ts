import { create } from 'zustand'
import api from '../lib/api'
import type { Subtask } from '../types'

interface SubtaskStore {
  subtasks: Subtask[]
  loading: boolean
  error: string | null
  setSubtasks: (subtasks: Subtask[]) => void
  addSubtask: (subtask: Subtask) => void
  updateSubtask: (id: number, data: Partial<Subtask>) => void
  removeSubtask: (id: number) => void
  loadSubtasks: (taskId: number) => Promise<void>
  loadSubtasksByIds: (taskIds: number[]) => Promise<void>
  createSubtask: (taskId: number, title: string, description?: string) => Promise<Subtask | null>
}

export const useSubtaskStore = create<SubtaskStore>((set) => ({
  subtasks: [],
  loading: false,
  error: null,
  setSubtasks: (subtasks) => set({ subtasks }),
  addSubtask: (subtask) => set(s => ({ subtasks: [subtask, ...s.subtasks] })),
  updateSubtask: (id, data) => set(s => ({ subtasks: s.subtasks.map(st => st.id === id ? { ...st, ...data } : st) })),
  removeSubtask: (id) => set(s => ({ subtasks: s.subtasks.filter(st => st.id !== id) })),
  loadSubtasks: async (taskId) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get<Subtask[]>(`/subtasks/task/${taskId}`)
      set({ subtasks: data, loading: false })
    } catch {
      set({ loading: false, error: 'فشل تحميل المهام الفرعية' })
    }
  },
  loadSubtasksByIds: async (taskIds) => {
    set({ loading: true, error: null })
    try {
      const { data } = await api.get<Subtask[]>('/subtasks/by-tasks', { params: { task_ids: taskIds.join(',') } })
      set({ subtasks: data, loading: false })
    } catch {
      set({ loading: false, error: 'فشل تحميل المهام الفرعية' })
    }
  },
  createSubtask: async (taskId, title, description) => {
    try {
      const { data } = await api.post<Subtask>('/subtasks', { task_id: taskId, title, description: description || '' })
      set(s => ({ subtasks: [data, ...s.subtasks] }))
      return data
    } catch {
      return null
    }
  },
}))
