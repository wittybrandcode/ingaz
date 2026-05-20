import { useEffect, useState, useMemo } from 'react'
import api from '../lib/api'
import { Plus, Trash2, Save, Edit3, Shield, AlertTriangle, UserCheck, Loader2, Search } from 'lucide-react'
import type { WarningType, RestrictionLevel, CreditUser } from '../types'

const levelIcons: Record<string, React.ReactNode> = {
  excellent: <Shield className="w-5 h-5 text-green-500" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
  restricted: <Shield className="w-5 h-5 text-orange-500" />,
  frozen: <AlertTriangle className="w-5 h-5 text-red-500" />,
}

const permLabels: Record<string, string> = {
  can_login: 'تسجيل الدخول',
  can_create_projects: 'إنشاء مشاريع',
  can_create_tasks: 'إنشاء مهام',
  can_edit: 'تعديل',
  can_assign: 'تعيين',
  can_submit: 'تسليم',
  can_comment: 'تعليق',
}

export default function WarningManagement() {
  const [tab, setTab] = useState('types')
  const [warningTypes, setWarningTypes] = useState<WarningType[]>([])
  const [levels, setLevels] = useState<RestrictionLevel[]>([])
  const [creditUsers, setCreditUsers] = useState<CreditUser[]>([])
  const [editingType, setEditingType] = useState<WarningType | null>(null)
  const [editingLevel, setEditingLevel] = useState<RestrictionLevel | null>(null)
  const [newType, setNewType] = useState({ name: '', description: '', points: 1 })
  const [showNewType, setShowNewType] = useState(false)
  const [creating, setCreating] = useState(false)
  const [savingType, setSavingType] = useState<number | null>(null)
  const [deletingType, setDeletingType] = useState<number | null>(null)
  const [savingLevel, setSavingLevel] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCreditUsers = useMemo(() => {
    if (!searchQuery) return creditUsers
    const q = searchQuery.toLowerCase()
    return creditUsers.filter(u => u.name.toLowerCase().includes(q))
  }, [creditUsers, searchQuery])

  const load = async () => {
    setLoading(true)
    try {
      const [wt, lv, cu] = await Promise.all([
        api.get<WarningType[]>('/warnings/types'),
        api.get<RestrictionLevel[]>('/warnings/levels'),
        api.get<CreditUser[]>('/warnings/credit-scores')
      ])
      setWarningTypes(wt.data)
      setLevels(lv.data)
      setCreditUsers(cu.data)
    } catch (e) { console.error('Failed to load warning management data', e) } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const saveType = async (t: WarningType) => {
    setSavingType(t.id)
    try { await api.put(`/warnings/types/${t.id}`, { name: t.name, description: t.description, points: t.points, is_active: t.is_active ? 1 : 0 }); setEditingType(null); load() } catch (e) { console.error('saveWarningType failed', e) } finally { setSavingType(null) }
  }

  const createType = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newType.name.trim()) return
    setCreating(true)
    try { await api.post('/warnings/types', { name: newType.name.trim(), description: newType.description, points: newType.points }); setNewType({ name: '', description: '', points: 1 }); setShowNewType(false); load() } catch (e) { console.error('createWarningType failed', e) } finally { setCreating(false) }
  }

  const deleteType = async (id: number) => {
    if (!confirm('حذف هذا النوع؟')) return
    setDeletingType(id)
    try { await api.delete(`/warnings/types/${id}`); load() } catch (e) { console.error('deleteWarningType failed', e) } finally { setDeletingType(null) }
  }

  const saveLevel = async (l: RestrictionLevel) => {
    setSavingLevel(l.id)
    try { await api.put(`/warnings/levels/${l.id}`, l); setEditingLevel(null); load() } catch (e) { console.error('saveLevel failed', e) } finally { setSavingLevel(null) }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">إدارة نظام الرصيد والإنذارات</h1>

      <div className="flex gap-2 border-b border-gray-200 pb-3">
        {[
          { key: 'types', label: 'أنواع الإنذارات', icon: AlertTriangle },
          { key: 'levels', label: 'مستويات التقييد', icon: Shield },
          { key: 'credits', label: 'رصيد الأعضاء', icon: UserCheck },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition-colors ${tab === t.key ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-500 hover:bg-gray-100'}`}>
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'types' && (
        <div className="space-y-4">
          {loading && (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-6 space-y-4">
                {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-10 w-full" />)}
              </div>
            </div>
          )}
          {!loading && (<>
          <div className="flex justify-end">
            <button onClick={() => setShowNewType(true)} className="p-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700">
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {showNewType && (
            <form onSubmit={createType} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
              <h3 className="font-semibold text-gray-900">نوع إنذار جديد</h3>
              <div className="grid sm:grid-cols-3 gap-4">
                <input value={newType.name} onChange={e => setNewType(p => ({ ...p, name: e.target.value }))} placeholder="الاسم (مثال: تأخير)" className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
                <input value={newType.points} onChange={e => setNewType(p => ({ ...p, points: Number(e.target.value) }))} type="number" min={1} max={10} placeholder="النقاط" className="px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" required />
              </div>
              <input value={newType.description} onChange={e => setNewType(p => ({ ...p, description: e.target.value }))} placeholder="وصف (اختياري)" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="flex gap-2">
                <button type="submit" disabled={creating} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">{creating ? 'جاري...' : 'إضافة'}</button>
                <button type="button" onClick={() => setShowNewType(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">إلغاء</button>
              </div>
            </form>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-right p-3 font-medium text-gray-600">النوع</th>
                  <th className="text-right p-3 font-medium text-gray-600">الوصف</th>
                  <th className="text-center p-3 font-medium text-gray-600">النقاط</th>
                  <th className="text-center p-3 font-medium text-gray-600">الحالة</th>
                  <th className="text-left p-3 font-medium text-gray-600"></th>
                </tr>
              </thead>
              <tbody>
                {warningTypes.map(t => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    {editingType?.id === t.id ? (
                      <>
                        <td className="p-3"><input value={editingType.name} onChange={e => setEditingType(p => p ? { ...p, name: e.target.value } : null)} className="px-2 py-1 border border-gray-300 rounded text-sm w-full" /></td>
                        <td className="p-3"><input value={editingType.description || ''} onChange={e => setEditingType(p => p ? { ...p, description: e.target.value } : null)} className="px-2 py-1 border border-gray-300 rounded text-sm w-full" /></td>
                        <td className="p-3 text-center"><input value={editingType.points} onChange={e => setEditingType(p => p ? { ...p, points: Number(e.target.value) } : null)} type="number" min={1} className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center" /></td>
                        <td className="p-3 text-center">
                          <button onClick={() => setEditingType(p => p ? { ...p, is_active: p.is_active ? 0 : 1 } : null)} className={`px-2 py-0.5 rounded text-xs ${editingType?.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{editingType?.is_active ? 'مفعل' : 'معطل'}</button>
                        </td>
                        <td className="p-3 text-left">
                          <button onClick={() => saveType(editingType!)} disabled={savingType === editingType?.id} className="px-3 py-1 bg-indigo-600 text-white rounded text-xs hover:bg-indigo-700 disabled:opacity-50 ml-1">{savingType === editingType?.id ? 'جاري...' : 'حفظ'}</button>
                          <button onClick={() => setEditingType(null)} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300">إلغاء</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="p-3 font-medium text-gray-900">{t.name}</td>
                        <td className="p-3 text-gray-500 text-xs">{t.description}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-50 text-red-600">{t.points}</span>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-xs ${t.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{t.is_active ? 'مفعل' : 'معطل'}</span>
                        </td>
                        <td className="p-3 text-left">
                          <button onClick={() => setEditingType({ ...t })} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 ml-1"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => deleteType(t.id)} disabled={deletingType === t.id} className="p-1 hover:bg-gray-100 rounded text-red-400 hover:text-red-600 disabled:opacity-30">{deletingType === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</button>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </>)}
        </div>
      )}

      {tab === 'levels' && (
        <div className="grid md:grid-cols-2 gap-4">
          {loading ? (
            <>
              {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-48 w-full rounded-xl" />)}
            </>
          ) : levels.map(l => (
            <div key={l.id} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4" style={{ borderColor: l.color + '40' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2" style={{ color: l.color }}>
                  {levelIcons[l.name] || <Shield className="w-5 h-5" />}
                  <h3 className="font-bold">{l.name_ar}</h3>
                </div>
                <button onClick={() => setEditingLevel(editingLevel?.id === l.id ? null : { ...l })} className="p-1.5 hover:bg-gray-100 rounded text-gray-400">
                  <Edit3 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">الحد الأدنى:</span>
                {editingLevel?.id === l.id ? (
                  <input value={editingLevel.min_score} onChange={e => setEditingLevel(p => p ? { ...p, min_score: Number(e.target.value) } : null)} type="number" min={0} max={10} className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center" />
                ) : (
                  <span className="text-lg font-bold" style={{ color: l.color }}>{l.min_score}</span>
                )}
                <span className="text-sm text-gray-400">من 10</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {Object.entries(permLabels).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2 text-sm text-gray-600">
                    {editingLevel?.id === l.id ? (
                      <input type="checkbox" checked={!!editingLevel?.[key as keyof RestrictionLevel]} onChange={() => setEditingLevel(p => p ? { ...p, [key]: p[key as keyof RestrictionLevel] ? 0 : 1 } : null)}
                        className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    ) : (
                      <span className={`w-4 h-4 rounded-full ${l[key as keyof RestrictionLevel] ? 'bg-green-500' : 'bg-red-400'}`} />
                    )}
                    {label}
                  </label>
                ))}
              </div>

              {editingLevel?.id === l.id && (
                <button onClick={() => saveLevel(editingLevel)} disabled={savingLevel === l.id} className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                  {savingLevel === l.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ المستوى
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === 'credits' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="بحث باسم العضو..."
              className="w-full pr-9 pl-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-4">
                {[0, 1, 2, 3].map(i => <div key={i} className="skeleton h-10 w-full" />)}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-right p-3 font-medium text-gray-600">العضو</th>
                    <th className="text-right p-3 font-medium text-gray-600">الدور</th>
                    <th className="text-right p-3 font-medium text-gray-600">الرصيد</th>
                    <th className="text-right p-3 font-medium text-gray-600">المستوى</th>
                    <th className="text-right p-3 font-medium text-gray-600">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCreditUsers.length === 0 ? (
                    <tr><td colSpan={5} className="p-6 text-center text-gray-400">لا توجد نتائج للبحث</td></tr>
                  ) : filteredCreditUsers.map(u => (
                    <tr key={u.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: u.level.color }} />
                          <span className="font-medium text-gray-900">{u.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-gray-500">{u.role_name}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${u.credit_score * 10}%`, backgroundColor: u.level.color }} />
                          </div>
                          <span className="text-sm font-bold" style={{ color: u.level.color }}>{u.credit_score}/10</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: u.level.color + '20', color: u.level.color }}>
                          {levelIcons[u.level.name]} {u.level.name_ar}
                        </span>
                      </td>
                      <td className="p-3">
                        {u.frozen_at ? (
                          <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">مجمد</span>
                        ) : (
                          <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">نشط</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
