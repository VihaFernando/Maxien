import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion as Motion, AnimatePresence } from 'framer-motion'
import { readStoredReduceAnimationsSetting } from '../../../lib/lifeSyncReduceMotion'
import { TVCard, TVCardSkeleton } from './TVCard'
import { useTVCardSelect } from './useTVCardSelect'

const LOW_END = readStoredReduceAnimationsSetting() === true
const HERO_ROTATE_MS = 7000

// ─── Carousel dots ────────────────────────────────────────────────────────────

function CarouselDots({ count, active, accent }) {
    if (count <= 1) return null
    return (
        <div className="flex items-center gap-1.5">
            {Array.from({ length: count }).map((_, i) => (
                <span
                    key={i}
                    className="rounded-full transition-all duration-300"
                    style={{
                        width: i === active ? 20 : 6,
                        height: 6,
                        background: i === active ? (accent || 'var(--mx-color-c6ff00)') : 'rgba(255,255,255,0.25)',
                    }}
                    aria-hidden
                />
            ))}
        </div>
    )
}

// ─── Hero carousel ────────────────────────────────────────────────────────────

const TVHeroCarousel = memo(function TVHeroCarousel({ items, focused, onSelect, accent }) {
    const [idx, setIdx] = useState(0)
    const timerRef = useRef(null)

    const startTimer = useCallback(() => {
        clearInterval(timerRef.current)
        if (LOW_END || items.length <= 1) return
        timerRef.current = setInterval(() => setIdx(i => (i + 1) % items.length), HERO_ROTATE_MS)
    }, [items.length])

    useEffect(() => {
        setIdx(0)
        startTimer()
        return () => clearInterval(timerRef.current)
    }, [startTimer])

    const item = items[idx] || null

    const handlePrev = useCallback((e) => {
        e.stopPropagation()
        setIdx(i => (i - 1 + items.length) % items.length)
        startTimer()
    }, [items.length, startTimer])

    const handleNext = useCallback((e) => {
        e.stopPropagation()
        setIdx(i => (i + 1) % items.length)
        startTimer()
    }, [items.length, startTimer])

    if (!item) return null

    return (
        <div
            className={`group relative w-full overflow-hidden rounded-[22px] transition-all duration-200 ${focused ? 'ring-2 shadow-[0_0_0_4px_rgba(198,255,0,0.18)]' : 'ring-1 ring-white/8'}`}
            style={{ aspectRatio: '16/7', cursor: 'pointer', ringColor: focused ? (accent || 'var(--mx-color-c6ff00)') : undefined }}
            onClick={() => item && onSelect(item)}
            data-focused-card={focused ? 'true' : undefined}
        >
            {/* Slides */}
            <AnimatePresence mode="crossfade">
                <Motion.div
                    key={idx}
                    className="absolute inset-0"
                    initial={LOW_END ? false : { opacity: 0, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={LOW_END ? {} : { opacity: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                >
                    {item.imageUrl ? (
                        <img
                            src={item.imageUrl}
                            alt={item.title || ''}
                            loading="eager"
                            className="absolute inset-0 h-full w-full object-cover"
                            style={{ objectPosition: item.aspectRatio === '16/9' ? 'center center' : 'center top' }}
                        />
                    ) : (
                        <div className="absolute inset-0 bg-linear-to-br from-white/5 to-white/2" />
                    )}
                </Motion.div>
            </AnimatePresence>

            {/* Scrims */}
            <div className="pointer-events-none absolute inset-0 bg-linear-to-r from-black/85 via-black/30 to-black/5" />
            <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />

            {/* Content */}
            <div className="absolute inset-0 flex flex-col justify-end p-8">
                <AnimatePresence mode="wait">
                    <Motion.div
                        key={idx}
                        initial={LOW_END ? false : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={LOW_END ? {} : { opacity: 0, y: -6 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {item.badge && (
                            <span className="mb-2 inline-flex w-fit items-center rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.2em] text-white/60 ring-1 ring-white/10">
                                {item.badge}
                            </span>
                        )}
                        <h2 className="line-clamp-2 text-[32px] font-black leading-tight tracking-tight text-white drop-shadow-lg">
                            {item.title}
                        </h2>
                        {item.description && (
                            <p className="mt-2 line-clamp-2 max-w-[55%] text-[13px] leading-relaxed text-white/60">
                                {item.description}
                            </p>
                        )}
                        {item.chips?.length > 0 && (
                            <div className="mt-3 flex gap-2">
                                {item.chips.slice(0, 3).map(chip => (
                                    <span key={chip} className="rounded-md bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/70">
                                        {chip}
                                    </span>
                                ))}
                            </div>
                        )}
                        <div className="mt-4 flex items-center gap-4">
                            {focused && (
                                <div className="flex items-center gap-2 text-[12px] font-bold text-(--mx-color-c6ff00)">
                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                                    </svg>
                                    Press A to open
                                </div>
                            )}
                            <CarouselDots count={items.length} active={idx} accent={accent} />
                        </div>
                    </Motion.div>
                </AnimatePresence>
            </div>

            {/* Prev / Next buttons (visible on hover / focus) */}
            {items.length > 1 && (
                <>
                    <button
                        type="button"
                        onClick={handlePrev}
                        className="absolute left-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white opacity-0 ring-1 ring-white/20 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                        aria-label="Previous"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
                    </button>
                    <button
                        type="button"
                        onClick={handleNext}
                        className="absolute right-4 top-1/2 z-10 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white opacity-0 ring-1 ring-white/20 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                        aria-label="Next"
                    >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
                    </button>
                </>
            )}
        </div>
    )
})

// ─── Row label ────────────────────────────────────────────────────────────────

function RowLabel({ label, accent }) {
    return (
        <div className="mb-4 flex items-center gap-3">
            <span
                className="h-5 w-1 rounded-full"
                style={{ background: accent || 'var(--mx-color-c6ff00)' }}
                aria-hidden
            />
            <h3 className="text-[16px] font-black uppercase tracking-[0.18em] text-white/70">{label}</h3>
        </div>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TVSectionHomePage({
    rows = [],
    heroItems,
    loading,
    focusPos,
    onItemSelect,
    onFocusedItemChange,
    onGridMetaChange,
    filterOpen,
    accent = 'var(--mx-color-c6ff00)',
    COLS = 5,
    hasMore = false,
}) {
    const heroPool = useMemo(
        () => (heroItems?.length ? heroItems : (rows[0]?.items || [])).slice(0, 8),
        [heroItems, rows],
    )

    // For keyboard nav the whole hero counts as 1 focus slot (row 0)
    const allRowItems = useMemo(() => rows.flatMap(r => r.items || []), [rows])
    const totalCount = allRowItems.length + (heroPool.length ? 1 : 0)

    useEffect(() => {
        onGridMetaChange?.({ count: totalCount, hasMore })
    }, [totalCount, hasMore, onGridMetaChange])

    // focusPos.row 0 = hero (the currently cycling slide), 1+ = content rows
    const focusedItem = useMemo(() => {
        if (filterOpen) return null
        if (focusPos.row === 0) return heroPool[0] || null
        const row = rows[focusPos.row - 1]
        return row?.items?.[focusPos.col] || null
    }, [filterOpen, focusPos, heroPool, rows])

    useEffect(() => {
        onFocusedItemChange?.(focusedItem)
    }, [focusedItem, onFocusedItemChange])

    // Single useTVCardSelect for all row items (hook must not be inside a loop)
    const allItems = useMemo(() => rows.flatMap(r => r.items || []), [rows])
    const rowOffsets = useMemo(() => {
        const offsets = []
        let offset = 0
        for (const row of rows) { offsets.push(offset); offset += (row.items?.length || 0) }
        return offsets
    }, [rows])
    const getSelectHandler = useTVCardSelect(allItems, onItemSelect)

    if (loading) {
        return (
            <div className="space-y-8">
                <div className="w-full animate-pulse overflow-hidden rounded-[22px] bg-white/5" style={{ aspectRatio: '16/7' }} />
                <div className="space-y-6">
                    <div className="h-4 w-32 animate-pulse rounded-full bg-white/10" />
                    <div className="grid grid-cols-5 gap-5">
                        {Array.from({ length: 5 }).map((_, i) => <TVCardSkeleton key={i} />)}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Hero carousel */}
            {heroPool.length > 0 && (
                <TVHeroCarousel
                    items={heroPool}
                    focused={!filterOpen && focusPos.row === 0}
                    onSelect={onItemSelect}
                    accent={accent}
                />
            )}

            {/* Content rows */}
            {rows.map((row, rowIdx) => (
                row.items?.length > 0 && (
                    <div key={row.label || rowIdx}>
                        <RowLabel label={row.label} accent={accent} />
                        <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}>
                            {row.items.map((item, colIdx) => {
                                const focused = !filterOpen && focusPos.row === rowIdx + 1 && focusPos.col === colIdx
                                const flatIdx = (rowOffsets[rowIdx] || 0) + colIdx
                                return (
                                    <div key={item.slug || item.mangaId || colIdx} data-focused-card={focused ? 'true' : undefined}>
                                        <TVCard
                                            imageUrl={item.imageUrl}
                                            title={item.title}
                                            badge={item.badge}
                                            subtitle={item.subtitle}
                                            ratingBadge={item.ratingBadge}
                                            score={item.score}
                                            aspectRatio={item.aspectRatio}
                                            focused={focused}
                                            onSelect={getSelectHandler(flatIdx)}
                                        />
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )
            ))}
        </div>
    )
}
