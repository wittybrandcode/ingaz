import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

import { useEffect, lazy, Suspense } from 'react'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './components/Toast'
import { useSocketAuth } from './hooks/useSocketAuth'

const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Users = lazy(() => import('./pages/Users'))
const Roles = lazy(() => import('./pages/Roles'))
const WarningsAdmin = lazy(() => import('./pages/WarningsAdmin'))
const WarningManagement = lazy(() => import('./pages/WarningManagement'))
const FrozenAccount = lazy(() => import('./pages/FrozenAccount'))
const Profile = lazy(() => import('./pages/Profile'))
const SubtaskPage = lazy(() => import('./pages/SubtaskPage'))
const NotificationPreferences = lazy(() => import('./pages/NotificationPreferences'))

function LoadingFallback() {
  return <div className="h-screen flex items-center justify-center text-lg text-gray-400">جاري التحميل...</div>
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore()
  if (loading) return <div className="h-screen flex items-center justify-center text-lg">جاري التحميل...</div>
  if (!user) return <Navigate to="/login" replace />
  if (user.frozen_at) return <Navigate to="/frozen" replace />
  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user || !user.is_manager) return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  const { loadUser } = useAuthStore()
  useSocketAuth()

  useEffect(() => { loadUser() }, [])

  return (
    <ToastProvider>
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
        <Route path="/frozen" element={<ErrorBoundary><FrozenAccount /></ErrorBoundary>} />
        <Route path="/" element={<ProtectedRoute><ErrorBoundary><Layout /></ErrorBoundary></ProtectedRoute>}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="dashboard" element={<ErrorBoundary><Dashboard /></ErrorBoundary>} />
          <Route path="projects" element={<ErrorBoundary><Projects /></ErrorBoundary>} />
          <Route path="projects/:id" element={<ErrorBoundary><ProjectDetail /></ErrorBoundary>} />
          <Route path="subtasks/:id" element={<ErrorBoundary><SubtaskPage /></ErrorBoundary>} />
          <Route path="users" element={<AdminRoute><ErrorBoundary><Users /></ErrorBoundary></AdminRoute>} />
          <Route path="roles" element={<AdminRoute><ErrorBoundary><Roles /></ErrorBoundary></AdminRoute>} />
          <Route path="warnings" element={<AdminRoute><ErrorBoundary><WarningsAdmin /></ErrorBoundary></AdminRoute>} />
          <Route path="warnings/manage" element={<AdminRoute><ErrorBoundary><WarningManagement /></ErrorBoundary></AdminRoute>} />
          <Route path="notifications/preferences" element={<ErrorBoundary><NotificationPreferences /></ErrorBoundary>} />
          <Route path="profile" element={<ErrorBoundary><Profile /></ErrorBoundary>} />
        </Route>
      </Routes>
    </Suspense>
    </ToastProvider>
  )
}
