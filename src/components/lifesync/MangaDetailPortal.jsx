/**
 * Shared manga detail portal.
 *
 * Usage:
 *   const { openManga, portal } = useMangaDetailPortal({ onStartRead })
 *   // somewhere in JSX:
 *   {portal}
 *
 * `onStartRead(manga, chapter)` is called by the portal when the user taps a
 * chapter. Callers (home page, browse page) provide their own navigation logic.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'
import useLifeSyncGamepadInput from '../../hooks/useLifeSyncGamepadInput'
import { XBOX_GAMEPAD_BUTTONS } from '../../lib/lifeSyncControllerInput'
import { LifesyncMangaChapterListSkeleton } from './EpisodeLoadingSkeletons'
import { lifesyncFetch } from '../../lib/lifesyncApi'
import {
    AnimatePresence,
    lifeSyncDetailBackdropFadeTransition,
    lifeSyncDetailBodyRevealTransition,
    lifeSyncDetailOverlayFadeTransition,
    lifeSyncDetailSheetEnterAnimate,
    lifeSyncDetailSheetEnterInitial,
    lifeSyncDetailSheetExitVariant,
    lifeSyncDetailSheetMainTransition,
    lifeSyncSharedLayoutTransitionProps,
    MotionDiv,
} from '../../lib/lifesyncMotion'
import {
    compareChapters,
    formatChapterLabel,
    mangaImageProps,
    resolveMangaCoverDisplayUrl,
} from '../../lib/mangaChapterUtils'

// ── Helpers ───────────────────────────────────────────────────────────────────

function mangaCoverLayoutId(source, id) {
    return `lifesync-manga-cover-${String(source || 'roliascan')}-${String(id)}`
}

function mangaTagLabel(tag) {
    if (tag == null) return ''
    if (typeof tag === 'string') return tag
    if (typeof tag === 'object' && tag.name != null) return String(tag.name)
    return ''
}

function mangaTagKey(tag, index, prefix = '') {
    if (tag != null && typeof tag === 'object' && tag.id != null && String(tag.id) !== '') {
        return `${prefix}${String(tag.id)}`
    }
    const label = mangaTagLabel(tag)
    return `${prefix || 't'}-${index}-${label || 'tag'}`
}

// ── MangaDetail component ─────────────────────────────────────────────────────

function MangaDetail({
    manga,
    onClose,
    source,
    onStartRead,
    roliascanConnected,
    browseTranslatedLang = 'en',
    isLifeSyncConnected = false,
}) {
    const [detail, setDetail] = useState(null)
    const [metaBusy, setMetaBusy] = useState(false)
    const [chapters, setChapters] = useState(null)
    const [chapBusy, setChapBusy] = useState(false)
    const [currentChapterId, setCurrentChapterId] = useState('')
    const [descExpanded, setDescExpanded] = useState(false)
    const [chapterLang, setChapterLang] = useState(() =>
        browseTranslatedLang === 'all' ? 'all' : browseTranslatedLang,
    )
    const [chapterOrder, setChapterOrder] = useState('asc')
    const chapterListRef = useRef(null)
    const currentChapterButtonRef = useRef(null)
    const didAutoScrollCurrentChapterRef = useRef(false)

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        setChapterLang(browseTranslatedLang === 'all' ? 'all' : browseTranslatedLang)
    }, [manga?.id, browseTranslatedLang])

    useEffect(() => {
        setChapterOrder('asc')
    }, [manga?.id])

    useEffect(() => {
        didAutoScrollCurrentChapterRef.current = false
        setCurrentChapterId('')
    }, [manga?.id, manga?.source])
    /* eslint-enable react-hooks/set-state-in-effect */

    useEffect(() => {
        if (!manga?.id || !isLifeSyncConnected) return
        let cancelled = false
        const sourceHint = String(manga.source || source || '').trim().toLowerCase()
        ;(async () => {
            try {
                const params = new URLSearchParams({
                    view: 'standard',
                    sortBy: 'updatedAt',
                    order: 'desc',
                    page: '1',
                    limit: '100',
                })
                if (sourceHint) params.set('source', sourceHint)
                const data = await lifesyncFetch(`/api/v1/progress?${params.toString()}`)
                if (cancelled) return
                const rows = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.entries)
                      ? data.entries
                      : []
                const match = rows.find((row) => {
                    if (String(row?.mangaId || '').trim() !== String(manga.id)) return false
                    if (!sourceHint) return true
                    return String(row?.source || '').trim().toLowerCase() === sourceHint
                })
                const chapterId = String(match?.lastChapterId || '').trim()
                if (chapterId) setCurrentChapterId(chapterId)
            } catch {
                // ignore: current chapter highlight falls back to local detail payload
            }
        })()
        return () => {
            cancelled = true
        }
    }, [isLifeSyncConnected, manga?.id, manga?.source, source])

    /* eslint-disable react-hooks/set-state-in-effect */
    useEffect(() => {
        if (!manga?.id) return
        if ((manga.source || source) !== 'roliascan') return

        const hasChapterPayload = Array.isArray(manga.chapters)
        setDetail({ ...manga })
        setMetaBusy(false)

        if (hasChapterPayload) {
            setChapters({ data: [...manga.chapters] })
            setChapBusy(false)
            return
        }

        // Home page cards don't carry chapters — fetch full info from the API.
        setChapters(null)
        setChapBusy(true)
        let cancelled = false
        const id = String(manga.id)
        lifesyncFetch(`/api/v1/manga/roliascan/info/${encodeURIComponent(id)}?view=full`)
            .then((data) => {
                if (cancelled) return
                const list = Array.isArray(data?.chapters) ? data.chapters : []
                setChapters({ data: list })
                setDetail((prev) => ({
                    ...prev,
                    ...data,
                    id: data.id || id,
                    source: 'roliascan',
                    coverUrl: data.coverUrl || prev?.coverUrl,
                }))
            })
            .catch(() => {
                if (!cancelled) setChapters({ data: [] })
            })
            .finally(() => {
                if (!cancelled) setChapBusy(false)
            })
        return () => { cancelled = true }
    }, [manga, source])

    useEffect(() => {
        if (!manga?.id) return undefined
        const src = manga.source || source

        if (src === 'roliascan') return undefined

        if (src === 'mangadistrict') {
            setDetail(null)
            setChapters(null)
            setMetaBusy(true)
            setChapBusy(true)

            let cancelled = false
            const id = String(manga.id)

            lifesyncFetch(`/api/v1/manga/mangadistrict/meta/${encodeURIComponent(id)}?view=full`)
                .then((data) => {
                    if (cancelled) return
                    setDetail((prev) => ({ ...prev, ...data, id: data.id || id, source: 'mangadistrict' }))
                })
                .catch(() => {})
                .finally(() => { if (!cancelled) setMetaBusy(false) })

            lifesyncFetch(`/api/v1/manga/mangadistrict/info/${encodeURIComponent(id)}?view=full`)
                .then((data) => {
                    if (cancelled) return
                    const list = Array.isArray(data.chapters) ? data.chapters : []
                    setChapters({ data: list })
                })
                .catch(() => { if (!cancelled) setChapters({ data: [] }) })
                .finally(() => { if (!cancelled) setChapBusy(false) })

            return () => { cancelled = true }
        }

        if (src === 'mangadna') {
            setDetail(null)
            setChapters(null)
            setMetaBusy(true)
            setChapBusy(true)

            let cancelled = false
            const slug = String(manga.id)

            lifesyncFetch(`/api/v1/manga/mangadna/info/${encodeURIComponent(slug)}?view=full`)
                .then((data) => {
                    if (cancelled) return
                    setDetail({ ...data, id: data.id || slug, source: 'mangadna' })
                    const list = Array.isArray(data.chapters) ? data.chapters : []
                    setChapters({ data: list })
                })
                .catch(() => { if (!cancelled) setChapters({ data: [] }) })
                .finally(() => {
                    if (!cancelled) {
                        setMetaBusy(false)
                        setChapBusy(false)
                    }
                })

            return () => { cancelled = true }
        }

        setDetail(null)
        setChapters({ data: [] })
        setMetaBusy(false)
        setChapBusy(false)
        return undefined
    }, [manga?.id, manga?.source, source, roliascanConnected, chapterLang])
    /* eslint-enable react-hooks/set-state-in-effect */

    const chaptersInSeriesOrder = useMemo(() => {
        const list = chapters?.data ? [...chapters.data] : []
        list.sort(compareChapters)
        return list
    }, [chapters])

    const displayChapters = useMemo(() => {
        if (chapterOrder === 'desc') return [...chaptersInSeriesOrder].reverse()
        return chaptersInSeriesOrder
    }, [chaptersInSeriesOrder, chapterOrder])

    const highlightedChapterId =
        String(currentChapterId || '').trim() ||
        String(manga?.lastChapterId || detail?.lastChapterId || '').trim() ||
        ''

    const chapterSeriesIndex = useCallback(
        (ch) => {
            const i = chaptersInSeriesOrder.findIndex((c) => String(c?.id) === String(ch?.id))
            return i >= 0 ? i + 1 : 0
        },
        [chaptersInSeriesOrder],
    )

    useEffect(() => {
        if (didAutoScrollCurrentChapterRef.current) return
        if (chapBusy || !highlightedChapterId || displayChapters.length === 0) return
        const targetChapterExists = displayChapters.some(
            (ch) => String(ch?.id || '') === highlightedChapterId,
        )
        if (!targetChapterExists) return
        const listEl = chapterListRef.current
        const chapterEl = currentChapterButtonRef.current
        if (!listEl || !chapterEl) return
        didAutoScrollCurrentChapterRef.current = true
        const raf = requestAnimationFrame(() => {
            const top = chapterEl.offsetTop - listEl.clientHeight / 2 + chapterEl.clientHeight / 2
            listEl.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
        })
        return () => cancelAnimationFrame(raf)
    }, [chapBusy, displayChapters, highlightedChapterId])

    const [focusedChIndex, setFocusedChIndex] = useState(-1)
    const mangaDetailControllerEnabled = useControllerSupportEnabled()

    const detailChHandlers = useMemo(
        () => ({
            [XBOX_GAMEPAD_BUTTONS.DPAD_UP]: () =>
                setFocusedChIndex((prev) =>
                    Math.max(0, prev <= 0 ? displayChapters.length - 1 : prev - 1),
                ),
            [XBOX_GAMEPAD_BUTTONS.DPAD_DOWN]: () =>
                setFocusedChIndex((prev) => (prev + 1) % Math.max(1, displayChapters.length)),
            [XBOX_GAMEPAD_BUTTONS.A]: () => {
                const ch = displayChapters[focusedChIndex]
                const d = detail || manga
                const src = manga?.source || source
                const mm = d ? { ...d, id: d.id || manga?.id, source: src } : null
                if (focusedChIndex >= 0 && ch && mm) onStartRead(mm, ch)
            },
            [XBOX_GAMEPAD_BUTTONS.B]: () => { onClose?.() },
        }),
        [detail, displayChapters, focusedChIndex, manga, onClose, onStartRead, source],
    )

    useLifeSyncGamepadInput({
        enabled: mangaDetailControllerEnabled && Boolean(manga),
        handlers: detailChHandlers,
        repeatableButtons: [XBOX_GAMEPAD_BUTTONS.DPAD_UP, XBOX_GAMEPAD_BUTTONS.DPAD_DOWN],
    })

    useEffect(() => {
        if (focusedChIndex < 0) return
        document.querySelector('[data-focused-ep="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, [focusedChIndex])

    if (!manga) return null

    const coverLayoutId = mangaCoverLayoutId(manga.source || source, manga.id)
    const src = manga.source || source
    const d =
        src === 'mangadistrict' && detail
            ? { ...manga, ...detail, id: detail.id || manga.id }
            : detail || manga
    const mergedManga = { ...d, id: d.id || manga.id, source: src }
    const tagList = d.tags?.length ? d.tags : manga.tags
    const coverImg = resolveMangaCoverDisplayUrl(
        detail?.coverUrl || (metaBusy ? manga.coverUrl : d.coverUrl || manga.coverUrl),
        src,
    )
    const heroBannerUrl =
        resolveMangaCoverDisplayUrl(d.backgroundImageUrl || manga.backgroundImageUrl, src) || null
    const heroBackdropUrl = heroBannerUrl || coverImg
    const blurDetailHero = src !== 'mangadistrict' && !heroBannerUrl && Boolean(coverImg)
    const rating = d.ratings?.average ?? d.ratingAverage
    const ratingNum = rating != null ? Number(rating) : null
    const showRating = ratingNum != null && Number.isFinite(ratingNum) && ratingNum > 0
    const cleanDesc = d.description ? String(d.description).replace(/<[^>]*>/g, '') : ''
    const roliascanTitleUrl =
        src === 'roliascan' && mergedManga.id
            ? mergedManga.url
                ? String(mergedManga.url)
                : mergedManga.slug
                  ? `https://roliascan.com/manga/${encodeURIComponent(String(mergedManga.slug))}/`
                  : `https://roliascan.com/browse/?title=${encodeURIComponent(String(mergedManga.title || ''))}`
            : null
    const isDarkTheme =
        typeof document !== 'undefined' && document.documentElement?.dataset?.maxienTheme === 'dark'
    const heroFadeClass = blurDetailHero
        ? 'absolute inset-0 lifesync-detail-hero-fade-soft'
        : 'absolute inset-0 lifesync-detail-hero-fade-strong'

    return createPortal(
        <MotionDiv
            className="fixed inset-0 z-9998 flex h-dvh max-h-dvh w-full max-w-[100vw] min-w-0 items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={lifeSyncDetailOverlayFadeTransition}
        >
            <MotionDiv
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={lifeSyncDetailBackdropFadeTransition}
            />

            <MotionDiv
                layout="size"
                layoutRoot
                className="lifesync-manga-detail-sheet relative flex h-auto max-h-[92dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-2xl bg-(--color-surface) shadow-2xl sm:max-h-[min(88vh,calc(100dvh-2rem))] sm:max-w-3xl sm:rounded-2xl"
                onClick={(e) => e.stopPropagation()}
                initial={lifeSyncDetailSheetEnterInitial}
                animate={lifeSyncDetailSheetEnterAnimate}
                exit={lifeSyncDetailSheetExitVariant}
                transition={lifeSyncDetailSheetMainTransition}
            >
                {/* Hero */}
                <div className="relative shrink-0">
                    {heroBackdropUrl && (
                        <>
                            <div className="absolute inset-0 overflow-hidden">
                                <img
                                    src={heroBackdropUrl}
                                    alt=""
                                    className={
                                        blurDetailHero
                                            ? 'h-full w-full scale-110 object-cover opacity-60 blur-2xl'
                                            : 'h-full min-h-44 w-full object-cover object-center sm:min-h-52'
                                    }
                                    {...mangaImageProps(heroBackdropUrl)}
                                />
                            </div>
                            <div className={heroFadeClass} />
                        </>
                    )}
                    {!heroBackdropUrl && <div className="absolute inset-0 lifesync-detail-hero-fallback" />}

                    {/* Close */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute z-10 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/90 hover:text-white transition-all"
                        style={{ top: '0.75rem', right: '0.75rem' }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    {/* Cover + title */}
                    <div className="relative flex gap-4 sm:gap-5 px-5 sm:px-6 pt-5 pb-4">
                        <div className="w-28 shrink-0 sm:w-32">
                            <MotionDiv
                                layoutId={coverLayoutId}
                                transition={lifeSyncSharedLayoutTransitionProps}
                                className="w-full overflow-hidden rounded-xl bg-(--color-surface-muted) shadow-lg ring-1 ring-black/10"
                                style={{ aspectRatio: '2/3' }}
                            >
                                {coverImg ? (
                                    <img
                                        src={coverImg}
                                        alt=""
                                        className="h-full w-full object-cover"
                                        {...mangaImageProps(coverImg)}
                                    />
                                ) : (
                                    <div className="flex h-full min-h-30 w-full items-center justify-center">
                                        <svg className="h-10 w-10 text-(--color-text-secondary)" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                                        </svg>
                                    </div>
                                )}
                            </MotionDiv>
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col justify-end pb-1">
                            <h2 className="text-[18px] sm:text-[22px] font-bold text-(--color-text-primary) leading-tight line-clamp-3">
                                {d.title || manga.title}
                            </h2>
                            {metaBusy && src === 'mangadistrict' ? (
                                <div className="mt-1.5 h-3 w-32 rounded bg-white/30 animate-pulse" />
                            ) : d.author ? (
                                <p className="mt-1.5 text-[12px] text-(--color-text-secondary) flex items-center gap-1.5">
                                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                    </svg>
                                    {d.author}
                                </p>
                            ) : null}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                {metaBusy && src === 'mangadistrict' ? (
                                    <>
                                        <span className="h-5 w-16 rounded-full bg-primary/20 animate-pulse" />
                                        <span className="h-5 w-12 rounded-full bg-(--color-surface-muted) animate-pulse" />
                                    </>
                                ) : (
                                    <>
                                        {d.status && (
                                            <span className="inline-flex items-center gap-1 bg-primary/20 text-(--color-text-primary) text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize">
                                                <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'completed' || d.status === 'cancelled' ? 'bg-(--color-text-secondary)' : 'bg-primary'}`} />
                                                {d.status}
                                            </span>
                                        )}
                                        {d.year && (
                                            <span className="text-[10px] font-medium text-(--color-text-secondary) bg-(--color-surface-muted) px-2 py-0.5 rounded-full">
                                                {d.year}
                                            </span>
                                        )}
                                        {showRating && (
                                            <span className="inline-flex items-center gap-0.5 bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full dark:bg-amber-500/15 dark:text-amber-300">
                                                <svg className="w-2.5 h-2.5 fill-amber-500" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                                {ratingNum.toFixed(1)}
                                            </span>
                                        )}
                                        {d.contentRating && d.contentRating !== 'safe' && (
                                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase dark:bg-amber-500/15 dark:text-amber-300">
                                                {d.contentRating}
                                            </span>
                                        )}
                                    </>
                                )}
                                {chaptersInSeriesOrder.length > 0 && (
                                    <span className="text-[10px] font-medium text-(--color-text-secondary) bg-(--color-surface-muted) px-2 py-0.5 rounded-full">
                                        {chaptersInSeriesOrder.length} ch.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <MotionDiv
                        key={String(manga.id)}
                        className="px-5 sm:px-6 py-4 space-y-4"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={lifeSyncDetailBodyRevealTransition}
                    >
                        {/* Tags */}
                        {metaBusy && src === 'mangadistrict' ? (
                            <div className="flex flex-wrap gap-1.5">
                                {[60, 80, 50, 70, 55].map((w, i) => (
                                    <span key={i} className="h-6 rounded-lg bg-(--color-surface-muted) animate-pulse" style={{ width: w }} />
                                ))}
                            </div>
                        ) : tagList?.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                                {tagList.map((t, i) => {
                                    const label = mangaTagLabel(t)
                                    if (!label) return null
                                    return (
                                        <span
                                            key={mangaTagKey(t, i, `${mergedManga.id}-`)}
                                            className="bg-(--color-surface-muted) hover:bg-(--color-surface-muted) text-(--color-text-primary) text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors cursor-default"
                                        >
                                            {label}
                                        </span>
                                    )
                                })}
                            </div>
                        ) : null}

                        {/* Description */}
                        {metaBusy && src === 'mangadistrict' ? (
                            <div className="space-y-2">
                                <div className="h-3 w-full rounded bg-(--color-surface-muted) animate-pulse" />
                                <div className="h-3 w-5/6 rounded bg-(--color-surface-muted) animate-pulse" />
                                <div className="h-3 w-4/6 rounded bg-(--color-surface-muted) animate-pulse" />
                            </div>
                        ) : cleanDesc ? (
                            <div>
                                <p className={`text-[13px] leading-relaxed ${descExpanded ? '' : 'line-clamp-3'}`}>
                                    {cleanDesc}
                                </p>
                                {cleanDesc.length > 200 && (
                                    <button
                                        type="button"
                                        onClick={() => setDescExpanded((v) => !v)}
                                        className="mt-1 text-[11px] font-semibold text-primary hover:underline"
                                    >
                                        {descExpanded ? 'Show less' : 'Read more'}
                                    </button>
                                )}
                            </div>
                        ) : null}

                        {/* Chapters */}
                        <div>
                            <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                                <div className="flex min-w-0 flex-wrap items-center gap-2">
                                    <h3 className="text-[13px] font-bold text-(--color-text-primary)">Chapters</h3>
                                    <div className="flex rounded-lg p-0.5" role="group" aria-label="Chapter list order">
                                        <button
                                            type="button"
                                            onClick={() => setChapterOrder('asc')}
                                            className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${chapterOrder === 'asc' ? 'bg-(--color-surface) text-(--color-text-primary) shadow-sm' : 'text-(--color-text-secondary)'}`}
                                        >
                                            First → last
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setChapterOrder('desc')}
                                            className={`rounded-md px-2.5 py-1 text-[10px] font-semibold transition-colors ${chapterOrder === 'desc' ? 'bg-(--color-surface) text-(--color-text-primary) shadow-sm' : 'text-(--color-text-secondary)'}`}
                                        >
                                            Last → first
                                        </button>
                                    </div>
                                    {src === 'roliascan' && roliascanTitleUrl && (
                                        <a href={roliascanTitleUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] font-semibold text-orange-500 hover:underline">
                                            Open on Roliascan
                                        </a>
                                    )}
                                    {src === 'mangadna' && mergedManga.id && (
                                        <a href={`https://mangadna.com/manga/${encodeURIComponent(String(mergedManga.id))}`} target="_blank" rel="noopener noreferrer" className="shrink-0 text-[11px] font-semibold text-orange-500 hover:underline">
                                            Open on MangaDNA
                                        </a>
                                    )}
                                </div>
                                {chaptersInSeriesOrder.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => onStartRead(mergedManga, chaptersInSeriesOrder[chaptersInSeriesOrder.length - 1])}
                                            className="flex items-center gap-1.5 rounded-lg border border-(--color-border-soft) bg-(--color-surface) px-3 py-1.5 text-[11px] font-semibold text-(--color-text-primary) shadow-sm transition-all hover:bg-(--color-surface-muted)"
                                        >
                                            Latest chapter
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onStartRead(mergedManga, chaptersInSeriesOrder[0])}
                                            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-(--color-ink-strong) shadow-sm ring-1 ring-(--color-ink-strong)/10 transition-all hover:brightness-95"
                                        >
                                            <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                            </svg>
                                            Start from first
                                        </button>
                                    </div>
                                )}
                            </div>
                            {chapBusy ? (
                                <LifesyncMangaChapterListSkeleton rows={8} dark={isDarkTheme} />
                            ) : chaptersInSeriesOrder.length === 0 ? (
                                <div className="rounded-xl bg-(--color-surface-muted) px-4 py-6 text-center">
                                    <p className="text-[12px] text-(--color-text-secondary)">
                                        {src === 'mangadistrict' || src === 'roliascan' || src === 'mangadna'
                                            ? 'No chapters in listing.'
                                            : 'No chapters for this language filter.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-hidden rounded-xl">
                                    <ul ref={chapterListRef} className="max-h-80 overflow-y-auto">
                                        {displayChapters.map((ch, chIdx) => {
                                            const isCurrentChapter =
                                                highlightedChapterId && String(ch?.id || '') === highlightedChapterId
                                            const isFocusedCh = focusedChIndex === chIdx
                                            return (
                                                <li key={ch.id}>
                                                    <button
                                                        ref={isCurrentChapter ? currentChapterButtonRef : null}
                                                        type="button"
                                                        data-focused-ep={isFocusedCh ? 'true' : undefined}
                                                        onClick={() => onStartRead(mergedManga, ch)}
                                                        aria-current={isCurrentChapter ? 'true' : undefined}
                                                        className={`group flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-left transition-colors ${
                                                            isFocusedCh
                                                                ? 'bg-primary/25 ring-2 ring-primary/70'
                                                                : isCurrentChapter
                                                                  ? 'bg-primary/18 ring-1 ring-primary/45'
                                                                  : 'hover:bg-(--color-surface-muted)'
                                                        }`}
                                                    >
                                                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold transition-colors ${isCurrentChapter ? 'bg-primary/32 text-(--color-text-primary)' : 'text-(--color-text-secondary) group-hover:bg-primary/20 group-hover:text-(--color-text-primary)'}`}>
                                                            {chapterSeriesIndex(ch) || ''}
                                                        </span>
                                                        <span className="flex-1 min-w-0">
                                                            <span className="flex items-center gap-2 min-w-0">
                                                                <span className="block text-[12px] font-medium text-(--color-text-primary) truncate">
                                                                    {formatChapterLabel(ch)}
                                                                </span>
                                                                {isCurrentChapter && (
                                                                    <span className="shrink-0 rounded-full bg-primary/28 px-1.5 py-0.5 text-[9px] font-semibold text-(--color-ink-strong)">
                                                                        Current
                                                                    </span>
                                                                )}
                                                            </span>
                                                            {ch.scanlationGroup && (
                                                                <span className="block text-[10px] text-(--color-text-secondary) truncate">
                                                                    {ch.scanlationGroup}
                                                                </span>
                                                            )}
                                                        </span>
                                                        <svg className="w-3.5 h-3.5 shrink-0 text-(--color-border-strong) group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </button>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </MotionDiv>
                </div>
            </MotionDiv>
        </MotionDiv>,
        document.body,
    )
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @param {object} options
 * @param {(manga: object, chapter: object) => void} options.onStartRead
 * @param {boolean} [options.roliascanConnected]
 * @param {string}  [options.browseTranslatedLang]
 * @param {boolean} [options.isLifeSyncConnected]
 */
export function useMangaDetailPortal({
    onStartRead,
    roliascanConnected = false,
    browseTranslatedLang = 'en',
    isLifeSyncConnected = false,
} = {}) {
    const [selected, setSelected] = useState(null)

    const openManga = useCallback((manga, source) => {
        const src = String(manga?.source || source || '')
        setSelected(src ? { ...manga, source: src } : manga)
    }, [])

    const close = useCallback(() => setSelected(null), [])

    const portal = (
        <AnimatePresence>
            {selected && (
                <MangaDetail
                    key={`${selected.source}-${selected.id}`}
                    manga={selected}
                    source={selected.source}
                    onClose={close}
                    onStartRead={onStartRead ?? (() => {})}
                    roliascanConnected={roliascanConnected}
                    browseTranslatedLang={browseTranslatedLang}
                    isLifeSyncConnected={isLifeSyncConnected}
                />
            )}
        </AnimatePresence>
    )

    return { openManga, close, isOpen: Boolean(selected), portal }
}
