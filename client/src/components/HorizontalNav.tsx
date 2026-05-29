import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderKanban, Users, Shield, AlertTriangle,
  Settings, UserCircle
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'

const navItems: { path: string; label: string; icon: any; adminOnly?: boolean }[] = [
  { path: '/projects', label: 'مساحة العمل', icon: FolderKanban },
  { path: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard },
  { path: '/warnings', label: 'الإنذارات', icon: AlertTriangle, adminOnly: true },
  { path: '/users', label: 'المستخدمين', icon: Users, adminOnly: true },
  { path: '/roles', label: 'الأدوار', icon: Shield, adminOnly: true },
  { path: '/profile', label: 'الملف', icon: UserCircle },
]

export { navItems }

export default function HorizontalNav() {
  const user = useAuthStore(s => s.user)
  const navigate = useNavigate()
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/projects') return location.pathname === '/projects' || location.pathname.startsWith('/projects/')
    return location.pathname === path
  }

  return (
    <nav className="hidden md:flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
      {navItems.filter(i => !i.adminOnly || user?.is_manager).map(item => {
        const active = isActive(item.path)
        return (
          <button key={item.path} onClick={() => navigate(item.path)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-none cursor-pointer whitespace-nowrap transition-all shrink-0"
            style={{
              background: active ? '#4A90D9' : 'rgba(255,255,255,0.06)',
              color: active ? '#fff' : 'rgba(255,255,255,0.65)',
            }}>
            <item.icon className="w-3.5 h-3.5" />
            <span>{item.label}</span>
          </button>
        )
      })}
      {user?.is_manager && (
        <button onClick={() => navigate('/warnings/manage')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-none cursor-pointer whitespace-nowrap transition-all shrink-0"
          style={{
            background: isActive('/warnings/manage') ? '#4A90D9' : 'rgba(255,255,255,0.06)',
            color: isActive('/warnings/manage') ? '#fff' : 'rgba(255,255,255,0.65)',
          }}>
          <Settings className="w-3.5 h-3.5" />
          <span>الرصيد</span>
        </button>
      )}
    </nav>
  )
}
