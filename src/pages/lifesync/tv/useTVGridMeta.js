import { useEffect } from 'react'

/**
 * Reports the active section's grid size up to the TV shell so it can clamp
 * focus to real items and cross pages at the grid edges (down past the last
 * row → next page, up/left past the first item → previous page).
 *
 * While `loading` is true we report a count of 0 so the shell never resolves a
 * pending back-page focus (or clamps) against the *previous* page's item count,
 * which a section keeps on screen until the next page's data arrives.
 *
 * @param {boolean} enabled  whether this section is the active one
 * @param {number} count     number of real (focusable) items in the grid
 * @param {boolean} hasMore  whether a next page exists
 * @param {(meta: { count: number, hasMore: boolean }) => void} [onGridMetaChange]
 * @param {boolean} [loading]  whether the grid is currently fetching a page
 */
export function useTVGridMeta(enabled, count, hasMore, onGridMetaChange, loading = false) {
    useEffect(() => {
        if (!enabled) return
        if (loading) {
            onGridMetaChange?.({ count: 0, hasMore: false })
            return
        }
        onGridMetaChange?.({ count, hasMore: Boolean(hasMore) })
    }, [enabled, count, hasMore, loading, onGridMetaChange])
}
