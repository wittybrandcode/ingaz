import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import {
  FolderKanban, ListTodo, Users, TrendingUp, Loader2, FileSpreadsheet
} from 'lucide-react'
import type { DashboardData } from '../types'
import { exportToCSV } from '../lib/exportToCSV'

const statusColors: Record<string, string> = {
  open: 'bg-gray-100 text-gray-700',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  deferred: 'bg-yellow-100 text-yellow-700',
}

const statusLabels: Record<string, string> = {
  open: 'مفتوحة',
  in_progress: 'قيد التنفيذ',
  completed: 'منفذة',
  cancelled: 'ملغية',
  deferred: 'مؤجلة',
}

export default function Dashboard() {
  const user = useAuthStore(s => s.user)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  const loadData = async () => {
    setLoading(true); setError('')
    try {
      const { data: r } = await api.get<DashboardData>('/analytics/dashboard')
      setData(r)
    } catch { setError('فشل تحميل البيانات') }
    setLoading(false)
  }

  const handleExportCSV = async () => {
    if (!data) return
    setExporting(true)
    try {
      const rows: string[][] = [['النوع', 'القيمة', 'التفاصيل']]
      rows.push(['المشاريع', String(data.counts.projects), ''])
      rows.push(['المهام', String(data.counts.tasks), ''])
      rows.push(['المهام الفرعية', String(data.counts.subtasks), ''])
      rows.push(['المستخدمين', String(data.counts.users), ''])
      rows.push([], ['توزيع الحالات', '', ''])
      for (const s of data.status_distribution) {
        rows.push(['', s.status, String(s.count)])
      }
      rows.push([], ['تقدم المشاريع', '', ''])
      for (const p of data.project_progress) {
        const pct = p.total_subtasks > 0 ? Math.round((p.completed_subtasks / p.total_subtasks) * 100) : 0
        rows.push(['', p.title, `${p.completed_subtasks}/${p.total_subtasks} (${pct}%)`])
      }
      rows.push([], ['أداء المستخدمين', '', ''])
      for (const u of data.tasks_by_user) {
        const pct = u.total > 0 ? Math.round((u.completed / u.total) * 100) : 0
        rows.push(['', u.name, `${u.completed}/${u.total} (${pct}%)`])
      }
      rows.push([], ['آخر النشاطات', '', ''])
      for (const a of data.recent_activity) {
        rows.push(['', a.user_name, `${a.action} — ${new Date(a.created_at).toLocaleDateString('ar-SA-u-nu-latn')}`])
      }
      exportToCSV(rows, 'تقرير_لوحة_التحكم.csv')
    } finally { setExporting(false) }
  }

  useEffect(() => { loadData() }, [])

  if (loading) return <div className="text-center py-12 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />جاري تحميل البيانات...</div>
  if (error || !data) return <div className="text-center py-12"><p className="text-red-500 mb-3">{error || 'لا توجد بيانات'}</p><button onClick={loadData} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">إعادة المحاولة</button></div>

  const maxStatus = Math.max(...data.status_distribution.map(s => s.count), 1)

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">لوحة التحكم</h1>
        <div className="flex items-center gap-2">
          <Avatar name={user?.name || ''} avatar={user?.avatar} size="sm" />
          <p className="text-sm text-gray-500">مرحباً، {user?.name}</p>
          <button onClick={handleExportCSV} disabled={exporting}
            className="mr-3 px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            {exporting ? 'جاري التصدير...' : 'CSV'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'المشاريع', value: data.counts.projects, icon: FolderKanban, color: 'bg-blue-500', link: '/projects' },
          { label: 'المهام', value: data.counts.tasks, icon: ListTodo, color: 'bg-indigo-500', link: '/projects' },
          { label: 'المهام الفرعية', value: data.counts.subtasks, icon: TrendingUp, color: 'bg-purple-500', link: '/projects' },
          { label: 'المستخدمين', value: data.counts.users, icon: Users, color: 'bg-emerald-500', link: '/users' },
        ].map(item => (
          <Link key={item.label} to={item.link}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{item.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{item.value}</p>
              </div>
              <div className={`${item.color} p-3 rounded-lg`}>
                <item.icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">توزيع حالات المهام</h2>
          <div className="space-y-3">
            {data.status_distribution.map(s => (
              <div key={s.status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className={statusColors[s.status] + ' px-2 py-0.5 rounded text-xs'}>{statusLabels[s.status]}</span>
                  <span className="text-gray-600 font-medium">{s.count}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className={`h-2 rounded-full ${s.status === 'completed' ? 'bg-green-500' : s.status === 'cancelled' ? 'bg-red-500' : s.status === 'in_progress' ? 'bg-blue-500' : s.status === 'deferred' ? 'bg-yellow-500' : 'bg-gray-400'}`}
                    style={{ width: `${(s.count / maxStatus) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">تقدم المشاريع</h2>
          <div className="space-y-4">
            {data.project_progress.map(p => {
              const pct = p.total_subtasks > 0 ? Math.round((p.completed_subtasks / p.total_subtasks) * 100) : 0
              return (
                <Link key={p.id} to={`/projects/${p.id}`} className="block">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{p.title}</span>
                    <span className="text-gray-500">{p.completed_subtasks}/{p.total_subtasks}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className="h-2.5 rounded-full bg-gradient-to-l from-indigo-500 to-purple-500 transition-all"
                      style={{ width: `${pct}%` }} />
                  </div>
                </Link>
              )
            })}
            {data.project_progress.length === 0 && <p className="text-gray-400 text-sm">لا توجد مشاريع بعد</p>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">أداء المستخدمين</h2>
          <div className="space-y-3">
            {data.tasks_by_user.map(u => (
              <div key={u.id} className="flex items-center gap-3">
                <Avatar name={u.name} avatar={u.avatar} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{u.name}</p>
                  <p className="text-xs text-gray-400">{u.completed}/{u.total} مكتملة</p>
                </div>
                <div className="text-sm font-medium text-gray-700">
                  {u.total > 0 ? Math.round((u.completed / u.total) * 100) : 0}%
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">آخر النشاطات</h2>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.recent_activity.map(a => (
              <div key={a.id} className="flex items-start gap-3 text-sm">
                <div className="flex items-center gap-2">
                  <Avatar name={a.user_name} avatar={a.user_avatar} size="sm" />
                  <div>
                    <p><span className="font-medium text-gray-700">{a.user_name}</span> <span className="text-gray-500">{a.action}</span></p>
                    <p className="text-xs text-gray-400">{new Date(a.created_at).toLocaleString('ar-SA-u-nu-latn')}</p>
                  </div>
                </div>
              </div>
            ))}
            {data.recent_activity.length === 0 && <p className="text-gray-400 text-sm">لا توجد نشاطات بعد</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
