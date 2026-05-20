import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderKanban, Users, Shield, AlertTriangle,
  Settings, LogOut, UserCircle, Menu, X
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { ROLES } from '../constants'
import { useFocusTrap } from '../lib/useFocusTrap'
import NotificationBell from './NotificationBell'
import Avatar from './Avatar'

const navItems: { path: string; label: string; icon: any; roles: number[] }[] = [
  { path: '/projects', label: 'مساحة العمل', icon: FolderKanban, roles: [ROLES.ADMIN, ROLES.DEPUTY, ROLES.EMPLOYEE] },
  { path: '/dashboard', label: 'لوحة التحكم', icon: LayoutDashboard, roles: [ROLES.ADMIN, ROLES.DEPUTY, ROLES.EMPLOYEE] },
  { path: '/warnings', label: 'الإنذارات', icon: AlertTriangle, roles: [ROLES.ADMIN] },
  { path: '/users', label: 'المستخدمين', icon: Users, roles: [ROLES.ADMIN] },
  { path: '/roles', label: 'الأدوار', icon: Shield, roles: [ROLES.ADMIN] },
  { path: '/profile', label: 'الملف', icon: UserCircle, roles: [ROLES.ADMIN, ROLES.DEPUTY, ROLES.EMPLOYEE] },
]

export default function TopBar() {
  const user = useAuthStore(s => s.user)
  const logout = useAuthStore(s => s.logout)
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const drawerRef = useFocusTrap(menuOpen)

  useEffect(() => {
    if (!menuOpen) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [menuOpen])

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const handleLogout = () => { logout(); navigate('/login') }

  const isActive = (path: string) => {
    if (path === '/projects') return location.pathname === '/projects' || location.pathname.startsWith('/projects/')
    return location.pathname === path
  }

  return (
    <header className="h-14 shrink-0 flex items-center justify-between px-5 gap-4" style={{ background: '#151B28', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center gap-5 min-w-0">
        <button onClick={() => navigate('/projects')} className="flex items-center gap-2 shrink-0 cursor-pointer border-none bg-transparent">
          <img src="/logo-icon.svg" alt="إنجاز" className="h-6" />
          <span className="text-white font-extrabold text-lg hidden sm:inline">إنجـــاز</span>
        </button>
        <nav className="hidden md:flex gap-1 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {navItems.filter(i => i.roles.includes(user?.role_id || ROLES.EMPLOYEE)).map(item => {
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
          {user?.role_id === ROLES.ADMIN && (
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
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <NotificationBell />
        <button onClick={() => navigate('/profile')} className="flex items-center gap-2 cursor-pointer border-none bg-transparent">
          <Avatar name={user?.name || 'U'} avatar={user?.avatar} size="sm" />
          <span className="text-xs text-white/70 hidden md:inline">{user?.name}</span>
        </button>
        <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent" title="تسجيل الخروج" aria-label="تسجيل الخروج">
          <LogOut className="w-4 h-4 text-white/50" />
        </button>
        <button onClick={() => setMenuOpen(true)}
          className="md:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent"
          aria-label="فتح القائمة" aria-expanded={menuOpen}>
          <Menu className="w-5 h-5 text-white/70" />
        </button>
      </div>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMenuOpen(false)}>
          <div className="absolute inset-0 bg-black/50 animate-fade-in" />
          <div ref={drawerRef}
            className="absolute top-0 bottom-0 right-0 w-72 bg-white shadow-2xl overflow-y-auto animate-slide-in-left"
            onClick={e => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-label="قائمة التنقل">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-bold text-gray-900">إنجـــاز</span>
              <button onClick={() => setMenuOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full cursor-pointer border-none bg-transparent"
                aria-label="إغلاق القائمة">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-3 space-y-1">
          {navItems.filter(i => i.roles.includes((user?.role_id || ROLES.EMPLOYEE) as number)).map(item => {
                const active = isActive(item.path)
                return (
                  <button key={item.path} onClick={() => { navigate(item.path); setMenuOpen(false) }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-bold border-none cursor-pointer text-right transition-all"
                    style={{
                      background: active ? '#EEF2FF' : 'transparent',
                      color: active ? '#4A90D9' : '#374151',
                    }}>
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
              {user?.role_id === ROLES.ADMIN && (
                <button onClick={() => { navigate('/warnings/manage'); setMenuOpen(false) }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-bold border-none cursor-pointer text-right transition-all"
                  style={{
                    background: isActive('/warnings/manage') ? '#EEF2FF' : 'transparent',
                    color: isActive('/warnings/manage') ? '#4A90D9' : '#374151',
                  }}>
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>الرصيد</span>
                </button>
              )}
            </div>
            <div className="border-t border-gray-100 p-3">
              <div className="flex items-center gap-2 px-3 py-2">
                <Avatar name={user?.name || 'U'} avatar={user?.avatar} size="sm" />
                <span className="text-sm text-gray-700">{user?.name}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
