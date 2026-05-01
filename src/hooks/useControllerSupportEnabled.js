import { useEffect, useState } from 'react'
import {
    CONTROLLER_SUPPORT_PREFERENCE_CHANGED,
    CONTROLLER_SUPPORT_STORAGE_KEY,
    readControllerSupportEnabled,
} from '../lib/lifeSyncControllerPreference'

export default function useControllerSupportEnabled() {
    const [enabled, setEnabled] = useState(() => readControllerSupportEnabled())

    useEffect(() => {
        const sync = () => setEnabled(readControllerSupportEnabled())
        const onStorage = (e) => {
            if (e?.key && e.key !== CONTROLLER_SUPPORT_STORAGE_KEY) return
            sync()
        }
        window.addEventListener(CONTROLLER_SUPPORT_PREFERENCE_CHANGED, sync)
        window.addEventListener('storage', onStorage)
        return () => {
            window.removeEventListener(CONTROLLER_SUPPORT_PREFERENCE_CHANGED, sync)
            window.removeEventListener('storage', onStorage)
        }
    }, [])

    return enabled
}
