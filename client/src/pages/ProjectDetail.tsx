import { useEffect, useState, useRef } from 'react'
import api from '../lib/api'
import { useParams, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useProjectStore } from '../store/projectStore'
import { useSubtaskStore } from '../store/subtaskStore'
import { useTaskStore } from '../store/taskStore'
import {
  ArrowRight, Edit3, Check, X, Loader2, AlertCircle
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
import type { Task, Subtask, Attachment } from '../types'
import { sanitizeHTML } from '../lib/sanitize'
import { TICKET_STATUS_CONFIG as statusConfig } from '../statusConfig'

export default function ProjectDetail() {
  const { id } = useParams()
  const user = useAuthStore(s => s.user)
  const permissions = useAuthStore(s => s.permissions)
  const project = useProjectStore(s => s.project)
  const loadProject = useProjectStore(s => s.loadProject)
  const updateProjectDescFn = useProjectStore(s => s.updateProjectDesc)
  const addMemberFn = useProjectStore(s => s.addMember)
  const removeMemberFn = useProjectStore(s => s.removeMember)
  const subtasks = useSubtaskStore(s => s.subtasks)
  const loadSubtasksStore = useSubtaskStore(s => s.loadSubtasks)
  const selectTask = useTaskStore(s => s.setSelectedTaskId)
  const createTaskStore = useTaskStore(s => s.createTask)
  const addTask = useTaskStore(s => s.addTask)
  const updateTask = useTaskStore(s => s.updateTask)
  const removeTask = useTaskStore(s => s.removeTask)
  const addSubtask = useSubtaskStore(s => s.addSubtask)
  const removeSubtask = useSubtaskStore(s => s.removeSubtask)
  const updateSubtaskStore = useSubtaskStore(s => s.updateSubtask)
  const users = useAppStore(s => s.users)
  const loadUsers = useAppStore(s => s.loadUsers)
  const roles = useAppStore(s => s.roles)
  const loadRoles = useAppStore(s => s.loadRoles)
  const [attachments, setAttachments] = useState<Record<number, Attachment[]>>({})
  const [previewFiles, setPreviewFiles] = useState<Attachment[]>([]); const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [editProjectDesc, setEditProjectDesc] = useState(false); const [projectDesc, setProjectDesc] = useState('')
  const [savingDesc, setSavingDesc] = useState(false)
  const { toast } = useToast()
  const selectedTaskId = useTaskStore(s => s.selectedTaskId)
  const selectedTaskRef = useRef<number | null>(null)

  useEffect(() => { loadProject(Number(id)); loadUsers(); loadRoles() }, [id])

  useEffect(() => {
    const subtaskUpdated = (st: Subtask) => {
      updateSubtaskStore(st.id, st)
    }
    const listHandler = (msg: { type: string; action: string; data: any }) => {
      const stId = selectedTaskRef.current
      if (msg.type === 'task') {
        if (msg.action === 'created') addTask(msg.data)
        else if (msg.action === 'updated') updateTask(msg.data.id, msg.data)
        else if (msg.action === 'deleted') removeTask(msg.data.id)
      }
      if (msg.type === 'subtask' && stId) {
        if (msg.action === 'created' && msg.data.task_id === stId) addSubtask(msg.data)
        else if (msg.action === 'deleted') removeSubtask(msg.data.id)
      }
    }
    socket.on('subtask:updated', subtaskUpdated)
    socket.on('list:update', listHandler)
    return () => { socket.off('subtask:updated', subtaskUpdated); socket.off('list:update', listHandler) }
  }, [])

  const loadSubtasks = async (taskId: number) => {
    selectTask(taskId)
    selectedTaskRef.current = taskId
    loadSubtasksStore(taskId)
    setAttachments({})
  }

  const createTask = async (titleVal: string, descVal: string, filesVal: File[]) => {
    if (!titleVal.trim()) return
    const tempId = -Date.now()
    const tempTask: Task = { id: tempId, project_id: Number(id), title: titleVal, description: descVal, subtasks_count: 0, completed_count: 0, status: 'open', created_at: new Date().toISOString() }
    addTask(tempTask)
    try {
      const task = await createTaskStore(Number(id), titleVal, descVal)
      if (!task) throw new Error('فشل إنشاء المهمة')
      if (filesVal.length > 0) {
        const fd = new FormData()
        filesVal.forEach(f => fd.append('files', f))
        fd.append('entity_type', 'task'); fd.append('entity_id', String(task.id))
        await api.post('/uploads', fd)
      }
      updateTask(tempId, task)
    } catch (e) {
      console.error('createTask failed', e)
      removeTask(tempId)
      toast('فشل إنشاء المهمة', 'error')
    }
  }



  const projectError = useProjectStore(s => s.error)

  if (projectError) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <AlertCircle className="w-12 h-12 text-red-400" />
      <p className="text-gray-600 text-lg">{projectError}</p>
      <button onClick={() => loadProject(Number(id))} className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
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
          {user?.is_manager && (
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
                try { const ok = await updateProjectDescFn(project.id, projectDesc); if (ok) setEditProjectDesc(false); else toast('فشل الحفظ', 'error') } catch (e) { console.error('saveProjectDesc failed', e) } finally { setSavingDesc(false) }
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
            const role = roles.find(r => r.id === u.role_id)
            const perms = role?.permissions ?? []
            if (!perms.includes('subtasks.create')) return false
            if (!perms.includes('subtasks.submit')) return false
            if (!perms.includes('comments.create')) return false
            return true
          })}
          onAdd={async (userId) => { await addMemberFn(Number(id), userId) }}
          onRemove={async (userId) => { await removeMemberFn(Number(id), userId) }}
          canAssign={permissions.includes('projects.assign')}
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <TaskList
          tasks={project.tasks}
          selectedTaskId={selectedTaskId}
          onSelectTask={loadSubtasks}
          onCreateTask={createTask}
          canCreate={user?.is_manager === 1}
          isManager={user?.is_manager === 1}
        />

        <SubtaskPanel
          subtasks={subtasks}
          selectedTaskId={selectedTaskId}
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
