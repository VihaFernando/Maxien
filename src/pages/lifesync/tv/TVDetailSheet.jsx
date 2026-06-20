import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useLifeSyncGamepadInput from '../../../hooks/useLifeSyncGamepadInput'
import useControllerSupportEnabled from '../../../hooks/useControllerSupportEnabled'
import { XBOX_GAMEPAD_BUTTONS } from '../../../lib/lifeSyncControllerInput'
import { lifesyncFetch } from '../../../lib/lifesyncApi'
import useLifeSyncInputSource from '../../../hooks/useLifeSyncInputSource'
import { tvHintLabel } from '../../../lib/lifeSyncKeyboardGamepad'
import {
    MotionDiv,
    lifeSyncDetailSheetEnterInitial,
    lifeSyncDetailSheetEnterAnimate,
    lifeSyncDetailSheetExitVariant,
    lifeSyncDetailSheetMainTransition,
    lifeSyncDetailBackdropFadeTransition,
    lifeSyncDetailOverlayFadeTransition,
} from '../../../lib/lifesyncMotion'

/**
 * item shape:
 * {
 *   type: 'anime' | 'manga' | 'hentai',
 *   title: string,
 *   imageUrl: string,
 *   description?: string,
 *   badge?: string,
 *   chips?: string[],
 *   slug?: string,          // anime slug
 *   mangaId?: string,       // manga id
 *   source?: string,        // manga source
 *   lastChapterId?: string, // resume chapter
 *   series?: object,        // hentai series object with episodes[]
 *   navigateTo: string,     // fallback route
 *   navigateState?: object,
 * }
 *
 * onOpenPlayer: ({ type, ...playerProps }) => void   opens TV reader/player
 * onClose: () => void
 */
