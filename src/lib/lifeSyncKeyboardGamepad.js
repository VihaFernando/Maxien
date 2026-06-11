/**
 * Keyboard → virtual gamepad bridge for TV mode.
 *
 * While active (TV mode mounted), `useLifeSyncGamepadInput` also accepts
 * keyboard input, translated to the same Xbox button indices so every
 * existing handler (shell, detail sheet, filter panel, players) works
 * unchanged with a keyboard:
 *
 *   W A S D / Arrow keys → D-pad      Q / E → LB / RB      N / M → LT / RT
 *   Space → X    Tab → Y    Enter → A    Backspace → B
 *
 * (Shift+T to launch TV mode lives in the Dashboard-level listener.)
 */
import { XBOX_GAMEPAD_BUTTONS } from './lifeSyncControllerInput'

export const LIFESYNC_KEYBOARD_GAMEPAD_CHANGED = 'maxien:keyboard-gamepad-changed'
export const LIFESYNC_INPUT_SOURCE_CHANGED = 'maxien:input-source-changed'

let keyboardGamepadActive = false

// ─── Last-used input source ('gamepad' | 'keyboard') ─────────────────────────
// Updated on every handled press so hint chips can show the right labels.

function hasConnectedGamepad() {
    try {
        if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') return false
        for (const pad of navigator.getGamepads() || []) {
            if (pad?.connected) return true
        }
    } catch { /* ignore */ }
    return false
}

let inputSource = hasConnectedGamepad() ? 'gamepad' : 'keyboard'

export function getLifeSyncInputSource() {
    return inputSource
}

export function setLifeSyncInputSource(source) {
    const next = source === 'gamepad' ? 'gamepad' : 'keyboard'
    if (next === inputSource) return
    inputSource = next
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(LIFESYNC_INPUT_SOURCE_CHANGED))
    }
}

/** Keyboard equivalents for the controller hint chips shown across TV mode. */
const KEYBOARD_HINT_LABELS = Object.freeze({
    A: 'Enter',
    B: 'Bksp',
    X: 'Space',
    Y: 'Tab',
    LB: 'Q',
    RB: 'E',
    LT: 'N',
    RT: 'M',
    'LB/RB': 'Q/E',
    'LT/RT': 'N/M',
    '✛': 'WASD',
    START: 'Shift+T',
})

/** Returns the hint label for a controller button given the active input source. */
export function tvHintLabel(buttonLabel, source = inputSource) {
    if (source !== 'keyboard') return buttonLabel
    return KEYBOARD_HINT_LABELS[buttonLabel] || buttonLabel
}

export function isLifeSyncKeyboardGamepadActive() {
    return keyboardGamepadActive
}

export function setLifeSyncKeyboardGamepadActive(active) {
    const next = Boolean(active)
    if (next === keyboardGamepadActive) return
    keyboardGamepadActive = next
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(LIFESYNC_KEYBOARD_GAMEPAD_CHANGED))
    }
}

const KEY_CODE_TO_BUTTON = Object.freeze({
    ArrowUp: XBOX_GAMEPAD_BUTTONS.DPAD_UP,
    ArrowDown: XBOX_GAMEPAD_BUTTONS.DPAD_DOWN,
    ArrowLeft: XBOX_GAMEPAD_BUTTONS.DPAD_LEFT,
    ArrowRight: XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT,
    KeyW: XBOX_GAMEPAD_BUTTONS.DPAD_UP,
    KeyS: XBOX_GAMEPAD_BUTTONS.DPAD_DOWN,
    KeyA: XBOX_GAMEPAD_BUTTONS.DPAD_LEFT,
    KeyD: XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT,
    KeyQ: XBOX_GAMEPAD_BUTTONS.LB,
    KeyE: XBOX_GAMEPAD_BUTTONS.RB,
    KeyN: XBOX_GAMEPAD_BUTTONS.LT,
    KeyM: XBOX_GAMEPAD_BUTTONS.RT,
    Space: XBOX_GAMEPAD_BUTTONS.X,
    Tab: XBOX_GAMEPAD_BUTTONS.Y,
    Enter: XBOX_GAMEPAD_BUTTONS.A,
    NumpadEnter: XBOX_GAMEPAD_BUTTONS.A,
    Backspace: XBOX_GAMEPAD_BUTTONS.B,
})

/** True when the event targets a field that should keep normal typing behavior. */
export function isEditableEventTarget(target) {
    if (!target || typeof target !== 'object') return false
    const tag = String(target.tagName || '').toLowerCase()
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
    return Boolean(target.isContentEditable)
}

/**
 * Maps a keydown event to a gamepad button index, or null when the key is
 * unmapped, modified (Ctrl/Meta/Alt), or typed inside an editable field.
 */
export function gamepadButtonFromKeyboardEvent(event) {
    if (!keyboardGamepadActive) return null
    if (event.ctrlKey || event.metaKey || event.altKey) return null
    if (isEditableEventTarget(event.target)) return null
    const button = KEY_CODE_TO_BUTTON[event.code]
    return button == null ? null : button
}
