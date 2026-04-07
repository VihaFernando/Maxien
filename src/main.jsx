import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return
    const ping = () => registration.update()
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') ping()
    })
    setInterval(ping, 60 * 60 * 1000)
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
