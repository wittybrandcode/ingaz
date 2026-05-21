import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '../lib/api'
import { AlertTriangle, Snowflake, Unlock, Loader2, Search, MessageSquare, CheckCircle2, XCircle } from 'lucide-react'
import Avatar from '../components/Avatar'
import { useToast } from '../components/Toast'
import { useAppStore } from '../store/appStore'
import { ROLES } from '../constants'
import type { Warning, WarningType } from '../types'
import { WARNING_STATUS_CONFIG } from '../statusConfig'

export default function WarningsAdmin() {
  const { toast } = useToast()
  const [warnings, setWarnings] = useState<Warning[]>([])
  const users = useAppStore(s => s.users)
  const usersLoading = useAppStore(s => s.usersLoading)
  const loadUsers = useAppStore(s => s.loadUsers)
  const [warningTypes, setWarningTypes] = useState<WarningType[]>([])
  const [showIssue, setShowIssue] = useState(false)
  const [selectedUser, setSelectedUser] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [reason, setReason] = useState('')
  const [deadlineHours, setDeadlineHours] = useState(48)
  const [issuing, setIssuing] = useState(false)
  const [clearing, setClearing] = useState<number | null>(null)
  const [sustaining, setSustaining] = useState<number | null>(null)
  const [unfreezing, setUnfreezing] = useState<number | null>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') || 'all'
  const [searchQuery, setSearchQuery] = useState('')

  const load = async () => {
    try {
      const [wRes, wtRes] = await Promise.all([
        api.get<Warning[]>('/warnings'),
        api.get<WarningType[]>('/warnings/types')
      ])
      setWarnings(wRes.data)
      setWarningTypes(wtRes.data)
      loadUsers()
    } catch (e) { console.error('Failed to load warnings', e) }
  }

  useEffect(() => { load() }, [])

  const filtered = useMemo(() => warnings.filter(w => {
    if (tab === 'pending') return w.status === 'pending'
    if (tab === 'responded') return w.status === 'responded'
    if (tab === 'cleared') return w.status === 'cleared'
    return true
  }).filter(w => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (w.user_name && w.user_name.toLowerCase().includes(q)) ||
           (w.reason && w.reason.toLowerCase().includes(q)) ||
           (w.issued_by_name && w.issued_by_name.toLowerCase().includes(q))
  }), [warnings, tab, searchQuery])

  const statusConfig = WARNING_STATUS_CONFIG

  const handleIssue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUser || !reason.trim()) return
    setIssuing(true)
    try {
      await api.post('/warnings', {
        user_id: Number(selectedUser),
        reason: reason.trim(),
        deadline_hours: deadlineHours,
        warning_type_id: selectedType ? Number(selectedType) : undefined
      })
      setShowIssue(false); setSelectedUser(''); setSelectedType(''); setReason(''); setDeadlineHours(48)
      toast('تم إصدار الإنذار')
      load()
    } catch { toast('فشل إصدار الإنذار', 'error') } finally { setIssuing(false) }
  }

  const handleClear = async (id: number) => {
    setClearing(id)
    try { await api.put('/warnings/' + id + '/clear'); toast('تم فك الإنذار وإعادة النقاط'); setWarnings(prev => prev.map(w => w.id === id ? { ...w, status: 'cleared' as const } : w)); loadUsers() } catch { toast('فشل العملية', 'error') } finally { setClearing(null) }
  }

  const handleSustain = async (id: number) => {
    if (!confirm('هل أنت متأكد من الإبقاء على الإنذار (خصم النقاط)؟')) return
    setSustaining(id)
    try { await api.put('/warnings/' + id + '/sustain'); toast('تم الإبقاء على الإنذار وخصم النقاط'); setWarnings(prev => prev.map(w => w.id === id ? { ...w, status: 'sustained' as const } : w)); loadUsers() } catch { toast('فشل العملية', 'error') } finally { setSustaining(null) }
  }

  const handleUnfreeze = async (userId: number) => {
    if (!confirm('هل أنت متأكد من فك تجميد هذا الحساب؟')) return
    setUnfreezing(userId)
    try { await api.put('/warnings/unfreeze/' + userId); toast('تم فك التجميد'); setWarnings(prev => prev.filter(w => w.user_id !== userId)) } catch { toast('فشل فك التجميد', 'error') } finally { setUnfreezing(null) }
  }

  const frozenUsers = users.filter(u => u.frozen_at)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">إدارة الإنذارات</h1>
        <div className="flex gap-2">
          {usersLoading ? (
            <div className="flex items-center px-4 py-2 bg-gray-50 rounded-lg"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
          ) : frozenUsers.length > 0 && (
            <div className="relative group">
              <button className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 rounded-lg text-sm font-medium border border-red-200">
                <Snowflake className="w-4 h-4" /> {frozenUsers.length} مجمد
              </button>
              <div className="absolute left-0 top-full mt-1 w-72 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden z-10 hidden group-hover:block">
                <div className="p-3 space-y-2">
                  {frozenUsers.map(u => (
                    <div key={u.id} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{u.name}</span>
                      <button onClick={() => handleUnfreeze(u.id)} disabled={unfreezing === u.id} title="فك التجميد"
                        className="p-1.5 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-30">
                        {unfreezing === u.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <button onClick={() => setShowIssue(true)} title="إصدار إنذار"
            className="p-2.5 rounded-full bg-red-500 text-white hover:bg-red-600">
            <AlertTriangle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showIssue && (
        <form onSubmit={handleIssue} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">إصدار إنذار جديد</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
              className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500" required>
              <option value="">اختر الموظف...</option>
              {users.filter(u => u.role_id !== ROLES.ADMIN).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <select value={selectedType} onChange={e => { setSelectedType(e.target.value); const t = warningTypes.find(wt => wt.id === Number(e.target.value)); if (t) setReason(t.name); }}
              className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">نوع الإنذار...</option>
              {warningTypes.filter(t => t.is_active).map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.points} نقاط)</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <input type="number" value={deadlineHours} onChange={e => setDeadlineHours(Number(e.target.value))}
                className="w-20 px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500" min={1} />
              <span className="text-sm text-gray-500">ساعة للرد</span>
            </div>
          </div>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="سبب الإنذار..."
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500 resize-none" rows={3} required />
          {selectedType && (
            <div className="text-xs text-gray-500 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-400" />
              سيتم خصم {warningTypes.find(t => t.id === Number(selectedType))?.points || 0} نقاط من رصيد الموظف
            </div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={issuing}
              className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600 disabled:opacity-50">
              {issuing ? 'جاري...' : 'إصدار الإنذار'}
            </button>
            <button type="button" onClick={() => setShowIssue(false)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">إلغاء</button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {['all', 'pending', 'responded', 'cleared'].map(t => (
            <button key={t} onClick={() => setSearchParams({ tab: t })}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${tab === t ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>
              {t === 'all' ? 'الكل' : t === 'pending' ? 'بانتظار الرد' : t === 'responded' ? 'تم الرد' : 'تم الفك'}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث باسم الموظف أو السبب..."
            className="pr-9 pl-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500 w-64" />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">لا توجد إنذارات</div>
        ) : (
          filtered.map(w => {
            const cfg = statusConfig[w.status] || statusConfig.pending
            const Icon = cfg.icon
            return (
              <div key={w.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`${cfg.bg} ${cfg.color} px-2 py-0.5 rounded text-xs flex items-center gap-1`}>
                        <Icon className="w-3 h-3" /> {cfg.label}
                      </span>
                      <span className="text-xs text-gray-400">#{w.id}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mb-2">
                      <Avatar name={w.user_name} avatar={w.user_avatar} size="sm" />
                      <span className="font-medium text-gray-900">{w.user_name}</span>
                      <span className="text-gray-400">بواسطة</span>
                      <Avatar name={w.issued_by_name} avatar={w.issued_by_avatar} size="sm" />
                      <span className="text-gray-600">{w.issued_by_name}</span>
                    </div>
                    <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{w.reason}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                      <span>تاريخ: {new Date(w.created_at).toLocaleDateString('ar-SA-u-nu-latn')}</span>
                      <span>الرد حتى: {new Date(w.deadline).toLocaleDateString('ar-SA-u-nu-latn')}</span>
                      {w.warning_type_name && <span className="px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">{w.warning_type_name} (-{w.points_deducted})</span>}
                      {w.credit_after !== undefined && <span>الرصيد بعد: {w.credit_after}/10</span>}
                    </div>
                  </div>
                </div>

                {w.response_text && (
                  <div className="mt-3 bg-blue-50 rounded-lg p-3">
                    <p className="text-xs text-blue-500 font-medium mb-1 flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" /> رد الموظف
                    </p>
                    <p className="text-sm text-blue-800">{w.response_text}</p>
                    {w.responded_at && (
                      <p className="text-xs text-blue-400 mt-1">{new Date(w.responded_at).toLocaleDateString('ar-SA-u-nu-latn')}</p>
                    )}
                  </div>
                )}

                {w.status === 'responded' && (
                  <div className="mt-3 flex gap-1.5 items-center">
                    <button onClick={() => handleClear(w.id)} disabled={clearing === w.id} title="قبول التقرير وفك الإنذار"
                      className="p-2 rounded-full bg-green-500 text-white hover:bg-green-600 transition-colors disabled:opacity-40">
                      {clearing === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    </button>
                    <button onClick={() => handleSustain(w.id)} disabled={sustaining === w.id} title="الإبقاء على الإنذار"
                      className="p-2 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-40">
                      {sustaining === w.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    </button>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
