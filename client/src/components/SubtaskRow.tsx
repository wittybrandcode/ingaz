import React from 'react'
import { Clock, Paperclip, File, Check, X, Loader2 } from 'lucide-react'
import { STATUS_LABELS, type Subtask, type Attachment, type User, type Assignee } from '../types'
import { ROLES } from '../constants'
import Avatar from './Avatar'
import AssigneePicker from './AssigneePicker'

type StatusConfig = Record<string, {
  label: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  bg: string
  dot: string
}>

interface SubtaskRowProps {
  subtask: Subtask
  statusConfig: StatusConfig
  user: User | null
  users: User[]
  attachments: Record<number, Attachment[]>
  selectedTask: number | null
  updatingSub: number | null
  deletingSub: number | null
  editSub: number | null
  editTitle: string
  editDeadline: string
  setEditSub: (v: number | null) => void
  setEditTitle: (v: string) => void
  setEditDeadline: (v: string) => void
  onUpdateSubtask: (subtaskId: number) => void
  onDeleteSubtask: (subtaskId: number) => void
  onPreview: (files: Attachment[], index: number) => void
  onAddAssignee: (subtaskId: number, userId: number) => Promise<void>
  onRemoveAssignee: (subtaskId: number, userId: number) => Promise<void>
  canAssign: boolean
}

function SubtaskRow({
  subtask: st,
  statusConfig,
  user,
  users,
  attachments,
  updatingSub,
  deletingSub,
  editSub,
  editTitle,
  editDeadline,
  setEditSub,
  setEditTitle,
  setEditDeadline,
  onUpdateSubtask,
  onDeleteSubtask,
  onPreview,
  onAddAssignee,
  onRemoveAssignee,
  canAssign,
}: SubtaskRowProps) {
  const cfg = statusConfig[st.status]
  const Icon = cfg.icon
  const isManager = user?.role_id === ROLES.ADMIN || user?.role_id === ROLES.DEPUTY
  const assignees: Assignee[] = st.assignees || []
  const filteredUsers = users.filter(u => {
    if (assignees.some(a => a.user_id === u.id)) return false
    if (u.role_id !== ROLES.EMPLOYEE) return false
    return true
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          {editSub === st.id ? (
            <div className="space-y-2">
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
              <input type="date" value={editDeadline} onChange={e => setEditDeadline(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm outline-none" />
              <div className="flex gap-2">
                <button onClick={() => onUpdateSubtask(st.id)} disabled={updatingSub === st.id}
                  className="p-2 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40" title="حفظ">
                  {updatingSub === st.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                </button>
                <button onClick={() => setEditSub(null)}
                  className="p-2 rounded-full bg-gray-200 text-gray-700 hover:bg-gray-300" title="إلغاء">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-gray-900">{st.title}</h3>
                <span className={`${cfg.bg} ${cfg.color} px-2 py-0.5 rounded text-xs flex items-center gap-1`}>
                  <Icon className="w-3 h-3" /> {STATUS_LABELS[st.status] || cfg.label}
                </span>
              </div>
              {st.description && <p className="text-sm text-gray-500 mt-1">{st.description}</p>}
              <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                {assignees.map(a => (
                  <span key={a.user_id} className="flex items-center gap-1.5">
                    <Avatar name={a.name} avatar={a.avatar} size="sm" />
                    <span>{a.name}</span>
                  </span>
                ))}
                {st.deadline && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {new Date(st.deadline).toLocaleDateString('ar-SA-u-nu-latn')}
                  </span>
                )}
              </div>
              {isManager && (
                <div className="mt-2">
                  <AssigneePicker
                    assignees={assignees.map(a => ({ user_id: a.user_id, name: a.name, avatar: a.avatar }))}
                    availableUsers={filteredUsers}
                    onAdd={async (userId) => { await onAddAssignee(st.id, userId) }}
                    onRemove={async (userId) => { await onRemoveAssignee(st.id, userId) }}
                    canAssign={canAssign}
                  />
                </div>
              )}
            </>
          )}
        </div>

        {isManager && !editSub && (
          <div className="flex items-center gap-1 mr-2">
            <button onClick={() => { setEditSub(st.id); setEditTitle(st.title); setEditDeadline(st.deadline ? st.deadline.split('T')[0] : '') }}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
            </button>
            <button onClick={() => onDeleteSubtask(st.id)} disabled={deletingSub === st.id}
              className="p-1 hover:bg-gray-100 rounded text-red-400 hover:text-red-600 disabled:opacity-30">
              {deletingSub === st.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>}
            </button>
          </div>
        )}
      </div>

      {attachments[st.id] && attachments[st.id].length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-gray-500 font-medium flex items-center gap-1">
            <Paperclip className="w-3 h-3" /> المرفقات ({attachments[st.id].length})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {attachments[st.id].map((att, idx) => {
              const isImage = att.mime_type?.startsWith('image/')
              return (
                <div key={att.id} className="relative group bg-gray-50 rounded-lg border border-gray-200 overflow-hidden cursor-pointer"
                  onClick={() => onPreview(attachments[st.id], idx)}>
                  {isImage ? (
                    <img src={`/uploads/${att.filename}`} alt={att.original_name}
                      className="w-full h-20 object-cover hover:opacity-80 transition-opacity" />
                  ) : (
                    <div className="flex items-center gap-2 p-2 hover:bg-gray-100 transition-colors">
                      <File className="w-5 h-5 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-600 truncate">{att.original_name}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      
    </div>
  )
}

export default React.memo(SubtaskRow)
