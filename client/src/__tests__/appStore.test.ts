import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/api', () => ({
  default: {
    get: vi.fn(),
  },
}))

const mockApi = vi.mocked((await import('../lib/api')).default)

import { useAppStore } from '../store/appStore'

describe('appStore', () => {
  beforeEach(() => {
    useAppStore.setState({
      users: [],
      roles: [],
      projects: [],
      usersLoading: false,
      rolesLoading: false,
      projectsLoading: false,
      usersError: '',
      rolesError: '',
      projectsError: '',
      lastSubtaskUpdate: null,
      lastListUpdate: null,
      lastNotification: null,
      lastComment: null,
      lastWinnerSelected: null,
    })
  })

  it('initial state is empty', () => {
    const state = useAppStore.getState()
    expect(state.users).toEqual([])
    expect(state.roles).toEqual([])
    expect(state.projects).toEqual([])
  })

  it('pushSubtaskUpdate sets lastSubtaskUpdate', () => {
    useAppStore.getState().pushSubtaskUpdate({ id: 1, status: 'approved' })
    expect(useAppStore.getState().lastSubtaskUpdate).toEqual({ id: 1, status: 'approved' })
  })

  it('pushListUpdate sets lastListUpdate', () => {
    useAppStore.getState().pushListUpdate({ type: 'task', action: 'create', data: { id: 1 } })
    expect(useAppStore.getState().lastListUpdate).toEqual({ type: 'task', action: 'create', data: { id: 1 } })
  })

  it('pushNotification sets lastNotification', () => {
    useAppStore.getState().pushNotification({ message: 'test' })
    expect(useAppStore.getState().lastNotification).toEqual({ message: 'test' })
  })

  it('pushComment sets lastComment', () => {
    const comment = { id: 1, subtask_id: 1, user_id: 1, content: 'test', created_at: 'now', user_name: 'test', user_avatar: null }
    useAppStore.getState().pushComment(comment)
    expect(useAppStore.getState().lastComment).toEqual(comment)
  })

  it('setWinnerSelected sets lastWinnerSelected', () => {
    useAppStore.getState().setWinnerSelected({ commentId: 1, subtaskId: 2 })
    expect(useAppStore.getState().lastWinnerSelected).toEqual({ commentId: 1, subtaskId: 2 })
  })

  it('updateUsers applies transformation', () => {
    useAppStore.setState({ users: [{ id: 1, name: 'test', email: 'test@test.com', role_id: 1, role_name: 'user', avatar: null, status: 'active', frozen_at: null }] })
    useAppStore.getState().updateUsers(prev => prev.filter(u => u.id !== 1))
    expect(useAppStore.getState().users).toEqual([])
  })

  it('loadUsers sets loading and error on failure', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('فشل'))
    await useAppStore.getState().loadUsers()
    const state = useAppStore.getState()
    expect(state.usersLoading).toBe(false)
    expect(state.usersError).toBe('فشل تحميل المستخدمين')
  })

  it('loadRoles sets loading and error on failure', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('فشل'))
    await useAppStore.getState().loadRoles()
    const state = useAppStore.getState()
    expect(state.rolesLoading).toBe(false)
    expect(state.rolesError).toBe('فشل تحميل الأدوار')
  })

  it('loadProjects sets loading and error on failure', async () => {
    mockApi.get.mockRejectedValueOnce(new Error('فشل'))
    await useAppStore.getState().loadProjects()
    const state = useAppStore.getState()
    expect(state.projectsLoading).toBe(false)
    expect(state.projectsError).toBe('فشل تحميل المشاريع')
  })
})
