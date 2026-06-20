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

// ─── shared poller ─────────────────────────────────────────────────────────────
// Previously every enabled hook instance ran its own requestAnimationFrame loop,
// each calling navigator.getGamepads() — so an open player + the shell + a
// settings panel could be polling the pad 2-3× per frame simultaneously. We now
// run ONE module-level loop that reads the pad once per frame and fans the result
// out to every active subscriber. The loop only exists while ≥1 subscriber is
// active, and stops (cancelling the rAF) as soon as the last one detaches.

const _subscribers = new Set()
let _rafId = 0
let _frameCount = 0

function sharedTick() {
    _frameCount++
    // Poll on every other frame (~30Hz) — matches the old per-instance cadence.
    if (_frameCount % 2 === 0) {
        const now = performance.now()
        const gamepad = getActiveGamepad()
        // Snapshot: a handler may mount/unmount another hook, mutating the live
        // Set mid-iteration. Iterating a copy keeps this frame's fan-out stable.
        for (const sub of [..._subscribers]) {
            if (_subscribers.has(sub)) sub.poll(now, gamepad)
        }
    }
    _rafId = window.requestAnimationFrame(sharedTick)
}

function addSubscriber(sub) {
    _subscribers.add(sub)
    if (!_rafId && typeof window !== 'undefined') {
        _frameCount = 0
        _rafId = window.requestAnimationFrame(sharedTick)
    }
}

function removeSubscriber(sub) {
    _subscribers.delete(sub)
    if (!_subscribers.size && _rafId) {
        window.cancelAnimationFrame(_rafId)
        _rafId = 0
    }
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

        const pressedMap = pressedRef.current
        const nextRepeatMap = nextRepeatAtRef.current
        pressedMap.clear()
        nextRepeatMap.clear()

        const poll = (now, gamepad) => {
            const handlersMap = handlersRef.current
            if (handlersMap.size === 0) return

            if (!gamepad) {
                pressedMap.clear()
                nextRepeatMap.clear()
                return
            }

            for (const [buttonIndex, handler] of handlersMap.entries()) {
                const button = gamepad.buttons?.[buttonIndex]
                const value = Number(button?.value || 0)
                const pressed = Boolean(button?.pressed) || value >= pressThreshold
                const wasPressed = pressedMap.get(buttonIndex) === true
                const repeatable = repeatableRef.current.has(buttonIndex)

                if (pressed && !wasPressed) {
                    setLifeSyncInputSource('gamepad')
                    handler({ buttonIndex, repeat: false, value, gamepad })
                    if (repeatable) {
                        nextRepeatMap.set(buttonIndex, now + repeatDelayMs)
                    }
                } else if (pressed && wasPressed && repeatable) {
                    const nextAt = Number(nextRepeatMap.get(buttonIndex) || 0)
                    if (now >= nextAt) {
                        handler({ buttonIndex, repeat: true, value, gamepad })
                        nextRepeatMap.set(buttonIndex, now + repeatIntervalMs)
                    }
                } else if (!pressed) {
                    nextRepeatMap.delete(buttonIndex)
                }

                pressedMap.set(buttonIndex, pressed)
            }
        }

        const subscriber = { poll }
        addSubscriber(subscriber)

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

        return () => {
            removeSubscriber(subscriber)
            window.removeEventListener('keydown', onKeyDown)
            pressedMap.clear()
            nextRepeatMap.clear()
        }
    }, [enabled, pressThreshold, repeatDelayMs, repeatIntervalMs])
}
