import { create } from 'zustand'
import type { Subtask } from '../types'

interface SubtaskStore {
  subtasks: Subtask[]
  setSubtasks: (subtasks: Subtask[]) => void
  addSubtask: (subtask: Subtask) => void
  updateSubtask: (id: number, data: Partial<Subtask>) => void
  removeSubtask: (id: number) => void
}

export const useSubtaskStore = create<SubtaskStore>((set) => ({
  subtasks: [],
  setSubtasks: (subtasks) => set({ subtasks }),
  addSubtask: (subtask) => set(s => ({ subtasks: [subtask, ...s.subtasks] })),
  updateSubtask: (id, data) => set(s => ({ subtasks: s.subtasks.map(st => st.id === id ? { ...st, ...data } : st) })),
  removeSubtask: (id) => set(s => ({ subtasks: s.subtasks.filter(st => st.id !== id) })),
}))
