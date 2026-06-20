import { useEffect, useRef } from 'react'
import { gamepadButtonFromKeyboardEvent, setLifeSyncInputSource } from '../lib/lifeSyncKeyboardGamepad'

function normalizeHandlers(rawHandlers) {
    const out = new Map()
    const entries = rawHandlers && typeof rawHandlers === 'object' ? Object.entries(rawHandlers) : []
    for (const [key, fn] of entries) {
        if (typeof fn !== 'function') continue
        const idx = Number(key)
        if (!Number.isInteger(idx) || idx < 0) continue
        out.set(idx, fn)
    }
    return out
}

function getActiveGamepad() {
    if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return null
    const pads = navigator.getGamepads() || []
    for (const pad of pads) {
        if (pad?.connected && Array.isArray(pad.buttons)) return pad
    }
    return null
}

/**
 * Shared gamepad polling with press-edge detection and repeat cooldown support.
 */
export default function useLifeSyncGamepadInput({
    enabled = false,
    handlers = {},
    repeatableButtons = [],
    repeatDelayMs = 420,
    repeatIntervalMs = 180,
    pressThreshold = 0.5,
}) {
    const handlersRef = useRef(normalizeHandlers(handlers))
    const repeatableRef = useRef(new Set(repeatableButtons.map(Number)))
    const pressedRef = useRef(new Map())
    const nextRepeatAtRef = useRef(new Map())

    useEffect(() => {
        handlersRef.current = normalizeHandlers(handlers)
    }, [handlers])

    useEffect(() => {
        repeatableRef.current = new Set(repeatableButtons.map(Number))
    }, [repeatableButtons])

    useEffect(() => {
        if (!enabled || typeof window === 'undefined') {
            pressedRef.current.clear()
            nextRepeatAtRef.current.clear()
            return undefined
        }

        let rafId = 0
        let frameCount = 0
        pressedRef.current = new Map()
        nextRepeatAtRef.current.clear()

        const tick = () => {
            frameCount++
            if (frameCount % 2 !== 0) {
                rafId = window.requestAnimationFrame(tick)
                return
            }
            const handlersMap = handlersRef.current
            if (handlersMap.size > 0) {
                const now = performance.now()
                const gamepad = getActiveGamepad()

                if (!gamepad) {
                    pressedRef.current.clear()
                    nextRepeatAtRef.current.clear()
                } else {
                    for (const [buttonIndex, handler] of handlersMap.entries()) {
                        const button = gamepad.buttons?.[buttonIndex]
                        const value = Number(button?.value || 0)
                        const pressed = Boolean(button?.pressed) || value >= pressThreshold
                        const wasPressed = pressedRef.current.get(buttonIndex) === true
                        const repeatable = repeatableRef.current.has(buttonIndex)

                        if (pressed && !wasPressed) {
                            setLifeSyncInputSource('gamepad')
                            handler({ buttonIndex, repeat: false, value, gamepad })
                            if (repeatable) {
                                nextRepeatAtRef.current.set(buttonIndex, now + repeatDelayMs)
                            }
                        } else if (pressed && wasPressed && repeatable) {
                            const nextAt = Number(nextRepeatAtRef.current.get(buttonIndex) || 0)
                            if (now >= nextAt) {
                                handler({ buttonIndex, repeat: true, value, gamepad })
                                nextRepeatAtRef.current.set(buttonIndex, now + repeatIntervalMs)
                            }
                        } else if (!pressed) {
                            nextRepeatAtRef.current.delete(buttonIndex)
                        }

                        pressedRef.current.set(buttonIndex, pressed)
                    }
                }
            }
            rafId = window.requestAnimationFrame(tick)
        }

        rafId = window.requestAnimationFrame(tick)

        // Keyboard bridge  active only while TV mode enables it (see
        // lifeSyncKeyboardGamepad.js). Mapped keys fire the same handlers as
        // their gamepad buttons; native key auto-repeat drives repeats so it
        // only applies to repeatable (D-pad) buttons.
        const onKeyDown = (event) => {
            const buttonIndex = gamepadButtonFromKeyboardEvent(event)
            if (buttonIndex == null) return
            const handler = handlersRef.current.get(buttonIndex)
            if (!handler) return
            event.preventDefault()
            event.stopPropagation()
            if (event.repeat && !repeatableRef.current.has(buttonIndex)) return
            setLifeSyncInputSource('keyboard')
            handler({ buttonIndex, repeat: Boolean(event.repeat), value: 1, gamepad: null, keyboard: true })
        }
        window.addEventListener('keydown', onKeyDown)

        const pressedMap = pressedRef.current
        const nextRepeatMap = nextRepeatAtRef.current
        return () => {
            window.cancelAnimationFrame(rafId)
            window.removeEventListener('keydown', onKeyDown)
            pressedMap.clear()
            nextRepeatMap.clear()
        }
    }, [enabled, pressThreshold, repeatDelayMs, repeatIntervalMs])
}
