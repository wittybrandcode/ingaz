import { useState, useEffect, useMemo, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useMemberStore } from '../store/memberStore'
import { useListUpdates } from '../lib/eventBus'
import AssignModal from './AssignModal'
import WarnModal from './WarnModal'
import MemberDetailModal from './MemberDetailModal'
import ViewModal from './ViewModal'
import ProjectSettingsModal from './ProjectSettingsModal'
import TaskSettingsModal from './TaskSettingsModal'
import SubtaskSettingsModal from './SubtaskSettingsModal'
import NotifBar from './NotifBar'
import ProjectsColumn from './ProjectsColumn'
import TasksColumn from './TasksColumn'
import SubtasksColumn from './SubtasksColumn'
import MembersColumn from './MembersColumn'
import type { Project, Task, Subtask } from '../types'
import type { MemberProfile } from '../store/memberStore'

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
  const [users, setUsers] = useState<MemberProfile[]>([])
  const [loadingMore, setLoadingMore] = useState('')

  // UI state
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [memberTab, setMemberTab] = useState('all')
  const [colorTheme, setColorTheme] = useState('default')

  // Modal state
  const [viewItem, setViewItem] = useState<{ type: 'project' | 'task' | 'subtask'; data: any } | null>(null)
  const [projectSettings, setProjectSettings] = useState<Project | null>(null)
  const [taskSettings, setTaskSettings] = useState<Task | null>(null)
  const [subtaskSettings, setSubtaskSettings] = useState<Subtask | null>(null)

  // Member action state
  const [selectedKanbanMember, setSelectedKanbanMember] = useState<number | null>(null)
  const [assignTarget, setAssignTarget] = useState<MemberProfile | null>(null)
  const [warnTarget, setWarnTarget] = useState<MemberProfile | null>(null)
  const [detailTarget, setDetailTarget] = useState<MemberProfile | null>(null)

  // NotifBar state
  const [notifIndex, setNotifIndex] = useState(0)
  const [notifVisible, setNotifVisible] = useState(true)

  const columnBg = themes[colorTheme] || themes.default
  const notifMessage = 'هذا إشعار تجريبي — سيتم ربطه بالإشعارات الحقيقية لاحقاً'

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [projTotal, setProjTotal] = useState(0)
  const [taskTotal, setTaskTotal] = useState(0)
  const [subTotal, setSubTotal] = useState(0)
  const [projPage, setProjPage] = useState(1)
  const [taskPage, setTaskPage] = useState(1)
  const [subPage, setSubPage] = useState(1)

  const loadedRef = useRef(false)

  // Load data with pagination
  const loadData = async () => {
    setLoading(true)
    setError(false)
    try {
      const [pRes, tRes, sRes, mRes] = await Promise.all([
        api.get<Project[]>(`/projects?page=1&pageSize=${PAGE_SIZE}`),
        api.get<Task[]>(`/tasks?page=1&pageSize=${PAGE_SIZE}`),
        api.get<Subtask[]>(`/subtasks?page=1&pageSize=${PAGE_SIZE}`),
        api.get<MemberProfile[]>('/members'),
      ])
      setProjects(pRes.data.filter((p: Project) => p.status !== 'archived'))
      setProjTotal(Number(pRes.headers['x-total-count'] || pRes.data.length))
      setTasks(tRes.data)
      setTaskTotal(Number(tRes.headers['x-total-count'] || tRes.data.length))
      setSubtasks(sRes.data)
      setSubTotal(Number(sRes.headers['x-total-count'] || sRes.data.length))
      setUsers(mRes.data)
      useMemberStore.getState().setMembers(mRes.data)
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
      }
    } catch { console.error(`Failed to load more ${type}`) } finally { setLoadingMore('') }
  }

  useEffect(() => { loadData() }, [])

  // Socket real-time updates (centralized via eventBus)
  useListUpdates((msg) => {
    if (!loadedRef.current) return
    const d = msg.data as any
    if (msg.type === 'project') {
      if (msg.action === 'created') setProjects(prev => prev.some(p => p.id === d.id) ? prev : [d, ...prev])
      else if (msg.action === 'updated') setProjects(prev => prev.map(p => p.id === d.id ? { ...p, ...d } : p))
      else if (msg.action === 'deleted') setProjects(prev => prev.filter(p => p.id !== d.id))
    }
    if (msg.type === 'task') {
      if (msg.action === 'created') setTasks(prev => prev.some(t => t.id === d.id) ? prev : [d, ...prev])
      else if (msg.action === 'updated') setTasks(prev => prev.map(t => t.id === d.id ? { ...t, ...d } : t))
      else if (msg.action === 'deleted') setTasks(prev => prev.filter(t => t.id !== d.id))
    }
    if (msg.type === 'subtask') {
      if (msg.action === 'created') setSubtasks(prev => prev.some(s => s.id === d.id) ? prev : [d, ...prev])
      else if (msg.action === 'updated') setSubtasks(prev => prev.map(s => s.id === d.id ? { ...s, ...d } : s))
      else if (msg.action === 'deleted') setSubtasks(prev => prev.filter(s => s.id !== d.id))
    }
  })

  // NotifBar interval
  useEffect(() => {
    const interval = setInterval(() => {
      setNotifIndex(prev => (prev + 1) % 5)
      setNotifVisible(true)
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  const [hideCompleted, setHideCompleted] = useState(false)

  const filteredUsers = useMemo(() => {
    const others = users.filter(u => u.id !== user?.id)
    if (memberTab === 'active') return others.filter(u => !u.frozen_at)
    if (memberTab === 'on_task') {
      const assigneeIds = [...new Set(subtasks.map(s => s.assigned_to).filter((id): id is number => id !== null))]
      return others.filter(u => assigneeIds.includes(u.id))
    }
    return others
  }, [memberTab, users, subtasks, user?.id])

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
        <ProjectsColumn
          projects={projects}
          total={projTotal}
          selectedId={selectedProject?.id ?? null}
          loadingMore={loadingMore}
          onSelect={(p) => handleSelect('project', p)}
          onSettings={setProjectSettings}
          onView={(p) => handleView('project', p)}
          onCreated={(p) => setProjects(prev => prev.some(x => x.id === p.id) ? prev : [p, ...prev])}
          onLoadMore={() => loadMore('projects')}
          bg={columnBg[0]} />

        <TasksColumn
          tasks={tasks}
          total={taskTotal}
          selectedProject={selectedProject}
          selectedId={selectedTask?.id ?? null}
          loadingMore={loadingMore}
          onSelect={(t) => handleSelect('task', t)}
          onSettings={setTaskSettings}
          onView={(t) => handleView('task', t)}
          onCreated={(t) => setTasks(prev => prev.some(x => x.id === t.id) ? prev : [t, ...prev])}
          onLoadMore={() => loadMore('tasks')}
          bg={columnBg[1]} />

        <SubtasksColumn
          subtasks={subtasks}
          tasks={tasks}
          total={subTotal}
          selectedProject={selectedProject}
          selectedTask={selectedTask}
          loadingMore={loadingMore}
          hideCompleted={hideCompleted}
          onToggleHide={() => setHideCompleted(prev => !prev)}
          onSelect={handleSelect}
          onView={(s) => handleView('subtask', s)}
          onCreated={(s) => setSubtasks(prev => prev.some(x => x.id === s.id) ? prev : [s, ...prev])}
          onLoadMore={() => loadMore('subtasks')}
          bg={columnBg[2]} />

        <MembersColumn
          users={filteredUsers}
          selectedMember={selectedKanbanMember}
          memberTab={memberTab}
          onSelectMember={setSelectedKanbanMember}
          onSetTab={setMemberTab}
          onDetail={(u) => { setSelectedKanbanMember(null); setDetailTarget(u) }}
          onAssign={(u) => { setSelectedKanbanMember(null); setAssignTarget(u) }}
          onWarn={(u) => { setSelectedKanbanMember(null); setWarnTarget(u) }}
          bg={columnBg[3]} />
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

      {assignTarget && <AssignModal member={assignTarget as any} onClose={() => setAssignTarget(null)} />}
      {warnTarget && <WarnModal member={warnTarget as any} onClose={() => setWarnTarget(null)} />}
      {detailTarget && <MemberDetailModal member={detailTarget as any} onClose={() => setDetailTarget(null)} />}
    </div>
  )
}
