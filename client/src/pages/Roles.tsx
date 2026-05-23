import { useEffect, useState } from 'react'
import api from '../lib/api'
import { Plus, Trash2, Save, X, Shield, Edit3, Check, ChevronUp, ChevronDown, Loader2, Pin } from 'lucide-react'
import { useAppStore } from '../store/appStore'
import { ASSIGN_REQUIRED_PERMS } from '../constants'

import type { Role, Permission } from '../types'
type GroupedPermissions = Record<string, Permission[]>

export default function Roles() {
  const roles = useAppStore(s => s.roles)
  const rolesLoading = useAppStore(s => s.rolesLoading)
  const loadRoles = useAppStore(s => s.loadRoles)
  const [permsGrouped, setPermsGrouped] = useState<GroupedPermissions>({})
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingName, setEditingName] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [managingPerms, setManagingPerms] = useState<Role | null>(null)
  const [selectedPerms, setSelectedPerms] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [savingName, setSavingName] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null)

  const loadPerms = async () => {
    try {
      const { data } = await api.get<GroupedPermissions>('/roles/permissions/list')
      setPermsGrouped(data)
    } catch (e) { console.error('Failed to load permissions', e) }
  }

  useEffect(() => { loadRoles(); loadPerms() }, [])

  const createRole = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try { await api.post('/roles', { name: newName.trim() }); setNewName(''); setShowCreate(false); loadRoles() } catch (e) { console.error('createRole failed', e) } finally { setCreating(false) }
  }

  const updateName = async (id: number) => {
    if (!editName.trim()) return
    setSavingName(id)
    try { await api.put(`/roles/${id}`, { name: editName.trim() }); setEditingName(null); loadRoles() } catch (e) { console.error('updateRole failed', e) } finally { setSavingName(null) }
  }

  const deleteRole = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا الدور؟')) return
    setDeleting(id)
    try { await api.delete(`/roles/${id}`); loadRoles() } catch (e) { console.error('deleteRole failed', e) } finally { setDeleting(null) }
  }

  const openPermManager = async (role: Role) => {
    setManagingPerms(role)
    setSelectedPerms([...(role.permissions || [])])
    setExpandedGroup(Object.keys(permsGrouped)[0] || null)
  }

  const togglePerm = (key: string) => {
    setSelectedPerms(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  const savePerms = async () => {
    if (!managingPerms) return
    setSaving(true)
    try {
      await api.put(`/roles/${managingPerms.id}/permissions`, { permissions: selectedPerms })
      loadRoles()
      setManagingPerms(null)
    } finally { setSaving(false) }
  }

  const defaultRoles: number[] = []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">الأدوار والصلاحيات</h1>
        <button onClick={() => setShowCreate(true)} title="دور جديد"
          className="p-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {showCreate && (
        <form onSubmit={createRole} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="اسم الدور"
            className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" autoFocus required />
          <div className="flex gap-2">
            <button type="submit" disabled={creating} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">{creating ? 'جاري...' : 'إنشاء'}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200">إلغاء</button>
          </div>
        </form>
      )}

      {rolesLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      ) : (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {roles.map(role => (
          <div key={role.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    {editingName === role.id ? (
                      <div className="flex gap-2">
                        <input value={editName} onChange={e => setEditName(e.target.value)}
                          className="px-2 py-1 border border-gray-300 rounded text-sm w-28" autoFocus />
                        <button onClick={() => updateName(role.id)} disabled={savingName === role.id} className="text-green-600 hover:text-green-800 disabled:opacity-30">{savingName === role.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}</button>
                        <button onClick={() => setEditingName(null)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-semibold text-gray-900">{role.name}</h3>
                        <p className="text-xs text-gray-400">{(role.permissions || []).length} صلاحية</p>
                        {(() => {
                          const perms = role.permissions || []
                          const ok = ASSIGN_REQUIRED_PERMS.every(p => perms.includes(p))
                          return ok ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-50 text-green-700 border border-green-200 mt-1">
                              <Check className="w-3 h-3" /> مؤهل للتكليف
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-50 text-gray-400 border border-gray-200 mt-1">
                              غير مؤهل للتكليف
                            </span>
                          )
                        })()}
                      </>
                    )}
                  </div>
                </div>
                {!defaultRoles.includes(role.id as 1) && editingName !== role.id && (
                  <div className="flex gap-1">
                    <button onClick={() => { setEditingName(role.id); setEditName(role.name) }} className="p-1.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteRole(role.id)} disabled={deleting === role.id} className="p-1.5 hover:bg-gray-100 rounded text-red-400 hover:text-red-600 disabled:opacity-30">
                      {deleting === role.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="p-3">
              <button onClick={() => openPermManager(role)} title="إدارة الصلاحيات"
                className="p-2 rounded-full bg-gray-50 text-gray-700 hover:bg-gray-100">
                <Shield className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      )}

      {managingPerms !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setManagingPerms(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                  <Shield className="w-4 h-4 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="font-bold text-gray-900 text-lg truncate">{managingPerms.name}</h2>
                  <p className="text-xs text-gray-500">{selectedPerms.length} صلاحية محددة من أصل {Object.values(permsGrouped).flat().length}</p>
                  {(() => {
                    const assignCount = ASSIGN_REQUIRED_PERMS.filter(p => selectedPerms.includes(p)).length
                    const qualified = assignCount === ASSIGN_REQUIRED_PERMS.length
                    return (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className={qualified ? 'text-green-600 font-medium' : 'text-gray-500'}>
                            {qualified ? '✅ مؤهل للتكليف' : `صلاحيات التكليف: ${assignCount}/${ASSIGN_REQUIRED_PERMS.length}`}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${qualified ? 'bg-green-500' : 'bg-indigo-500'}`}
                            style={{ width: `${(assignCount / ASSIGN_REQUIRED_PERMS.length) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })()}
                </div>
              </div>
              <button onClick={() => setManagingPerms(null)} className="p-1 hover:bg-gray-100 rounded-full shrink-0">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4" style={{ maxHeight: 'calc(85vh - 140px)' }}>
              {Object.entries(permsGrouped).map(([group, perms]) => (
                <div key={group} className="border border-gray-200 rounded-xl overflow-hidden">
                  <button onClick={() => setExpandedGroup(expandedGroup === group ? null : group)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
                    <span className="font-medium text-sm text-gray-900">{group}</span>
                    {expandedGroup === group ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </button>
                  {expandedGroup === group && (
                    <div className="p-4 space-y-2">
                      {perms.map(p => (
                        <label key={p.id} className="flex items-center gap-3 cursor-pointer py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors">
                          <input type="checkbox" checked={selectedPerms.includes(p.key)}
                            onChange={() => togglePerm(p.key)}
                            className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-sm text-gray-700">{p.name}</span>
                          {ASSIGN_REQUIRED_PERMS.includes(p.key) && <Pin className="w-3 h-3 text-amber-500 shrink-0" />}
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
              <button onClick={savePerms} disabled={saving} title="حفظ الصلاحيات"
                className="p-2.5 rounded-full bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                <Save className="w-4 h-4" />
              </button>
              <button onClick={() => setManagingPerms(null)} title="إلغاء"
                className="p-2.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
