import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider } from './context/AuthContext'
import { AppThemeProvider } from './context/AppThemeContext'
import './App.css'

const Login = lazy(() => import('./pages/Login'))
const Signup = lazy(() => import('./pages/Signup'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const DashboardHome = lazy(() => import('./pages/DashboardHome'))
const Profile = lazy(() => import('./pages/Profile'))
const Subscriptions = lazy(() => import('./pages/Subscriptions'))
const Tasks = lazy(() => import('./pages/Tasks'))
const Projects = lazy(() => import('./pages/Projects'))
const TaskTypes = lazy(() => import('./pages/TaskTypes'))
const Notes = lazy(() => import('./pages/Notes'))
const Workouts = lazy(() => import('./pages/Workouts'))
const Workplaces = lazy(() => import('./pages/Workplaces'))
const WorkplaceDetail = lazy(() => import('./pages/WorkplaceDetail'))
const Calendar = lazy(() => import('./pages/Calendar'))
const AIAssistant = lazy(() => import('./pages/AIAssistant'))
const Finance = lazy(() => import('./pages/Finance'))
const GithubCallback = lazy(() => import('./pages/GithubCallback'))
const Github = lazy(() => import('./pages/Github'))
const FloatingAIChat = lazy(() => import('./components/FloatingAIChat'))
const GlobalCommandPalette = lazy(() => import('./components/GlobalCommandPalette'))
const PWAUpdatePrompt = lazy(() => import('./components/PWAUpdatePrompt'))
const PWAEngagementNotifications = lazy(() => import('./components/PWAEngagementNotifications'))

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppThemeProvider>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/dashboard" element={<Dashboard />}>
                <Route index element={<DashboardHome />} />
                <Route path="tasks" element={<Tasks />} />
                <Route path="projects" element={<Projects />} />
                <Route path="subscriptions" element={<Subscriptions />} />
                <Route path="calendar" element={<Calendar />} />
                <Route path="ai-assistant" element={<AIAssistant />} />
                <Route path="task-types" element={<TaskTypes />} />
                <Route path="notes" element={<Notes />} />
                <Route path="workouts" element={<Workouts />} />
                <Route path="finance" element={<Finance />} />
                <Route path="workplaces" element={<Workplaces />} />
                <Route path="workplaces/:id" element={<WorkplaceDetail />} />
                <Route path="profile" element={<Profile />} />
                <Route path="github" element={<Github />} />
              </Route>
              <Route path="/auth/github/callback" element={<GithubCallback />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
            <GlobalCommandPalette />
            <PWAUpdatePrompt />
            <PWAEngagementNotifications />
            <FloatingAIChat />
          </Suspense>
        </AppThemeProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
