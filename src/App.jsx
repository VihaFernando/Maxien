import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { LifeSyncProvider } from './context/LifeSyncContext'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Dashboard from './pages/Dashboard'
import DashboardHome from './pages/DashboardHome'
import Profile from './pages/Profile'
import Subscriptions from './pages/Subscriptions'
import Tasks from './pages/Tasks'
import Projects from './pages/Projects'
import TaskTypes from './pages/TaskTypes'
import Notes from './pages/Notes'
import Workplaces from './pages/Workplaces'
import WorkplaceDetail from './pages/WorkplaceDetail'
import Calendar from './pages/Calendar'
import AIAssistant from './pages/AIAssistant'
import GithubCallback from './pages/GithubCallback'
import Github from './pages/Github'
import LifeSyncOAuthCallback from './pages/lifesync/LifeSyncOAuthCallback'
import LifeSyncSteam from './pages/lifesync/LifeSyncSteam'
import LifeSyncWishlist from './pages/lifesync/LifeSyncWishlist'
import LifeSyncXbox from './pages/lifesync/LifeSyncXbox'
import LifeSyncAnime from './pages/lifesync/LifeSyncAnime'
import LifeSyncManga from './pages/lifesync/LifeSyncManga'
import LifeSyncHentai from './pages/lifesync/LifeSyncHentai'
import { LifeSyncGamesHub, LifeSyncAnimeHub } from './pages/lifesync/LifeSyncCategoryHub'
import FloatingAIChat from './components/FloatingAIChat'
import GlobalCommandPalette from './components/GlobalCommandPalette'
import './App.css'

function App() {
  return (
    <Router>
      <AuthProvider>
        <LifeSyncProvider>
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
            <Route path="workplaces" element={<Workplaces />} />
            <Route path="workplaces/:id" element={<WorkplaceDetail />} />
            <Route path="profile" element={<Profile />} />
            <Route path="github" element={<Github />} />
            <Route path="lifesync/games" element={<LifeSyncGamesHub />} />
            <Route path="lifesync/games/steam" element={<LifeSyncSteam />} />
            <Route path="lifesync/games/wishlist" element={<LifeSyncWishlist />} />
            <Route path="lifesync/games/xbox" element={<LifeSyncXbox />} />
            <Route path="lifesync/anime" element={<LifeSyncAnimeHub />} />
            <Route path="lifesync/anime/anime" element={<LifeSyncAnime />} />
            <Route path="lifesync/anime/manga" element={<LifeSyncManga />} />
            <Route path="lifesync/anime/hentai" element={<LifeSyncHentai />} />
          </Route>
          <Route path="/auth/github/callback" element={<GithubCallback />} />
          <Route path="/auth/lifesync/callback" element={<LifeSyncOAuthCallback />} />
          <Route path="/settings" element={<LifeSyncOAuthCallback />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <GlobalCommandPalette />
        <FloatingAIChat />
        </LifeSyncProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
