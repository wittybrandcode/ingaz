import { create } from 'zustand'
import api from '../lib/api'
import type { Task } from '../types'

interface TaskStore {
  tasks: Task[]
  selectedTaskId: number | null
  loading: boolean
  error: string | null
  page: number
  hasMore: boolean
  setTasks: (tasks: Task[]) => void
  setSelectedTaskId: (id: number | null) => void
  addTask: (task: Task) => void
  updateTask: (id: number, data: Partial<Task>) => void
  removeTask: (id: number) => void
  loadTasks: (projectId?: number) => Promise<void>
  loadMore: (projectId?: number) => Promise<void>
  createTask: (projectId: number, title: string, description?: string) => Promise<Task | null>
}

export const useTaskStore = create<TaskStore>((set, get) => ({
  tasks: [],
  selectedTaskId: null,
  loading: false,
  error: null,
  page: 1,
  hasMore: true,
  setTasks: (tasks) => set({ tasks }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  addTask: (task) => set(s => ({ tasks: [task, ...s.tasks] })),
  updateTask: (id, data) => set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...data } : t) })),
  removeTask: (id) => set(s => ({ tasks: s.tasks.filter(t => t.id !== id) })),
  loadTasks: async (projectId) => {
    set({ loading: true, error: null, page: 1 })
    try {
      const url = projectId ? `/tasks/project/${projectId}` : '/tasks'
      const { data } = await api.get<Task[]>(url)
      set({ tasks: data, loading: false, hasMore: data.length >= 50 })
    } catch {
      set({ loading: false, error: 'فشل تحميل المهام' })
    }
  },
  loadMore: async (projectId) => {
    const { loading, page, hasMore } = get()
    if (loading || !hasMore) return
    const nextPage = page + 1
    set({ loading: true })
    try {
      const url = projectId ? `/tasks/project/${projectId}` : '/tasks'
      const { data } = await api.get<Task[]>(url, { params: { page: nextPage, pageSize: 50 } })
      set(s => ({ tasks: [...s.tasks, ...data], page: nextPage, loading: false, hasMore: data.length >= 50 }))
    } catch {
      set({ loading: false, error: 'فشل تحميل المزيد من المهام' })
    }
  },
  createTask: async (projectId, title, description) => {
    try {
      const { data } = await api.post<Task>('/tasks', { project_id: projectId, title, description: description || '' })
      set(s => ({ tasks: [data, ...s.tasks] }))
      return data
    } catch {
      return null
    }
  },
}))
