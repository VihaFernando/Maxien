import { useCallback } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

let swPingIntervalId = null
let swVisHandler = null

function scheduleServiceWorkerChecks(registration) {
  if (!registration) return
  const ping = () => registration.update()

  if (swVisHandler) {
    document.removeEventListener('visibilitychange', swVisHandler)
    swVisHandler = null
  }
  if (swPingIntervalId != null) {
    window.clearInterval(swPingIntervalId)
    swPingIntervalId = null
  }

  swVisHandler = () => {
    if (document.visibilityState === 'visible') ping()
  }
  document.addEventListener('visibilitychange', swVisHandler)
  swPingIntervalId = window.setInterval(ping, 60 * 60 * 1000)
}

/**
 * Shows a bottom bar when a new app shell is cached so the user can reload on their own terms.
 * Requires `registerType: 'prompt'` in vite-plugin-pwa.
 */
export default function PWAUpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      scheduleServiceWorkerChecks(registration)
    },
  })

  const onUpdate = useCallback(async () => {
    await updateServiceWorker(true)
  }, [updateServiceWorker])

  const onDismiss = useCallback(() => {
    setNeedRefresh(false)
  }, [setNeedRefresh])

  if (!needRefresh) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-10050 flex justify-center p-3 sm:p-4"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto flex max-w-lg flex-col gap-3 rounded-xl border border-slate-700/80 bg-slate-900/95 px-4 py-3 text-sm text-slate-100 shadow-lg backdrop-blur-md sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <p className="leading-snug">
          <span className="font-medium text-white">A new version of Maxien is ready.</span>{' '}
        </p>
        <div className="flex shrink-0 gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg border border-slate-600 bg-transparent px-3 py-1.5 text-slate-300 transition hover:bg-slate-800"
          >
            Later
          </button>
          <button
            type="button"
            onClick={onUpdate}
            className="rounded-lg bg-primary px-3 py-1.5 font-medium text-slate-900 transition hover:brightness-95"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  )
}
