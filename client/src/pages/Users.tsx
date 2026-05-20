import { useEffect, useState, useMemo } from 'react'
import api from '../lib/api'
import { UserPlus, Trash2, RotateCcw, AlertTriangle, Send, X, Loader2, Search } from 'lucide-react'
import Avatar from '../components/Avatar'
import { useAppStore } from '../store/appStore'
import { ROLES } from '../constants'
import type { User } from '../types'

export default function Users() {
  const users = useAppStore(s => s.users)
  const usersLoading = useAppStore(s => s.usersLoading)
  const loadUsers = useAppStore(s => s.loadUsers)
  const roles = useAppStore(s => s.roles)
  const loadRoles = useAppStore(s => s.loadRoles)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState<number | ''>('')
  const [editing, setEditing] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<number | ''>('')
  const [editStatus, setEditStatus] = useState('active')
  const [warningTarget, setWarningTarget] = useState<User | null>(null)
  const [warningReason, setWarningReason] = useState('')
  const [warningDeadline, setWarningDeadline] = useState(48)
  const [issuingWarning, setIssuingWarning] = useState(false)
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<number | ''>('')
  const [statusFilter, setStatusFilter] = useState('')
  const [restoring, setRestoring] = useState<number | null>(null)

  const filteredUsers = useMemo(() => users.filter(u => {
    if (searchQuery && !u.name.toLowerCase().includes(searchQuery.toLowerCase()) && !u.email.toLowerCase().includes(searchQuery.toLowerCase())) return false
    if (roleFilter !== '' && u.role_id !== roleFilter) return false
    if (statusFilter && u.status !== statusFilter) return false
    return true
  }), [users, searchQuery, roleFilter, statusFilter])

  const presetReasons = [
    'تأخر عن العمل',
    'تقصير في المهام',
    'عدم التزام بالمواعيد النهائية',
    'سلوك غير لائق',
    'إهمال متكرر',
    'مخالفة تعليمات العمل',
    'غياب بدون إذن',
    'تسليم أعمال غير مكتملة',
  ]

  const handleIssueWarning = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!warningTarget || !warningReason.trim() || issuingWarning) return
    setIssuingWarning(true)
    try {
      await api.post('/warnings', {
        user_id: warningTarget.id,
        reason: warningReason.trim(),
        deadline_hours: warningDeadline,
      })
      setWarningTarget(null)
      setWarningReason('')
      setWarningDeadline(48)
    } finally { setIssuingWarning(false) }
  }

  const updateUsers = useAppStore(s => s.updateUsers)

  useEffect(() => { loadUsers(); loadRoles() }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim() || !password || !roleId) return
    setCreating(true)
    try {
      const { data: newUser } = await api.post<User>('/users', { name, email, password, role_id: roleId })
      setName(''); setEmail(''); setPassword(''); setRoleId(''); setShowForm(false)
      updateUsers(prev => [newUser, ...prev])
    } catch (e) { console.error('createUser failed', e) } finally { setCreating(false) }
  }

  const update = async (id: number) => {
    if (!editRole) return
    setSaving(id)
    try {
      await api.put(`/users/${id}`, { name: editName, email: editEmail, role_id: editRole, status: editStatus })
      updateUsers(prev => prev.map(u => u.id === id ? { ...u, name: editName, email: editEmail, role_id: editRole, status: editStatus } : u))
      setEditing(null)
    } catch (e) { console.error('updateUser failed', e) } finally { setSaving(null) }
  }

  const remove = async (id: number) => {
    if (!confirm('هل أنت متأكد من أرشفة هذا المستخدم؟ يمكنك استعادته لاحقاً.')) return
    setDeleting(id)
    try { await api.delete(`/users/${id}`); loadUsers() } catch (e) { console.error('archiveUser failed', e) } finally { setDeleting(null) }
  }

  const restore = async (id: number) => {
    setRestoring(id)
    try { await api.put(`/users/${id}/restore`); loadUsers() } catch (e) { console.error('restoreUser failed', e) } finally { setRestoring(null) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">المستخدمين</h1>
        <button onClick={() => setShowForm(true)} title="مستخدم جديد"
          className="p-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700">
          <UserPlus className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو البريد..."
            className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value ? Number(e.target.value) : '')}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">كل الأدوار</option>
          {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
          <option value="">كل الحالات</option>
          <option value="active">نشط</option>
          <option value="inactive">غير نشط</option>
          <option value="archived">مؤرشف</option>
        </select>
      </div>

      {showForm && (
        <form onSubmit={create} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="الاسم" className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني" className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="كلمة المرور" className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
            <select value={roleId} onChange={e => setRoleId(Number(e.target.value))} className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="">اختر الدور...</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">{creating ? 'جاري...' : 'إنشاء'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">إلغاء</button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {usersLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-right p-3 font-medium text-gray-600">الاسم</th>
              <th className="text-right p-3 font-medium text-gray-600">البريد الإلكتروني</th>
              <th className="text-right p-3 font-medium text-gray-600">الدور</th>
              <th className="text-right p-3 font-medium text-gray-600">الحالة</th>
              <th className="text-center p-3 font-medium text-gray-600">الرصيد</th>
              <th className="text-start p-3 font-medium text-gray-600">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-gray-400">لا توجد نتائج للبحث</td></tr>
            ) : filteredUsers.map(u => (
              <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                {editing === u.id ? (
                  <>
                    <td className="p-3"><input value={editName} onChange={e => setEditName(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm w-full" /></td>
                    <td className="p-3"><input value={editEmail} onChange={e => setEditEmail(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm w-full" /></td>
                    <td className="p-3">
                      <select value={editRole} onChange={e => setEditRole(Number(e.target.value))} className="px-2 py-1 border border-gray-300 rounded text-sm">
                        <option value="">اختر الدور...</option>
                        {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-sm">
                        <option value="active">نشط</option>
                        <option value="inactive">غير نشط</option>
                      </select>
                    </td>
                    <td className="p-3 text-center text-xs text-gray-400">-</td>
                    <td className="p-3 text-left">
                      <button onClick={() => update(u.id)} disabled={saving === u.id} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50 ml-1">{saving === u.id ? 'جاري...' : 'حفظ'}</button>
                      <button onClick={() => setEditing(null)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">إلغاء</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <Avatar name={u.name} avatar={u.avatar} size="sm" />
                        <span className="font-medium text-gray-900">{u.name}</span>
                      </div>
                    </td>
                    <td className="p-3 text-gray-600">{u.email}</td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700">{u.role_name}</span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        u.status === 'active' ? 'bg-green-50 text-green-700' :
                        u.status === 'archived' ? 'bg-gray-100 text-gray-500' :
                        'bg-red-50 text-red-700'
                      }`}>
                        {u.status === 'active' ? 'نشط' : u.status === 'archived' ? 'مؤرشف' : 'غير نشط'}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {u.credit_score !== undefined ? (
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${u.credit_score >= 8 ? 'text-green-600 bg-green-50' : u.credit_score >= 5 ? 'text-yellow-600 bg-yellow-50' : u.credit_score >= 3 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50'}`}>
                          {u.credit_score}/10
                        </span>
                      ) : '-'}
                    </td>
                    <td className="p-3 text-left">
                      <button onClick={() => { setEditing(u.id); setEditName(u.name); setEditEmail(u.email); setEditRole(u.role_id); setEditStatus(u.status) }}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 ml-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      {u.status === 'archived' ? (
                        <button onClick={() => restore(u.id)} disabled={restoring === u.id} className="p-1 hover:bg-gray-100 rounded text-green-500 hover:text-green-700 ml-1" title="استعادة المستخدم">
                          {restoring === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                        </button>
                      ) : (
                        <>
                          {u.role_id !== ROLES.ADMIN && (
                            <button onClick={() => setWarningTarget(u)} className="p-1 hover:bg-gray-100 rounded text-red-400 hover:text-red-600 ml-1" title="إصدار إنذار">
                              <AlertTriangle className="w-4 h-4" />
                            </button>
                          )}
                          {u.id !== 1 && (
                            <button onClick={() => remove(u.id)} disabled={deleting === u.id} className="p-1 hover:bg-gray-100 rounded text-red-400 hover:text-red-600 disabled:opacity-30" title="أرشفة المستخدم">
                              {deleting === u.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
      {warningTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setWarningTarget(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" /> إصدار إنذار
              </h2>
              <button onClick={() => setWarningTarget(null)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleIssueWarning} className="p-5 space-y-4">
              <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
                <Avatar name={warningTarget.name} avatar={warningTarget.avatar} size="md" />
                <div>
                  <p className="font-semibold text-gray-900">{warningTarget.name}</p>
                  <p className="text-xs text-gray-500">{warningTarget.email}</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">أسباب مقترحة</label>
                <div className="flex flex-wrap gap-1.5">
                  {presetReasons.map(r => (
                    <button key={r} type="button" onClick={() => setWarningReason(r)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${warningReason === r ? 'bg-red-500 text-white border-red-500' : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-red-50 hover:border-red-300'}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">سبب الإنذار</label>
                <textarea value={warningReason} onChange={e => setWarningReason(e.target.value)}
                  placeholder="اكتب سبب الإنذار..."
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm outline-none focus:ring-2 focus:ring-red-500 resize-none" rows={3} required />
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-700 font-medium whitespace-nowrap">مهلة الرد:</label>
                <input type="number" value={warningDeadline} onChange={e => setWarningDeadline(Number(e.target.value))}
                  className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500" min={1} />
                <span className="text-sm text-gray-500">ساعة</span>
              </div>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={!warningReason.trim() || issuingWarning}
                  className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl hover:bg-red-600 disabled:opacity-50 text-sm font-medium transition-colors flex items-center justify-center gap-2">
                  {issuingWarning ? 'جاري الإصدار...' : <><Send className="w-4 h-4" /> إصدار الإنذار</>}
                </button>
                <button type="button" onClick={() => setWarningTarget(null)}
                  className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm transition-colors">
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
