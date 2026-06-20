import { useEffect, useMemo, useRef, useState } from 'react'
import { motion as M } from 'framer-motion'
import useLifeSyncGamepadInput from '../../../hooks/useLifeSyncGamepadInput'
import useControllerSupportEnabled from '../../../hooks/useControllerSupportEnabled'
import { XBOX_GAMEPAD_BUTTONS } from '../../../lib/lifeSyncControllerInput'
import useLifeSyncInputSource from '../../../hooks/useLifeSyncInputSource'
import { tvHintLabel } from '../../../lib/lifeSyncKeyboardGamepad'

/**
 * Right-side slide-in filter panel opened by the Y button.
 *
 * filterConfig: Array of filter row descriptors:
 *   { id: string, label: string, type: 'select' | 'action', options?: {id, label}[], onAction?: () => void }
 *
 * filters: { [id]: value }    current filter values
 * onFilterChange: (id, value) => void
 * onClose: () => void
 */
export function TVFilterPanel({ filterConfig = [], filters = {}, onFilterChange, onClose, title = 'Filters' }) {
    const controllerEnabled = useControllerSupportEnabled()
    const inputSource = useLifeSyncInputSource()
    const [rowIndex, setRowIndex] = useState(0)
    const [chipIndexByRow, setChipIndexByRow] = useState({})
    const [editingSearchId, setEditingSearchId] = useState('')
    const openedAtRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now())
    const searchInputRefs = useRef({})
    const blurTimeoutRef = useRef(null)
    const rows = filterConfig.filter(Boolean)

    const activeRow = rows[rowIndex]
    const activeChipIndex = activeRow ? Number(chipIndexByRow[activeRow.id] || 0) : 0

    useEffect(() => {
        setRowIndex(prev => Math.min(Math.max(0, rows.length - 1), prev))
    }, [rows.length])

    useEffect(() => {
        if (!activeRow || activeRow.type !== 'chip-multi') return
        const maxIndex = Math.max(0, (activeRow.options || []).length - 1)
        setChipIndexByRow(prev => {
            const current = Number(prev[activeRow.id] || 0)
            if (current <= maxIndex) return prev
            return { ...prev, [activeRow.id]: maxIndex }
        })
    }, [activeRow])

    useEffect(() => {
        document.querySelector('[data-focused-filter-chip="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }, [activeChipIndex, rowIndex])

    // Clear the pending search-blur timer on unmount so it can't fire setState
    // after the panel closes (React warning + retained closure over stale state).
    useEffect(() => () => {
        if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
    }, [])

    const toggleChipValue = (row, value) => {
        const current = Array.isArray(filters[row.id]) ? filters[row.id] : []
        const next = current.includes(value)
            ? current.filter(item => item !== value)
            : [...current, value]
        onFilterChange(row.id, next)
    }

    const closeIfSettled = useMemo(() => () => {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
        if (now - openedAtRef.current < 280) return
        onClose()
    }, [onClose])

    const handlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => { if (!editingSearchId) setRowIndex(prev => Math.max(0, prev - 1)) },
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => { if (!editingSearchId) setRowIndex(prev => Math.min(rows.length - 1, prev + 1)) },
        [XBOX_GAMEPAD_BUTTONS.DPAD_LEFT]: () => {
            if (editingSearchId) return
            if (!activeRow) return
            if (activeRow.type === 'chip-multi') {
                const opts = activeRow.options || []
                setChipIndexByRow(prev => ({ ...prev, [activeRow.id]: Math.max(0, activeChipIndex - 1) }))
                return
            }
            if (activeRow.type !== 'select') return
            const opts = activeRow.options || []
            const cur = filters[activeRow.id] ?? opts[0]?.id
            const idx = opts.findIndex(o => o.id === cur)
            const next = opts[Math.max(0, idx - 1)]
            if (next) onFilterChange(activeRow.id, next.id)
        },
        [XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT]: () => {
            if (editingSearchId) return
            if (!activeRow) return
            if (activeRow.type === 'chip-multi') {
                const opts = activeRow.options || []
                setChipIndexByRow(prev => ({ ...prev, [activeRow.id]: Math.min(opts.length - 1, activeChipIndex + 1) }))
                return
            }
            if (activeRow.type !== 'select') return
            const opts = activeRow.options || []
            const cur = filters[activeRow.id] ?? opts[0]?.id
            const idx = opts.findIndex(o => o.id === cur)
            const next = opts[Math.min(opts.length - 1, idx + 1)]
            if (next) onFilterChange(activeRow.id, next.id)
        },
        [XBOX_GAMEPAD_BUTTONS.A]: () => {
            if (editingSearchId) return
            if (!activeRow) return
            if (activeRow.type === 'action') { activeRow.onAction?.(); return }
            if (activeRow.type === 'chip-multi') {
                const option = (activeRow.options || [])[activeChipIndex]
                if (option) toggleChipValue(activeRow, option.id)
                return
            }
            if (activeRow.type === 'search') {
                setEditingSearchId(activeRow.id)
                window.requestAnimationFrame(() => {
                    const input = searchInputRefs.current[activeRow.id]
                    input?.focus()
                    input?.select()
                })
                return
            }
            // Cycle select forward on A
            const opts = activeRow.options || []
            const cur = filters[activeRow.id] ?? opts[0]?.id
            const idx = opts.findIndex(o => o.id === cur)
            const next = opts[(idx + 1) % opts.length]
            if (next) onFilterChange(activeRow.id, next.id)
        },
        [XBOX_GAMEPAD_BUTTONS.Y]: closeIfSettled,
        [XBOX_GAMEPAD_BUTTONS.B]: () => {
            if (editingSearchId) {
                setEditingSearchId('')
                searchInputRefs.current[editingSearchId]?.blur()
                return
            }
            onClose()
        },
    }), [activeChipIndex, activeRow, closeIfSettled, editingSearchId, filters, onClose, onFilterChange, rows.length])

    useLifeSyncGamepadInput({ enabled: controllerEnabled, handlers, repeatableButtons: [XBOX_GAMEPAD_BUTTONS.DPAD_UP, XBOX_GAMEPAD_BUTTONS.DPAD_DOWN] })

    return (
        <>
            {/* Backdrop  tap outside to close, but not while the search keyboard is open */}
            <M.div
                className="absolute inset-0 z-20 bg-black/50"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => { if (!editingSearchId) onClose() }}
            />

            {/* Panel */}
            <M.div
                className="absolute inset-y-0 right-0 z-30 flex w-[320px] flex-col border-l border-white/8 bg-[#0c0c12]/97 shadow-[-30px_0_80px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
                initial={{ x: 320 }}
                animate={{ x: 0 }}
                exit={{ x: 320 }}
                transition={{ type: 'spring', stiffness: 380, damping: 34 }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="relative flex items-center justify-between border-b border-white/8 px-6 py-5">
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--mx-color-c6ff00)/50 to-transparent" aria-hidden />
                    <div className="flex items-center gap-3">
                        <span className="h-6 w-1 rounded-full bg-(--mx-color-c6ff00)" aria-hidden />
                        <h3 className="text-[20px] font-black tracking-tight text-white">{title}</h3>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] font-bold text-white/30">
                        <span className="rounded-md bg-(--mx-color-c6ff00) px-1.5 py-0.5 text-[9px] font-black text-black">{tvHintLabel('Y', inputSource)}</span>
                        Close
                    </div>
                </div>

                {/* Filter rows */}
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                    {rows.map((row, i) => {
                        const isFocused = i === rowIndex
                        if (row.type === 'action') {
                            return (
                                <button
                                    key={row.id}
                                    type="button"
                                    onClick={() => row.onAction?.()}
                                    className={`flex w-full items-center justify-between rounded-2xl px-4 py-3.5 text-left transition-all ${
                                        isFocused
                                            ? 'bg-(--mx-color-c6ff00) text-black scale-[1.01]'
                                            : 'bg-white/5 text-white/70'
                                    }`}
                                >
                                    <span className="text-[15px] font-bold">{row.label}</span>
                                    {isFocused && (
                                        <span className="rounded bg-black/20 px-2 py-0.5 text-[10px] font-black">A</span>
                                    )}
                                </button>
                            )
                        }

                        if (row.type === 'search') {
                            const curValue = filters[row.id] || ''
                            const editing = editingSearchId === row.id
                            return (
                                <div
                                    key={row.id}
                                    className={`rounded-2xl px-4 py-3.5 transition-all ${
                                        isFocused ? 'bg-white/10 ring-2 ring-(--mx-color-c6ff00)/60' : 'bg-white/5'
                                    }`}
                                >
                                    <p className={`mb-2 text-[11px] font-bold uppercase tracking-wider ${isFocused ? 'text-(--mx-color-c6ff00)' : 'text-white/40'}`}>
                                        {row.label}
                                    </p>
                                    <input
                                        ref={(node) => { searchInputRefs.current[row.id] = node }}
                                        type="search"
                                        value={curValue}
                                        readOnly={!editing}
                                        placeholder={row.placeholder || 'Search...'}
                                        onClick={() => {
                                            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
                                            setEditingSearchId(row.id)
                                        }}
                                        onFocus={() => {
                                            if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current)
                                            setEditingSearchId(row.id)
                                        }}
                                        onBlur={() => {
                                            blurTimeoutRef.current = setTimeout(() => {
                                                setEditingSearchId(current => current === row.id ? '' : current)
                                            }, 150)
                                        }}
                                        onChange={(event) => onFilterChange(row.id, event.target.value)}
                                        className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-[14px] font-semibold text-white outline-none placeholder:text-white/25 focus:border-(--mx-color-c6ff00)/60"
                                    />
                                    <p className="mt-2 text-[10px] font-semibold text-white/25">
                                        {editing
                                            ? (inputSource === 'keyboard' ? 'Typing enabled · click away to finish' : 'Typing enabled · B closes keyboard focus')
                                            : `Press ${tvHintLabel('A', inputSource)} to type`}
                                    </p>
                                </div>
                            )
                        }

                        const opts = row.options || []
                        const curValue = filters[row.id] ?? (row.type === 'chip-multi' ? [] : opts[0]?.id)
                        const curLabel = opts.find(o => o.id === curValue)?.label ?? curValue

                        return (
                            <div
                                key={row.id}
                                className={`rounded-2xl px-4 py-3.5 transition-all ${
                                    isFocused ? 'bg-white/10 ring-2 ring-(--mx-color-c6ff00)/60' : 'bg-white/5'
                                }`}
                            >
                                <p className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${isFocused ? 'text-(--mx-color-c6ff00)' : 'text-white/40'}`}>
                                    {row.label}
                                </p>
                                {isFocused && row.type !== 'chip-multi' && (
                                    <div className="mb-2 flex items-center justify-center gap-4 text-[12px] font-black text-white/35">
                                        <span>←</span>
                                        <span>{curLabel}</span>
                                        <span>→</span>
                                    </div>
                                )}
                                {isFocused && row.type === 'chip-multi' && (
                                    <div className="mb-2 flex items-center justify-center gap-4 text-[12px] font-black text-white/35">
                                        <span>←</span>
                                        <span>A toggle</span>
                                        <span>→</span>
                                    </div>
                                )}
                                <div className="flex flex-wrap gap-2">
                                    {opts.map((o, optionIndex) => {
                                        const selected = row.type === 'chip-multi'
                                            ? (Array.isArray(curValue) && curValue.includes(o.id))
                                            : o.id === curValue
                                        const chipFocused = row.type === 'chip-multi' && isFocused && activeChipIndex === optionIndex
                                        return (
                                            <button
                                                key={o.id}
                                                type="button"
                                                data-focused-filter-chip={chipFocused ? 'true' : undefined}
                                                onClick={() => row.type === 'chip-multi' ? toggleChipValue(row, o.id) : onFilterChange(row.id, o.id)}
                                                className={`rounded-full px-3 py-1.5 text-[12px] font-black transition-all ${
                                                    selected
                                                        ? 'bg-(--mx-color-c6ff00) text-black'
                                                        : 'bg-white/8 text-white/55'
                                                } ${isFocused && selected ? 'ring-2 ring-white/30' : ''} ${chipFocused ? 'scale-[1.08] ring-2 ring-(--mx-color-c6ff00)/80' : ''}`}
                                            >
                                                {o.label}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )
                    })}
                </div>

                {/* Footer hint */}
                <div className="border-t border-white/8 px-6 py-4">
                    <p className="text-[11px] text-white/25 text-center">{`↑↓ navigate · ← → change · ${tvHintLabel('A', inputSource)} select/type · ${tvHintLabel('B', inputSource)} back`}</p>
                </div>
            </M.div>
        </>
    )
}
