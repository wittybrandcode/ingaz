import { useState, useEffect } from 'react'
import { Bell, BellOff, Save, ChevronDown, ChevronUp } from 'lucide-react'
import api from '../lib/api'

import type { NotifType } from '../types'

export default function NotificationPreferences() {
  const [types, setTypes] = useState<NotifType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setLoading(true)
    api.get<NotifType[]>('/notifications/preferences').then(({ data }) => {
      setTypes(data)
    }).catch((e) => { console.error('Failed to load notification prefs', e) }).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>

  const groups = types.reduce((acc, t) => {
    if (!acc[t.type_group]) acc[t.type_group] = []
    acc[t.type_group].push(t)
    return acc
  }, {} as Record<string, NotifType[]>)

  const toggleType = (typeKey: string) => {
    setTypes(prev => prev.map(t =>
      t.type_key === typeKey ? { ...t, enabled: t.enabled ? 0 : 1 } : t
    ))
    setSaved(false)
  }

  const saveAll = async () => {
    setSaving(true)
    try {
      await api.put('/notifications/types/batch', { types: types.map(t => ({ id: t.id, enabled: t.enabled })) })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">إعدادات التنبيهات</h1>
          <p className="text-sm text-gray-500 mt-1">حدد التنبيهات التي تريد استلامها</p>
        </div>
        <button onClick={saveAll} disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors">
          <Save className="w-4 h-4" /> {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
        </button>
      </div>

      {saved && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">
          تم حفظ الإعدادات بنجاح ✓
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(groups).map(([group, items]) => (
          <div key={group} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button onClick={() => setExpandedGroups(prev => ({ ...prev, [group]: !prev[group] }))}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors">
              <span className="font-semibold text-gray-800 text-sm">{group}</span>
              {expandedGroups[group] ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
            </button>
            {expandedGroups[group] !== false && (
              <div className="divide-y divide-gray-100">
                {items.map(t => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{t.name}</span>
                      </div>
                      {t.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
                      )}
                    </div>
                    <button onClick={() => toggleType(t.type_key)}
                      className={`p-2 rounded-lg transition-colors ${t.enabled ? 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                      title={t.enabled ? 'إيقاف' : 'تفعيل'}>
                      {t.enabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
