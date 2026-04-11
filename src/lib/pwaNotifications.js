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
 * Pools of nudges — one category is picked at random when a notification fires.
 * URLs match `BrowserRouter` routes under `/dashboard`.
 */
export const ENGAGEMENT_NOTIFICATION_POOL = [
  {
    category: 'manga',
    title: 'Continue your manga',
    body: 'Jump back into your library and pick up where you left off.',
    url: '/dashboard/lifesync/anime/manga/library',
  },
  {
    category: 'manga',
    title: 'New chapters?',
    body: "Open LifeSync Manga and see what's updated on your shelf.",
    url: '/dashboard/lifesync/anime/manga/library',
  },
  {
    category: 'anime',
    title: 'Resume watching',
    body: 'Catch up on anime you started — your history is one tap away.',
    url: '/dashboard/lifesync/anime',
  },
  {
    category: 'anime',
    title: 'Your queue is waiting',
    body: "See what's airing and continue the shows you follow.",
    url: '/dashboard/lifesync/anime',
  },
  {
    category: 'deals',
    title: 'Game deals',
    body: 'Peek at your Steam wishlist — a sale might be live.',
    url: '/dashboard/lifesync/games/wishlist',
  },
  {
    category: 'deals',
    title: 'Wishlist check-in',
    body: "Browse deals on games you're watching for.",
    url: '/dashboard/lifesync/games/wishlist',
  },
]

export function pickRandomEngagementNotification() {
  const pool = ENGAGEMENT_NOTIFICATION_POOL
  return pool[Math.floor(Math.random() * pool.length)]
}
