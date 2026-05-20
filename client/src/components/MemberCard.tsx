import React from 'react'
import { Snowflake, AlertTriangle } from 'lucide-react'
import Avatar from './Avatar'
import type { User } from '../types'

interface MemberCardProps {
  member: User
  onSelect: (type: string, item: any) => void
  index: number
}

function MemberCard({ member, onSelect, index }: MemberCardProps) {
  return (
    <div
      className="card-hover rounded-xl p-3 cursor-pointer bg-white anim-fade shadow-sm flex items-center gap-3"
      style={{ animationDelay: `${index * 0.05}s` }}
      onClick={() => onSelect('member', member)}
      tabIndex={0} role="button" onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect('member', member) } }}
    >
      <Avatar name={member.name} avatar={member.avatar} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-bold text-gray-800 truncate">{member.name}</span>
          {member.frozen_at && <Snowflake className="w-3 h-3 text-blue-400 shrink-0" />}
        </div>
        <div className="text-[0.6rem] text-gray-500">{member.role_name}</div>
      </div>
      <div className="flex items-center gap-1">
        <div className="w-5 h-5 rounded-full flex items-center justify-center text-[0.55rem] font-bold"
          style={{ background: (member.credit_score ?? 10) >= 8 ? '#d1fae5' : (member.credit_score ?? 10) >= 5 ? '#fef3c7' : '#fee2e2', color: (member.credit_score ?? 10) >= 8 ? '#059669' : (member.credit_score ?? 10) >= 5 ? '#d97706' : '#dc2626' }}>
          {member.credit_score ?? '?'}
        </div>
        {!!member.warnings && member.warnings > 0 && (
          <div className="w-4 h-4 rounded-full bg-red-500 flex items-center justify-center">
            <AlertTriangle className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>
    </div>
  )
}

export default React.memo(MemberCard)
