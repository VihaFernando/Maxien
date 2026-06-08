import { useEffect } from 'react'

const DPAD_BUTTONS = new Set([12, 13, 14, 15]) // up, down, left, right

let globalCursorHidden = false
let rafId = null

function setBodyCursorHidden(hidden) {
    if (globalCursorHidden === hidden) return
    globalCursorHidden = hidden
    document.body.style.cursor = hidden ? 'none' : ''
}

function getActiveGamepad() {
    if (typeof navigator?.getGamepads !== 'function') return null
    for (const pad of navigator.getGamepads() || []) {
        if (pad?.connected && Array.isArray(pad.buttons)) return pad
    }
    return null
}

/**
 * While the component is mounted:
 *  - Hides the cursor whenever a D-pad button is pressed
 *  - Restores it immediately on any mouse movement
 *  - Also restores it if the left/right analogue stick moves beyond a small dead-zone
 *    (axes 0/1 = left stick x/y on standard mapping)
 *
 * Call inside any page that uses D-pad card navigation. No parameters needed.
 */
export function useHideCursorOnDpad() {
    useEffect(() => {
        const onMouseMove = () => setBodyCursorHidden(false)
        window.addEventListener('mousemove', onMouseMove, { passive: true })

        // Poll for d-pad presses and stick movement
        const STICK_DEADZONE = 0.25
        let prevDpadPressed = false
        let frameCount = 0

        const tick = () => {
            frameCount++
            if (frameCount % 2 !== 0) {
                rafId = requestAnimationFrame(tick)
                return
            }
            const pad = getActiveGamepad()
            if (pad) {
                // D-pad: any of buttons 12-15 pressed → hide cursor
                const dpadPressed = [12, 13, 14, 15].some(i => pad.buttons[i]?.pressed)
                if (dpadPressed && !prevDpadPressed) {
                    setBodyCursorHidden(true)
                }
                prevDpadPressed = dpadPressed

                // Left stick (axes 0 & 1) movement beyond dead-zone → show cursor
                const lx = Number(pad.axes[0] || 0)
                const ly = Number(pad.axes[1] || 0)
                if (Math.abs(lx) > STICK_DEADZONE || Math.abs(ly) > STICK_DEADZONE) {
                    setBodyCursorHidden(false)
                }
            } else {
                prevDpadPressed = false
            }
            rafId = requestAnimationFrame(tick)
        }

        rafId = requestAnimationFrame(tick)

        return () => {
            window.removeEventListener('mousemove', onMouseMove)
            if (rafId != null) cancelAnimationFrame(rafId)
            // Restore cursor when component unmounts
            setBodyCursorHidden(false)
        }
    }, [])
}
