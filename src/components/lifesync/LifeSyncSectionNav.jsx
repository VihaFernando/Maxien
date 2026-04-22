import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { MotionSpan } from '../../lib/lifesyncMotion'

/**
 * Underline-style section tabs with a spring-animated indicator that slides
 * horizontally to the active tab (clear left/right motion on change).
 */
export function LifeSyncSectionNav({
    items,
    activeId,
    onSelect,
    layoutId: _layoutId,
    className = '',
    size = 'default',
    ariaLabel = 'Sections',
}) {
    const pad = size === 'dense' ? 'px-2.5 sm:px-3 py-2 text-[12px]' : 'px-3 sm:px-5 py-2.5 text-[13px]'
    const insetX = size === 'dense' ? 6 : 10

    const scrollRef = useRef(null)
    const rowRef = useRef(null)
    const btnRefs = useRef(new Map())
    const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

    const measure = useCallback(() => {
        const row = rowRef.current
        const btn = btnRefs.current.get(activeId)
        if (!row || !btn) return
        const r = row.getBoundingClientRect()
        const b = btn.getBoundingClientRect()
        const left = b.left - r.left + insetX
        const width = Math.max(12, b.width - insetX * 2)
        setIndicator({ left, width, ready: true })
    }, [activeId, insetX])

    const didInteractRef = useRef(false)

    useLayoutEffect(() => {
        measure()
        const btn = btnRefs.current.get(activeId)
        if (btn) {
            btn.scrollIntoView({
                block: 'nearest',
                inline: 'nearest',
                behavior: didInteractRef.current ? 'smooth' : 'instant',
            })
        }
        didInteractRef.current = true
    }, [activeId, measure])

    useLayoutEffect(() => {
        const root = scrollRef.current
        if (!root) return
        const ro = new ResizeObserver(() => measure())
        ro.observe(root)
        const onWin = () => measure()
        window.addEventListener('resize', onWin)
        return () => {
            ro.disconnect()
            window.removeEventListener('resize', onWin)
        }
    }, [measure])

    const setBtnRef = (id) => (el) => {
        if (el) btnRefs.current.set(id, el)
        else btnRefs.current.delete(id)
    }

    return (
        <nav
            className={`rounded-xl border border-[var(--mx-color-e5e5ea)]/90 bg-[var(--color-surface)]/90 shadow-[0_1px_0_rgba(0,0,0,0.04)] backdrop-blur-sm ${className}`}
            aria-label={ariaLabel}
        >
            <div ref={scrollRef} className="min-w-0 overflow-x-auto hide-scrollbar">
                <div ref={rowRef} className="relative flex min-w-0 items-stretch gap-0" role="tablist">
                    {indicator.ready && (
                        <MotionSpan
                            aria-hidden
                            className="pointer-events-none absolute bottom-0 z-10 h-[3px] rounded-full bg-[var(--mx-color-c6ff00)]"
                            initial={false}
                            animate={{ left: indicator.left, width: indicator.width }}
                            transition={{ type: 'spring', stiffness: 520, damping: 38, mass: 0.85 }}
                        />
                    )}
                    {items.map((it) => {
                        const active = it.id === activeId
                        const disabled = Boolean(it.disabled)
                        return (
                            <button
                                key={it.id}
                                ref={setBtnRef(it.id)}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                disabled={disabled}
                                title={it.title}
                                onClick={() => !disabled && onSelect(it.id)}
                                className={`relative z-0 shrink-0 font-semibold transition-colors ${pad} ${
                                    active
                                        ? 'text-[var(--mx-color-1a1628)]'
                                        : 'text-[var(--mx-color-86868b)] hover:text-[var(--mx-color-1d1d1f)] disabled:cursor-not-allowed disabled:opacity-40'
                                }`}
                            >
                                {it.label}
                            </button>
                        )
                    })}
                </div>
            </div>
        </nav>
    )
}
