import { Outlet, useLocation } from 'react-router-dom'
import {
  AlertTriangle, ArrowUp
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useState, useEffect, useCallback } from 'react'
import api from '../lib/api'
import TopBar from './TopBar'
import { ToastProvider } from './Toast'
import ErrorBoundary from './ErrorBoundary'
import type { RestrictionLevel } from '../types'

export default function Layout() {
  const user = useAuthStore(s => s.user)
  const location = useLocation()
  const [creditLevel, setCreditLevel] = useState<RestrictionLevel | null>(null)
  const [creditScore, setCreditScore] = useState<number | null>(null)
  const isBoard = location.pathname === '/projects'
  const [showScrollTop, setShowScrollTop] = useState(false)

  useEffect(() => {
    if (isBoard) return
    const onScroll = () => setShowScrollTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [isBoard])

  const scrollToTop = useCallback(() => window.scrollTo({ top: 0, behavior: 'smooth' }), [])

  useEffect(() => {
    if (!user) return
    api.get<{ level: RestrictionLevel; credit_score: number }>('/warnings/my-level').then(({ data }) => {
      setCreditLevel(data.level)
      setCreditScore(data.credit_score)
    }).catch((e) => { console.error('Failed to load credit level', e) })
  }, [user])

  return (
    <ToastProvider>
    <div className="h-screen flex flex-col bg-gray-50">
      {!!creditLevel?.show_banner && creditLevel?.name !== 'frozen' && (
        <div className="shrink-0 px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2"
          style={{ backgroundColor: creditLevel.color + '15', color: creditLevel.color, borderBottom: `2px solid ${creditLevel.color}` }}>
          <AlertTriangle className="w-4 h-4" />
          رصيدك {creditScore}/10 — {creditLevel.name_ar}
          {creditLevel.name === 'restricted' && ' — بعض الصلاحيات مقيدة'}
        </div>
      )}

      <TopBar />

      <main className={`flex-1 ${isBoard ? 'overflow-hidden' : 'overflow-auto p-4 md:p-6'}`}>
        <ErrorBoundary><Outlet /></ErrorBoundary>
      </main>

      {showScrollTop && (
        <button onClick={scrollToTop} aria-label="العودة للأعلى"
          className="fixed bottom-6 right-6 w-11 h-11 rounded-full bg-indigo-600 text-white shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center z-50">
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
    </ToastProvider>
  )
}
