import { useState } from 'react'
import { Plus, Paperclip } from 'lucide-react'
import api from '../../lib/api'
import SubtaskRow from '../SubtaskRow'
import { useToast } from '../Toast'
import { ROLES } from '../../constants'
import type { StatusConfig } from '../../statusConfig'
import type { Subtask, Attachment, User } from '../../types'

interface SubtaskPanelProps {
  subtasks: Subtask[]
  setSubtasks: React.Dispatch<React.SetStateAction<Subtask[]>>
  selectedTaskId: number | null
  statusConfig: StatusConfig
  user: User | null
  users: User[]
  attachments: Record<number, Attachment[]>
  onPreview: (files: Attachment[], idx: number) => void
  permissions: string[]
}

export default function SubtaskPanel({ subtasks, setSubtasks, selectedTaskId, statusConfig, user, users, attachments, onPreview, permissions }: SubtaskPanelProps) {
  const { toast } = useToast()

  const [subForm, setSubForm] = useState(false)
  const [subTitle, setSubTitle] = useState('')
  const [subDesc, setSubDesc] = useState('')
  const [subAssign, setSubAssign] = useState('')
  const [subDeadline, setSubDeadline] = useState('')
  const [subFiles, setSubFiles] = useState<File[]>([])
  const [editSub, setEditSub] = useState<number | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDeadline, setEditDeadline] = useState('')
  const [creatingSub, setCreatingSub] = useState(false)
  const [updatingSub, setUpdatingSub] = useState<number | null>(null)
  const [deletingSub, setDeletingSub] = useState<number | null>(null)

  const createSubtask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subTitle.trim() || !selectedTaskId) return
    const tempId = -Date.now()
    const foundUser = users.find(u => u.id === Number(subAssign))
    const tempSub: Subtask = { id: tempId, task_id: selectedTaskId, title: subTitle, description: subDesc || null, assigned_to: subAssign ? Number(subAssign) : null, assigned_to_name: foundUser?.name || null, assigned_to_avatar: foundUser?.avatar || null, status: 'open', deadline: subDeadline || null, created_at: new Date().toISOString() }
    setSubtasks(prev => [tempSub, ...prev])
    const titleVal = subTitle; const descVal = subDesc; const assignVal = subAssign; const deadlineVal = subDeadline; const filesVal = subFiles; const taskId = selectedTaskId
    setSubTitle(''); setSubDesc(''); setSubAssign(''); setSubDeadline(''); setSubFiles([]); setSubForm(false)
    setCreatingSub(true)
    try {
      const { data: subtask } = await api.post<Subtask>('/subtasks', {
        task_id: taskId, title: titleVal, description: descVal,
        assigned_to: assignVal ? Number(assignVal) : null, deadline: deadlineVal || null
      })
      if (filesVal.length > 0) {
        const fd = new FormData()
        filesVal.forEach(f => fd.append('files', f))
        fd.append('entity_type', 'subtask'); fd.append('entity_id', String(subtask.id))
        await api.post('/uploads', fd)
      }
      setSubtasks(prev => prev.map(s => s.id === tempId ? subtask : s))
    } catch (e) {
      console.error('createSubtask failed', e)
      setSubtasks(prev => prev.filter(s => s.id !== tempId))
      toast('فشل إنشاء المهمة الفرعية', 'error')
    } finally { setCreatingSub(false) }
  }

  const updateSubtask = async (subtaskId: number) => {
    if (!selectedTaskId) return
    const prev = subtasks.find(s => s.id === subtaskId)
    if (!prev) return
    const editTitleVal = editTitle; const editDeadlineVal = editDeadline
    setSubtasks(prevList => prevList.map(s => s.id === subtaskId ? { ...s, title: editTitleVal, deadline: editDeadlineVal || null } : s))
    setEditSub(null)
    setUpdatingSub(subtaskId)
    try {
      await api.put(`/subtasks/${subtaskId}`, { title: editTitleVal, deadline: editDeadlineVal || null })
    } catch (e) {
      console.error('updateSubtask failed', e)
      setSubtasks(prevList => prevList.map(s => s.id === subtaskId ? prev : s))
      toast('فشل تحديث المهمة الفرعية', 'error')
    } finally { setUpdatingSub(null) }
  }

  const deleteSubtask = async (subtaskId: number) => {
    if (!selectedTaskId || !confirm('هل أنت متأكد؟')) return
    const prev = subtasks.find(s => s.id === subtaskId)
    if (!prev) return
    setSubtasks(prevList => prevList.filter(s => s.id !== subtaskId))
    setDeletingSub(subtaskId)
    try {
      await api.delete(`/subtasks/${subtaskId}`)
    } catch (e) {
      console.error('deleteSubtask failed', e)
      setSubtasks(prevList => [prev, ...prevList])
      toast('فشل حذف المهمة الفرعية', 'error')
    } finally { setDeletingSub(null) }
  }

  const handleAddAssignee = async (subtaskId: number, userId: number) => {
    const prev = subtasks.find(s => s.id === subtaskId)
    if (!prev) return
    const foundUser = users.find(u => u.id === userId)
    const newAssignee = { id: -1, user_id: userId, name: foundUser?.name || '', email: foundUser?.email || '', avatar: foundUser?.avatar || null, role_id: foundUser?.role_id || 3, role_name: '', assigned_by: null, created_at: new Date().toISOString() }
    setSubtasks(prevList => prevList.map(s => s.id === subtaskId ? { ...s, assignees: [...(s.assignees || []), newAssignee] } : s))
    try {
      await api.post(`/subtasks/${subtaskId}/assignees`, { user_id: userId })
    } catch (e) {
      console.error('handleAddAssignee failed', e)
      setSubtasks(prevList => prevList.map(s => s.id === subtaskId ? prev : s))
      toast('فشل إضافة المسؤول', 'error')
    }
  }

  const handleRemoveAssignee = async (subtaskId: number, userId: number) => {
    const prev = subtasks.find(s => s.id === subtaskId)
    if (!prev) return
    setSubtasks(prevList => prevList.map(s => s.id === subtaskId ? { ...s, assignees: (s.assignees || []).filter(a => a.user_id !== userId) } : s))
    try {
      await api.delete(`/subtasks/${subtaskId}/assignees/${userId}`)
    } catch (e) {
      console.error('handleRemoveAssignee failed', e)
      setSubtasks(prevList => prevList.map(s => s.id === subtaskId ? prev : s))
      toast('فشل إزالة المسؤول', 'error')
    }
  }

  if (!selectedTaskId) {
    return (
      <div className="lg:col-span-2 space-y-3">
        <div className="text-center py-16 text-gray-400">
          <p>اختر مهمة من اليمين لعرض المهام الفرعية</p>
        </div>
      </div>
    )
  }

  const isManager = user?.role_id === ROLES.ADMIN || user?.role_id === ROLES.DEPUTY

  return (
    <div className="lg:col-span-2 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">المهام الفرعية</h2>
        {isManager && (
          <button onClick={() => { setSubForm(true); setEditSub(null) }}
            className="p-2 rounded-full text-indigo-600 hover:bg-indigo-50" title="إضافة مهمة فرعية">
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {subForm && (
        <form onSubmit={createSubtask} className="bg-gray-50 rounded-lg p-3 space-y-2">
          <input value={subTitle} onChange={e => setSubTitle(e.target.value)} placeholder="العنوان" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" required />
          <input value={subDesc} onChange={e => setSubDesc(e.target.value)} placeholder="وصف" className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
          <div className="flex gap-2">
            <select value={subAssign} onChange={e => setSubAssign(e.target.value)} className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm outline-none">
              <option value="">تعيين إلى...</option>
              {users.filter(u => u.role_id === ROLES.EMPLOYEE).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <input type="date" value={subDeadline} onChange={e => setSubDeadline(e.target.value)}
              className="px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
          </div>
          <label className="flex items-center gap-1.5 text-xs text-indigo-600 cursor-pointer hover:text-indigo-800">
            <Paperclip className="w-3 h-3" /> إرفاق ملفات
            <input type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
              onChange={e => setSubFiles(Array.from(e.target.files || []))} />
          </label>
          {subFiles.length > 0 && (
            <div className="text-xs text-gray-500">{subFiles.length} ملف محدد</div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={creatingSub} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-xs disabled:opacity-50">{creatingSub ? 'جاري...' : 'إضافة'}</button>
            <button type="button" onClick={() => { setSubForm(false); setSubFiles([]) }} className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs">إلغاء</button>
          </div>
        </form>
      )}

      {subtasks.length === 0 && !subForm ? (
        <div className="text-center py-16 text-gray-400">
          {isManager ? (
            <button onClick={() => { setSubForm(true); setEditSub(null) }}
              className="inline-flex flex-col items-center gap-3 text-indigo-500 hover:text-indigo-700 transition-colors">
              <div className="w-16 h-16 rounded-full border-2 border-dashed border-indigo-400 flex items-center justify-center hover:bg-indigo-50">
                <Plus className="w-8 h-8" />
              </div>
              <span className="text-sm font-medium">إضافة مهمة فرعية جديدة</span>
            </button>
          ) : (
            <p>لا توجد مهام فرعية</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {subtasks.map(st => (
            <SubtaskRow
              key={st.id}
              subtask={st}
              statusConfig={statusConfig}
              user={user}
              users={users}
              attachments={attachments}
              selectedTask={selectedTaskId}
              updatingSub={updatingSub}
              deletingSub={deletingSub}
              editSub={editSub}
              editTitle={editTitle}
              editDeadline={editDeadline}
              setEditSub={setEditSub}
              setEditTitle={setEditTitle}
              setEditDeadline={setEditDeadline}
              onUpdateSubtask={updateSubtask}
              onDeleteSubtask={deleteSubtask}
              onPreview={onPreview}
              onAddAssignee={handleAddAssignee}
              onRemoveAssignee={handleRemoveAssignee}
              canAssign={permissions.includes('subtasks.assign')}
            />
          ))}
        </div>
      )}
    </div>
  )
}