export function TVDetailSheet({ item, onClose, onOpenPlayer }) {
    const controllerEnabled = useControllerSupportEnabled()
    const inputSource = useLifeSyncInputSource()
    const [detail, setDetail] = useState(null)
    const [detailLoading, setDetailLoading] = useState(false)
    const [actionFocus, setActionFocus] = useState(0) // 0=Play selected 1=Cancel
    const [pickerIndex, setPickerIndex] = useState(0)
    const [chapterSortDir, setChapterSortDir] = useState('asc')
    const [progressChapterId, setProgressChapterId] = useState('')
    const [statusPickerOpen, setStatusPickerOpen] = useState(false)
    const [statusPickerIndex, setStatusPickerIndex] = useState(0)
    const [statusUpdating, setStatusUpdating] = useState(false)
    const cancelRef = useRef(false)
    const openedAtRef = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now())

    // Fetch richer detail data based on type
    useEffect(() => {
        if (!item) return
        cancelRef.current = false
        setDetail(null)
        setPickerIndex(0)
        setActionFocus(0)
        setChapterSortDir('asc')
        setProgressChapterId('')
        setStatusPickerOpen(false)
        setStatusPickerIndex(0)
        setStatusUpdating(false)
        openedAtRef.current = typeof performance !== 'undefined' ? performance.now() : Date.now()

        const load = async () => {
            setDetailLoading(true)
            try {
                if (item.type === 'anime' && item.slug) {
                    const data = await lifesyncFetch(
                        `/api/v1/anime/stream/info/by-slug/${encodeURIComponent(item.slug)}?view=full`
                    )
                    if (!cancelRef.current) setDetail(data?.data || data || null)
                } else if (item.type === 'manga' && item.mangaId && item.source) {
                    const data = await lifesyncFetch(
                        `/api/v1/manga/${item.source}/info/${encodeURIComponent(item.mangaId)}?view=full`
                    )
                    if (!cancelRef.current) setDetail(data || null)
                } else if (item.type === 'hentai' && item.slug) {
                    const data = await lifesyncFetch(
                        `/api/v1/hentai/watchhentai/detail?slug=${encodeURIComponent(item.slug)}&view=full`
                    )
                    if (!cancelRef.current) setDetail(data || null)
                }
            } catch { /* ignore  fall back to item data */ }
            finally { if (!cancelRef.current) setDetailLoading(false) }
        }
        void load()
        return () => { cancelRef.current = true }
    }, [item?.slug, item?.mangaId, item?.source, item?.type])

    useEffect(() => {
        if (!(item?.type === 'manga' && item.mangaId && item.source)) return
        let cancelled = false
        const loadProgress = async () => {
            try {
                const params = new URLSearchParams({
                    view: 'standard',
                    sortBy: 'updatedAt',
                    order: 'desc',
                    page: '1',
                    limit: '100',
                    source: item.source,
                })
                const data = await lifesyncFetch(`/api/v1/progress?${params.toString()}`)
                if (cancelled) return
                const rows = Array.isArray(data) ? data : (Array.isArray(data?.entries) ? data.entries : [])
                const match = rows.find((row) => (
                    String(row?.mangaId || '').trim() === String(item.mangaId).trim()
                    && String(row?.source || '').trim().toLowerCase() === String(item.source).trim().toLowerCase()
                ))
                const chapterId = String(match?.lastChapterId || match?.locator?.chapterId || '').trim()
                if (chapterId) setProgressChapterId(chapterId)
            } catch {
                // Progress is optional; the detail sheet still works without it.
            }
        }
        void loadProgress()
        return () => { cancelled = true }
    }, [item?.mangaId, item?.source, item?.type])

    const playableItems = useMemo(() => {
        if (item?.type === 'anime') {
            return Array.isArray(detail?.episodes) ? detail.episodes.map((ep, i) => ({
                id: ep?.episodeId || ep?.id,
                label: ep?.title || `Episode ${ep?.number ?? i + 1}`,
                badge: `EP ${ep?.number ?? i + 1}`,
                raw: {
                    episodeId: ep?.episodeId || ep?.id,
                    title: ep?.title || `Episode ${i + 1}`,
                    number: ep?.number ?? i + 1,
                    hasDub: ep?.hasDub,
                    hasSub: ep?.hasSub,
                },
            })).filter(row => row.id) : []
        }
        if (item?.type === 'manga') {
            const chapters = Array.isArray(detail?.chapters) ? [...detail.chapters] : []
            chapters.sort((a, b) => {
                const chapterA = Number.parseFloat(a?.chapter ?? a?.number ?? a?.label ?? 0)
                const chapterB = Number.parseFloat(b?.chapter ?? b?.number ?? b?.label ?? 0)
                const safeA = Number.isFinite(chapterA) ? chapterA : 0
                const safeB = Number.isFinite(chapterB) ? chapterB : 0
                return chapterSortDir === 'asc' ? safeA - safeB : safeB - safeA
            })
            return chapters.map((chapter, i) => ({
                id: chapter?.id,
                label: chapter?.title || chapter?.name || chapter?.chapter || `Chapter ${i + 1}`,
                badge: chapter?.chapter ? `CH ${chapter.chapter}` : `CH ${i + 1}`,
                raw: chapter,
            })).filter(row => row.id)
        }
        if (item?.type === 'hentai') {
            const episodes = Array.isArray(detail?.episodes) && detail.episodes.length > 0
                ? detail.episodes
                : (Array.isArray(item?.series?.episodes) ? item.series.episodes : [])
            return episodes.map((ep, i) => ({
                id: ep?.slug || ep?.episodeId || ep?.id || `${i}`,
                label: ep?.title || `Episode ${i + 1}`,
                badge: `EP ${i + 1}`,
                raw: ep,
            }))
        }
        return []
    }, [chapterSortDir, detail?.chapters, detail?.episodes, item])

    useEffect(() => {
        setPickerIndex(prev => Math.max(0, Math.min(playableItems.length - 1, prev)))
    }, [playableItems.length])

    const resumeChapterId = item?.type === 'manga'
        ? String(item.lastChapterId || progressChapterId || '').trim()
        : ''

    useEffect(() => {
        if (!playableItems.length) return
        if (item?.type === 'manga' && resumeChapterId) {
            const idx = playableItems.findIndex(row => String(row.id) === resumeChapterId)
            if (idx >= 0) setPickerIndex(idx)
        } else if (item?.type === 'anime' && item.lastEpisodeNumber != null) {
            const idx = playableItems.findIndex(row => Number(row.raw?.number) === Number(item.lastEpisodeNumber))
            if (idx >= 0) setPickerIndex(idx)
        }
    }, [item?.lastEpisodeNumber, item?.type, playableItems, resumeChapterId])

    const handlePlay = useCallback((explicitIndex = pickerIndex) => {
        if (!item) return

        if (item.type === 'anime') {
            const episodes = playableItems.map(row => row.raw)
            onOpenPlayer({ type: 'anime', animeId: item.slug, episodes, initialEpisodeIndex: Math.max(0, explicitIndex) })
        } else if (item.type === 'manga') {
            const chapters = playableItems.map(row => row.raw)
            const selectedChapter = playableItems[explicitIndex]?.raw
            const chapterId = selectedChapter?.id || resumeChapterId || (chapters[0]?.id ? String(chapters[0].id) : '')
            if (chapterId) {
                onOpenPlayer({ type: 'manga', mangaId: item.mangaId, chapterId, source: item.source, allChapters: chapters })
            }
        } else if (item.type === 'hentai') {
            const series = detail ? { ...item.series, ...detail, episodes: playableItems.map(row => row.raw) } : { ...item.series, episodes: playableItems.map(row => row.raw) }
            if (series) onOpenPlayer({ type: 'hentai', series, initialEpisodeIndex: Math.max(0, explicitIndex) })
        }
        onClose()
    }, [item, onClose, onOpenPlayer, pickerIndex, playableItems, resumeChapterId])

    const statusOptions = useMemo(() => {
        if (item?.type === 'manga') {
            return [
                { id: '', label: 'Clear status' },
                { id: 'reading', label: 'Reading' },
                { id: 'on_hold', label: 'On hold' },
                { id: 'completed', label: 'Completed' },
                { id: 'dropped', label: 'Dropped' },
                { id: 'plan_to_read', label: 'Plan to read' },
                { id: 're_reading', label: 'Re-reading' },
            ]
        }
        if (item?.type === 'anime') {
            return [
                { id: '', label: 'Clear status' },
                { id: 'watching', label: 'Watching' },
                { id: 'completed', label: 'Completed' },
                { id: 'dropped', label: 'Dropped' },
            ]
        }
        return []
    }, [item?.type])

    const openStatusPicker = useCallback(() => {
        if (!statusOptions.length) return
        setStatusPickerIndex(0)
        setStatusPickerOpen(true)
    }, [statusOptions.length])

    const applyStatusChange = useCallback(async (statusValue) => {
        if (!item || statusUpdating) return
        setStatusUpdating(true)
        try {
            if (item.type === 'manga' && item.mangaId && item.source) {
                const chapterId = String(
                    playableItems[pickerIndex]?.id || resumeChapterId || item.lastChapterId || ''
                ).trim()
                await lifesyncFetch('/api/v1/progress', {
                    method: 'POST',
                    json: {
                        bookId: `${item.source}:${item.mangaId}`,
                        source: item.source,
                        mangaId: item.mangaId,
                        progressPct: 0,
                        locator: { chapterId },
                        updatedAt: new Date().toISOString(),
                        status: { readingStatus: statusValue || null },
                    },
                })
            } else if (item.type === 'anime' && item.slug) {
                await lifesyncFetch(`/api/v1/anime/watch-progress/${encodeURIComponent(item.slug)}`, {
                    method: 'PATCH',
                    json: { status: statusValue || null },
                }).catch(() => lifesyncFetch('/api/v1/anime/watch-progress', {
                    method: 'POST',
                    json: { animeId: item.slug, status: statusValue || null },
                }))
            }
        } catch {
            // Best-effort status update; ignore errors to avoid blocking the popup.
        } finally {
            setStatusUpdating(false)
            setStatusPickerOpen(false)
        }
    }, [item, pickerIndex, playableItems, resumeChapterId, statusUpdating])

    const canUseOpeningSensitiveAction = useCallback(() => {
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
        return now - openedAtRef.current >= 420
    }, [])

    const handlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.DPAD_LEFT]: () => setActionFocus(0),
        [XBOX_GAMEPAD_BUTTONS.DPAD_RIGHT]: () => setActionFocus(1),
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => setPickerIndex(prev => Math.max(0, prev - 1)),
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => setPickerIndex(prev => Math.min(Math.max(0, playableItems.length - 1), prev + 1)),
        [XBOX_GAMEPAD_BUTTONS.LB]: () => { if (item?.type === 'manga') setChapterSortDir('asc') },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => { if (item?.type === 'manga') setChapterSortDir('desc') },
        [XBOX_GAMEPAD_BUTTONS.Y]: () => {
            if ((item?.type === 'manga' || item?.type === 'anime') && canUseOpeningSensitiveAction()) {
                openStatusPicker()
            }
        },
        [XBOX_GAMEPAD_BUTTONS.A]: () => {
            const now = typeof performance !== 'undefined' ? performance.now() : Date.now()
            if (now - openedAtRef.current < 360) return
            if (actionFocus === 0) handlePlay()
            else onClose()
        },
        [XBOX_GAMEPAD_BUTTONS.B]: () => onClose(),
    }), [actionFocus, canUseOpeningSensitiveAction, handlePlay, item?.type, onClose, openStatusPicker])

    const statusHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () => setStatusPickerIndex(prev => Math.max(0, prev - 1)),
        [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () => setStatusPickerIndex(prev => Math.min(Math.max(0, statusOptions.length - 1), prev + 1)),
        [XBOX_GAMEPAD_BUTTONS.A]: () => {
            const selected = statusOptions[statusPickerIndex]
            if (selected) void applyStatusChange(selected.id)
        },
        [XBOX_GAMEPAD_BUTTONS.B]: () => setStatusPickerOpen(false),
    }), [applyStatusChange, statusOptions, statusPickerIndex])

    useLifeSyncGamepadInput({
        enabled: controllerEnabled && Boolean(item) && !statusPickerOpen,
        handlers,
        repeatableButtons: [XBOX_GAMEPAD_BUTTONS.DPAD_UP, XBOX_GAMEPAD_BUTTONS.DPAD_DOWN],
    })

    useLifeSyncGamepadInput({
        enabled: controllerEnabled && statusPickerOpen,
        handlers: statusHandlers,
        repeatableButtons: [XBOX_GAMEPAD_BUTTONS.DPAD_UP, XBOX_GAMEPAD_BUTTONS.DPAD_DOWN],
    })

    useEffect(() => {
        document.querySelector('[data-focused-tv-detail-row="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [pickerIndex])

    if (!item) return null

    // Merge item + fetched detail
    const title = item.title
    const description = detail?.synopsis || detail?.description || item.description || ''
    const imageUrl = item.imageUrl
    const chips = [...(item.chips || [])]

    // Anime detail chips
    if (item.type === 'anime' && detail) {
        if (detail.status && !chips.includes(detail.status)) chips.unshift(detail.status)
        if ((detail.type || detail.media_type) && !chips.includes(detail.type || detail.media_type)) chips.unshift(detail.type || detail.media_type)
    }
    // Manga detail chips
    if (item.type === 'manga' && detail) {
        if (detail.status && !chips.includes(detail.status)) chips.unshift(detail.status)
        const chapCount = Array.isArray(detail.chapters) ? detail.chapters.length : null
        if (chapCount) chips.push(`${chapCount} ch`)
    }
    // Hentai detail chips
    if (item.type === 'hentai' && detail) {
        const epCount = Array.isArray(detail.episodes) ? detail.episodes.length : null
        if (epCount) chips.push(`${epCount} ep`)
        const genres = Array.isArray(detail.genres) ? detail.genres.slice(0, 3) : []
        chips.push(...genres.map(g => String(g.label || g)).filter(Boolean))
    }

    const ctaLabel = item.type === 'manga' ? 'Read' : 'Watch'
    const listTitle = item.type === 'manga' ? 'Chapters' : 'Episodes'
    const badgeText = item.badge || null

    return (
        <MotionDiv
            className="absolute inset-0 z-20 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={lifeSyncDetailOverlayFadeTransition}
            onClick={onClose}
        >
            <MotionDiv
                className="absolute inset-0 bg-black/75 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={lifeSyncDetailBackdropFadeTransition}
            />

            <MotionDiv
                className="relative z-10 flex w-full max-w-5xl flex-col overflow-hidden rounded-[30px] bg-linear-to-b from-[#13131b] to-[#0b0b10] shadow-[0_50px_140px_-30px_rgba(0,0,0,0.95)] ring-1 ring-white/10"
                style={{ maxHeight: '85vh' }}
                initial={lifeSyncDetailSheetEnterInitial}
                animate={lifeSyncDetailSheetEnterAnimate}
                exit={lifeSyncDetailSheetExitVariant}
                transition={lifeSyncDetailSheetMainTransition}
                onClick={e => e.stopPropagation()}
            >
                {/* Hero */}
                <div className="relative shrink-0">
                    {imageUrl && (
                        <div className="absolute inset-0 overflow-hidden">
                            <img src={imageUrl} alt="" className="h-full w-full scale-110 object-cover opacity-40 blur-2xl saturate-[1.2]" referrerPolicy="no-referrer" />
                        </div>
                    )}
                    <div className="absolute inset-0 bg-linear-to-b from-black/20 via-[#0e0e14]/60 to-[#0f0f16]" />
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-(--mx-color-c6ff00)/60 to-transparent" aria-hidden />

                    <div className="relative flex min-h-[260px] items-end gap-8 p-8">
                        {imageUrl && (
                            <div className="hidden shrink-0 overflow-hidden rounded-2xl shadow-[0_30px_70px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/15 sm:block" style={{ width: 160, aspectRatio: '2/3' }}>
                                <img src={imageUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                            </div>
                        )}
                        <div className="min-w-0 flex-1 pb-2">
                            {chips.length > 0 && (
                                <div className="mb-3 flex flex-wrap gap-2">
                                    {chips.slice(0, 6).map((chip, i) => (
                                        <span key={i} className="rounded-full bg-white/8 px-3 py-1 text-[12px] font-bold text-white/80 ring-1 ring-white/12 backdrop-blur-sm">
                                            {chip}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <h2 className="line-clamp-2 text-[40px] font-black leading-[1.05] tracking-tight text-white">{title}</h2>
                            {badgeText && (
                                <p className="mt-2 inline-flex items-center gap-2 text-[15px] font-black text-(--mx-color-c6ff00)">                                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-(--mx-color-c6ff00)" aria-hidden />
                                    {badgeText}
                                </p>
                            )}
                            {description && (
                                <p className="mt-3 line-clamp-3 max-w-3xl text-[14px] leading-relaxed text-white/55">{description}</p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Episode / chapter picker */}
                <div className="min-h-0 flex-1 px-8 pb-5">
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/45">{listTitle}</p>
                        <div className="flex items-center gap-3">
                            {playableItems.length > 0 && (
                                <p className="text-[12px] font-semibold text-white/35">
                                    {item.type === 'manga' && resumeChapterId ? 'Resume focused · ' : ''}{pickerIndex + 1} / {playableItems.length}
                                </p>
                            )}
                            {statusOptions.length > 0 && (
                                <button
                                    type="button"
                                    onClick={openStatusPicker}
                                    className="rounded-xl bg-white/8 px-3 py-2 text-[11px] font-black text-white/70"
                                >
                                    Update status
                                </button>
                            )}
                        </div>
                    </div>
                    {item.type === 'manga' && playableItems.length > 0 && (
                        <div className="mb-3 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setChapterSortDir('asc')}
                                className={`rounded-xl px-3 py-2 text-[12px] font-black ${chapterSortDir === 'asc' ? 'bg-[var(--mx-color-c6ff00)] text-black' : 'bg-white/8 text-white/55'}`}
                            >
                                {'First -> last'}
                            </button>
                            <button
                                type="button"
                                onClick={() => setChapterSortDir('desc')}
                                className={`rounded-xl px-3 py-2 text-[12px] font-black ${chapterSortDir === 'desc' ? 'bg-[var(--mx-color-c6ff00)] text-black' : 'bg-white/8 text-white/55'}`}
                            >
                                {'Last -> first'}
                            </button>
                        </div>
                    )}
                    <div className="max-h-[220px] overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                        {detailLoading ? (
                            <div className="grid grid-cols-2 gap-2">
                                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-white/8" />)}
                            </div>
                        ) : playableItems.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {playableItems.map((row, i) => (
                                    <button
                                        key={`${row.id}-${i}`}
                                        type="button"
                                        data-focused-tv-detail-row={pickerIndex === i ? 'true' : undefined}
                                        onClick={() => handlePlay(i)}
                                        className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all ${
                                            pickerIndex === i
                                                ? 'bg-(--mx-color-c6ff00) text-black shadow-[0_8px_24px_-10px_rgba(198,255,0,0.55)]'
                                                : 'bg-white/5 text-white/70 ring-1 ring-white/6'
                                        }`}
                                    >
                                        <span className={`shrink-0 rounded-lg px-2 py-1 text-[11px] font-black tabular-nums ${pickerIndex === i ? 'bg-black/15' : 'bg-white/10 text-white/50'}`}>
                                            {row.badge}
                                        </span>
                                        <span className="min-w-0 flex-1 truncate text-[13px] font-bold">{row.label}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="rounded-xl bg-white/6 px-4 py-3 text-[13px] font-semibold text-white/40">
                                No {listTitle.toLowerCase()} found.
                            </p>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4 px-8 pb-8 pt-2">
                    <button
                        type="button"
                        onClick={handlePlay}
                        disabled={detailLoading || playableItems.length === 0}
                        className={`flex min-h-[64px] flex-1 items-center justify-center gap-3 rounded-2xl text-[18px] font-black transition-all disabled:opacity-50 ${
                            actionFocus === 0
                                ? 'bg-(--mx-color-c6ff00) text-black scale-[1.02] shadow-[0_0_0_4px_rgba(198,255,0,0.25),0_18px_50px_-12px_rgba(198,255,0,0.45)]'
                                : 'bg-white/10 text-white ring-1 ring-white/10'
                        }`}
                    >
                        {detailLoading ? (
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        ) : (
                            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                        {ctaLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`flex min-h-[64px] items-center justify-center rounded-2xl px-10 text-[18px] font-bold transition-all ${
                            actionFocus === 1
                                ? 'bg-white/15 text-white scale-[1.02] ring-2 ring-white/30'
                                : 'bg-white/5 text-white/50 ring-1 ring-white/8'
                        }`}
                    >
                        Cancel
                    </button>
                </div>

                {/* Input hint  follows active device (controller or keyboard) */}
                <div className="absolute right-5 top-5 flex items-center gap-2 rounded-xl bg-black/50 px-3 py-2 text-[11px] text-white/50 backdrop-blur-sm">
                    <span className="flex h-5 min-w-5 items-center justify-center rounded bg-green-600 px-1 text-[9px] font-black text-white">{tvHintLabel('A', inputSource)}</span> Confirm
                    <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded bg-red-600 px-1 text-[9px] font-black text-white">{tvHintLabel('B', inputSource)}</span> Back
                    {(item.type === 'manga' || item.type === 'anime') && (
                        <>
                            <span className="ml-1 flex h-5 min-w-5 items-center justify-center rounded bg-(--mx-color-c6ff00) px-1 text-[9px] font-black text-black">{tvHintLabel('Y', inputSource)}</span> Status
                        </>
                    )}
                    {item.type === 'manga' && (
                        <>
                            <span className="ml-1 flex h-5 min-w-6 items-center justify-center rounded bg-white/15 px-1 text-[9px] font-black text-white">{tvHintLabel('LB', inputSource)}</span> First
                            <span className="ml-1 flex h-5 min-w-6 items-center justify-center rounded bg-white/15 px-1 text-[9px] font-black text-white">{tvHintLabel('RB', inputSource)}</span> Last
                        </>
                    )}
                </div>
            </MotionDiv>

            {statusPickerOpen && statusOptions.length > 0 && (
                <div
                    className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex max-h-[60vh] w-[420px] flex-col rounded-[28px] bg-linear-to-b from-[#14141c] to-[#0c0c12] p-5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/10">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-[22px] font-black text-white">Set status</h3>
                            <p className="text-[11px] text-white/35">{`↑↓ select · ${tvHintLabel('A', inputSource)} apply · ${tvHintLabel('B', inputSource)} close`}</p>
                        </div>
                        <div className="min-h-0 flex-1 overflow-y-auto pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                            {statusOptions.map((option, index) => {
                                const focused = index === statusPickerIndex
                                return (
                                    <button
                                        key={option.id || 'clear'}
                                        type="button"
                                        onClick={() => applyStatusChange(option.id)}
                                        className={`mb-2 flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left transition-all ${
                                            focused
                                                ? 'bg-[var(--mx-color-c6ff00)] text-black'
                                                : 'bg-white/6 text-white/70'
                                        }`}
                                    >
                                        <span className="text-[14px] font-bold">{option.label}</span>
                                        {statusUpdating && focused && (
                                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}
        </MotionDiv>
    )
}
