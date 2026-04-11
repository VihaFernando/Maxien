import { useEffect, useRef, useSyncExternalStore } from 'react'
import {
  readPwaEngagementNotificationsEnabled,
  engagementNotificationsSupported,
  pickRandomEngagementNotification,
} from '../lib/pwaNotifications'

const CHANGED = 'pwa-engagement-notifications-changed'

function subscribeEngagementPref(onStoreChange) {
  window.addEventListener('storage', onStoreChange)
  window.addEventListener(CHANGED, onStoreChange)
  return () => {
    window.removeEventListener('storage', onStoreChange)
    window.removeEventListener(CHANGED, onStoreChange)
  }
}

function getEngagementPrefSnapshot() {
  return readPwaEngagementNotificationsEnabled()
}

function getServerSnapshot() {
  return false
}

const MIN_INTERVAL_MS = 30 * 60 * 1000
const MAX_INTERVAL_MS = 75 * 60 * 1000

function nextDelayMs() {
  return MIN_INTERVAL_MS + Math.random() * (MAX_INTERVAL_MS - MIN_INTERVAL_MS)
}

function showEngagementNotification() {
  if (!engagementNotificationsSupported()) return
  if (Notification.permission !== 'granted') return

  const { title, body, url } = pickRandomEngagementNotification()
  const icon = typeof window !== 'undefined' ? `${window.location.origin}/logopwa.svg` : undefined

  try {
    const n = new Notification(title, {
      body,
      icon,
      tag: 'maxien-engage',
      renotify: true,
    })
    n.onclick = (e) => {
      e.preventDefault()
      n.close()
      window.focus()
      if (url) window.location.assign(url)
    }
  } catch {
    /* Some browsers block or throw for malformed options */
  }
}

/**
 * Occasional in-browser tips (manga / anime / deals) while a tab is open and notifications are allowed.
 */
export default function PWAEngagementNotifications() {
  const enabled = useSyncExternalStore(
    subscribeEngagementPref,
    getEngagementPrefSnapshot,
    getServerSnapshot,
  )

  const timeoutRef = useRef(null)

  useEffect(() => {
    if (!enabled || !engagementNotificationsSupported()) {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }
    if (Notification.permission !== 'granted') return

    let cancelled = false

    const clearLocalTimer = () => {
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    const scheduleLocal = () => {
      clearLocalTimer()
      const go = () => {
        if (cancelled) return
        showEngagementNotification()
        timeoutRef.current = window.setTimeout(go, nextDelayMs())
      }
      timeoutRef.current = window.setTimeout(go, nextDelayMs())
    }

    scheduleLocal()

    return () => {
      cancelled = true
      clearLocalTimer()
    }
  }, [enabled])

  return null
}
