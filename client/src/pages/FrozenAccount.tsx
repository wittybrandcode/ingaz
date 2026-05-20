import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import { Snowflake, Clock, AlertTriangle, Loader2, User, Mail, Calendar, LogOut } from 'lucide-react'
import type { FreezeStatus, Warning } from '../types'

export default function FrozenAccount() {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const navigate = useNavigate()
  const [warnings, setWarnings] = useState<Warning[]>([])
  const [freezeReason, setFreezeReason] = useState('')
  const [frozenAt, setFrozenAt] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<FreezeStatus>('/warnings/freeze/status').then(r => {
      if (r.data.frozen) {
        setWarnings(r.data.warnings || [])
        setFreezeReason(r.data.freeze_reason || '')
        setFrozenAt(r.data.frozen_at || '')
      }
    }).catch((e) => { console.error('Failed to load frozen account', e) }).finally(() => setLoading(false))
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-white flex items-center justify-center p-4">
      <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-2xl animate-fade-in">
        <div className="bg-white rounded-2xl shadow-xl border border-red-100 overflow-hidden">
          <div className="bg-gradient-to-l from-red-500 to-red-600 p-6 text-white text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
              <Snowflake className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold">حسابك مجمد ❄️</h1>
            <p className="text-white/80 mt-1 text-sm">تم تجميد حسابك بسبب تجاوز الحد المسموح من الإنذارات</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-red-800 text-sm">سبب التجميد</p>
                  <p className="text-red-700 text-sm mt-1">{freezeReason || 'لم يتم تحديد سبب'}</p>
                </div>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">الاسم</p>
                  <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">البريد</p>
                  <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                </div>
              </div>
              {frozenAt && (
                <div className="bg-gray-50 rounded-xl p-4 flex items-center gap-3 sm:col-span-2">
                  <Calendar className="w-5 h-5 text-gray-400" />
                  <div>
                    <p className="text-xs text-gray-500">تاريخ التجميد</p>
                    <p className="text-sm font-medium text-gray-900">{new Date(frozenAt).toLocaleDateString('ar-SA-u-nu-latn')}</p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h2 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                الإنذارات المسجلة ({warnings.length})
              </h2>
              <div className="space-y-2">
                {warnings.map((w, i) => (
                  <div key={w.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-red-100 text-red-600 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                        <span className="font-medium text-sm text-gray-900">إنذار #{w.id}</span>
                      </div>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(w.created_at).toLocaleDateString('ar-SA-u-nu-latn')}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-2 pr-8">{w.reason}</p>
                    <p className="text-xs text-gray-400 mt-1 pr-8">بواسطة: {w.issued_by_name}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
              <p className="text-sm text-amber-800 font-medium mb-1">تواصل مع المدير</p>
              <p className="text-sm text-amber-700">يرجى التواصل مع المدير العام لفك تجميد حسابك واستئناف العمل.</p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
            <button onClick={handleLogout}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-sm font-medium transition-colors flex items-center justify-center gap-2">
              <LogOut className="w-4 h-4" /> تسجيل الخروج
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
