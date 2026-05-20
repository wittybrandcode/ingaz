import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../constants'
import {
  ArrowRight, CheckCircle2, Clock, AlertCircle, Send,
  XCircle, Edit3, Check, X, Loader2
} from 'lucide-react'
import socket from '../lib/socket'
import FileUpload from '../components/FileUpload'
import FilePreview from '../components/FilePreview'
import TiptapEditor from '../components/TiptapEditor'
import Avatar from '../components/Avatar'
import { useAppStore } from '../store/appStore'
import AssigneePicker from '../components/AssigneePicker'
import { ProjectDetailSkeleton } from '../components/Skeleton'
import { useToast } from '../components/Toast'
import TaskList from '../components/ProjectDetail/TaskList'
import SubtaskPanel from '../components/ProjectDetail/SubtaskPanel'
import type { ProjectDetail, Task, Subtask, Attachment } from '../types'
import { sanitizeHTML } from '../lib/sanitize'

const statusConfig = {
  pending: { label: 'بانتظار البدء', icon: Clock, color: 'text-gray-500', bg: 'bg-gray-100', dot: 'bg-gray-400' },
  in_progress: { label: 'قيد التنفيذ', icon: AlertCircle, color: 'text-blue-600', bg: 'bg-blue-100', dot: 'bg-blue-500' },
  submitted: { label: 'تم التسليم', icon: Send, color: 'text-yellow-600', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
  approved: { label: 'مقبول', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-100', dot: 'bg-green-500' },
  rejected: { label: 'مرفوض', icon: XCircle, color: 'text-red-600', bg: 'bg-red-100', dot: 'bg-red-500' },
}

export default function ProjectDetail() {
  const { id } = useParams()
  const user = useAuthStore(s => s.user)
  const permissions = useAuthStore(s => s.permissions)
  const [project, setProject] = useState<ProjectDetail | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const subtaskAbortRef = useRef<AbortController | null>(null)
  const [subtasks, setSubtasks] = useState<Subtask[]>([])
  const [selectedTask, setSelectedTask] = useState<number | null>(null)
  const users = useAppStore(s => s.users)
  const loadUsers = useAppStore(s => s.loadUsers)
  const roles = useAppStore(s => s.roles)
  const loadRoles = useAppStore(s => s.loadRoles)
  const [attachments, setAttachments] = useState<Record<number, Attachment[]>>({})
  const [previewFiles, setPreviewFiles] = useState<Attachment[]>([]); const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [editProjectDesc, setEditProjectDesc] = useState(false); const [projectDesc, setProjectDesc] = useState('')
  const [savingDesc, setSavingDesc] = useState(false)
  const { toast } = useToast()
  const selectedTaskRef = useRef(selectedTask)
  selectedTaskRef.current = selectedTask
  const projectRef = useRef(project)
  projectRef.current = project

  const load = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoadError(null)
    try {
      const { data: projectData } = await api.get<ProjectDetail>(`/projects/${id}`, { signal: controller.signal })
      setProject(projectData)
      loadUsers()
      loadRoles()
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setLoadError('فشل تحميل بيانات المشروع. يرجى المحاولة مرة أخرى.')
      console.error('Failed to load project', e)
    }
  }

  const loadSubtasks = async (taskId: number) => {
    setSelectedTask(taskId)
    subtaskAbortRef.current?.abort()
    const controller = new AbortController()
    subtaskAbortRef.current = controller
    const { data } = await api.get<Subtask[]>(`/subtasks/task/${taskId}`, { signal: controller.signal })
    setSubtasks(data)
    if (data.length > 0) {
      try {
        const ids = data.map((st: Subtask) => st.id)
        const { data: attMap } = await api.get<Record<number, Attachment[]>>('/uploads', { params: { entity_type: 'subtask', entity_ids: ids.join(','), groupBy: 'true' } })
        setAttachments(attMap)
      } catch (e) { console.error('Failed to load attachments', e) }
    } else {
      setAttachments({})
    }
  }

  useEffect(() => { load() }, [id])

  useEffect(() => {
    const subtaskUpdated = (st: Subtask) => {
      if (st.task_id === selectedTaskRef.current) {
        setSubtasks(prev => prev.map(s => s.id === st.id ? st : s))
      }
    }
    const listHandler = (msg: { type: string; action: string; data: any }) => {
      const p = projectRef.current
      const stId = selectedTaskRef.current
      if (msg.type === 'task' && p) {
        if (msg.action === 'created' && msg.data.project_id === p.id) {
          setProject({ ...p, tasks: [msg.data, ...p.tasks] })
        } else if (msg.action === 'updated') {
          setProject({ ...p, tasks: p.tasks.map(t => t.id === msg.data.id ? { ...t, ...msg.data } : t) })
        } else if (msg.action === 'deleted') {
          setProject({ ...p, tasks: p.tasks.filter(t => t.id !== msg.data.id) })
        }
      }
      if (msg.type === 'subtask' && stId) {
        if (msg.action === 'created' && msg.data.task_id === stId) {
          setSubtasks(prev => [msg.data, ...prev])
        } else if (msg.action === 'deleted') {
          setSubtasks(prev => prev.filter(s => s.id !== msg.data.id))
        }
      }
    }
    socket.on('subtask:updated', subtaskUpdated)
    socket.on('list:update', listHandler)
    return () => { socket.off('subtask:updated', subtaskUpdated); socket.off('list:update', listHandler) }
  }, [])

  const createTask = async (titleVal: string, descVal: string, filesVal: File[]) => {
    if (!titleVal.trim()) return
    const tempId = -Date.now()
    const tempTask: Task = { id: tempId, project_id: Number(id), title: titleVal, description: descVal, subtasks_count: 0, completed_count: 0, status: 'open', created_at: new Date().toISOString() }
    setProject(prev => prev ? { ...prev, tasks: [tempTask, ...prev.tasks] } : prev)
    try {
      const { data: task } = await api.post<Task>('/tasks', { project_id: Number(id), title: titleVal, description: descVal })
      if (filesVal.length > 0) {
        const fd = new FormData()
        filesVal.forEach(f => fd.append('files', f))
        fd.append('entity_type', 'task'); fd.append('entity_id', String(task.id))
        await api.post('/uploads', fd)
      }
      setProject(prev => prev ? { ...prev, tasks: prev.tasks.map(t => t.id === tempId ? task : t) } : prev)
    } catch (e) {
      console.error('createTask failed', e)
      setProject(prev => prev ? { ...prev, tasks: prev.tasks.filter(t => t.id !== tempId) } : prev)
      toast('فشل إنشاء المهمة', 'error')
    }
  }



  if (loadError) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle className="w-12 h-12 text-red-400" />
      <p className="text-gray-600 text-lg">{loadError}</p>
      <button onClick={load} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
        إعادة المحاولة
      </button>
    </div>
  )

  if (!project) return <ProjectDetailSkeleton />

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
        <Link to="/projects" className="hover:text-indigo-600">المشاريع</Link>
        <ArrowRight className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">{project.title}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
          {(user?.role_id === ROLES.ADMIN || user?.role_id === ROLES.DEPUTY) && (
            <button onClick={() => { setEditProjectDesc(!editProjectDesc); setProjectDesc(project.description || '') }}
              className="p-2 rounded-full hover:bg-gray-100" title={editProjectDesc ? 'إلغاء' : 'تعديل الوصف'}>
              {editProjectDesc ? <X className="w-4 h-4" /> : <Edit3 className="w-4 h-4 text-indigo-500" />}
            </button>
          )}
        </div>
        {editProjectDesc ? (
          <div className="mt-3 space-y-2">
            <TiptapEditor content={projectDesc} onChange={setProjectDesc} placeholder="وصف المشروع..." />
            <div className="flex gap-2">
              <button onClick={async () => {
                setSavingDesc(true)
                try { await api.put(`/projects/${project.id}`, { description: projectDesc }); setProject(prev => prev ? { ...prev, description: projectDesc } : prev); setEditProjectDesc(false) } catch (e) { console.error('saveProjectDesc failed', e) } finally { setSavingDesc(false) }
              }} disabled={savingDesc} className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50" title="حفظ">
                {savingDesc ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              </button>
              <button onClick={() => setEditProjectDesc(false)}
                className="p-2 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200" title="إلغاء">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : (
          project.description && (
            <div className="mt-2 text-sm text-gray-600 [&_p]:m-0 [&_ul]:pr-4 [&_ol]:pr-4"
              dangerouslySetInnerHTML={{ __html: sanitizeHTML(project.description) }} />
          )
        )}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-1.5">
              <Avatar name={project.created_by_name} avatar={project.created_by_avatar} size="sm" />
              <span>بواسطة {project.created_by_name}</span>
            </div>
            <span>{new Date(project.created_at).toLocaleDateString('ar-SA-u-nu-latn')}</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100">
          <FileUpload entityType="project" entityId={project.id} />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">أعضاء المشروع</h2>
        </div>
        <AssigneePicker
          assignees={project.members.map(m => ({ user_id: m.user_id, name: m.name, avatar: m.avatar }))}
          availableUsers={users.filter(u => {
            if (u.role_id !== ROLES.EMPLOYEE) return false
            const role = roles.find(r => r.id === u.role_id)
            const perms = role?.permissions ?? []
            if (!perms.includes('subtasks.create')) return false
            if (!perms.includes('subtasks.submit')) return false
            if (!perms.includes('comments.create')) return false
            return true
          })}
          onAdd={async (userId) => {
            await api.post(`/projects/${id}/members`, { user_id: userId })
            const { data: member } = await api.get(`/projects/${id}/members`)
            setProject(prev => prev ? { ...prev, members: member } : prev)
          }}
          onRemove={async (userId) => {
            await api.delete(`/projects/${id}/members/${userId}`)
            setProject(prev => prev ? { ...prev, members: prev.members.filter(m => m.user_id !== userId) } : prev)
          }}
          canAssign={permissions.includes('projects.assign')}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <TaskList
          tasks={project.tasks}
          selectedTaskId={selectedTask}
          onSelectTask={loadSubtasks}
          onCreateTask={createTask}
          canCreate={user?.role_id === ROLES.ADMIN || user?.role_id === ROLES.DEPUTY}
          userRole={user?.role_id}
        />

        <SubtaskPanel
          subtasks={subtasks}
          setSubtasks={setSubtasks}
          selectedTaskId={selectedTask}
          statusConfig={statusConfig}
          user={user}
          users={users}
          attachments={attachments}
          onPreview={(files, idx) => { setPreviewFiles(files); setPreviewIndex(idx) }}
          permissions={permissions}
        />
      </div>
      {previewIndex !== null && (
        <FilePreview files={previewFiles} initialIndex={previewIndex} onClose={() => setPreviewIndex(null)} />
      )}
    </div>
  )
}
