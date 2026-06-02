import { useEffect, useRef, useState } from 'react'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'

/**
 * Xbox-style button glyphs.
 * Each returns an inline SVG suited to sit inside a small pill badge.
 */
function BtnA({ className = 'h-3 w-3' }) {
    return (
        <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="7.5" fill="#5abf47" />
            <text x="8" y="11.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white" fontFamily="system-ui,sans-serif">A</text>
        </svg>
    )
}
function BtnB({ className = 'h-3 w-3' }) {
    return (
        <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="7.5" fill="#e2241a" />
            <text x="8" y="11.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white" fontFamily="system-ui,sans-serif">B</text>
        </svg>
    )
}
function BtnX({ className = 'h-3 w-3' }) {
    return (
        <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="7.5" fill="#1e76c8" />
            <text x="8" y="11.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white" fontFamily="system-ui,sans-serif">X</text>
        </svg>
    )
}
function BtnY({ className = 'h-3 w-3' }) {
    return (
        <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
            <circle cx="8" cy="8" r="7.5" fill="#e8a718" />
            <text x="8" y="11.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="white" fontFamily="system-ui,sans-serif">Y</text>
        </svg>
    )
}
function BtnLB({ className = 'h-3 w-3' }) {
    return (
        <svg className={className} viewBox="0 0 28 14" fill="none" aria-hidden>
            <rect x="0.5" y="0.5" width="27" height="13" rx="4" fill="#2d2d2d" stroke="#555" strokeWidth="0.8" />
            <text x="14" y="10" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="white" fontFamily="system-ui,sans-serif">LB</text>
        </svg>
    )
}
function BtnRB({ className = 'h-3 w-3' }) {
    return (
        <svg className={className} viewBox="0 0 28 14" fill="none" aria-hidden>
            <rect x="0.5" y="0.5" width="27" height="13" rx="4" fill="#2d2d2d" stroke="#555" strokeWidth="0.8" />
            <text x="14" y="10" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="white" fontFamily="system-ui,sans-serif">RB</text>
        </svg>
    )
}
function BtnLT({ className = 'h-3 w-3' }) {
    return (
        <svg className={className} viewBox="0 0 28 14" fill="none" aria-hidden>
            <rect x="0.5" y="0.5" width="27" height="13" rx="4" fill="#2d2d2d" stroke="#555" strokeWidth="0.8" />
            <text x="14" y="10" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="white" fontFamily="system-ui,sans-serif">LT</text>
        </svg>
    )
}
function BtnRT({ className = 'h-3 w-3' }) {
    return (
        <svg className={className} viewBox="0 0 28 14" fill="none" aria-hidden>
            <rect x="0.5" y="0.5" width="27" height="13" rx="4" fill="#2d2d2d" stroke="#555" strokeWidth="0.8" />
            <text x="14" y="10" textAnchor="middle" fontSize="7.5" fontWeight="bold" fill="white" fontFamily="system-ui,sans-serif">RT</text>
        </svg>
    )
}
function BtnDpad({ dir, className = 'h-3 w-3' }) {
    const arrows = { up: '↑', down: '↓', left: '←', right: '→', updown: '↑↓', leftright: '←→' }
    const label = arrows[dir] || '✦'
    return (
        <svg className={className} viewBox="0 0 22 14" fill="none" aria-hidden>
            <rect x="0.5" y="0.5" width="21" height="13" rx="3.5" fill="#1a1a1a" stroke="#555" strokeWidth="0.8" />
            <text x="11" y="10" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#e0e0e0" fontFamily="system-ui,sans-serif">{label}</text>
        </svg>
    )
}

/** Map a button key name to its icon component */
function ButtonIcon({ btn, className }) {
    const map = {
        A: BtnA, B: BtnB, X: BtnX, Y: BtnY,
        LB: BtnLB, RB: BtnRB, LT: BtnLT, RT: BtnRT,
    }
    const Comp = map[btn]
    if (Comp) return <Comp className={className} />
    if (btn === '↑↓') return <BtnDpad dir="updown" className={className} />
    if (btn === '←→') return <BtnDpad dir="leftright" className={className} />
    if (btn === '↑') return <BtnDpad dir="up" className={className} />
    if (btn === '↓') return <BtnDpad dir="down" className={className} />
    if (btn === '←') return <BtnDpad dir="left" className={className} />
    if (btn === '→') return <BtnDpad dir="right" className={className} />
    if (btn === 'D-pad') return <BtnDpad dir="leftright" className={className} />
    return <span className="text-[9px] font-bold text-white/70">{btn}</span>
}

/**
 * One hint row: one or more button glyphs followed by a label.
 * btns: array of button key strings e.g. ['LB'], ['←', '→'], ['A']
 */
function HintRow({ btns, label }) {
    const btnClass = 'h-[14px] w-auto'
    return (
        <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex items-center gap-0.5 shrink-0">
                {btns.map((b, i) => (
                    <ButtonIcon key={i} btn={b} className={btnClass} />
                ))}
            </div>
            <span className="text-[10px] leading-none text-white/75 truncate">{label}</span>
        </div>
    )
}

