export const XBOX_GAMEPAD_BUTTONS = Object.freeze({
    A: 0,
    B: 1,
    X: 2,
    Y: 3,
    LB: 4,
    RB: 5,
    LT: 6,
    RT: 7,
    DPAD_UP: 12,
    DPAD_DOWN: 13,
})

/**
 * Cross-origin iframe inputs are not fully controllable from the parent page.
 * This is best-effort only and may be ignored by providers/browsers.
 */
export function dispatchBestEffortIframeMediaKey(iframeEl, key) {
    if (!iframeEl || !key) return false

    let dispatched = false
    const keyName = String(key)

    try {
        iframeEl.focus({ preventScroll: true })
    } catch {
        try {
            iframeEl.focus()
        } catch {
            // ignore
        }
    }

    const makeEvent = (type) => new KeyboardEvent(type, {
        key: keyName,
        bubbles: true,
        cancelable: true,
    })

    try {
        const win = iframeEl.contentWindow
        if (win?.dispatchEvent) {
            win.dispatchEvent(makeEvent('keydown'))
            win.dispatchEvent(makeEvent('keyup'))
            dispatched = true
        }
    } catch {
        // cross-origin access is expected to fail on many providers
    }

    try {
        iframeEl.dispatchEvent(makeEvent('keydown'))
        iframeEl.dispatchEvent(makeEvent('keyup'))
        dispatched = true
    } catch {
        // ignore
    }

    return dispatched
}
