import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, List, UserCheck, ClipboardList, AlertTriangle } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import socket from '../lib/socket'
import ProjectCard from './ProjectCard'
import TaskCard from './TaskCard'
import SubtaskCard from './SubtaskCard'
import MemberCard from './MemberCard'
import ViewModal from './ViewModal'
import ProjectSettingsModal from './ProjectSettingsModal'
import TaskSettingsModal from './TaskSettingsModal'
import SubtaskSettingsModal from './SubtaskSettingsModal'
import NotifBar from './NotifBar'
import KanbanColumn from './KanbanColumn'
import type { Project, Task, Subtask, User } from '../types'

const themes: Record<string, string[]> = {
  default: ['#D5D8DC', '#DFE2E6', '#EAECEF', '#F4F5F7'],
  slate:   ['#CBD5E1', '#94A3B8', '#64748B', '#475569'],
  emerald: ['#A7F3D0', '#6EE7B7', '#34D399', '#10B981'],
  rose:    ['#FECDD3', '#FDA4AF', '#FB7185', '#F43F5E'],
  amber:   ['#FDE68A', '#FCD34D', '#FBBF24', '#F59E0B'],
  indigo:  ['#C7D2FE', '#A5B4FC', '#818CF8', '#6366F1'],
}

const PAGE_SIZE = 50

