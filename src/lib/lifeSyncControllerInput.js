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

export const IFRAME_CONTROLLER_ACTIONS = Object.freeze({
    TOGGLE_PLAY: 'togglePlay',
    PLAY: 'play',
    TOGGLE_FULLSCREEN: 'toggleFullscreen',
    SEEK_BACK_10: 'seekBack10',
    SEEK_FORWARD_10: 'seekForward10',
    VOLUME_UP: 'volumeUp',
    VOLUME_DOWN: 'volumeDown',
})

const IFRAME_ACTION_FALLBACK_KEYS = Object.freeze({
    [IFRAME_CONTROLLER_ACTIONS.TOGGLE_PLAY]: Object.freeze(['k', ' ', 'Spacebar', 'MediaPlayPause']),
    [IFRAME_CONTROLLER_ACTIONS.PLAY]: Object.freeze(['MediaPlay', 'k', ' ', 'MediaPlayPause']),
    [IFRAME_CONTROLLER_ACTIONS.TOGGLE_FULLSCREEN]: Object.freeze(['f']),
    [IFRAME_CONTROLLER_ACTIONS.SEEK_BACK_10]: Object.freeze(['j', 'ArrowLeft']),
    [IFRAME_CONTROLLER_ACTIONS.SEEK_FORWARD_10]: Object.freeze(['l', 'ArrowRight']),
    [IFRAME_CONTROLLER_ACTIONS.VOLUME_UP]: Object.freeze(['ArrowUp']),
    [IFRAME_CONTROLLER_ACTIONS.VOLUME_DOWN]: Object.freeze(['ArrowDown']),
})

const DIRECT_MEDIA_ACTIONS = Object.freeze({
    [IFRAME_CONTROLLER_ACTIONS.TOGGLE_PLAY]: 'toggle-playback',
    [IFRAME_CONTROLLER_ACTIONS.PLAY]: 'play',
    [IFRAME_CONTROLLER_ACTIONS.TOGGLE_FULLSCREEN]: 'toggle-fullscreen',
    [IFRAME_CONTROLLER_ACTIONS.SEEK_BACK_10]: 'seek-backward',
    [IFRAME_CONTROLLER_ACTIONS.SEEK_FORWARD_10]: 'seek-forward',
    [IFRAME_CONTROLLER_ACTIONS.VOLUME_UP]: 'volume-up',
    [IFRAME_CONTROLLER_ACTIONS.VOLUME_DOWN]: 'volume-down',
})

const DIRECT_MEDIA_SEEK_SECONDS = 10
const DIRECT_MEDIA_VOLUME_STEP = 0.08

function normalizeControllerAction(action) {
    const raw = String(action || '').trim()
    return Object.values(IFRAME_CONTROLLER_ACTIONS).includes(raw) ? raw : null
}

function normalizeKeyName(rawKeyName) {
    const raw = String(rawKeyName || '')
    return raw === 'Spacebar' ? ' ' : raw
}

function inferControllerActionFromKey(rawKeyName) {
    const key = normalizeKeyName(rawKeyName)
    if (key === 'k' || key === 'K' || key === ' ' || key === 'MediaPlayPause') {
        return IFRAME_CONTROLLER_ACTIONS.TOGGLE_PLAY
    }
    if (key === 'MediaPlay') return IFRAME_CONTROLLER_ACTIONS.PLAY
    if (key === 'f' || key === 'F') return IFRAME_CONTROLLER_ACTIONS.TOGGLE_FULLSCREEN
    if (key === 'j' || key === 'J' || key === 'ArrowLeft') return IFRAME_CONTROLLER_ACTIONS.SEEK_BACK_10
    if (key === 'l' || key === 'L' || key === 'ArrowRight') return IFRAME_CONTROLLER_ACTIONS.SEEK_FORWARD_10
    if (key === 'ArrowUp') return IFRAME_CONTROLLER_ACTIONS.VOLUME_UP
    if (key === 'ArrowDown') return IFRAME_CONTROLLER_ACTIONS.VOLUME_DOWN
    return null
}

export function getIframeControllerActionFallbackKeys(action) {
    const normalized = normalizeControllerAction(action)
    if (!normalized) return []
    const keys = IFRAME_ACTION_FALLBACK_KEYS[normalized]
    return Array.isArray(keys) ? [...keys] : []
}

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

