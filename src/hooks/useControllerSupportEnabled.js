import { useEffect, useState } from 'react'
import {
    CONTROLLER_SUPPORT_PREFERENCE_CHANGED,
    CONTROLLER_SUPPORT_STORAGE_KEY,
    readControllerSupportEnabled,
} from '../lib/lifeSyncControllerPreference'
import {
    LIFESYNC_KEYBOARD_GAMEPAD_CHANGED,
    isLifeSyncKeyboardGamepadActive,
} from '../lib/lifeSyncKeyboardGamepad'

// The keyboard bridge (TV mode) acts as a virtual controller, so controller-
// driven UIs stay enabled even when the gamepad preference is off.
function readEnabled() {
    return readControllerSupportEnabled() || isLifeSyncKeyboardGamepadActive()
}

export default function useControllerSupportEnabled() {
    const [enabled, setEnabled] = useState(() => readEnabled())

    useEffect(() => {
        const sync = () => setEnabled(readEnabled())
        const onStorage = (e) => {
            if (e?.key && e.key !== CONTROLLER_SUPPORT_STORAGE_KEY) return
            sync()
        }
        window.addEventListener(CONTROLLER_SUPPORT_PREFERENCE_CHANGED, sync)
        window.addEventListener(LIFESYNC_KEYBOARD_GAMEPAD_CHANGED, sync)
        window.addEventListener('storage', onStorage)
        return () => {
            window.removeEventListener(CONTROLLER_SUPPORT_PREFERENCE_CHANGED, sync)
            window.removeEventListener(LIFESYNC_KEYBOARD_GAMEPAD_CHANGED, sync)
            window.removeEventListener('storage', onStorage)
        }
    }, [])

    return enabled
}
