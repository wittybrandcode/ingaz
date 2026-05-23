import { useMemberStore, type MemberProfile } from '../store/memberStore'
import ProfileAvatar, { warningsBadge } from './ProfileAvatar'
import { Users } from 'lucide-react'

export default function MemberProfileCard({ member }: { member: MemberProfile }) {
  const selectedMemberId = useMemberStore(s => s.selectedMemberId)
  const selectMember = useMemberStore(s => s.selectMember)
  const isSelected = selectedMemberId === member.id

  return (
    <button
      onClick={() => selectMember(isSelected ? null : member.id)}
      className={`w-full text-right p-3 rounded-xl border transition-all ${
        isSelected
          ? 'border-indigo-400 bg-indigo-50 shadow-sm'
          : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="flex items-center gap-3">
        <ProfileAvatar
          name={member.name}
          avatar={member.avatar}
          size="md"
          badges={[
            warningsBadge(member.warnings_count),
          ]}
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {member.name}
            {member.online && (
              <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-1.5 animate-pulse" title="متصل" />
            )}
          </p>
          <p className="text-xs text-gray-500 truncate">{member.role_name || '—'}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Users className="w-3 h-3" />
              {member.projects_count}
            </span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${member.active_tasks > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
              {member.active_tasks} مهام
            </span>
          </div>
        </div>
      </div>
    </button>
  )
}
