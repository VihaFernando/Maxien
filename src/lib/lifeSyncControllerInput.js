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

function getIframeDocument(iframeEl) {
    if (!iframeEl) return null
    try {
        return iframeEl.contentDocument || iframeEl.contentWindow?.document || null
    } catch {
        return null
    }
}

function findMediaElementInDocument(doc, depth = 0) {
    if (!doc || depth > 2) return null
    const video = doc.querySelector?.('video')
    if (video) return video
    const audio = doc.querySelector?.('audio')
    if (audio) return audio

    const nestedFrames = doc.querySelectorAll?.('iframe') || []
    for (const frame of nestedFrames) {
        const nestedDoc = getIframeDocument(frame)
        const media = findMediaElementInDocument(nestedDoc, depth + 1)
        if (media) return media
    }
    return null
}

function runPlay(mediaEl) {
    const playPromise = mediaEl?.play?.()
    if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {})
    }
}

function normalizeMediaActionFromKey(keyName) {
    const key = String(keyName || '')
    if (!key) return null
    if (key === 'k' || key === ' ' || key === 'Spacebar' || key === 'MediaPlayPause') return 'toggle-playback'
    if (key === 'MediaPlay') return 'play'
    if (key === 'MediaPause') return 'pause'
    if (key === 'j' || key === 'ArrowLeft') return 'seek-backward'
    if (key === 'l' || key === 'ArrowRight') return 'seek-forward'
    if (key === 'ArrowUp') return 'volume-up'
    if (key === 'ArrowDown') return 'volume-down'
    if (key === 'f') return 'toggle-fullscreen'
    return null
}

function tryControlIframeMediaElement(iframeEl, action) {
    if (!iframeEl || !action) return false
    const doc = getIframeDocument(iframeEl)
    if (!doc) return false
    const mediaEl = findMediaElementInDocument(doc)
    if (!mediaEl) return false

    if (action === 'toggle-playback') {
        if (mediaEl.paused) runPlay(mediaEl)
        else mediaEl.pause?.()
        return true
    }
    if (action === 'play') {
        runPlay(mediaEl)
        return true
    }
    if (action === 'pause') {
        mediaEl.pause?.()
        return true
    }
    if (action === 'seek-backward' || action === 'seek-forward') {
        const direction = action === 'seek-forward' ? 1 : -1
        const cur = Number(mediaEl.currentTime)
        if (!Number.isFinite(cur)) return false
        mediaEl.currentTime = Math.max(0, cur + direction * 10)
        return true
    }
    if (action === 'volume-up' || action === 'volume-down') {
        const cur = Number(mediaEl.volume)
        if (!Number.isFinite(cur)) return false
        const delta = action === 'volume-up' ? 0.08 : -0.08
        const next = Math.max(0, Math.min(1, cur + delta))
        mediaEl.volume = next
        if (mediaEl.muted && next > 0) mediaEl.muted = false
        return true
    }
    if (action === 'toggle-fullscreen') {
        const target = mediaEl.requestFullscreen ? mediaEl : iframeEl
        if (!document.fullscreenElement) {
            target.requestFullscreen?.().catch?.(() => {})
            return true
        }
        document.exitFullscreen?.().catch?.(() => {})
        return true
    }
    return false
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
    const action = normalizeMediaActionFromKey(keyName)

    if (action && tryControlIframeMediaElement(iframeEl, action)) {
        dispatched = true
    }

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