function keyboardMetaForKey(rawKeyName) {
    const keyName = normalizeKeyName(rawKeyName)
    if (keyName === ' ') return { key: ' ', code: 'Space', keyCode: 32 }
    if (keyName === 'k' || keyName === 'K') return { key: String(keyName).toLowerCase(), code: 'KeyK', keyCode: 75 }
    if (keyName === 'j' || keyName === 'J') return { key: String(keyName).toLowerCase(), code: 'KeyJ', keyCode: 74 }
    if (keyName === 'l' || keyName === 'L') return { key: String(keyName).toLowerCase(), code: 'KeyL', keyCode: 76 }
    if (keyName === 'f' || keyName === 'F') return { key: String(keyName).toLowerCase(), code: 'KeyF', keyCode: 70 }
    if (keyName === 'ArrowLeft') return { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 }
    if (keyName === 'ArrowUp') return { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 }
    if (keyName === 'ArrowRight') return { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }
    if (keyName === 'ArrowDown') return { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 }
    if (keyName === 'MediaPlayPause') return { key: 'MediaPlayPause', code: 'MediaPlayPause', keyCode: 179 }
    if (keyName === 'MediaPlay') return { key: 'MediaPlay', code: 'MediaPlayPause', keyCode: 179 }
    if (keyName === 'MediaPause') return { key: 'MediaPause', code: 'MediaPlayPause', keyCode: 179 }
    if (keyName.length === 1) {
        const upper = keyName.toUpperCase()
        return {
            key: keyName,
            code: `Key${upper}`,
            keyCode: upper.charCodeAt(0),
        }
    }
    return { key: keyName, code: keyName, keyCode: 0 }
}

function patchLegacyKeyboardFields(event, meta) {
    if (!event || !meta) return
    const keyCode = Number(meta.keyCode)
    const hasCode = Number.isFinite(keyCode) && keyCode > 0
    const charCode = typeof meta.key === 'string' && meta.key.length === 1 ? meta.key.charCodeAt(0) : 0
    const entries = [
        ['keyCode', hasCode ? keyCode : 0],
        ['which', hasCode ? keyCode : 0],
        ['charCode', Number.isFinite(charCode) ? charCode : 0],
    ]
    for (const [name, value] of entries) {
        try {
            Object.defineProperty(event, name, {
                configurable: true,
                enumerable: true,
                get: () => value,
            })
        } catch {
            // ignore readonly engine behavior
        }
    }
}

function createKeyboardEvent(type, keyName) {
    const meta = keyboardMetaForKey(keyName)
    const event = new KeyboardEvent(type, {
        key: meta.key,
        code: meta.code,
        bubbles: true,
        cancelable: true,
        composed: true,
    })
    patchLegacyKeyboardFields(event, meta)
    return { event, meta }
}

