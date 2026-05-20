import { useState, useEffect, useCallback } from 'react'
import { X, Download, File, ChevronLeft, ChevronRight, Paperclip, Check, X as XIcon, Award } from 'lucide-react'

export interface FileItem {
  id: number; filename: string; original_name: string
  mime_type: string; file_size: number;   uploaded_by?: number; created_at: string
}

interface Props {
  files: FileItem[]
  initialIndex?: number
  onClose: () => void
  onAccept?: (file: FileItem) => void
  onReject?: (file: FileItem) => void
  onSelectWinner?: (file: FileItem) => void
}

export default function FilePreview({ files, initialIndex = 0, onClose, onAccept, onReject, onSelectWinner }: Props) {
  const [index, setIndex] = useState(initialIndex)
  const file = files[index]

  const prev = useCallback(() => setIndex(i => (i > 0 ? i - 1 : files.length - 1)), [files.length])
  const next = useCallback(() => setIndex(i => (i < files.length - 1 ? i + 1 : 0)), [files.length])

  const isRTL = document.dir === 'rtl'

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') { if (isRTL) next(); else prev() }
      if (e.key === 'ArrowRight') { if (isRTL) prev(); else next() }
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose, prev, next, isRTL])

  if (!file) return null

  const isImage = file.mime_type?.startsWith('image/')
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="relative max-w-4xl max-h-[90vh] mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <Paperclip className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-700 truncate">{file.original_name}</span>
            <span className="text-xs text-gray-400 shrink-0">{formatSize(file.file_size)}</span>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[300px]">
          {isImage ? (
            <img src={`/uploads/${file.filename}`} alt={file.original_name}
              className="max-w-full max-h-[70vh] object-contain rounded-lg" />
          ) : (
            <div className="text-center py-12">
              <File className="w-20 h-20 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-1">{file.original_name}</p>
              <p className="text-sm text-gray-400 mb-4">{formatSize(file.file_size)}</p>
              <a href={`/uploads/${file.filename}`} download={file.original_name}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
                <Download className="w-4 h-4" /> تحميل الملف
              </a>
            </div>
          )}
        </div>

        {(onAccept || onReject || onSelectWinner) && (
          <div className="flex items-center justify-center gap-2 px-4 py-2.5 border-t border-gray-100 bg-gray-50">
            {onAccept && (
              <button onClick={() => onAccept(file)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors">
                <Check className="w-4 h-4" /> قبول
              </button>
            )}
            {onReject && (
              <button onClick={() => onReject(file)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 transition-colors">
                <XIcon className="w-4 h-4" /> رفض
              </button>
            )}
            {onSelectWinner && (
              <button onClick={() => onSelectWinner(file)}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 text-white rounded-lg text-sm hover:bg-amber-600 transition-colors">
                <Award className="w-4 h-4" /> ترشيح فائز
              </button>
            )}
          </div>
        )}

        {files.length > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <button onClick={prev}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              <ChevronRight className="w-4 h-4" /> السابق
            </button>
            <span className="text-xs text-gray-500">{index + 1} / {files.length}</span>
            <button onClick={next}
              className="flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors">
              التالي <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
