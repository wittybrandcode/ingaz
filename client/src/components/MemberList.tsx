import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useMemberStore, type MemberProfile } from '../store/memberStore'
import MemberProfileCard from './MemberProfileCard'
import AssignModal from './AssignModal'
import WarnModal from './WarnModal'
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react'

export default function MemberList() {
  const members = useMemberStore(s => s.members)
  const loading = useMemberStore(s => s.loading)
  const error = useMemberStore(s => s.error)
  const loadMembers = useMemberStore(s => s.loadMembers)
  const selectedMemberId = useMemberStore(s => s.selectedMemberId)
  const selectMember = useMemberStore(s => s.selectMember)
  const user = useAuthStore(s => s.user)
  const [assignTarget, setAssignTarget] = useState<MemberProfile | null>(null)
  const [warnTarget, setWarnTarget] = useState<MemberProfile | null>(null)

  useEffect(() => { loadMembers() }, [])

  const selectedMember = members.find(m => m.id === selectedMemberId)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-gray-900">الأعضاء</h2>
        <button
          onClick={loadMembers}
          className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          title="تحديث"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {loading && members.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <AlertCircle className="w-6 h-6 text-red-400" />
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      ) : members.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">لا يوجد أعضاء</p>
      ) : (
        <div className="space-y-2 max-h-[360px] overflow-y-auto overscroll-contain">
          {members.map(m => (
            <MemberProfileCard key={m.id} member={m} />
          ))}
        </div>
      )}

      {selectedMember && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-center justify-center gap-2">
            {selectedMember.can_assign && user?.is_manager && (
              <button
                onClick={() => { selectMember(null); setAssignTarget(selectedMember) }}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors text-xs"
              >
                <span className="text-lg leading-none">➕</span>
                تكليف
              </button>
            )}
            {user?.is_manager && (
              <button
                onClick={() => { selectMember(null); setWarnTarget(selectedMember) }}
                className="flex-1 flex flex-col items-center gap-0.5 py-2 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors text-xs"
              >
                <span className="text-lg leading-none">⚠️</span>
                إنذار
              </button>
            )}
          </div>
        </div>
      )}

      {assignTarget && <AssignModal member={assignTarget} onClose={() => setAssignTarget(null)} />}
      {warnTarget && <WarnModal member={warnTarget} onClose={() => setWarnTarget(null)} />}
    </div>
  )
}