/**
 * Floating controller hint overlay.
 *
 * Props:
 *   hints: Array of { btns: string[], label: string }
 *   position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'  (default: 'bottom-left')
 *   dark: boolean — use dark background (for use inside dark popups)
 *   cols: number — number of columns for hint grid (default: 1)
 *   className: extra className
 */
export function ControllerHintOverlay({
    hints = [],
    position = 'bottom-left',
    dark = false,
    cols = 1,
    className = '',
}) {
    const controllerEnabled = useControllerSupportEnabled()
    // Start expanded so hints are visible on mount, then auto-collapse after 4.5s
    const [expanded, setExpanded] = useState(true)
    const hideTimer = useRef(null)

    useEffect(() => {
        hideTimer.current = setTimeout(() => setExpanded(false), 4500)
        return () => clearTimeout(hideTimer.current)
    }, [])

    if (!controllerEnabled || !hints.length) return null

    const posClass = {
        'bottom-left': 'bottom-3 left-3 sm:bottom-4 sm:left-4',
        'bottom-right': 'bottom-3 right-3 sm:bottom-4 sm:right-4',
        'top-left': 'top-3 left-3 sm:top-4 sm:left-4',
        'top-right': 'top-3 right-3 sm:top-4 sm:right-4',
    }[position] ?? 'bottom-3 left-3'

    const bgClass = dark
        ? 'bg-black/75 border-white/10'
        : 'bg-black/65 border-white/10'

    const colClass = cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-1'

    return (
        <div
            className={`pointer-events-auto absolute z-40 ${posClass} ${className}`}
            style={{ maxWidth: 'min(92vw, 380px)' }}
        >
            <button
                type="button"
                onClick={() => setExpanded(p => !p)}
                className={`flex items-center gap-1.5 rounded-xl border px-2 py-1.5 backdrop-blur-md transition-all ${bgClass}`}
                title={expanded ? 'Hide controls' : 'Show controls'}
                aria-expanded={expanded}
            >
                {/* Gamepad icon */}
                <svg className="h-3.5 w-3.5 shrink-0 text-white/80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <rect x="2" y="6" width="20" height="12" rx="5" />
                    <path strokeLinecap="round" d="M8 12h4M10 10v4" />
                    <circle cx="16" cy="11" r="0.8" fill="currentColor" />
                    <circle cx="14" cy="13" r="0.8" fill="currentColor" />
                </svg>
                <span className="text-[10px] font-semibold text-white/80 leading-none">Controls</span>
                <svg
                    className={`h-2.5 w-2.5 text-white/50 transition-transform ${expanded ? 'rotate-180' : ''}`}
                    viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l4 4 4-4" />
                </svg>
            </button>

            {expanded && (
                <div className={`mt-1.5 rounded-xl border px-3 py-2.5 backdrop-blur-md ${bgClass}`}>
                    <div className={`grid gap-x-5 gap-y-1.5 ${colClass}`}>
                        {hints.map((h, i) => (
                            <HintRow key={i} btns={h.btns} label={h.label} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

/**
 * Non-absolute version for inline placement (e.g. in a toolbar row).
 * Shows a compact chip that expands to a popover on click.
 */
export function ControllerHintBar({
    hints = [],
    dark = false,
    cols = 2,
    className = '',
}) {
    const controllerEnabled = useControllerSupportEnabled()
    const [open, setOpen] = useState(false)

    if (!controllerEnabled || !hints.length) return null

    const bgClass = dark
        ? 'bg-[#111]/80 border-white/10 text-white'
        : 'bg-[var(--color-surface)]/90 border-[var(--color-border-soft)] text-[var(--mx-color-1d1d1f)]'

    const colClass = cols === 2 ? 'grid-cols-2' : cols === 3 ? 'grid-cols-3' : 'grid-cols-1'

    return (
        <div className={`relative ${className}`}>
            <button
                type="button"
                onClick={() => setOpen(p => !p)}
                className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold backdrop-blur-sm transition ${bgClass}`}
                aria-expanded={open}
            >
                <svg className="h-3.5 w-3.5 shrink-0 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                    <rect x="2" y="6" width="20" height="12" rx="5" />
                    <path strokeLinecap="round" d="M8 12h4M10 10v4" />
                    <circle cx="16" cy="11" r="0.8" fill="currentColor" />
                    <circle cx="14" cy="13" r="0.8" fill="currentColor" />
                </svg>
                Controls
                <svg
                    className={`h-2.5 w-2.5 opacity-50 transition-transform ${open ? 'rotate-180' : ''}`}
                    viewBox="0 0 10 6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden
                >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M1 1l4 4 4-4" />
                </svg>
            </button>

            {open && (
                <div className={`absolute bottom-full left-0 mb-2 z-50 min-w-[220px] rounded-2xl border px-3.5 py-3 shadow-xl backdrop-blur-md ${bgClass}`}>
                    <p className="mb-2 text-[9px] font-black uppercase tracking-[0.14em] opacity-50">Controller</p>
                    <div className={`grid gap-x-5 gap-y-1.5 ${colClass}`}>
                        {hints.map((h, i) => (
                            <HintRow key={i} btns={h.btns} label={h.label} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