export default function KanbanBoard() {
  const user = useAuthStore(s => s.user)

  // Data state
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Pagination state
  const [projPage, setProjPage] = useState(1)
  const [taskPage, setTaskPage] = useState(1)
  const [subPage, setSubPage] = useState(1)
  const [userPage, setUserPage] = useState(1)
  const [projTotal, setProjTotal] = useState(0)
  const [taskTotal, setTaskTotal] = useState(0)
  const [subTotal, setSubTotal] = useState(0)
  const [userTotal, setUserTotal] = useState(0)
  const [loadingMore, setLoadingMore] = useState('')

  // UI state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [memberTab, setMemberTab] = useState('all')
  const [colorTheme, setColorTheme] = useState('default')
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [newProjectTitle, setNewProjectTitle] = useState('')
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [showCreateSubtask, setShowCreateSubtask] = useState(false)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newSubtaskTaskId, setNewSubtaskTaskId] = useState<number | null>(null)

  // Modal state
  const [viewItem, setViewItem] = useState<{ type: 'project' | 'task' | 'subtask'; data: any } | null>(null)
  const [projectSettings, setProjectSettings] = useState<Project | null>(null)
  const [taskSettings, setTaskSettings] = useState<Task | null>(null)
  const [subtaskSettings, setSubtaskSettings] = useState<Subtask | null>(null)

  // NotifBar state
  const [notifIndex, setNotifIndex] = useState(0)
  const [notifVisible, setNotifVisible] = useState(true)

  const columnBg = themes[colorTheme] || themes.default
  const notifMessage = 'هذا إشعار تجريبي — سيتم ربطه بالإشعارات الحقيقية لاحقاً'

  const loadedRef = useRef(false)

  // Load data with pagination
  const loadData = async () => {
    setLoading(true)
    setError(false)
    try {
      const [pRes, tRes, sRes, uRes] = await Promise.all([
        api.get<Project[]>(`/projects?page=1&pageSize=${PAGE_SIZE}`),
        api.get<Task[]>(`/tasks?page=1&pageSize=${PAGE_SIZE}`),
        api.get<Subtask[]>(`/subtasks?page=1&pageSize=${PAGE_SIZE}`),
        api.get<User[]>(`/users?page=1&pageSize=${PAGE_SIZE}`),
      ])
      setProjects(pRes.data.filter((p: Project) => p.status !== 'archived'))
      setProjTotal(Number(pRes.headers['x-total-count'] || pRes.data.length))
      setTasks(tRes.data)
      setTaskTotal(Number(tRes.headers['x-total-count'] || tRes.data.length))
      setSubtasks(sRes.data)
      setSubTotal(Number(sRes.headers['x-total-count'] || sRes.data.length))
      setUsers(uRes.data)
      setUserTotal(Number(uRes.headers['x-total-count'] || uRes.data.length))
      setProjPage(1); setTaskPage(1); setSubPage(1); setUserPage(1)
      loadedRef.current = true
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  const loadMore = async (type: string) => {
    setLoadingMore(type)
    try {
      if (type === 'projects') {
        const np = projPage + 1
        const res = await api.get<Project[]>(`/projects?page=${np}&pageSize=${PAGE_SIZE}`)
        setProjects(prev => { const ids = new Set(prev.map(p => p.id)); return [...prev, ...res.data.filter((p: Project) => p.status !== 'archived' && !ids.has(p.id))] })
        setProjPage(np)
      } else if (type === 'tasks') {
        const np = taskPage + 1
        const res = await api.get<Task[]>(`/tasks?page=${np}&pageSize=${PAGE_SIZE}`)
        setTasks(prev => [...prev, ...res.data])
        setTaskPage(np)
      } else if (type === 'subtasks') {
        const np = subPage + 1
        const res = await api.get<Subtask[]>(`/subtasks?page=${np}&pageSize=${PAGE_SIZE}`)
        setSubtasks(prev => [...prev, ...res.data])
        setSubPage(np)
      } else if (type === 'users') {
        const np = userPage + 1
        const res = await api.get<User[]>(`/users?page=${np}&pageSize=${PAGE_SIZE}`)
        setUsers(prev => [...prev, ...res.data])
        setUserPage(np)
      }
    } catch { console.error(`Failed to load more ${type}`) } finally { setLoadingMore('') }
  }

  useEffect(() => { loadData() }, [])

  // Socket real-time updates
  useEffect(() => {
    const handler = (msg: { type: string; action: string; data: any }) => {
      if (!loadedRef.current) return
      if (msg.type === 'project') {
        if (msg.action === 'created') setProjects(prev => prev.some(p => p.id === msg.data.id) ? prev : [msg.data, ...prev])
        else if (msg.action === 'updated') setProjects(prev => prev.map(p => p.id === msg.data.id ? { ...p, ...msg.data } : p))
        else if (msg.action === 'deleted') setProjects(prev => prev.filter(p => p.id !== msg.data.id))
      }
      if (msg.type === 'task') {
        if (msg.action === 'created') setTasks(prev => prev.some(t => t.id === msg.data.id) ? prev : [msg.data, ...prev])
        else if (msg.action === 'updated') setTasks(prev => prev.map(t => t.id === msg.data.id ? { ...t, ...msg.data } : t))
        else if (msg.action === 'deleted') setTasks(prev => prev.filter(t => t.id !== msg.data.id))
      }
      if (msg.type === 'subtask') {
        if (msg.action === 'created') setSubtasks(prev => prev.some(s => s.id === msg.data.id) ? prev : [msg.data, ...prev])
        else if (msg.action === 'updated') setSubtasks(prev => prev.map(s => s.id === msg.data.id ? { ...s, ...msg.data } : s))
        else if (msg.action === 'deleted') setSubtasks(prev => prev.filter(s => s.id !== msg.data.id))
      }
    }
    socket.on('list:update', handler)
    return () => { socket.off('list:update', handler) }
  }, [])

  // NotifBar interval
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifIndex(prev => (prev + 1) % 5)
      setNotifVisible(true)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  // Filtered data
  const [hideCompleted, setHideCompleted] = useState(false)

  const filteredTasks = useMemo(() =>
    selectedProject ? tasks.filter(t => t.project_id === selectedProject.id) : [],
    [selectedProject, tasks]
  )

  const filteredSubtasks = useMemo(() => {
    if (!selectedTask) return []
    let list = subtasks.filter(s => s.task_id === selectedTask.id)
    if (hideCompleted) list = list.filter(s => s.status !== 'completed' && s.status !== 'cancelled')
    return list
  }, [selectedTask, subtasks, hideCompleted])

  const filteredUsers = useMemo(() => {
    if (memberTab === 'active') return users.filter(u => !u.frozen_at)
    if (memberTab === 'on_task') {
      const assigneeIds = [...new Set(subtasks.map(s => s.assigned_to).filter((id): id is number => id !== null))]
      return users.filter(u => assigneeIds.includes(u.id))
    }
    return users
  }, [memberTab, users, subtasks])

  const handleSelect = (type: string, item: any) => {
    if (type === 'project') {
      setSelectedProject(item)
      setSelectedTask(null)
    } else if (type === 'task') {
      setSelectedTask(item)
    } else if (type === 'subtask') {
      // single click on subtask does nothing special (double-click opens view modal)
    }
  }

  const handleView = (type: 'project' | 'task' | 'subtask', data: any) => {
    setViewItem({ type, data })
  }

  const handleViewSettings = () => {
    if (!viewItem) return
    const item = viewItem
    setViewItem(null)
    if (item.type === 'project') setProjectSettings(item.data)
    else if (item.type === 'task') setTaskSettings(item.data)
    else if (item.type === 'subtask') setSubtaskSettings(item.data)
  }

  const handleUpdateSubtask = (updated: any) => {
    setSubtasks(prev => prev.map(s => s.id === updated.id ? { ...s, ...updated } : s))
  }

  const handleDeleteSubtask = (id: number) => {
    setSubtasks(prev => prev.filter(s => s.id !== id))
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="board-grid">
        {[0, 1, 2, 3].map(col => (
          <div key={col} className="rounded-xl flex flex-col overflow-hidden" style={{ background: columnBg[col] }}>
            <div className="px-4 py-2.5"><div className="skeleton h-4 w-20" /></div>
            <div className="col-body">
              {[0, 1, 2].map(i => <div key={i} className="skeleton h-24 w-full" />)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-gray-600 mb-3">فشل تحميل البيانات</p>
          <button onClick={loadData} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700">
            إعادة المحاولة
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 board-grid" style={{ minHeight: 0 }}>
        {/* Column 0: المشاريع */}
        <KanbanColumn header={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <List className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-bold text-gray-600">المشاريع</span>
              <span className="w-5 h-5 rounded-full text-[0.6rem] font-bold flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.1)', color: '#333' }}>{projects.length}</span>
            </div>
            {user?.is_manager && (
              <button onClick={() => setShowCreateProject(true)}
                className="w-6 h-6 rounded-full border-none flex items-center justify-center text-xs cursor-pointer transition-all hover:bg-gray-300" style={{ background: 'rgba(0,0,0,0.08)', color: '#777' }} title="إضافة مشروع">
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        } bg={columnBg[0]}>
            {showCreateProject && (
              <form onSubmit={async (e) => { e.preventDefault(); if (!newProjectTitle.trim()) return; try { const { data } = await api.post('/projects', { title: newProjectTitle }); setProjects(prev => prev.some(p => p.id === data.id) ? prev : [data, ...prev]); setShowCreateProject(false); setNewProjectTitle('') } catch (e) { console.error('createProject failed', e) } }}
                className="mx-2 mb-2 p-2 bg-white rounded-lg shadow-sm border border-gray-200">
                <input value={newProjectTitle} onChange={e => setNewProjectTitle(e.target.value)} placeholder="اسم المشروع"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 mb-1" autoFocus />
                <div className="flex gap-1">
                  <button type="submit" className="px-2 py-1 bg-indigo-600 text-white rounded text-[0.6rem] font-medium hover:bg-indigo-700">إنشاء</button>
                  <button type="button" onClick={() => { setShowCreateProject(false); setNewProjectTitle('') }} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[0.6rem] hover:bg-gray-200">إلغاء</button>
                </div>
              </form>
            )}
            {projects.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">لا توجد مشاريع</div>
            ) : (
              projects.map((p, i) => (
                <ProjectCard key={p.id} project={p}
                  selected={selectedProject?.id === p.id}
                  onSelect={() => handleSelect('project', p)}
                  onSettings={() => setProjectSettings(p)}
                  onView={() => handleView('project', p)}
                  index={i}
                  members={p.members} />
              ))
            )}
            {projects.length < projTotal && (
              <button onClick={() => loadMore('projects')} disabled={loadingMore === 'projects'}
                className="w-full py-2 text-xs text-indigo-600 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-40">
                {loadingMore === 'projects' ? 'جاري...' : `عرض المزيد (${projTotal - projects.length} متبقي)`}
              </button>
            )}
          </KanbanColumn>

        {/* Column 1: المهام */}
        <KanbanColumn header={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-bold text-gray-600">المهام</span>
              <span className="w-5 h-5 rounded-full text-[0.6rem] font-bold flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.1)', color: '#333' }}>{filteredTasks.length}</span>
            </div>
            {selectedProject && user?.is_manager && (
              <button onClick={() => setShowCreateTask(true)}
                className="w-6 h-6 rounded-full border-none flex items-center justify-center text-xs cursor-pointer transition-all hover:bg-gray-300" style={{ background: 'rgba(0,0,0,0.08)', color: '#777' }} title="إضافة مهمة">
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        } bg={columnBg[1]}>
            {showCreateTask && selectedProject && (
              <form onSubmit={async (e) => { e.preventDefault(); if (!newTaskTitle.trim()) return; try { const { data } = await api.post('/tasks', { project_id: selectedProject.id, title: newTaskTitle }); setTasks(prev => prev.some(t => t.id === data.id) ? prev : [data, ...prev]); setShowCreateTask(false); setNewTaskTitle('') } catch (e) { console.error('createTask failed', e) } }}
                className="mx-2 mb-2 p-2 bg-white rounded-lg shadow-sm border border-gray-200">
                <input value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="اسم المهمة"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 mb-1" autoFocus />
                <div className="flex gap-1">
                  <button type="submit" className="px-2 py-1 bg-indigo-600 text-white rounded text-[0.6rem] font-medium hover:bg-indigo-700">إنشاء</button>
                  <button type="button" onClick={() => { setShowCreateTask(false); setNewTaskTitle('') }} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[0.6rem] hover:bg-gray-200">إلغاء</button>
                </div>
              </form>
            )}
            {!selectedProject ? (
              <div className="text-center py-8 text-gray-400 text-xs">اختر مشروعاً لعرض المهام</div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">لا توجد مهام في هذا المشروع</div>
            ) : (
              filteredTasks.map((t, i) => (
                <TaskCard key={t.id} task={t}
                  selected={selectedTask?.id === t.id}
                  onSelect={() => handleSelect('task', t)}
                  onSettings={() => setTaskSettings(t)}
                  onView={() => handleView('task', t)}
                  index={i} />
              ))
            )}
            {tasks.length < taskTotal && (
              <button onClick={() => loadMore('tasks')} disabled={loadingMore === 'tasks'}
                className="w-full py-2 text-xs text-indigo-600 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-40">
                {loadingMore === 'tasks' ? 'جاري...' : `عرض المزيد (${taskTotal - tasks.length} متبقي)`}
              </button>
            )}
          </KanbanColumn>

        {/* Column 2: المهام الفرعية */}
        <KanbanColumn header={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-gray-600" />
              <span className="text-xs font-bold text-gray-600">المهام الفرعية</span>
              <span className="w-5 h-5 rounded-full text-[0.6rem] font-bold flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.1)', color: '#333' }}>{filteredSubtasks.length}</span>
            </div>
            <div className="flex items-center gap-1">
              {selectedProject && user?.is_manager && (
                <button onClick={() => { setShowCreateSubtask(true); setNewSubtaskTaskId(selectedTask?.id ?? null) }}
                  className="w-6 h-6 rounded-full border-none flex items-center justify-center text-xs cursor-pointer transition-all hover:bg-gray-300" style={{ background: 'rgba(0,0,0,0.08)', color: '#777' }} title="إضافة مهمة فرعية">
                  <Plus className="w-3 h-3" />
                </button>
              )}
              <button onClick={() => setHideCompleted(prev => !prev)}
                className={`px-1.5 py-0.5 rounded text-[0.55rem] font-medium transition-colors ${hideCompleted ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}
                title={hideCompleted ? 'إظهار المنجز' : 'إخفاء المنجز'}>
                {hideCompleted ? 'إظهار' : 'إخفاء'}
              </button>
            </div>
          </div>
        } bg={columnBg[2]}>
            {showCreateSubtask && (
              <form onSubmit={async (e) => { e.preventDefault(); if (!newSubtaskTitle.trim()) return; try { const tid = newSubtaskTaskId ?? selectedTask?.id; if (!tid) return; const { data } = await api.post('/subtasks', { task_id: tid, title: newSubtaskTitle }); setSubtasks(prev => prev.some(s => s.id === data.id) ? prev : [data, ...prev]); setShowCreateSubtask(false); setNewSubtaskTitle('') } catch (e) { console.error('createSubtask failed', e) } }}
                className="mx-2 mb-2 p-2 bg-white rounded-lg shadow-sm border border-gray-200">
                <input value={newSubtaskTitle} onChange={e => setNewSubtaskTitle(e.target.value)} placeholder="اسم المهمة الفرعية"
                  className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 mb-1" autoFocus />
                {!selectedTask && (
                  <select value={newSubtaskTaskId ?? ''} onChange={e => setNewSubtaskTaskId(Number(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs outline-none focus:ring-1 focus:ring-indigo-500 mb-1">
                    <option value="">اختر المهمة</option>
                    {tasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                )}
                <div className="flex gap-1">
                  <button type="submit" className="px-2 py-1 bg-indigo-600 text-white rounded text-[0.6rem] font-medium hover:bg-indigo-700">إنشاء</button>
                  <button type="button" onClick={() => { setShowCreateSubtask(false); setNewSubtaskTitle(''); setNewSubtaskTaskId(null) }} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-[0.6rem] hover:bg-gray-200">إلغاء</button>
                </div>
              </form>
            )}
            {!selectedTask && !showCreateSubtask ? (
              <div className="text-center py-8 text-gray-400 text-xs">اختر مهمة لعرض المهام الفرعية</div>
            ) : filteredSubtasks.length === 0 && !showCreateSubtask ? (
              <div className="text-center py-8 text-gray-400 text-xs">لا توجد مهام فرعية</div>
            ) : (
              filteredSubtasks.map((s, i) => (
                <SubtaskCard key={s.id} subtask={s}
                  onSelect={handleSelect}
                  onView={() => handleView('subtask', s)}
                  index={i} />
              ))
            )}
            {subtasks.length < subTotal && (
              <button onClick={() => loadMore('subtasks')} disabled={loadingMore === 'subtasks'}
                className="w-full py-2 text-xs text-indigo-600 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-40">
                {loadingMore === 'subtasks' ? 'جاري...' : `عرض المزيد (${subTotal - subtasks.length} متبقي)`}
              </button>
            )}
          </KanbanColumn>

        {/* Column 3: الأعضاء */}
        <KanbanColumn header={
          <div className="flex items-center justify-between w-full" style={{ minHeight: '44px' }}>
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full text-[0.6rem] font-bold flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.1)', color: '#333' }}>{filteredUsers.length}</span>
              {[
                { key: 'all', icon: List },
                { key: 'active', icon: UserCheck },
                { key: 'on_task', icon: ClipboardList },
              ].map(tab => {
                const Icon = tab.icon
                return (
                  <button key={tab.key} onClick={() => setMemberTab(tab.key)}
                    className="w-6 h-6 rounded-md border-none flex items-center justify-center text-xs cursor-pointer transition-all"
                    style={{
                      background: memberTab === tab.key ? (tab.key === 'active' ? '#d1fae5' : tab.key === 'on_task' ? '#ede9fe' : '#333') : 'rgba(0,0,0,0.06)',
                      color: memberTab === tab.key ? (tab.key === 'active' ? '#059669' : tab.key === 'on_task' ? '#7c3aed' : '#fff') : '#777',
                    }}
                    title={tab.key === 'all' ? 'الكل' : tab.key === 'active' ? 'النشطون' : 'على المهام'}>
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                )
              })}
            </div>
            <div className="flex items-center gap-1">
              <button className="w-6 h-6 rounded-full border-none flex items-center justify-center text-xs cursor-pointer transition-all hover:bg-gray-300" style={{ background: 'rgba(0,0,0,0.08)', color: '#777' }} title="إضافة عضو">
                <Plus className="w-3 h-3" />
              </button>
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center" title="إنذارات">
                <AlertTriangle className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>
        } bg={columnBg[3]}>
            {filteredUsers.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-xs">لا يوجد أعضاء</div>
            ) : (
              filteredUsers.map((u, i) => (
                <MemberCard key={u.id} member={u} onSelect={handleSelect} index={i} />
              ))
            )}
            {users.length < userTotal && (
              <button onClick={() => loadMore('users')} disabled={loadingMore === 'users'}
                className="w-full py-2 text-xs text-indigo-600 hover:bg-white/50 rounded-lg transition-colors disabled:opacity-40">
                {loadingMore === 'users' ? 'جاري...' : `عرض المزيد (${userTotal - users.length} متبقي)`}
              </button>
            )}
          </KanbanColumn>
      </div>

      {/* NotifBar */}
      {notifVisible && (
        <NotifBar notif={notifMessage} onClose={() => setNotifVisible(false)} index={notifIndex}
          colorTheme={colorTheme} setColorTheme={setColorTheme} />
      )}

      {/* Modals */}
      <ViewModal item={viewItem} onClose={() => setViewItem(null)} onSettings={handleViewSettings} />
      {projectSettings && (
        <ProjectSettingsModal project={projectSettings} onClose={() => setProjectSettings(null)} />
      )}
      {taskSettings && (
        <TaskSettingsModal task={taskSettings} onClose={() => setTaskSettings(null)} />
      )}
      {subtaskSettings && (
        <SubtaskSettingsModal subtask={subtaskSettings} onClose={() => setSubtaskSettings(null)}
          onUpdate={handleUpdateSubtask} onDelete={handleDeleteSubtask} />
      )}
    </div>
  )
}
