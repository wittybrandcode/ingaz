import { useState } from 'react'
import api from '../lib/api'
import { useToast } from './Toast'
import type { MemberProfile } from '../store/memberStore'
import { X, Loader2 } from 'lucide-react'

interface WarnModalProps {
  member: MemberProfile
  onClose: () => void
}

export default function WarnModal({ member, onClose }: WarnModalProps) {
  const { toast } = useToast()
  const [reason, setReason] = useState('')
  const [deadline, setDeadline] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) { toast('اكتب سبب الإنذار', 'error'); return }
    if (!deadline) { toast('حدد مهلة الرد', 'error'); return }
    setSubmitting(true)
    try {
      await api.post('/warnings', {
        user_id: member.id,
        reason: reason.trim(),
        deadline,
      })
      toast(`تم إرسال إنذار إلى ${member.name}`)
      onClose()
    } catch {
      toast('فشل إرسال الإنذار', 'error')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-5 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">إنذار: {member.name}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">سبب الإنذار</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none resize-none h-24"
              placeholder="اكتب سبب الإنذار..." required />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">مهلة الرد</label>
            <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none" required />
          </div>

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm hover:bg-gray-50">
              إلغاء
            </button>
            <button type="submit" disabled={submitting || !reason.trim() || !deadline}
              className="flex-1 py-2 rounded-lg bg-amber-600 text-white text-sm hover:bg-amber-700 disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'إرسال إنذار'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
