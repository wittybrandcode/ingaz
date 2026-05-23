import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'

import { useEffect, lazy, Suspense } from 'react'
import Layout from './components/Layout'
import ErrorBoundary from './components/ErrorBoundary'

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

  useEffect(() => { loadUser() }, [])

  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        <Route path="/login" element={<ErrorBoundary><Login /></ErrorBoundary>} />
        <Route path="/frozen" element={<ErrorBoundary><FrozenAccount /></ErrorBoundary>} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Navigate to="/projects" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="subtasks/:id" element={<SubtaskPage />} />
          <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
          <Route path="roles" element={<AdminRoute><Roles /></AdminRoute>} />
          <Route path="warnings" element={<AdminRoute><WarningsAdmin /></AdminRoute>} />
          <Route path="warnings/manage" element={<AdminRoute><WarningManagement /></AdminRoute>} />
          <Route path="notifications/preferences" element={<NotificationPreferences />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
