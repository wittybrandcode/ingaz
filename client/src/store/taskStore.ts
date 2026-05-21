import { create } from 'zustand'
import type { Task } from '../types'

interface TaskStore {
  tasks: Task[]
  selectedTaskId: number | null
  setTasks: (tasks: Task[]) => void
  setSelectedTaskId: (id: number | null) => void
  addTask: (task: Task) => void
  updateTask: (id: number, data: Partial<Task>) => void
  removeTask: (id: number) => void
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],
  selectedTaskId: null,
  setTasks: (tasks) => set({ tasks }),
  setSelectedTaskId: (id) => set({ selectedTaskId: id }),
  addTask: (task) => set(s => ({ tasks: [task, ...s.tasks] })),
  updateTask: (id, data) => set(s => ({ tasks: s.tasks.map(t => t.id === id ? { ...t, ...data } : t) })),
  removeTask: (id) => set(s => ({ tasks: s.tasks.filter(t => t.id !== id) })),
}))
