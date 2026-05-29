import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Settings, LogOut, UserCircle, Menu, X, Wifi, WifiOff
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useMemberStore } from '../store/memberStore'
import { useFocusTrap } from '../lib/useFocusTrap'
import socket from '../lib/socket'
import NotificationBell from './NotificationBell'
import Avatar from './Avatar'
import HorizontalNav, { navItems } from './HorizontalNav'

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

  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isOnline, setIsOnline] = useState(user ? useMemberStore.getState().onlineUsers.has(user.id) : false)

  useEffect(() => {
    return useMemberStore.subscribe((s) => {
      if (user) setIsOnline(s.onlineUsers.has(user.id))
    })
  }, [user])
  const dropdownRef = useRef<HTMLDivElement>(null)

  const toggleOnline = (e: React.MouseEvent) => {
    e.stopPropagation()
    const newStatus = !isOnline
    socket.emit('user:status', newStatus)
    useMemberStore.getState().setOnline(user!.id, newStatus)
    setDropdownOpen(false)
  }

  useEffect(() => {
    if (!dropdownOpen) return
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [dropdownOpen])

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
        <HorizontalNav />
      </div>

      <div className="flex items-center gap-3 shrink-0">
        <NotificationBell />
        <div ref={dropdownRef} className="relative">
          <button onClick={() => setDropdownOpen(p => !p)}
            className="flex items-center gap-2 cursor-pointer border-none bg-transparent">
            <Avatar name={user?.name || 'U'} avatar={user?.avatar} size="sm" />
            <span className="text-xs text-white/70 hidden md:inline">{user?.name}</span>
          </button>
          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 animate-fade-in">
              <div className="px-4 py-2 border-b border-gray-100 mb-1">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-400 truncate">{user?.email}</p>
              </div>
              <button onClick={() => { navigate('/dashboard'); setDropdownOpen(false) }}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-none bg-transparent cursor-pointer text-right">
                <LayoutDashboard className="w-4 h-4 text-gray-400" />
                لوحة التحكم
              </button>
              <button onClick={() => { navigate('/profile'); setDropdownOpen(false) }}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 border-none bg-transparent cursor-pointer text-right">
                <UserCircle className="w-4 h-4 text-gray-400" />
                الملف الشخصي
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button onClick={toggleOnline}
                className="flex items-center gap-3 w-full px-4 py-2 text-sm border-none bg-transparent cursor-pointer text-right">
                {isOnline ? (
                  <Wifi className="w-4 h-4 text-green-500" />
                ) : (
                  <WifiOff className="w-4 h-4 text-red-400" />
                )}
                <span className={isOnline ? 'text-green-600' : 'text-red-500'}>
                  {isOnline ? 'متصل' : 'غير متصل'}
                </span>
              </button>
            </div>
          )}
        </div>
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
          {navItems.filter(i => !i.adminOnly || user?.is_manager).map(item => {
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
              {user?.is_manager && (
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
