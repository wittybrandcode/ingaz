import { useEffect, useState, useRef, useCallback } from 'react'
import { MessageSquare, Star, Award, Loader2, Lock } from 'lucide-react'
import api from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useComments, useWinnerSelected } from '../lib/eventBus'
import Avatar from './Avatar'
import TiptapEditor from './TiptapEditor'
import FilePreview, { type FileItem } from './FilePreview'
import { sanitizeHTML } from '../lib/sanitize'

import type { Comment } from '../types'

interface Props {
  subtaskId: number
  winnerCommentId?: number | null
}

function extractImages(html: string): string[] {
  const srcs: string[] = []
  const regex = /<img[^>]+src=["']([^"']+)["']/g
  let match
  while ((match = regex.exec(html)) !== null) {
    srcs.push(match[1])
  }
  return srcs
}

export default function Comments({ subtaskId, winnerCommentId }: Props) {
  const user = useAuthStore(s => s.user)
  const permissions = useAuthStore(s => s.permissions)
  const [comments, setComments] = useState<Comment[]>([])
  const [content, setContent] = useState('')
  const [sending, setSending] = useState(false)
  const [selectingWinner, setSelectingWinner] = useState<number | null>(null)
  const [previewImages, setPreviewImages] = useState<{ files: FileItem[]; index: number } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const isClosed = !!winnerCommentId

  const canSelectWinner = (user?.is_manager || permissions.includes('subtasks.complete')) && !isClosed

  const load = async () => {
    try {
      const { data } = await api.get<Comment[]>(`/comments/${subtaskId}`)
      setComments(data)
    } catch (e) { console.error('Failed to load comments', e) }
  }

  useEffect(() => { load() }, [subtaskId])

  useComments(subtaskId, (c) => setComments(prev => [...prev, c]), [])

  useWinnerSelected(() => load(), [])

  const selectWinner = async (commentId: number) => {
    setSelectingWinner(commentId)
    try {
      await api.post(`/comments/${commentId}/select-winner`)
      load()
    } catch (e) {
      console.error('Failed to select winner', e)
    } finally {
      setSelectingWinner(null)
    }
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [comments.length])

  const send = async () => {
    if (!content.replace(/<[^>]*>/g, '').trim() || sending) return
    setSending(true)
    try {
      await api.post<Comment>('/comments', { subtask_id: subtaskId, content })
      setContent('')
    } catch (e) { console.error('Failed to send', e) } finally { setSending(false) }
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'الآن'
    if (mins < 60) return `منذ ${mins} د`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `منذ ${hours} س`
    return `منذ ${Math.floor(hours / 24)} ي`
  }

  const handleImgClick = useCallback((e: React.MouseEvent, commentContent: string) => {
    const imgs = extractImages(commentContent)
    const src = (e.target as HTMLImageElement).src
    const idx = imgs.findIndex(s => s === src || `/uploads/${s}` === src || s === `/uploads/${src}`)
    const files: FileItem[] = imgs.map((src, i) => ({
      id: i, filename: src.replace('/uploads/', ''), original_name: src.split('/').pop() || '',
      mime_type: 'image/*', file_size: 0, created_at: '',
    }))
    setPreviewImages({ files, index: idx >= 0 ? idx : 0 })
  }, [])

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <MessageSquare className="w-4 h-4 text-gray-500" />
        <h3 className="font-semibold text-gray-900 text-sm">الإنجازات ({comments.length})</h3>
      </div>

      <div className="space-y-4 max-h-[30rem] overflow-y-auto mb-4">
        {comments.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">لا توجد إنجازات بعد</p>
        ) : (
          comments.map(c => {
            const isWinner = c.is_winner === 1
            const images = extractImages(c.content || '')
            return (
              <div key={c.id}>
                <div className={`${isWinner ? 'bg-amber-50 border-2 border-amber-300 rounded-xl p-3' : ''}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Avatar name={c.user_name || ''} avatar={c.user_avatar} size="sm" />
                    <span className="text-xs font-medium text-gray-700">{c.user_name}</span>
                    {isWinner && (
                      <span className="mr-auto bg-amber-400 text-white rounded-full p-1.5 shadow-lg" title="إنجاز">
                        <Award className="w-5 h-5" />
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-800 [&_img]:max-w-full [&_img]:rounded-lg [&_img]:mt-1 [&_img]:cursor-pointer prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHTML(c.content) }}
                    onClick={(e) => {
                      const target = e.target as HTMLElement
                      if (target.tagName === 'IMG') handleImgClick(e, c.content || '')
                    }} />

                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {images.map((src, i) => (
                        <img key={i} src={src}
                          className="w-16 h-16 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity border border-gray-200"
                          onClick={() => {
                            const files: FileItem[] = images.map((s, j) => ({
                              id: j, filename: s.replace('/uploads/', ''), original_name: s.split('/').pop() || '',
                              mime_type: 'image/*', file_size: 0, created_at: '',
                            }))
                            setPreviewImages({ files, index: i })
                          }} />
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-1.5">
                    <p className="text-[10px] text-gray-400">{timeAgo(c.created_at)}</p>
                    {isWinner && (
                      <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5">
                        <Star className="w-3 h-3" /> إنجاز
                      </span>
                    )}
                  </div>

                  {!isWinner && canSelectWinner && (
                    <button onClick={() => selectWinner(c.id)} disabled={selectingWinner === c.id}
                      className="text-[10px] mt-1.5 text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-0.5 disabled:opacity-40 transition-colors">
                      {selectingWinner === c.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Award className="w-3 h-3" />
                      )}
                      ترشيح كإنجاز
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {previewImages && (
        <FilePreview files={previewImages.files} initialIndex={previewImages.index}
          onClose={() => setPreviewImages(null)} />
      )}

      {isClosed ? (
        <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl text-sm text-gray-500">
          <Lock className="w-4 h-4 text-gray-400" />
          تم الإنجاز
        </div>
      ) : (
        <div className="flex gap-2 items-start">
          <div className="flex-1">
            <TiptapEditor content={content} onChange={setContent} placeholder="اكتب إنجاز..."
              uploadUrl={`/uploads?entity_type=comment&entity_id=${subtaskId}`}
              minHeight="min-h-[40px]" minimal />
          </div>
          <button onClick={send} disabled={!content.replace(/<[^>]*>/g, '').trim() || sending}
            className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-1 shrink-0">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}
          </button>
        </div>
      )}
    </div>
  )
}
