import { useEffect } from 'react'
import { X, Download, File as FileIcon } from 'lucide-react'

interface Props {
  filename: string
  originalName: string
  fileSize?: number
  onClose: () => void
}

export default function AudioPreview({ filename, originalName, fileSize, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handler)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const formatSize = (bytes?: number) => {
    if (!bytes) return ''
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="relative max-w-lg w-full mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2 min-w-0">
            <FileIcon className="w-4 h-4 text-gray-400 shrink-0" />
            <span className="text-sm text-gray-700 truncate">{originalName}</span>
            {fileSize && <span className="text-xs text-gray-400 shrink-0">{formatSize(fileSize)}</span>}
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          <audio controls className="w-full">
            <source src={`/uploads/${filename}`} />
            المتصفح لا يدعم تشغيل الصوت
          </audio>
        </div>

        <div className="flex items-center justify-center px-4 py-3 border-t border-gray-100 bg-gray-50">
          <a href={`/uploads/${filename}`} download={originalName}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
            <Download className="w-4 h-4" /> تحميل الملف
          </a>
        </div>
      </div>
    </div>
  )
}
