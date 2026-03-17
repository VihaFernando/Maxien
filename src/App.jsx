import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import DashboardHome from './pages/DashboardHome'
import Profile from './pages/Profile'
import Tasks from './pages/Tasks'
import Projects from './pages/Projects'
import TaskTypes from './pages/TaskTypes'
import Workplaces from './pages/Workplaces'
import WorkplaceDetail from './pages/WorkplaceDetail'
import Calendar from './pages/Calendar'
import AIAssistant from './pages/AIAssistant'
import GithubCallback from './pages/GithubCallback'
import FloatingAIChat from './components/FloatingAIChat'
import GlobalCommandPalette from './components/GlobalCommandPalette'
import './App.css'

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/dashboard" element={<Dashboard />}>
            <Route index element={<DashboardHome />} />
            <Route path="tasks" element={<Tasks />} />
            <Route path="projects" element={<Projects />} />
            <Route path="calendar" element={<Calendar />} />
            <Route path="ai-assistant" element={<AIAssistant />} />
            <Route path="task-types" element={<TaskTypes />} />
            <Route path="workplaces" element={<Workplaces />} />
            <Route path="workplaces/:id" element={<WorkplaceDetail />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="/auth/github/callback" element={<GithubCallback />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <GlobalCommandPalette />
        <FloatingAIChat />
      </AuthProvider>
    </Router>
  )
}

export default App
