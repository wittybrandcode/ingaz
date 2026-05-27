import { List, UserCheck, ClipboardList, Plus, AlertTriangle } from 'lucide-react'
import KanbanColumn from './KanbanColumn'
import MemberProfileCard from './MemberProfileCard'
import type { MemberProfile } from '../store/memberStore'

interface Props {
  users: MemberProfile[]
  selectedMember: number | null
  memberTab: string
  onSelectMember: (id: number | null) => void
  onSetTab: (tab: string) => void
  onDetail: (user: MemberProfile) => void
  onAssign: (user: MemberProfile) => void
  onWarn: (user: MemberProfile) => void
  bg: string
}

const tabs = [
  { key: 'all', icon: List },
  { key: 'active', icon: UserCheck },
  { key: 'on_task', icon: ClipboardList },
]

export default function MembersColumn({ users, selectedMember, memberTab, onSelectMember, onSetTab, onDetail, onAssign, onWarn, bg }: Props) {
  return (
    <KanbanColumn header={
      <div className="flex items-center justify-between w-full" style={{ minHeight: '44px' }}>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-5 rounded-full text-[0.6rem] font-bold flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.1)', color: '#333' }}>{users.length}</span>
          {tabs.map(tab => {
            const Icon = tab.icon
            return (
              <button key={tab.key} onClick={() => onSetTab(tab.key)}
                className="w-6 h-6 rounded-md border-none flex items-center justify-center text-xs cursor-pointer transition-all"
                style={{
                  background: memberTab === tab.key ? (tab.key === 'active' ? '#d1fae5' : tab.key === 'on_task' ? '#ede9fe' : '#333') : 'rgba(0,0,0,0.06)',
                  color: memberTab === tab.key ? (tab.key === 'active' ? '#059669' : tab.key === 'on_task' ? '#7c3aed' : '#fff') : '#777',
                }}
                title={tab.key === 'all' ? 'الكل' : tab.key === 'active' ? 'النشطون' : 'على المهام'}>
                <Icon className="w-3.5 h-3.5" />
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-1">
          <button className="w-6 h-6 rounded-full border-none flex items-center justify-center text-xs cursor-pointer transition-all hover:bg-gray-300" style={{ background: 'rgba(0,0,0,0.08)', color: '#777' }} title="إضافة عضو">
            <Plus className="w-3 h-3" />
          </button>
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center" title="إنذارات">
            <AlertTriangle className="w-3 h-3 text-white" />
          </div>
        </div>
      </div>
    } bg={bg}>
      {users.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-xs">لا يوجد أعضاء</div>
      ) : (
        users.map((u) => (
          <div key={u.id} className="space-y-1">
            <div onClick={() => onSelectMember(selectedMember === u.id ? null : u.id)}>
              <MemberProfileCard member={u as any} />
            </div>
            {selectedMember === u.id && (
              <div className="flex gap-1 px-2 pb-1">
                <button onClick={() => { onSelectMember(null); onDetail(u) }}
                  className="flex-1 py-1 rounded text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                  تفاصيل
                </button>
                <button onClick={() => { onSelectMember(null); onAssign(u) }}
                  className="flex-1 py-1 rounded text-xs bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors">
                  تكليف
                </button>
                <button onClick={() => { onSelectMember(null); onWarn(u) }}
                  className="flex-1 py-1 rounded text-xs bg-amber-100 text-amber-600 hover:bg-amber-200 transition-colors">
                  إنذار
                </button>
              </div>
            )}
          </div>
        ))
      )}
      {users.length === 0 && (
        <div className="text-xs text-gray-400 text-center py-4">لا يوجد أعضاء</div>
      )}
    </KanbanColumn>
  )
}
