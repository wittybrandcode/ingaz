import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Plus, X, Loader2, Search } from 'lucide-react'
import Avatar from './Avatar'
import type { User } from '../types'

interface AssigneeItem {
  user_id: number
  name: string
  avatar: string | null
}

interface AssigneePickerProps {
  assignees: AssigneeItem[]
  availableUsers: User[]
  onAdd: (userId: number) => Promise<void>
  onRemove: (userId: number) => Promise<void>
  canAssign: boolean
}

export default function AssigneePicker({ assignees, availableUsers, onAdd, onRemove, canAssign }: AssigneePickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState<number | null>(null)
  const [removing, setRemoving] = useState<number | null>(null)
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({})
  const ref = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => { setOpen(false); setSearch('') }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && !(e.target as HTMLElement)?.closest?.('.assignee-portal')) {
        close()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [close])

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      const menuWidth = 256
      const left = Math.max(4, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 4))
      setMenuStyle({
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${left}px`,
        zIndex: 9999,
      })
    }
  }, [open])

  const filtered = availableUsers.filter(u => {
    if (assignees.some(a => a.user_id === u.id)) return false
    if (!search.trim()) return true
    return u.name.includes(search)
  })

  const handleAdd = async (userId: number) => {
    setLoading(userId)
    try { await onAdd(userId) } catch (e) { console.error('addAssignee failed', e) } finally { setLoading(null) }
  }

  const handleRemove = async (userId: number) => {
    setRemoving(userId)
    try { await onRemove(userId) } catch (e) { console.error('removeAssignee failed', e) } finally { setRemoving(null) }
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap items-center gap-1.5">
        {assignees.map(a => (
          <div key={a.user_id} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 bg-gray-50">
            <Avatar name={a.name} avatar={a.avatar} size="sm" />
            <span className="text-xs text-gray-700">{a.name}</span>
            {canAssign && (
              <button onClick={() => handleRemove(a.user_id)} disabled={removing === a.user_id}
                className="p-0.5 rounded-full hover:bg-red-100 text-gray-400 hover:text-red-500 disabled:opacity-30">
                {removing === a.user_id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
              </button>
            )}
          </div>
        ))}
        {canAssign && (
          <button ref={btnRef} onClick={() => setOpen(!open)}
            className="p-1.5 rounded-full border border-dashed border-gray-300 text-indigo-500 hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && createPortal(
        <div className="assignee-portal" style={menuStyle}>
          <div className="w-64 bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gray-100">
                <Search className="w-3.5 h-3.5 text-gray-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="بحث..." autoFocus
                  className="flex-1 bg-transparent text-sm outline-none text-gray-700 placeholder:text-gray-400" />
              </div>
            </div>
            <div className="max-h-48 overflow-y-auto p-1 space-y-0.5">
              {filtered.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">{search ? 'لا توجد نتائج' : 'لا يوجد أعضاء متاحون'}</p>
              ) : (
                filtered.map(u => (
                  <button key={u.id} onClick={() => handleAdd(u.id)} disabled={loading === u.id}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors text-right disabled:opacity-50">
                    {loading === u.id ? (
                      <Loader2 className="w-4 h-4 animate-spin text-indigo-500 shrink-0" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                    )}
                    <Avatar name={u.name} avatar={u.avatar} size="sm" />
                    <span className="text-sm text-gray-900 truncate">{u.name}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
