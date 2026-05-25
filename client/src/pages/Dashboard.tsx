import { useEffect, useState } from 'react'
import { useAuthStore } from '../store/authStore'
import api from '../lib/api'
import { Link } from 'react-router-dom'
import Avatar from '../components/Avatar'
import MemberList from '../components/MemberList'
import {
  FolderKanban, ListTodo, Users, TrendingUp, Loader2, FileSpreadsheet,
  AlertTriangle, Activity, Shield
} from 'lucide-react'
import type { DashboardData } from '../types'
import { exportToCSV } from '../lib/exportToCSV'
import { SUBTASK_STATUS_CONFIG } from '../statusConfig'

interface MemberActiveTask {
  id: number; title: string
  project_id: number; project_title: string
  status: string; deadline: string | null
}

interface MemberActivity {
  id: number; action: string; details: string; created_at: string
}

function MemberDashboard() {
  const user = useAuthStore(s => s.user)
  const [tasks, setTasks] = useState<MemberActiveTask[]>([])
  const [activity, setActivity] = useState<MemberActivity[]>([])
  const [credit, setCredit] = useState<{ credit_score: number; level: { name_ar: string; color: string } } | null>(null)
  const [warnings, setWarnings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadData = async () => {
    if (!user) return
    setLoading(true); setError('')
    try {
      const [tasksRes, activityRes, creditRes, warningsRes] = await Promise.all([
        api.get(`/members/${user.id}/tasks`).catch(() => ({ data: [] })),
        api.get(`/members/${user.id}/activity`).catch(() => ({ data: [] })),
        api.get('/warnings/my-level').catch(() => ({ data: null })),
        api.get('/warnings/my').catch(() => ({ data: [] })),
      ])
      setTasks(tasksRes.data || [])
      setActivity(activityRes.data || [])
      setCredit(creditRes.data)
      setWarnings(warningsRes.data || [])
    } catch { setError('فشل تحميل البيانات') }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  if (loading) return <div className="text-center py-12 text-gray-500"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />جاري تحميل البيانات...</div>
  if (error) return <div className="text-center py-12"><p className="text-red-500 mb-3">{error}</p><button onClick={loadData} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">إعادة المحاولة</button></div>

  const activeTasksCount = tasks.filter(t => !['approved', 'cancelled'].includes(t.status)).length
  const pendingWarnings = warnings.filter((w: any) => w.status === 'pending').length

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مرحباً، {user?.name}</h1>
          <p className="text-sm text-gray-500 mt-1">نظرة سريعة على مهامك ونشاطاتك</p>
        </div>
        <Avatar name={user?.name || ''} avatar={user?.avatar} size="md" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">المهام النشطة</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{activeTasksCount}</p>
            </div>
            <div className="bg-indigo-500 p-3 rounded-lg"><ListTodo className="w-5 h-5 text-white" /></div>
          </div>
        </div>
        <Link to="/projects" className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">الإنذارات</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{pendingWarnings}</p>
            </div>
            <div className="bg-amber-500 p-3 rounded-lg"><AlertTriangle className="w-5 h-5 text-white" /></div>
          </div>
        </Link>
        <Link to="/projects" className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">الرصيد</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{credit?.credit_score ?? '—'}</p>
            </div>
            <div className="bg-emerald-500 p-3 rounded-lg"><Shield className="w-5 h-5 text-white" /></div>
          </div>
        </Link>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">المستوى</p>
              <p className="text-lg font-bold mt-1" style={{ color: credit?.level?.color || '#6b7280' }}>{credit?.level?.name_ar || '—'}</p>
            </div>
            <div className="bg-purple-500 p-3 rounded-lg"><TrendingUp className="w-5 h-5 text-white" /></div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <ListTodo className="w-4 h-4" /> مهامي النشطة
          </h2>
          {tasks.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">لا توجد مهام حالياً</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {tasks.map(t => (
                <Link key={t.id} to={`/projects/${t.project_id}`}
                  className="block p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">{t.title}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${SUBTASK_STATUS_CONFIG[t.status]?.bg || 'bg-gray-100'} ${SUBTASK_STATUS_CONFIG[t.status]?.color || 'text-gray-600'}`}>
                      {SUBTASK_STATUS_CONFIG[t.status]?.label || t.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{t.project_title}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4" /> آخر النشاطات
          </h2>
          {activity.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-6">لا توجد نشاطات بعد</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {activity.slice(0, 10).map(a => (
                <div key={a.id} className="flex items-start gap-2 p-2 rounded-lg bg-gray-50">
                  <Activity className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm text-gray-700">{a.details || a.action}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(a.created_at).toLocaleString('ar-SA-u-nu-latn')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {pendingWarnings > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> إنذاراتي
          </h2>
          <div className="space-y-2">
            {warnings.filter((w: any) => w.status === 'pending').slice(0, 5).map((w: any) => (
              <div key={w.id} className="flex items-start gap-2 p-2 rounded-lg bg-white">
                <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-gray-700">{w.reason}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(w.created_at).toLocaleDateString('ar-SA-u-nu-latn')} — مهلة: {new Date(w.deadline).toLocaleDateString('ar-SA-u-nu-latn')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Link to="/projects" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 transition-colors">
          مساحة العمل
        </Link>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const user = useAuthStore(s => s.user)
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exporting, setExporting] = useState(false)

  if (!user) return null

  if (!user.is_manager) return <MemberDashboard />

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

      <div className="grid lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <MemberList />
        </div>
        <div className="lg:col-span-3 space-y-6">

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">توزيع حالات المهام</h2>
          <div className="space-y-3">
            {data.status_distribution.map(s => (
              <div key={s.status}>
                <div className="flex justify-between text-sm mb-1">
                  <span className={(SUBTASK_STATUS_CONFIG[s.status]?.bg || 'bg-gray-100') + ' ' + (SUBTASK_STATUS_CONFIG[s.status]?.color || 'text-gray-700') + ' px-2 py-0.5 rounded text-xs'}>{SUBTASK_STATUS_CONFIG[s.status]?.label || s.status}</span>
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
      </div>
    </div>
  )
}