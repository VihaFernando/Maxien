import { useCallback, useEffect, useRef } from 'react'

/**
 * Returns a `getSelectHandler(index)` factory that yields a *stable* click
 * handler per card index. The handler reads the latest item list and select
 * callback through refs, so it never changes identity across renders.
 *
 * This is what lets the memoized <TVCard> skip re-rendering when an unrelated
 * card gains/loses focus — without a stable onSelect the memo is defeated by a
 * fresh closure on every render.
 *
 * @param {Array} detailItems  one resolved detail item per card index (may hold nulls)
 * @param {(item: any) => void} onSelect  invoked with the item at the clicked index
 */
export function useTVCardSelect(detailItems, onSelect) {
    const itemsRef = useRef(detailItems)
    const onSelectRef = useRef(onSelect)
    const handlersRef = useRef([])

    // Keep the latest item list + callback reachable from the stable handlers.
    // Clicks only happen after commit, so the effect always runs first.
    useEffect(() => {
        itemsRef.current = detailItems
        onSelectRef.current = onSelect
    })

    return useCallback((idx) => {
        if (!handlersRef.current[idx]) {
            handlersRef.current[idx] = () => {
                const item = itemsRef.current[idx]
                if (item) onSelectRef.current(item)
            }
        }
        return handlersRef.current[idx]
    }, [])
}
