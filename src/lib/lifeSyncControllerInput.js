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

function focusIframeElement(iframeEl) {
    if (!iframeEl) return
    try {
        iframeEl.focus({ preventScroll: true })
    } catch {
        try {
            iframeEl.focus()
        } catch {
            // ignore
        }
    }
}

function fireKeyEventTarget(target, keyName) {
    if (!target?.dispatchEvent) return false
    const makeEvent = (type) => new KeyboardEvent(type, {
        key: keyName,
        bubbles: true,
        cancelable: true,
    })
    target.dispatchEvent(makeEvent('keydown'))
    target.dispatchEvent(makeEvent('keyup'))
    return true
}

/**
 * Try to move focus into the iframe to maximize keyboard-shortcut compatibility
 * for third-party embed players (YouTube/Vimeo/custom mirrors).
 */
export function focusIframeForControllerInput(iframeEl) {
    if (!iframeEl) return false
    let focused = false
    focusIframeElement(iframeEl)
    focused = true

    try {
        const win = iframeEl.contentWindow
        win?.focus?.()
        const doc = win?.document
        doc?.body?.focus?.()
        focused = true
    } catch {
        // cross-origin access expected for most embeds
    }

    return focused
}

/**
 * Cross-origin iframe inputs are not fully controllable from the parent page.
 * This is best-effort only and may be ignored by providers/browsers.
 */
export function dispatchBestEffortIframeMediaKey(iframeEl, key) {
    if (!iframeEl || !key) return false

    let dispatched = false
    const keyName = String(key)

    focusIframeForControllerInput(iframeEl)

    try {
        const win = iframeEl.contentWindow
        if (fireKeyEventTarget(win, keyName)) dispatched = true
        const doc = win?.document
        if (fireKeyEventTarget(doc, keyName)) dispatched = true
        if (fireKeyEventTarget(doc?.activeElement, keyName)) dispatched = true
        if (fireKeyEventTarget(doc?.body, keyName)) dispatched = true
    } catch {
        // cross-origin access is expected to fail on many providers
    }

    if (fireKeyEventTarget(iframeEl, keyName)) dispatched = true
    if (fireKeyEventTarget(window, keyName)) dispatched = true
    if (fireKeyEventTarget(document, keyName)) dispatched = true
    if (fireKeyEventTarget(document?.activeElement, keyName)) dispatched = true

    return dispatched
}

/**
 * Fires several candidate keys in order to increase compatibility between
 * different third-party players inside cross-origin iframes.
 */
export function dispatchBestEffortIframeMediaKeys(iframeEl, keys) {
    const list = Array.isArray(keys) ? keys : [keys]
    let dispatched = false
    for (const key of list) {
        if (!key) continue
        if (dispatchBestEffortIframeMediaKey(iframeEl, key)) dispatched = true
    }
    return dispatched
}
