import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../lib/api'

import { ArrowRight, Paperclip, Loader2, File, Music } from 'lucide-react'
import Avatar from '../components/Avatar'
import Comments from '../components/Comments'
import FilePreview, { type FileItem } from '../components/FilePreview'
import AudioPreview from '../components/AudioPreview'
import { useAuthStore } from '../store/authStore'
import { useAppStore } from '../store/appStore'
import { ROLES } from '../constants'
import type { SubtaskData } from '../types'
import { sanitizeHTML } from '../lib/sanitize'
import { SUBTASK_STATUS_CONFIG as statusConfig } from '../statusConfig'

interface Attachment {
  id: number; filename: string; original_name: string
  mime_type: string; file_size: number; uploaded_by: number; created_at: string
}

export default function SubtaskPage() {
  const { id } = useParams()
  const user = useAuthStore(s => s.user)
  const [subtask, setSubtask] = useState<SubtaskData | null>(null)
  const [files, setFiles] = useState<Attachment[]>([])
  const [uploadingFromBar, setUploadingFromBar] = useState(false)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [audioPreview, setAudioPreview] = useState<Attachment | null>(null)

  const loadAll = async () => {
    try {
      const { data: st } = await api.get<SubtaskData>(`/subtasks/${id}`)
      setSubtask(st)
      const { data: atts } = await api.get<Attachment[]>('/uploads', { params: { entity_type: 'subtask', entity_id: st.id } })
      setFiles(atts)
    } catch (e) { console.error('Failed to load', e) }
  }

  useEffect(() => { loadAll() }, [id])

  useEffect(() => {
    const unsub = useAppStore.subscribe((state, prev) => {
      const u = state.lastSubtaskUpdate
      if (u && u.id === Number(id) && u !== prev.lastSubtaskUpdate) {
        setSubtask(prevSt => prevSt ? { ...prevSt, status: u.status as SubtaskData['status'] } : prevSt)
      }
    })
    return unsub
  }, [id])

  const canUpload = user?.role_id === ROLES.ADMIN || user?.role_id === ROLES.DEPUTY

  const uploadFromBar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files
    if (!f || f.length === 0 || !subtask) return
    setUploadingFromBar(true)
    try {
      const formData = new FormData()
      Array.from(f).forEach(file => formData.append('files', file))
      formData.append('entity_type', 'subtask')
      formData.append('entity_id', String(subtask.id))
      await api.post('/uploads', formData)
      const { data: atts } = await api.get<Attachment[]>('/uploads', { params: { entity_type: 'subtask', entity_id: subtask.id } })
      setFiles(atts)
    } catch (e) { console.error('Upload failed', e) }
    setUploadingFromBar(false)
  }

  const isImage = (m: string) => m?.startsWith('image/')
  const isAudio = (m: string) => m?.startsWith('audio/')

  const fileItems: FileItem[] = files.map(f => ({
    id: f.id, filename: f.filename, original_name: f.original_name,
    mime_type: f.mime_type, file_size: f.file_size, created_at: f.created_at,
  }))

  if (!subtask) return <div className="text-center py-12 text-gray-500">جاري التحميل...</div>

  const cfg = statusConfig[subtask.status]
  const Icon = cfg.icon
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link to="/projects" className="hover:text-indigo-600">المشاريع</Link>
        <ArrowRight className="w-3.5 h-3.5" />
        <Link to={`/projects/${subtask.task.project_id}`} className="hover:text-indigo-600">{subtask.task.project_title}</Link>
        <ArrowRight className="w-3.5 h-3.5" />
        <span className="text-gray-900 font-medium">{subtask.title}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex gap-4">
          <div className="flex-1 space-y-5 min-w-0">
            {/* السطر 1: العنوان */}
            <h1 className="text-2xl font-bold text-gray-900">{subtask.title}</h1>

            {/* السطر 2: المهمة ← المشروع */}
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="text-gray-700 font-medium">{subtask.task.title}</span>
              <ArrowRight className="w-3.5 h-3.5 text-gray-300" />
              <Link to={`/projects/${subtask.task.project_id}`} className="hover:text-indigo-600">{subtask.task.project_title}</Link>
            </div>

            {/* السطر 3: المكلفون */}
            {subtask.assignees && subtask.assignees.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                {subtask.assignees.map(a => (
                  <span key={a.user_id} className="flex items-center gap-1.5">
                    <Avatar name={a.name} avatar={a.avatar} size="sm" />
                    <span className="text-sm text-gray-700">{a.name}</span>
                  </span>
                ))}
              </div>
            )}

            {/* السطر 4: الوصف الكامل */}
            {subtask.description && (
              <div className="prose prose-sm max-w-none text-gray-700 [&_p]:m-0 [&_img]:rounded-lg"
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(subtask.description) }} />
            )}
          </div>

          {/* المرفقات — أعمدة ثابتة */}
          {files.length > 0 && (
            <div className="flex flex-col gap-2 sticky top-4 self-start shrink-0">
              {files.map((f, i) => (
                <button key={f.id} onClick={() => {
                  if (isAudio(f.mime_type)) setAudioPreview(f)
                  else setPreviewIndex(i)
                }}
                  className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 hover:border-indigo-300 hover:shadow transition-all shrink-0"
                  title={f.original_name}>
                  {isImage(f.mime_type) ? (
                    <img src={`/uploads/${f.filename}`} alt={f.original_name}
                      className="w-full h-full object-cover" />
                  ) : isAudio(f.mime_type) ? (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Music className="w-5 h-5" />
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <File className="w-5 h-5" />
                    </div>
                  )}
                </button>
              ))}
              {canUpload && (
                <label className="w-10 h-10 rounded-lg border border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:border-indigo-300 cursor-pointer transition-colors shrink-0"
                  title="إرفاق ملفات">
                  {uploadingFromBar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                  <input type="file" multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
                    onChange={uploadFromBar} disabled={uploadingFromBar} />
                </label>
              )}
            </div>
          )}
        </div>

        {/* السطر 5: شريط المعلومات */}
        <div className="flex items-center justify-between pt-2 mt-5 border-t border-gray-100">
          <span className={`inline-flex items-center gap-1.5 ${cfg.bg} ${cfg.color} px-3 py-1 rounded-full text-sm font-medium`}>
            <Icon className="w-4 h-4" /> {cfg.label}
          </span>
        </div>
      </div>

      {previewIndex !== null && (
        <FilePreview files={fileItems} initialIndex={previewIndex}
          onClose={() => setPreviewIndex(null)} />
      )}

      {audioPreview && (
        <AudioPreview filename={audioPreview.filename} originalName={audioPreview.original_name}
          fileSize={audioPreview.file_size} onClose={() => setAudioPreview(null)} />
      )}

      <Comments subtaskId={subtask.id} winnerCommentId={subtask.winner_comment_id} />
    </div>
  )
}
