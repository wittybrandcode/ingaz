import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import { Save, Bell, Camera, Loader2 } from 'lucide-react'

import type { Notification } from '../types'

export default function Profile() {
  const { user, loadUser } = useAuthStore()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState('')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loadingMark, setLoadingMark] = useState<number | null>(null)
  const [loadingMarkAll, setLoadingMarkAll] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { api.get<Notification[]>('/notifications').then(r => setNotifications(r.data)).catch((e) => { console.error('Failed to load notifications', e) }) }, [])
  useEffect(() => { if (user) setName(user.name) }, [user])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('avatar', file)
      await api.post('/auth/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      loadUser()
    } finally { setUploading(false) }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    if (password && password !== confirmPassword) {
      setMessage('كلمة المرور غير متطابقة')
      return
    }
    const body = { name } as { name: string; password?: string }
    if (password) body.password = password
    setSaving(true)
    try { await api.put('/auth/profile', body); setMessage('تم تحديث الملف الشخصي'); setPassword(''); setConfirmPassword(''); loadUser() } catch { setMessage('فشل التحديث') } finally { setSaving(false) }
  }

  const markAllRead = async () => {
    setLoadingMarkAll(true)
    try { await api.put('/notifications/read-all'); setNotifications(prev => prev.map(n => ({ ...n, read: 1 }))) } catch (e) { console.error('markAllRead failed', e) } finally { setLoadingMarkAll(false) }
  }

  const markRead = async (id: number) => {
    setLoadingMark(id)
    try { await api.put('/notifications/' + id + '/read'); setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: 1 } : n)) } catch (e) { console.error('markNotificationRead failed', e) } finally { setLoadingMark(null) }
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'الآن'
    if (mins < 60) return `منذ ${mins} د`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `منذ ${hours} س`
    return `منذ ${Math.floor(hours / 24)} ي`
  }

  if (!user) return null

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900">الملف الشخصي</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-5 mb-6">
          <div className="relative group">
            <div className="w-20 h-20 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-2xl overflow-hidden ring-2 ring-indigo-200">
              {user.avatar ? (
                <img src={`/uploads/${user.avatar}`} alt="" className="w-full h-full object-cover" />
              ) : (
                user.name.charAt(0)
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="absolute -bottom-1 -start-1 w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 transition-colors shadow-md disabled:opacity-50">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{user.name}</h2>
            <p className="text-sm text-gray-500">{user.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700">{user.role_name}</span>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الاسم</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">كلمة المرور الجديدة</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="اتركها فارغة إن لم ترد التغيير"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">تأكيد كلمة المرور</label>
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          {message && <p className="text-sm text-green-600">{message}</p>}
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} حفظ التغييرات
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Bell className="w-5 h-5" /> الإشعارات
          </h2>
          <button onClick={markAllRead} disabled={loadingMarkAll}
            className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50">{loadingMarkAll ? 'جاري...' : 'تحديد الكل كمقروء'}</button>
        </div>
        {notifications.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-6">لا توجد إشعارات</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {notifications.map(n => (
              <div key={n.id} onClick={() => !n.read && loadingMark !== n.id && markRead(n.id)}
                className={`p-3 rounded-lg text-sm cursor-pointer transition-colors ${n.read ? 'bg-white hover:bg-gray-50' : 'bg-indigo-50 hover:bg-indigo-100'}`}>
                <div className="flex items-center justify-between">
                  <p className={`${n.read ? 'text-gray-700' : 'text-gray-900 font-medium'}`}>{n.title}</p>
                  {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />}
                </div>
                {n.message && <p className="text-gray-500 text-xs mt-1">{n.message}</p>}
                <p className="text-gray-400 text-xs mt-1 flex items-center gap-1">{timeAgo(n.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
