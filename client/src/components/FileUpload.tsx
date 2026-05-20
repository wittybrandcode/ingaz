import { useState, useEffect } from 'react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../constants'
import { Paperclip, File, XCircle, Loader2 } from 'lucide-react'
import FilePreview, { type FileItem } from './FilePreview'

interface Attachment {
  id: number; entity_type: string; entity_id: number
  filename: string; original_name: string
  mime_type: string; file_size: number
  uploaded_by: number; created_at: string
}

interface Props {
  entityType: 'project' | 'task' | 'subtask'
  entityId: number
  maxFiles?: number
  onAccept?: (file: FileItem) => void
  onReject?: (file: FileItem) => void
  onSelectWinner?: (file: FileItem) => void
}

export default function FileUpload({ entityType, entityId, onAccept, onReject, onSelectWinner }: Props) {
  const user = useAuthStore(s => s.user)
  const [files, setFiles] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [selected, setSelected] = useState<File[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)

  const load = async () => {
    try {
      const { data } = await api.get<Attachment[]>('/uploads', { params: { entity_type: entityType, entity_id: entityId } })
      setFiles(data)
    } catch (e) { console.error('Failed to load files', e) }
  }

  useEffect(() => { load() }, [entityType, entityId])

  const uploadFiles = async () => {
    if (selected.length === 0) return
    setUploading(true)
    const formData = new FormData()
    selected.forEach(f => formData.append('files', f))
    formData.append('entity_type', entityType)
    formData.append('entity_id', String(entityId))
    await api.post('/uploads', formData)
    setSelected([]); setUploading(false); load()
  }

  const removeFile = async (fileId: number) => {
    setDeleting(fileId)
    try { await api.delete(`/uploads/${fileId}`); load() } catch (e) { console.error('removeFile failed', e) }
    setDeleting(null)
    setConfirmDeleteId(null)
  }

  const isImage = (mime: string) => mime?.startsWith('image/')
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-gray-500">
          {files.length > 0 ? `${files.length} مرفق` : 'لا توجد مرفقات'}
        </span>
        <label className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 cursor-pointer hover:bg-gray-100 transition-colors">
          <Paperclip className="w-3.5 h-3.5" />
          {selected.length > 0 ? `${selected.length} ملف` : 'إرفاق'}
          <input type="file" multiple className="hidden"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.rar,.txt"
            onChange={e => setSelected(Array.from(e.target.files || []))} />
        </label>
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {files.map((f, i) => (
            <div key={f.id} className="relative group bg-gray-50 rounded-lg border border-gray-200 overflow-hidden cursor-pointer"
              onClick={() => setPreviewIndex(i)}>
              {isImage(f.mime_type) ? (
                <div className="block">
                  <img src={`/uploads/${f.filename}`} alt={f.original_name}
                    className="w-28 h-28 object-cover transition-transform duration-200 group-hover:scale-105" />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/40 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-white truncate">{f.original_name}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 hover:bg-gray-100 transition-colors min-w-[140px]">
                  <File className="w-6 h-6 text-gray-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-700 truncate max-w-[100px]">{f.original_name}</p>
                    <p className="text-[10px] text-gray-400">{formatSize(f.file_size)}</p>
                  </div>
                </div>
              )}
              {(user?.id === f.uploaded_by || user?.role_id === ROLES.ADMIN) && (
                confirmDeleteId === f.id ? (
                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-white/90 z-20">
                    <button onClick={e => { e.stopPropagation(); removeFile(f.id) }} disabled={deleting === f.id}
                      className="px-1.5 py-0.5 bg-red-500 text-white rounded text-[0.55rem] font-medium hover:bg-red-600 disabled:opacity-40">
                      {deleting === f.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'حذف'}
                    </button>
                    <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(null) }}
                      className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[0.55rem] hover:bg-gray-200">
                      إلغاء
                    </button>
                  </div>
                ) : (
                  <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(f.id) }}
                    className="absolute top-1.5 right-1.5 p-0.5 bg-white/80 rounded-full text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500 hover:text-white z-10">
                    <XCircle className="w-3.5 h-3.5" />
                  </button>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {previewIndex !== null && (
        <FilePreview files={files} initialIndex={previewIndex} onClose={() => setPreviewIndex(null)}
          onAccept={onAccept} onReject={onReject} onSelectWinner={onSelectWinner} />
      )}

      {selected.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <button onClick={uploadFiles} disabled={uploading}
            className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {uploading ? 'جاري الرفع...' : 'رفع'}
          </button>
          <button onClick={() => setSelected([])}
            className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 transition-colors">
            إلغاء
          </button>
        </div>
      )}

      {selected.length > 0 && (
        <div className="space-y-1">
          {selected.map((f, i) => (
            <div key={i} className="flex items-center justify-between text-xs text-gray-600 bg-gray-50 rounded px-2 py-1">
              <span className="truncate">{f.name}</span>
              <button onClick={() => setSelected(prev => prev.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600 mr-1 shrink-0">
                <XCircle className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
