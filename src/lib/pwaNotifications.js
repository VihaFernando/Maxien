/** localStorage: user opted in to occasional PWA engagement notifications (this device). */
export const PWA_ENGAGEMENT_NOTIFICATIONS_KEY = 'maxien_pwa_engagement_notifications'

export function readPwaEngagementNotificationsEnabled() {
  try {
    return localStorage.getItem(PWA_ENGAGEMENT_NOTIFICATIONS_KEY) === 'true'
  } catch {
    return false
  }
}

export function writePwaEngagementNotificationsEnabled(value) {
  try {
    localStorage.setItem(PWA_ENGAGEMENT_NOTIFICATIONS_KEY, value ? 'true' : 'false')
    window.dispatchEvent(new Event('pwa-engagement-notifications-changed'))
  } catch {
    /* ignore quota / private mode */
  }
}

export function engagementNotificationsSupported() {
  return typeof window !== 'undefined' && typeof Notification !== 'undefined'
}

/**
 * Pools of nudges  one category is picked at random when a notification fires.
 * URLs match `BrowserRouter` routes under `/dashboard`.
 */
export const ENGAGEMENT_NOTIFICATION_POOL = [
  {
    category: 'tasks',
    title: 'Anything due today?',
    body: 'Check your tasks and knock out what matters most.',
    url: '/dashboard/tasks',
  },
  {
    category: 'tasks',
    title: 'Plan your day',
    body: 'Open your dashboard and line up what needs doing.',
    url: '/dashboard',
  },
  {
    category: 'calendar',
    title: "What's on your calendar?",
    body: 'Take a quick look at upcoming events and deadlines.',
    url: '/dashboard/calendar',
  },
  {
    category: 'finance',
    title: 'Finance check-in',
    body: 'Review your spending and stay on top of your budget.',
    url: '/dashboard/finance',
  },
  {
    category: 'workouts',
    title: 'Time to move',
    body: 'Log a workout and keep your streak going.',
    url: '/dashboard/workouts',
  },
]

export function pickRandomEngagementNotification() {
  const pool = ENGAGEMENT_NOTIFICATION_POOL
  return pool[Math.floor(Math.random() * pool.length)]
}
