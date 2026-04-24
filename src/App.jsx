import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy } from 'react'
import { AuthProvider } from './context/AuthContext'
import { LifeSyncProvider } from './context/LifeSyncContext'
import { AppThemeProvider } from './context/AppThemeContext'
import { LifeSyncMotionRoot } from './components/LifeSyncMotionRoot'
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
const Workplaces = lazy(() => import('./pages/Workplaces'))
const WorkplaceDetail = lazy(() => import('./pages/WorkplaceDetail'))
const Calendar = lazy(() => import('./pages/Calendar'))
const AIAssistant = lazy(() => import('./pages/AIAssistant'))
const LifeSyncAdmin = lazy(() => import('./pages/LifeSyncAdmin'))
const GithubCallback = lazy(() => import('./pages/GithubCallback'))
const Github = lazy(() => import('./pages/Github'))
const LifeSyncOAuthCallback = lazy(() => import('./pages/lifesync/LifeSyncOAuthCallback'))
const LifeSyncSteam = lazy(() => import('./pages/lifesync/LifeSyncSteam'))
const LifeSyncGameRant = lazy(() => import('./pages/lifesync/LifeSyncGameRant'))
const LifeSyncGameDeals = lazy(() => import('./pages/lifesync/LifeSyncGameDeals'))
const LifeSyncGameRantArticle = lazy(() => import('./pages/lifesync/LifeSyncGameRantArticle'))
const LifeSyncGameSearch = lazy(() => import('./pages/lifesync/LifeSyncGameSearch'))
const LifeSyncGameReleases = lazy(() => import('./pages/lifesync/LifeSyncGameReleases'))
const LifeSyncGameCrackStatus = lazy(() => import('./pages/lifesync/LifeSyncGameCrackStatus'))
const LifeSyncWishlist = lazy(() => import('./pages/lifesync/LifeSyncWishlist'))
const LifeSyncXbox = lazy(() => import('./pages/lifesync/LifeSyncXbox'))
const LifeSyncAnime = lazy(() => import('./pages/lifesync/LifeSyncAnime'))
const LifeSyncAnimeCalendar = lazy(() => import('./pages/lifesync/LifeSyncAnimeCalendar'))
const LifeSyncManga = lazy(() => import('./pages/lifesync/LifeSyncManga'))
const LifeSyncHentai = lazy(() => import('./pages/lifesync/LifeSyncHentai'))
const LifeSyncAnimeMediaLayout = lazy(() => import('./pages/lifesync/LifeSyncAnimeMediaLayout'))
const LifeSyncGamesHub = lazy(() =>
  import('./pages/lifesync/LifeSyncCategoryHub').then((module) => ({ default: module.LifeSyncGamesHub })),
)
const LifeSyncAnimeHub = lazy(() =>
  import('./pages/lifesync/LifeSyncCategoryHub').then((module) => ({ default: module.LifeSyncAnimeHub })),
)
const FloatingAIChat = lazy(() => import('./components/FloatingAIChat'))
const GlobalCommandPalette = lazy(() => import('./components/GlobalCommandPalette'))
const PWAUpdatePrompt = lazy(() => import('./components/PWAUpdatePrompt'))
const PWAEngagementNotifications = lazy(() => import('./components/PWAEngagementNotifications'))

const LifeSyncAnimeWatch = lazy(() => import('./pages/lifesync/LifeSyncAnimeWatch'))
const LifeSyncMangaRead = lazy(() => import('./pages/lifesync/LifeSyncMangaRead'))
const LifeSyncMangaLibrary = lazy(() => import('./pages/lifesync/LifeSyncMangaLibrary'))
const LifeSyncAnimeHistory = lazy(() => import('./pages/lifesync/LifeSyncAnimeHistory'))

function App() {
  return (
    <Router>
      <AuthProvider>
        <LifeSyncProvider>
          <AppThemeProvider>
            <LifeSyncMotionRoot>
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
                    <Route path="workplaces" element={<Workplaces />} />
                    <Route path="workplaces/:id" element={<WorkplaceDetail />} />
                    <Route path="profile" element={<Profile />} />
                    <Route path="admin" element={<LifeSyncAdmin />} />
                    <Route path="github" element={<Github />} />
                    <Route path="lifesync/games" element={<LifeSyncGamesHub />} />
                    <Route path="lifesync/games/steam/*" element={<LifeSyncSteam />} />
                    <Route path="lifesync/games/gamerant" element={<LifeSyncGameRant />} />
                    <Route path="lifesync/games/deals" element={<LifeSyncGameDeals />} />
                    <Route path="lifesync/games/gamerant/news/:slug" element={<LifeSyncGameRantArticle />} />
                    <Route path="lifesync/games/search" element={<LifeSyncGameSearch />} />
                    <Route path="lifesync/games/releases" element={<LifeSyncGameReleases />} />
                    <Route path="lifesync/games/crack-status" element={<LifeSyncGameCrackStatus />} />
                    <Route path="lifesync/games/wishlist/*" element={<LifeSyncWishlist />} />
                    <Route path="lifesync/games/xbox/*" element={<LifeSyncXbox />} />
                    <Route path="lifesync/anime" element={<LifeSyncAnimeMediaLayout />}>
                      <Route index element={<LifeSyncAnimeHub />} />
                      <Route path="anime/watch/:malId/:ep" element={<LifeSyncAnimeWatch />} />
                      <Route path="manga/read/:mangaId/:chapterId" element={<LifeSyncMangaRead />} />
                      <Route path="manga/library" element={<LifeSyncMangaLibrary />} />
                      <Route path="anime/history" element={<LifeSyncAnimeHistory />} />
                      <Route path="anime/calendar" element={<LifeSyncAnimeCalendar />} />
                      <Route path="anime/*" element={<LifeSyncAnime />} />
                      <Route path="manga/*" element={<LifeSyncManga />} />
                      <Route path="hentai/*" element={<LifeSyncHentai />} />
                    </Route>
                  </Route>
                  <Route path="/auth/github/callback" element={<GithubCallback />} />
                  <Route path="/auth/lifesync/callback" element={<LifeSyncOAuthCallback />} />
                  <Route path="/settings" element={<LifeSyncOAuthCallback />} />
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                </Routes>
                <GlobalCommandPalette />
                <PWAUpdatePrompt />
                <PWAEngagementNotifications />
                <FloatingAIChat />
              </Suspense>
            </LifeSyncMotionRoot>
          </AppThemeProvider>
        </LifeSyncProvider>
      </AuthProvider>
    </Router>
  )
}

export default App
