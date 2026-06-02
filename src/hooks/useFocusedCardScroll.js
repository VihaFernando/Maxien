import { useEffect } from 'react'

/**
 * Scrolls the focused card into view whenever focusedCardIndex changes.
 * Cards must have data-focused-card="true" on the focused wrapper element.
 */
export function useFocusedCardScroll(focusedCardIndex) {
    useEffect(() => {
        if (focusedCardIndex < 0) return
        const el = document.querySelector('[data-focused-card="true"]')
        if (!el) return
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }, [focusedCardIndex])
}
