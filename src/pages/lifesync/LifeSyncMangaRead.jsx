import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch } from '../../lib/lifesyncApi'

function compareChapters(a, b) {
    const av = a?.volume != null && a.volume !== '' ? Number(a.volume) : null
    const bv = b?.volume != null && b.volume !== '' ? Number(b.volume) : null
    const ac = a?.chapter != null && a.chapter !== '' ? Number(a.chapter) : null
    const bc = b?.chapter != null && b.chapter !== '' ? Number(b.chapter) : null
    if (av != null && bv != null && av !== bv) return av - bv
    if (ac != null && bc != null && ac !== bc) return ac - bc
    const at = a?.title ? String(a.title) : ''
    const bt = b?.title ? String(b.title) : ''
    if (at && bt && at !== bt) return at.localeCompare(bt)
    return String(a?.id || '').localeCompare(String(b?.id || ''))
}

function formatChapterLabel(ch) {
    if (!ch) return ''
    const bits = []
    const v = ch.volume != null && ch.volume !== '' ? String(ch.volume) : ''
    const c = ch.chapter != null && ch.chapter !== '' ? String(ch.chapter) : ''
    if (v) bits.push(`Vol. ${v}`)
    if (c) bits.push(`Ch. ${c}`)
    const label = bits.length ? bits.join(' ') : (ch.title ? String(ch.title) : 'Chapter')
    return label
}

function normalizeReadPercent(value) {
    const n = Number(value)
    if (!Number.isFinite(n)) return 0
    return Math.min(100, Math.max(0, Math.round(n * 10) / 10))
}

function mangadexImageProps(url) {
    const src = String(url || '')
    if (!src) return {}
    try {
        const u = new URL(src, window.location.origin)
        const host = u.hostname || ''
        if (host.includes('mangadex')) {
            return { referrerPolicy: 'no-referrer' }
        }
    } catch {
        // ignore
    }
    return {}
}

function LifesyncChapterPagesSkeleton() {
    return (
        <div className="mx-auto max-w-3xl p-6">
            <div className="h-4 w-40 rounded bg-white/10" />
            <div className="mt-4 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-40 w-full rounded-xl bg-white/10" />
                ))}
            </div>
        </div>
    )
}

