import { useEffect, useState } from 'react'
import {
    LIFESYNC_INPUT_SOURCE_CHANGED,
    getLifeSyncInputSource,
} from '../lib/lifeSyncKeyboardGamepad'

/**
 * Live last-used input source: 'gamepad' | 'keyboard'.
 * TV mode hint chips use this to show controller or keyboard labels.
 */
export default function useLifeSyncInputSource() {
    const [source, setSource] = useState(() => getLifeSyncInputSource())

    useEffect(() => {
        const sync = () => setSource(getLifeSyncInputSource())
        window.addEventListener(LIFESYNC_INPUT_SOURCE_CHANGED, sync)
        return () => window.removeEventListener(LIFESYNC_INPUT_SOURCE_CHANGED, sync)
    }, [])

    return source
}
