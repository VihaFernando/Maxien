import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

let swPingIntervalId = null
let swVisHandler = null

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
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
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