export default function LifeSyncMangaRead() {
    const { mangaId: mangaIdParam, chapterId: chapterIdParam } = useParams()
    const location = useLocation()
    const navigate = useNavigate()
    const { isLifeSyncConnected } = useLifeSync()

    const mangaId = useMemo(() => String(mangaIdParam || '').trim(), [mangaIdParam])
    const chapterId = useMemo(() => String(chapterIdParam || '').trim(), [chapterIdParam])

    const from = location.state?.from
    const closeTo =
        typeof from === 'string' && from.startsWith('/dashboard/lifesync/anime/manga')
            ? from
            : '/dashboard/lifesync/anime/manga/mangadex/popular/page/1'

    const source = useMemo(() => {
        const s = location.state?.source || location.state?.src
        const v = String(s || '').trim()
        return v === 'mangadistrict' ? v : 'mangadex'
    }, [location.state])

    const browseTranslatedLang = useMemo(() => {
        const v = location.state?.browseTranslatedLang
        const s = String(v || '').trim()
        return s || 'en'
    }, [location.state])

    const resumeChapterId = useMemo(() => String(location.state?.resumeChapterId || '').trim(), [location.state])
    const resumePercent = useMemo(() => normalizeReadPercent(location.state?.resumePercent), [location.state])

    const [busy, setBusy] = useState(true)
    const [error, setError] = useState('')
    const [manga, setManga] = useState(null)
    const [sortedChapters, setSortedChapters] = useState([])
    const [chapter, setChapter] = useState(null)

    const [pack, setPack] = useState(null)
    const [loadErr, setLoadErr] = useState('')
    const [loadingPages, setLoadingPages] = useState(true)
    const [chapterReadProgress, setChapterReadProgress] = useState(0)
    const [navBusy, setNavBusy] = useState(false)
    const [zoomPct, setZoomPct] = useState(100)

    const scrollRef = useRef(null)
    const pagesInnerRef = useRef(null)
    const scrollRafRef = useRef(null)

    const [dexAuthStatus, setDexAuthStatus] = useState(null)
    const mdReadSyncTimer = useRef(null)
    const mdReadingStatusSent = useRef(new Set())
    const resumeRestoreKeyRef = useRef('')
    const lastSavedPercentRef = useRef({ key: '', percent: 0 })

    useEffect(() => {
        if (!isLifeSyncConnected) return
        let cancelled = false
        lifesyncFetch('/api/v1/manga/mangadex/auth/status?view=compact')
            .then(s => { if (!cancelled) setDexAuthStatus(s) })
            .catch(() => { if (!cancelled) setDexAuthStatus({ oauthConfigured: false, connected: false }) })
        return () => { cancelled = true }
    }, [isLifeSyncConnected])

    const upsertReading = useCallback(async (manga, chapter, readPercent) => {
        if (!manga?.id || !chapter?.id) return
        const src =
            manga.source === 'mangadistrict'
                ? manga.source
                : 'mangadex'
        try {
            await lifesyncFetch('/api/v1/manga/reading', {
                method: 'PUT',
                json: {
                    source: src,
                    mangaId: String(manga.id),
                    title: manga.title || '',
                    coverUrl: manga.coverUrl || '',
                    lastChapterId: String(chapter.id),
                    lastChapterLabel: formatChapterLabel(chapter),
                    lastVolume: chapter.volume != null && chapter.volume !== '' ? String(chapter.volume) : '',
                    lastChapterNum: chapter.chapter != null && chapter.chapter !== '' ? String(chapter.chapter) : '',
                    lastReadPercent: normalizeReadPercent(readPercent),
                    ...(src === 'mangadex' && manga.contentRating
                        ? { contentRating: String(manga.contentRating) }
                        : {}),
                },
            })
        } catch {
            /* offline */
        }
    }, [])

    const syncMangaDexReading = useCallback(async (manga, chapter) => {
        if (!manga?.id || !chapter?.id) return
        const src =
            manga.source === 'mangadistrict'
                ? manga.source
                : 'mangadex'
        if (src !== 'mangadex' || !dexAuthStatus?.connected) return
        if (mdReadSyncTimer.current) clearTimeout(mdReadSyncTimer.current)
        mdReadSyncTimer.current = setTimeout(() => {
            mdReadSyncTimer.current = null
            void (async () => {
                try {
                    await lifesyncFetch(`/api/v1/manga/mangadex/read-chapters/${encodeURIComponent(String(manga.id))}`, {
                        method: 'POST',
                        json: { read: [String(chapter.id)], unread: [] },
                    })
                } catch {
                    /* token / network */
                }
                const k = String(manga.id)
                if (mdReadingStatusSent.current.has(k)) return
                try {
                    await lifesyncFetch(`/api/v1/manga/mangadex/reading-status/${encodeURIComponent(k)}`, {
                        method: 'POST',
                        json: { status: 'reading' },
                    })
                    mdReadingStatusSent.current.add(k)
                } catch {
                    /* ignore */
                }
            })()
        }, 450)
    }, [dexAuthStatus?.connected])

    useEffect(
        () => () => {
            if (mdReadSyncTimer.current) clearTimeout(mdReadSyncTimer.current)
        },
        []
    )

    useEffect(() => {
        if (!mangaId || !chapterId) return
        let cancelled = false
        ;(async () => {
            setBusy(true)
            setError('')
            try {
                if (source === 'mangadex') {
                    const detail = await lifesyncFetch(`/api/v1/manga/details/${encodeURIComponent(mangaId)}?view=full`)
                    const langParam = browseTranslatedLang === 'all' ? 'all' : browseTranslatedLang
                    const feed = await lifesyncFetch(
                        `/api/v1/manga/chapters/${encodeURIComponent(mangaId)}?limit=500&lang=${encodeURIComponent(langParam)}&order=asc`
                        + '&view=full'
                    )
                    const list = [...(feed?.data || [])]
                    list.sort(compareChapters)
                    const ch = list.find(c => String(c?.id) === chapterId) || (list.length ? list[list.length - 1] : null)
                    if (!ch) throw new Error('No chapters available.')
                    if (!cancelled) {
                        setManga({ ...detail, source: 'mangadex' })
                        setSortedChapters(list)
                        setChapter(ch)
                    }
                } else if (source === 'mangadistrict') {
                    const data = await lifesyncFetch(`/api/v1/manga/mangadistrict/info/${encodeURIComponent(mangaId)}?view=full`)
                    const list = [...(data?.chapters || [])]
                    list.sort(compareChapters)
                    const ch = list.find(c => String(c?.id) === chapterId) || (list.length ? list[list.length - 1] : null)
                    if (!ch) throw new Error('No chapters available.')
                    if (!cancelled) {
                        setManga({ ...data, source: 'mangadistrict' })
                        setSortedChapters(list)
                        setChapter(ch)
                    }
                }
            } catch (e) {
                if (!cancelled) setError(e?.message || 'Could not open reader')
            } finally {
                if (!cancelled) setBusy(false)
            }
        })()
        return () => { cancelled = true }
    }, [browseTranslatedLang, chapterId, mangaId, source])

    useEffect(() => {
        if (!manga?.id || !chapter?.id) return
        const key = `${manga.source || source}:${String(manga.id)}:${String(chapter.id)}`
        const initialPercent =
            resumeChapterId && String(chapter.id) === resumeChapterId && resumePercent > 0
                ? resumePercent
                : 0
        lastSavedPercentRef.current = { key, percent: initialPercent }
        void upsertReading(manga, chapter, initialPercent)
        void syncMangaDexReading(manga, chapter)
    }, [chapter, manga, resumeChapterId, resumePercent, source, syncMangaDexReading, upsertReading])

    useEffect(() => {
        if (!manga?.id || !chapter?.id) return
        let cancelled = false
        ;(async () => {
            setLoadingPages(true)
            setLoadErr('')
            setPack(null)
            const path =
                manga.source === 'mangadistrict'
                        ? `/api/v1/manga/mangadistrict/chapter/${encodeURIComponent(manga.id)}/${encodeURIComponent(chapter.id)}`
                        : `/api/v1/manga/pages/${chapter.id}`
            try {
                const data = await lifesyncFetch(`${path}${path.includes('?') ? '&' : '?'}view=full`)
                if (!cancelled) setPack(data)
            } catch (e) {
                if (!cancelled) setLoadErr(e?.message || 'Could not load chapter pages')
            } finally {
                if (!cancelled) setLoadingPages(false)
            }
        })()
        return () => { cancelled = true }
    }, [chapter?.id, manga?.id, manga?.source])

    useLayoutEffect(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = 0
        setChapterReadProgress(0)
    }, [chapter?.id])

    const updateScrollProgress = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        const { scrollTop, scrollHeight, clientHeight } = el
        const max = scrollHeight - clientHeight
        const p = max <= 0 ? 1 : Math.min(1, Math.max(0, scrollTop / max))
        setChapterReadProgress(p)
    }, [])

    const scheduleProgressUpdate = useCallback(() => {
        if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current)
        scrollRafRef.current = requestAnimationFrame(() => {
            scrollRafRef.current = null
            updateScrollProgress()
        })
    }, [updateScrollProgress])

    const onReaderScroll = useCallback(() => {
        scheduleProgressUpdate()
    }, [scheduleProgressUpdate])

    useEffect(
        () => () => {
            if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current)
        },
        []
    )

    const urls = useMemo(() => (pack?.pages?.length ? pack.pages : []), [pack])
    const zoomScale = useMemo(() => Math.min(2, Math.max(0.5, Number(zoomPct) / 100)), [zoomPct])

    useEffect(() => {
        if (loadingPages) return
        scheduleProgressUpdate()
        return () => {
            if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current)
        }
    }, [loadingPages, urls.length, chapter?.id, scheduleProgressUpdate])

    useEffect(() => {
        const inner = pagesInnerRef.current
        if (!inner || loadingPages) return
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateScrollProgress()) : null
        ro?.observe(inner)
        return () => ro?.disconnect()
    }, [loadingPages, urls.length, chapter?.id, updateScrollProgress])

    useEffect(() => {
        if (loadingPages || !manga?.id || !chapter?.id || urls.length === 0) return
        if (!resumeChapterId || String(chapter.id) !== resumeChapterId) return
        if (!(resumePercent > 0 && resumePercent < 100)) return

        const chapterKey = `${manga.source || source}:${String(manga.id)}:${String(chapter.id)}`
        if (resumeRestoreKeyRef.current === chapterKey) return
        resumeRestoreKeyRef.current = chapterKey

        const el = scrollRef.current
        if (!el) return
        const id = requestAnimationFrame(() => {
            const max = Math.max(0, el.scrollHeight - el.clientHeight)
            el.scrollTop = max * (resumePercent / 100)
            scheduleProgressUpdate()
        })
        return () => cancelAnimationFrame(id)
    }, [
        chapter?.id,
        loadingPages,
        manga?.id,
        manga?.source,
        resumeChapterId,
        resumePercent,
        scheduleProgressUpdate,
        source,
        urls.length,
    ])

    useEffect(() => {
        if (loadingPages) return
        if (!manga?.id || !chapter?.id) return
        const chapterKey = `${manga.source || source}:${String(manga.id)}:${String(chapter.id)}`
        const percent = normalizeReadPercent(chapterReadProgress * 100)
        const prev = lastSavedPercentRef.current
        if (prev.key === chapterKey && Math.abs(percent - prev.percent) < 1) return

        const timer = setTimeout(() => {
            lastSavedPercentRef.current = { key: chapterKey, percent }
            void upsertReading(manga, chapter, percent)
        }, 700)
        return () => clearTimeout(timer)
    }, [chapterReadProgress, chapter?.id, loadingPages, manga, source, upsertReading])

    const safeIdx = useMemo(() => {
        if (!chapter?.id) return -1
        const idx = sortedChapters.findIndex(c => String(c?.id) === String(chapter.id))
        return idx >= 0 ? idx : -1
    }, [chapter?.id, sortedChapters])

    const prevCh = safeIdx > 0 ? sortedChapters[safeIdx - 1] : null
    const nextCh = safeIdx >= 0 && safeIdx < sortedChapters.length - 1 ? sortedChapters[safeIdx + 1] : null

    const goToChapter = useCallback((ch) => {
        if (!ch?.id) return
        if (navBusy) return
        setNavBusy(true)
        navigate(
            `/dashboard/lifesync/anime/manga/read/${encodeURIComponent(String(mangaId))}/${encodeURIComponent(String(ch.id))}${location.search || ''}`,
            {
                replace: true,
                state: {
                    ...(location.state || {}),
                    source,
                    browseTranslatedLang,
                    from: closeTo,
                },
            },
        )
    }, [browseTranslatedLang, closeTo, location.search, location.state, mangaId, navBusy, navigate, source])

    useEffect(() => {
        // Unlock nav after the route-driven chapter switch has landed.
        if (navBusy && String(chapterIdParam || '').trim()) setNavBusy(false)
    }, [chapterIdParam, navBusy])

    useEffect(() => {
        if (!isLifeSyncConnected) {
            navigate('/dashboard/profile?tab=integrations', { replace: true })
        }
    }, [isLifeSyncConnected, navigate])

    if (!isLifeSyncConnected) return null

    return (
        <div className="fixed inset-0 z-[9999] flex h-dvh max-h-dvh w-full max-w-[100vw] flex-col overflow-hidden bg-[#0a0a0a]">
            <header className="shrink-0 border-b border-white/10 bg-black/70 px-2 py-2 backdrop-blur-xl">
                <div className="mx-auto flex w-full max-w-5xl items-center gap-2">
                    <button
                        type="button"
                        onClick={() => navigate(closeTo)}
                        className="inline-flex items-center gap-2 rounded-lg border border-[#3a3a3c] bg-[#1c1c1e] px-2.5 py-2 text-[11px] font-semibold text-[#f5f5f7] hover:bg-[#2c2c2e]"
                        title="Back to list"
                    >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                        <span className="hidden sm:inline">Back</span>
                    </button>

                    <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-semibold text-[#f5f5f7]">{manga?.title || 'Manga'}</p>
                        <p className="truncate text-[10px] text-[#86868b]">{formatChapterLabel(chapter)}</p>
                    </div>

                    <div className="hidden md:flex items-center gap-2">
                        <label className="text-[10px] font-semibold text-[#86868b] tabular-nums" htmlFor="manga-reader-zoom">
                            Zoom {Math.round(zoomScale * 100)}%
                        </label>
                        <input
                            id="manga-reader-zoom"
                            type="range"
                            min={50}
                            max={200}
                            step={5}
                            value={zoomPct}
                            onChange={(e) => setZoomPct(Number(e.target.value))}
                            className="w-28 accent-[#C6FF00]"
                        />
                    </div>

                    <label className="sr-only" htmlFor="manga-reader-chapter-select">Chapter</label>
                    <select
                        id="manga-reader-chapter-select"
                        value={chapter?.id ? String(chapter.id) : ''}
                        onChange={(e) => {
                            const id = String(e.target.value || '')
                            if (!id) return
                            const ch = sortedChapters.find(c => String(c?.id) === id)
                            if (ch) goToChapter(ch)
                        }}
                        disabled={navBusy || busy || loadingPages || sortedChapters.length === 0}
                        className="min-w-[10rem] max-w-[16rem] rounded-lg border border-[#3a3a3c] bg-[#1c1c1e] px-2.5 py-2 text-[11px] font-semibold text-[#f5f5f7] focus:outline-none focus:ring-2 focus:ring-[#C6FF00]/40 disabled:opacity-50"
                        title="Jump to chapter"
                    >
                        {sortedChapters.length === 0 ? (
                            <option value="">Loading…</option>
                        ) : (
                            sortedChapters.map((ch) => (
                                <option key={String(ch?.id)} value={String(ch?.id)}>
                                    {formatChapterLabel(ch) || 'Chapter'}
                                </option>
                            ))
                        )}
                    </select>

                    <button
                        type="button"
                        disabled={!prevCh || navBusy || busy || loadingPages}
                        onClick={() => prevCh && goToChapter(prevCh)}
                        className="inline-flex items-center justify-center rounded-lg border border-[#3a3a3c] bg-[#1c1c1e] px-2.5 py-2 text-[11px] font-semibold text-[#f5f5f7] hover:bg-[#2c2c2e] disabled:opacity-40"
                        title="Previous chapter"
                    >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <button
                        type="button"
                        disabled={!nextCh || navBusy || busy || loadingPages}
                        onClick={() => nextCh && goToChapter(nextCh)}
                        className="inline-flex items-center justify-center rounded-lg border border-[#3a3a3c] bg-[#1c1c1e] px-2.5 py-2 text-[11px] font-semibold text-[#f5f5f7] hover:bg-[#2c2c2e] disabled:opacity-40"
                        title="Next chapter"
                    >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </header>

            <div
                ref={scrollRef}
                onScroll={onReaderScroll}
                className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {busy ? (
                    <p className="p-8 text-center text-[13px] text-[#86868b]">Opening reader…</p>
                ) : null}
                {error ? (
                    <p className="p-8 text-center text-[13px] text-red-400">{error}</p>
                ) : null}
                {loadingPages ? <LifesyncChapterPagesSkeleton /> : null}
                {loadErr && !loadingPages && <p className="p-8 text-center text-[13px] text-red-400">{loadErr}</p>}
                {!loadingPages && !loadErr && urls.length === 0 && (
                    <p className="p-8 text-center text-[13px] text-[#86868b]">No page images returned for this chapter.</p>
                )}
                <div
                    ref={pagesInnerRef}
                    className="mx-auto max-w-3xl pb-8 pt-2"
                    style={{ transform: `scale(${zoomScale})`, transformOrigin: 'top center' }}
                >
                    {urls.map((src, i) => (
                        <img
                            key={`${chapter?.id || 'ch'}-${i}`}
                            src={src}
                            alt={`Page ${i + 1}`}
                            className="w-full bg-black"
                            loading="eager"
                            decoding="async"
                            onLoad={() => {
                                scheduleProgressUpdate()
                            }}
                            {...mangadexImageProps(src)}
                        />
                    ))}
                </div>
            </div>

            <footer className="shrink-0 border-t border-white/10 bg-black/85 px-3 py-2 backdrop-blur-xl">
                <div className="mx-auto max-w-3xl">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full bg-[#C6FF00] transition-[width] duration-100 ease-out"
                            style={{ width: `${Math.round(chapterReadProgress * 1000) / 10}%` }}
                            role="progressbar"
                            aria-valuenow={Math.round(chapterReadProgress * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Scroll position in this chapter"
                        />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#86868b]">
                        <span>
                            {urls.length > 0 ? `${urls.length} page${urls.length === 1 ? '' : 's'}` : loadingPages ? '…' : '—'}
                        </span>
                        <span className="tabular-nums text-[#a1a1a6]">
                            {Math.round(chapterReadProgress * 100)}% through chapter
                        </span>
                    </div>
                </div>
            </footer>
        </div>
    )
}