function fireKeyEventTarget(target, keyName) {
    if (!target?.dispatchEvent) return false
    const { event: downEvent, meta } = createKeyboardEvent('keydown', keyName)
    target.dispatchEvent(downEvent)
    const shouldEmitKeyPress = typeof meta?.key === 'string' && (meta.key === ' ' || meta.key.length === 1)
    if (shouldEmitKeyPress) {
        const { event: pressEvent } = createKeyboardEvent('keypress', keyName)
        target.dispatchEvent(pressEvent)
    }
    const { event: upEvent } = createKeyboardEvent('keyup', keyName)
    target.dispatchEvent(upEvent)
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

function runDirectMediaAction(iframeEl, action) {
    const internalAction = DIRECT_MEDIA_ACTIONS[action]
    if (!iframeEl || !internalAction) return { handled: false, via: null }
    const doc = getIframeDocument(iframeEl)
    if (!doc) return { handled: false, via: null }
    const mediaEl = findMediaElementInDocument(doc)
    if (!mediaEl) return { handled: false, via: null }

    if (internalAction === 'toggle-playback') {
        if (mediaEl.paused) runPlay(mediaEl)
        else mediaEl.pause?.()
        return { handled: true, via: 'same-origin-media' }
    }
    if (internalAction === 'play') {
        runPlay(mediaEl)
        return { handled: true, via: 'same-origin-media' }
    }
    if (internalAction === 'seek-backward' || internalAction === 'seek-forward') {
        const direction = internalAction === 'seek-forward' ? 1 : -1
        const cur = Number(mediaEl.currentTime)
        if (!Number.isFinite(cur)) return { handled: false, via: null }
        mediaEl.currentTime = Math.max(0, cur + (direction * DIRECT_MEDIA_SEEK_SECONDS))
        return { handled: true, via: 'same-origin-media' }
    }
    if (internalAction === 'volume-up' || internalAction === 'volume-down') {
        const cur = Number(mediaEl.volume)
        if (!Number.isFinite(cur)) return { handled: false, via: null }
        const delta = internalAction === 'volume-up' ? DIRECT_MEDIA_VOLUME_STEP : -DIRECT_MEDIA_VOLUME_STEP
        const next = Math.max(0, Math.min(1, cur + delta))
        mediaEl.volume = next
        if (mediaEl.muted && next > 0) mediaEl.muted = false
        return { handled: true, via: 'same-origin-media' }
    }
    if (internalAction === 'toggle-fullscreen') {
        const target = mediaEl.requestFullscreen ? mediaEl : iframeEl
        if (!document.fullscreenElement) {
            target.requestFullscreen?.().catch?.(() => {})
        } else {
            document.exitFullscreen?.().catch?.(() => {})
        }
        return { handled: true, via: 'same-origin-media' }
    }

    return { handled: false, via: null }
}

function getKeyboardDispatchTargets(iframeEl) {
    const raw = []

    try {
        const win = iframeEl?.contentWindow
        raw.push(['iframeWindow', win])
        const doc = win?.document
        raw.push(['iframeDocument', doc])
        raw.push(['iframeBody', doc?.body])
    } catch {
        // cross-origin access is expected to fail on many providers
    }

    raw.push(['iframeElement', iframeEl])
    raw.push(['fullscreenElement', document?.fullscreenElement])
    raw.push(['activeElement', document?.activeElement])
    raw.push(['document', document])
    raw.push(['window', window])

    const targets = []
    const seen = new Set()
    for (const [label, target] of raw) {
        if (!target || seen.has(target)) continue
        seen.add(target)
        targets.push({ label, target })
    }
    return targets
}

function dispatchKeysAcrossTargets(targets, keys) {
    const targetHits = {}
    const dispatchedKeys = []
    let handled = false

    const safeKeys = Array.isArray(keys)
        ? keys.map((key) => String(key || '').trim()).filter(Boolean)
        : []

    for (const key of safeKeys) {
        let keyHandled = false
        for (const { label, target } of targets) {
            if (!fireKeyEventTarget(target, key)) continue
            handled = true
            keyHandled = true
            targetHits[label] = (targetHits[label] || 0) + 1
        }
        if (keyHandled) dispatchedKeys.push(key)
    }

    return {
        handled,
        dispatchedKeys,
        targetHits,
        targetOrder: targets.map((row) => row.label),
    }
}

function createExecutionResult({ action, keys }) {
    return {
        action: action || null,
        fallbackKeys: Array.isArray(keys) ? [...keys] : [],
        handled: false,
        handledBy: null,
        stages: {
            focus: {
                attempted: false,
                handled: false,
            },
            directMedia: {
                attempted: false,
                handled: false,
                strategy: null,
            },
            keyboard: {
                attempted: false,
                handled: false,
                dispatchedKeys: [],
                targetHits: {},
                targetOrder: [],
            },
        },
    }
}

function executeIframeDispatchPipeline({
    iframeEl,
    action = null,
    keys = [],
    skipKeyboardWhenDirectHandled = false,
}) {
    const result = createExecutionResult({ action, keys })
    if (!iframeEl) return result

    result.stages.focus.attempted = true
    result.stages.focus.handled = focusIframeForControllerInput(iframeEl)

    if (action) {
        result.stages.directMedia.attempted = true
        const direct = runDirectMediaAction(iframeEl, action)
        result.stages.directMedia.handled = direct.handled
        result.stages.directMedia.strategy = direct.via
        if (direct.handled) {
            result.handled = true
            result.handledBy = 'direct-media'
        }
    }

    const safeKeys = Array.isArray(keys)
        ? keys.map((key) => String(key || '').trim()).filter(Boolean)
        : []

    const shouldRunKeyboard =
        safeKeys.length > 0 &&
        (!skipKeyboardWhenDirectHandled || !result.stages.directMedia.handled)

    if (shouldRunKeyboard) {
        result.stages.keyboard.attempted = true
        const keyboard = dispatchKeysAcrossTargets(getKeyboardDispatchTargets(iframeEl), safeKeys)
        result.stages.keyboard.handled = keyboard.handled
        result.stages.keyboard.dispatchedKeys = keyboard.dispatchedKeys
        result.stages.keyboard.targetHits = keyboard.targetHits
        result.stages.keyboard.targetOrder = keyboard.targetOrder
        if (keyboard.handled && !result.handled) {
            result.handled = true
            result.handledBy = 'keyboard'
        }
    }

    return result
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

export function executeIframeControllerAction(iframeEl, action) {
    const normalizedAction = normalizeControllerAction(action)
    const keys = normalizedAction ? getIframeControllerActionFallbackKeys(normalizedAction) : []
    if (!normalizedAction) return createExecutionResult({ action: null, keys: [] })

    const skipKeyboardWhenDirectHandled =
        normalizedAction !== IFRAME_CONTROLLER_ACTIONS.TOGGLE_FULLSCREEN

    return executeIframeDispatchPipeline({
        iframeEl,
        action: normalizedAction,
        keys,
        skipKeyboardWhenDirectHandled,
    })
}

/**
 * Cross-origin iframe inputs are not fully controllable from the parent page.
 * This is best-effort only and may be ignored by providers/browsers.
 *
 * Back-compat wrapper: returns `boolean` instead of structured result.
 */
export function dispatchBestEffortIframeMediaKey(iframeEl, key) {
    if (!iframeEl || !key) return false
    const keyName = String(key)
    const inferredAction = inferControllerActionFromKey(keyName)
    const result = executeIframeDispatchPipeline({
        iframeEl,
        action: inferredAction,
        keys: [keyName],
        skipKeyboardWhenDirectHandled: false,
    })
    return result.handled
}

/**
 * Back-compat wrapper for a sequence of candidate keys.
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
