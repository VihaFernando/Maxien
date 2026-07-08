import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import useControllerSupportEnabled from '../../hooks/useControllerSupportEnabled'
import useLifeSyncGamepadInput from '../../hooks/useLifeSyncGamepadInput'
import { useLifeSync } from '../../context/LifeSyncContext'
import { XBOX_GAMEPAD_BUTTONS } from '../../lib/lifeSyncControllerInput'
import { ControllerHintOverlay } from '../../components/lifesync/ControllerHintOverlay'
import { lifesyncFetch } from '../../lib/lifesyncApi'
import { decodeHtmlEntities } from '../../lib/mangaChapterUtils'
import { useMangaProgress } from '../../features/manga-progress/useMangaProgress'
import { readProgressQueueSync, writeProgressQueueSync } from '../../features/manga-progress/progressSyncService'

// ─── constants ───────────────────────────────────────────────────────────────

const PROGRESS_FLUSH_BATCH          = 16
// Checkpoints (%) at which progress is immediately persisted and flushed remotely.
// Crossing any threshold triggers one save; re-crossing the same chapter/threshold is a no-op.
const PROGRESS_CHECKPOINTS          = [20, 35, 50, 60, 80, 97, 100]
const PROGRESS_SOURCES              = new Set(['mangadistrict', 'roliascan', 'mangadna'])
const INITIAL_PAGE_BURST            = 3
const ZOOM_TRANSITION_MS            = 180
const ZOOM_STEP                     = 10
const ZOOM_STEP_FS                  = 2
const ZOOM_MIN                      = 50
const ZOOM_MAX                      = 200
const ZOOM_MIN_FS                   = 20
const ZOOM_MAX_FS                   = 80

// Detect Xbox One / low-RAM / data-saver  evaluated once at module load
const LOW_END = (() => {
    try {
        if (/Xbox/i.test(navigator.userAgent)) return true
        if (navigator.deviceMemory != null && navigator.deviceMemory <= 2) return true
        const c = navigator.connection
        if (c && (c.saveData || c.effectiveType === 'slow-2g' || c.effectiveType === '2g')) return true
    } catch { /* ignore */ }
    return false
})()

// ─── pure helpers (no hooks, no closures over component state) ────────────────

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

function pickLatestChapter(chapters) {
    const list = Array.isArray(chapters) ? [...chapters] : []
    if (!list.length) return null
    list.sort(compareChapters)
    return list[list.length - 1] || null
}

function formatChapterLabel(ch) {
    if (!ch) return ''
    const v = ch.volume != null && ch.volume !== '' ? String(ch.volume) : ''
    const c = ch.chapter != null && ch.chapter !== '' ? String(ch.chapter) : ''
    if (v && c) return `Vol. ${v} Ch. ${c}`
    if (v) return `Vol. ${v}`
    if (c) return `Ch. ${c}`
    return ch.title ? decodeHtmlEntities(String(ch.title)) : 'Chapter'
}

function normalizeReadPercent(value) {
    const n = Number(value)
    if (!Number.isFinite(n)) return 0
    return Math.min(100, Math.max(0, Math.round(n * 10) / 10))
}

function clampZoom(value, fs = false) {
    const n = Number(value)
    const v = Number.isFinite(n) ? n : 100
    return Math.min(fs ? ZOOM_MAX_FS : ZOOM_MAX, Math.max(fs ? ZOOM_MIN_FS : ZOOM_MIN, v))
}

function normalizeSrc(value) {
    const s = String(value || '').trim().toLowerCase()
    if (s === 'mangadistrict' || s === 'roliascan' || s === 'mangadna') return s
    return ''
}

function sanitizePayload(raw) {
    const source = String(raw?.source || '').trim().toLowerCase()
    if (!PROGRESS_SOURCES.has(source)) return null
    const mangaId = String(raw?.mangaId || '').trim()
    const lastChapterId = String(raw?.lastChapterId || '').trim()
    if (!mangaId || !lastChapterId) return null
    return {
        source,
        mangaId,
        title:           String(raw?.title || ''),
        coverUrl:        String(raw?.coverUrl || ''),
        lastChapterId,
        lastChapterLabel: String(raw?.lastChapterLabel || ''),
        lastVolume:      String(raw?.lastVolume || ''),
        lastChapterNum:  String(raw?.lastChapterNum || ''),
        lastReadPercent: normalizeReadPercent(raw?.lastReadPercent),
    }
}

function queueKey(payload) {
    return `${payload?.source || ''}:${payload?.mangaId || ''}`
}

function readQueue()        { return readProgressQueueSync() }
function writeQueue(q)      { writeProgressQueueSync(q) }

function mergePayload(prevRaw, next) {
    const prev = sanitizePayload(prevRaw)
    if (!prev) return next
    if (prev.source !== next.source || prev.mangaId !== next.mangaId || prev.lastChapterId !== next.lastChapterId)
        return next
    const prevPct = normalizeReadPercent(prev.lastReadPercent)
    const nextPct = normalizeReadPercent(next.lastReadPercent)
    return nextPct < prevPct ? { ...next, lastReadPercent: prevPct } : next
}

function pickQueuedResume(mangaId, preferredSrc = '') {
    const mid = String(mangaId || '').trim()
    if (!mid) return null
    const queue = readQueue()
    let best = null
    for (const raw of Object.values(queue)) {
        const p = sanitizePayload(raw)
        if (!p || p.mangaId !== mid) continue
        const pct = normalizeReadPercent(p.lastReadPercent)
        if (!(pct > 0 && pct < 100)) continue
        const chId = String(p.lastChapterId || '').trim()
        if (!chId) continue
        const src   = normalizeSrc(p.source)
        const score = preferredSrc && src === preferredSrc ? 1 : 0
        const ts    = Date.parse(String(raw?.savedAt || ''))
        const savedAt = Number.isFinite(ts) ? ts : 0
        if (!best || score > best.score || (score === best.score && savedAt > best.savedAt))
            best = { source: src, chapterId: chId, percent: pct, savedAt, score }
    }
    if (!best) return null
    return { source: best.source, chapterId: best.chapterId, percent: best.percent, savedAt: best.savedAt }
}

function pickRemoteResume(rows, mangaId, preferredSrc = '') {
    const mid = String(mangaId || '').trim()
    if (!mid || !Array.isArray(rows)) return null
    let best = null
    for (const row of rows) {
        if (String(row?.mangaId || '').trim() !== mid) continue
        const chId = String(row?.lastChapterId || '').trim()
        if (!chId) continue
        const pct = normalizeReadPercent(row?.lastReadPercent)
        if (!(pct > 0 && pct < 100)) continue
        const src = normalizeSrc(row?.source)
        if (!src) continue
        const score = preferredSrc && src === preferredSrc ? 1 : 0
        const ts    = Date.parse(String(row?.updatedAt || ''))
        const savedAt = Number.isFinite(ts) ? ts : 0
        if (!best || score > best.score || (score === best.score && savedAt > best.savedAt))
            best = { source: src, chapterId: chId, percent: pct, savedAt, score }
    }
    if (!best) return null
    return { source: best.source, chapterId: best.chapterId, percent: best.percent, savedAt: best.savedAt }
}

// Returns referrerPolicy prop for known manga CDNs
function imgProps(url) {
    try {
        const host = new URL(String(url || ''), window.location.origin).hostname
        if (host.includes('mangadistrict') || host.includes('roliascan') || host.includes('mangadna'))
            return { referrerPolicy: 'no-referrer' }
    } catch { /* ignore */ }
    return {}
}

// ─── skeleton ────────────────────────────────────────────────────────────────

function PagesSkeleton() {
    return (
        <div className="mx-auto max-w-3xl p-6">
            <div className="h-4 w-40 rounded bg-white/5" />
            <div className="mt-4 space-y-3">
                {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-40 w-full rounded-xl bg-white/5" />
                ))}
            </div>
        </div>
    )
}

// ─── main component ───────────────────────────────────────────────────────────

export default function LifeSyncMangaRead() {
    const { mangaId: mangaIdParam, chapterId: chapterIdParam } = useParams()
    const location  = useLocation()
    const navigate  = useNavigate()
    const { isLifeSyncConnected } = useLifeSync()
    const {
        ready:          progressReady,
        persistLocal:   persistLocalProgress,
        flushNow:       flushProgressNow,
    } = useMangaProgress({ enabled: isLifeSyncConnected })
    const controllerSupportEnabled = useControllerSupportEnabled()

    // ── stable primitives from params/location (memoized to avoid cascade) ──
    const mangaId   = useMemo(() => String(mangaIdParam  || '').trim(), [mangaIdParam])
    const chapterId = useMemo(() => String(chapterIdParam || '').trim(), [chapterIdParam])

    const searchParams = useMemo(() => new URLSearchParams(location.search || ''), [location.search])

    const sourceHint = useMemo(() => {
        const q = normalizeSrc(searchParams.get('source') || searchParams.get('src'))
        return q || normalizeSrc(location.state?.source || location.state?.src)
    }, [location.state, searchParams])

    const browseTranslatedLang = useMemo(() => {
        const q = String(searchParams.get('lang') || '').trim().toLowerCase()
        if (q === 'all' || q === 'en') return q
        const s = String(location.state?.browseTranslatedLang || '').trim().toLowerCase()
        if (s === 'all' || s === 'en') return s
        return 'en'
    }, [location.state, searchParams])

    const closeTo = useMemo(() => {
        const from = location.state?.from
        return typeof from === 'string' && from.startsWith('/dashboard/lifesync/anime/manga')
            ? from
            : '/dashboard/lifesync/anime/manga'
    }, [location.state])

    // ── resume hints from navigation state / query ──
    const explicitResumeChapterId = useMemo(() =>
        String(searchParams.get('resumeChapterId') || location.state?.resumeChapterId || '').trim(),
    [location.state, searchParams])

    const explicitResumePercent = useMemo(() => {
        const q = normalizeReadPercent(searchParams.get('resumePercent'))
        if (q > 0 && q < 100) return q
        const s = normalizeReadPercent(location.state?.resumePercent)
        return s > 0 && s < 100 ? s : 0
    }, [location.state, searchParams])

    // ── state ──
    const [fallbackResume, setFallbackResume] = useState({ source: '', chapterId: '', percent: 0 })
    const [busy,             setBusy]         = useState(true)
    const [error,            setError]        = useState('')
    const [manga,            setManga]        = useState(null)
    const [sortedChapters,   setChapters]     = useState([])
    const [chapter,          setChapter]      = useState(null)
    const [pack,             setPack]         = useState(null)
    const [loadErr,          setLoadErr]      = useState('')
    const [loadingPages,     setLoadingPages] = useState(true)
    const [readProgress,     setReadProgress] = useState(0)
    const [navBusy,          setNavBusy]      = useState(false)
    const [zoomPct,          setZoomPct]      = useState(100)
    const [fullscreen,       setFullscreen]   = useState(false)

    // ── derived / stable values ──
    const source = sourceHint || fallbackResume.source || 'mangadistrict'

    const resumeChapterId = explicitResumeChapterId || fallbackResume.chapterId || ''
    const resumePercent = (() => {
        if (explicitResumeChapterId) {
            if (explicitResumePercent > 0) return explicitResumePercent
            if (fallbackResume.chapterId === explicitResumeChapterId && fallbackResume.percent > 0)
                return fallbackResume.percent
            return 0
        }
        return fallbackResume.percent > 0 && fallbackResume.percent < 100 ? fallbackResume.percent : 0
    })()

    const urls = useMemo(() => pack?.pages?.length ? pack.pages : [], [pack])

    const zoomScale = useMemo(
        () => clampZoom(zoomPct, fullscreen) / 100,
        [fullscreen, zoomPct]
    )

    const safeIdx = useMemo(() => {
        if (!chapter?.id) return -1
        const idx = sortedChapters.findIndex(c => String(c?.id) === String(chapter.id))
        return idx >= 0 ? idx : -1
    }, [chapter?.id, sortedChapters])

    const prevCh = safeIdx > 0 ? sortedChapters[safeIdx - 1] : null
    const nextCh = safeIdx >= 0 && safeIdx < sortedChapters.length - 1 ? sortedChapters[safeIdx + 1] : null

    const readerSearch = useMemo(() => {
        const p = new URLSearchParams(location.search || '')
        p.set('source', source)
        p.set('lang', browseTranslatedLang)
        p.delete('resumeChapterId')
        p.delete('resumePercent')
        const q = p.toString()
        return q ? `?${q}` : ''
    }, [browseTranslatedLang, location.search, source])

    // ── refs (no-render state) ──
    const scrollRef          = useRef(null)
    const pagesInnerRef      = useRef(null)
    const readerRootRef      = useRef(null)
    const scrollRafRef       = useRef(null)
    const imageLoadRafRef    = useRef(null)
    const remoteFlushTimer   = useRef(null)
    const zoomChanging       = useRef(false)
    const zoomResetTimer     = useRef(null)
    const zoomPrevPct        = useRef(100)
    const readProgressRef    = useRef(0)        // mirrors readProgress without causing re-renders
    const lastCommittedProg  = useRef(0)        // throttle gate for setReadProgress
    const resumeRestoreKey   = useRef('')
    const latestProgress     = useRef({ manga: null, chapter: null, percent: 0 })
    const lastFlushedSig     = useRef('')
    // Tracks which checkpoints have already fired for the current chapter (by chapterId).
    // Stored as "chapterId:threshold" strings so a chapter switch resets all checkpoints.
    const firedCheckpoints   = useRef(new Set())

    // ── progress helpers (all stable  deps are refs or module-level fns) ──

    const buildPayload = useCallback((row) => {
        const m = row?.manga
        const c = row?.chapter
        if (!m?.id || !c?.id) return null
        const srcName = normalizeSrc(m.source)
        if (!srcName) return null
        return sanitizePayload({
            source:           srcName,
            mangaId:          String(m.id),
            title:            String(m.title || ''),
            coverUrl:         String(m.coverUrl || ''),
            lastChapterId:    String(c.id),
            lastChapterLabel: formatChapterLabel(c),
            lastVolume:       c.volume != null && c.volume !== '' ? String(c.volume) : '',
            lastChapterNum:   c.chapter != null && c.chapter !== '' ? String(c.chapter) : '',
            lastReadPercent:  normalizeReadPercent(row?.percent),
        })
    }, [])

    const toWritePayload = useCallback((payload, savedAt) => {
        const clean = sanitizePayload(payload)
        if (!clean) return null
        return {
            bookId:      `${clean.source}:${clean.mangaId}`,
            source:      clean.source,
            mangaId:     clean.mangaId,
            progressPct: normalizeReadPercent(clean.lastReadPercent),
            locator:     { chapterId: clean.lastChapterId },
            updatedAt:   String(savedAt || new Date().toISOString()),
        }
    }, [])

    const persistLocal = useCallback(() => {
        const payload = buildPayload(latestProgress.current)
        if (!payload) return null
        const key = queueKey(payload)
        if (!key || key === ':') return null
        const queue   = readQueue()
        const merged  = mergePayload(queue[key], payload)
        const savedAt = new Date().toISOString()
        const next    = { ...merged, savedAt }
        queue[key] = next
        writeQueue(queue)
        persistLocalProgress(next)
        return next
    }, [buildPayload, persistLocalProgress])

    const flushQueued = useCallback(async ({ keepalive = false, maxItems = PROGRESS_FLUSH_BATCH } = {}) => {
        if (!isLifeSyncConnected) return
        await flushProgressNow({ keepalive, maxItems })
    }, [flushProgressNow, isLifeSyncConnected])

    const flushReading = useCallback(async ({ keepalive = false, queueFirst = true } = {}) => {
        let payload = buildPayload(latestProgress.current)
        if (!payload) return false
        if (queueFirst) payload = persistLocal() || payload
        const sig = `${payload.source}:${payload.mangaId}:${payload.lastChapterId}:${payload.lastReadPercent}`
        if (lastFlushedSig.current === sig) return true
        try {
            const body = toWritePayload(payload, payload.savedAt || new Date().toISOString())
            if (!body) return false
            await lifesyncFetch('/api/v1/progress', { method: 'POST', json: body, keepalive })
            lastFlushedSig.current = sig
            const queue = readQueue()
            delete queue[queueKey(payload)]
            writeQueue(queue)
            return true
        } catch {
            persistLocal()
            return false
        }
    }, [buildPayload, persistLocal, toWritePayload])

    const checkAndFireCheckpoint = useCallback((pct) => {
        if (!isLifeSyncConnected || !manga?.id || !chapter?.id) return
        const chId = String(chapter.id)
        for (const threshold of PROGRESS_CHECKPOINTS) {
            if (pct < threshold) break
            const key = `${chId}:${threshold}`
            if (firedCheckpoints.current.has(key)) continue
            firedCheckpoints.current.add(key)
            persistLocal()
            void flushReading({ queueFirst: false })
            void flushQueued({ maxItems: 4 })
            break // only fire the highest newly-crossed checkpoint per scroll event
        }
    }, [chapter?.id, flushQueued, flushReading, isLifeSyncConnected, manga?.id, persistLocal])

    // ── scroll progress (hot path  minimise allocations) ──

    const updateScrollProgress = useCallback(() => {
        if (zoomChanging.current) return
        const el = scrollRef.current
        if (!el) return
        const { scrollTop, scrollHeight, clientHeight } = el
        const max = scrollHeight - clientHeight
        const p = max <= 0 ? 1 : Math.min(1, Math.max(0, scrollTop / max))
        readProgressRef.current = p
        // Only commit to state when change ≥ 0.5% (or at extremes)  cuts ~95% of re-renders
        const prev = lastCommittedProg.current
        if (p === 0 || p === 1 || Math.abs(p - prev) >= 0.005) {
            lastCommittedProg.current = p
            setReadProgress(p)
        }
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

    // Single collapsed RAF for all per-image onLoad fires during chapter load
    const onPageImageLoad = useCallback(() => {
        if (imageLoadRafRef.current != null) return
        imageLoadRafRef.current = requestAnimationFrame(() => {
            imageLoadRafRef.current = null
            updateScrollProgress()
        })
    }, [updateScrollProgress])

    // ── effects ──────────────────────────────────────────────────────────────

    // Cleanup all timers/RAFs on unmount
    useEffect(() => () => {
        if (remoteFlushTimer.current)  window.clearTimeout(remoteFlushTimer.current)
        if (zoomResetTimer.current)    window.clearTimeout(zoomResetTimer.current)
        if (scrollRafRef.current)      cancelAnimationFrame(scrollRafRef.current)
        if (imageLoadRafRef.current)   cancelAnimationFrame(imageLoadRafRef.current)
    }, [])

    // Redirect if not connected
    useEffect(() => {
        if (!isLifeSyncConnected)
            navigate('/dashboard/profile?tab=integrations', { replace: true })
    }, [isLifeSyncConnected, navigate])

    // Load manga info + chapter list
    useEffect(() => {
        if (!mangaId || !chapterId) return
        let cancelled = false
        ;(async () => {
            setBusy(true)
            setError('')
            try {
                const url =
                    source === 'mangadistrict' ? `/api/v1/manga/mangadistrict/info/${encodeURIComponent(mangaId)}?view=full`
                  : source === 'roliascan'     ? `/api/v1/manga/roliascan/info/${encodeURIComponent(mangaId)}?view=full`
                  : source === 'mangadna'      ? `/api/v1/manga/mangadna/info/${encodeURIComponent(mangaId)}?view=full`
                  : null
                if (!url) throw new Error('Unknown source')
                const data = await lifesyncFetch(url)
                const list = [...(data?.chapters || [])].sort(compareChapters) // sort in place on local copy
                const ch = list.find(c => String(c?.id) === chapterId) || pickLatestChapter(list)
                if (!ch) throw new Error('No chapters available.')
                if (!cancelled) {
                    setManga({ ...data, source })
                    setChapters(list)
                    setChapter(ch)
                }
            } catch (e) {
                if (!cancelled) setError(e?.message || 'Could not open reader')
            } finally {
                if (!cancelled) setBusy(false)
            }
        })()
        return () => { cancelled = true }
    }, [browseTranslatedLang, chapterId, mangaId, source])

    // Flush any queued progress on mount / reconnect
    useEffect(() => {
        if (!isLifeSyncConnected) return
        void flushQueued()
    }, [flushQueued, isLifeSyncConnected])

    // Load resume candidate from local queue + remote
    useEffect(() => {
        if (!isLifeSyncConnected || !mangaId || !progressReady) return
        let cancelled = false

        const queuedCandidate = pickQueuedResume(mangaId, sourceHint)
        setFallbackResume(queuedCandidate
            ? { source: queuedCandidate.source, chapterId: queuedCandidate.chapterId, percent: queuedCandidate.percent }
            : { source: '', chapterId: '', percent: 0 })

        ;(async () => {
            try {
                const p = new URLSearchParams({ view: 'standard', sortBy: 'updatedAt', order: 'desc', page: '1', limit: '50' })
                if (sourceHint) p.set('source', sourceHint)
                const data = await lifesyncFetch(`/api/v1/progress?${p.toString()}`)
                if (cancelled) return
                const rows = Array.isArray(data) ? data : (Array.isArray(data?.entries) ? data.entries : [])
                const remote = pickRemoteResume(rows, mangaId, sourceHint)
                if (!remote) return
                const best = (remote.savedAt || 0) >= (queuedCandidate?.savedAt || 0) ? remote : queuedCandidate
                if (!best) return
                setFallbackResume({ source: best.source, chapterId: best.chapterId, percent: best.percent })
            } catch { /* resume still works from nav state + local queue */ }
        })()

        return () => { cancelled = true }
    }, [isLifeSyncConnected, mangaId, progressReady, sourceHint])

    // Load chapter pages
    useEffect(() => {
        if (!manga?.id || !chapter?.id) return
        let cancelled = false
        ;(async () => {
            setLoadingPages(true)
            setLoadErr('')
            setPack(null)
            const path =
                manga.source === 'mangadistrict' ? `/api/v1/manga/mangadistrict/chapter/${encodeURIComponent(manga.id)}/${encodeURIComponent(chapter.id)}`
              : manga.source === 'roliascan'     ? `/api/v1/manga/roliascan/chapter/${encodeURIComponent(manga.id)}/${encodeURIComponent(chapter.id)}`
              : manga.source === 'mangadna'      ? `/api/v1/manga/mangadna/chapter/${encodeURIComponent(manga.id)}/${encodeURIComponent(chapter.id)}`
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

    // Reset scroll + progress on chapter change
    useLayoutEffect(() => {
        const el = scrollRef.current
        zoomChanging.current = false
        if (zoomResetTimer.current) { window.clearTimeout(zoomResetTimer.current); zoomResetTimer.current = null }
        if (el) el.scrollTop = 0
        lastCommittedProg.current = 0
        setReadProgress(0)
        firedCheckpoints.current.clear()
    }, [chapter?.id])

    // Zoom change: preserve scroll position
    useLayoutEffect(() => {
        const el = scrollRef.current
        if (!el || zoomPrevPct.current === zoomPct) { zoomPrevPct.current = zoomPct; return }

        const oldMax      = Math.max(0, el.scrollHeight - el.clientHeight)
        const oldProgress = oldMax > 0
            ? Math.min(1, Math.max(0, el.scrollTop / oldMax))
            : Math.min(1, Math.max(0, readProgressRef.current))

        zoomChanging.current = true
        if (zoomResetTimer.current) window.clearTimeout(zoomResetTimer.current)

        const raf = requestAnimationFrame(() => {
            const newMax = Math.max(0, el.scrollHeight - el.clientHeight)
            el.scrollTop = newMax * oldProgress
            zoomResetTimer.current = window.setTimeout(() => {
                zoomChanging.current = false
                scheduleProgressUpdate()
            }, ZOOM_TRANSITION_MS + 30)
        })

        zoomPrevPct.current = zoomPct
        return () => cancelAnimationFrame(raf)
    }, [zoomPct, scheduleProgressUpdate])

    // Kick off progress update once pages finish loading
    useEffect(() => {
        if (loadingPages) return
        scheduleProgressUpdate()
        return () => { if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current) }
    }, [loadingPages, urls.length, chapter?.id, scheduleProgressUpdate])

    // ResizeObserver to catch image-driven height changes
    useEffect(() => {
        const inner = pagesInnerRef.current
        if (!inner || loadingPages) return
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScrollProgress) : null
        ro?.observe(inner)
        return () => ro?.disconnect()
    }, [loadingPages, urls.length, chapter?.id, updateScrollProgress])

    const goToChapter = useCallback((ch) => {
        if (!ch?.id || navBusy) return
        persistLocal()
        void flushReading({ queueFirst: true })
        setNavBusy(true)
        navigate(
            `/dashboard/lifesync/anime/manga/read/${encodeURIComponent(String(mangaId))}/${encodeURIComponent(String(ch.id))}${readerSearch}`,
            { replace: true, state: { ...(location.state || {}), source, browseTranslatedLang, from: closeTo } }
        )
    }, [browseTranslatedLang, closeTo, flushReading, location.state, mangaId, navBusy, navigate, persistLocal, readerSearch, source])

    // Restore scroll to resume position — or, if the saved progress was essentially
    // finished (95-100%) and a next chapter exists, open that instead of re-showing
    // the last few panels of the chapter the user already finished.
    useEffect(() => {
        if (loadingPages || !manga?.id || !chapter?.id || !urls.length) return
        if (!resumeChapterId || String(chapter.id) !== resumeChapterId) return
        if (!(resumePercent > 0 && resumePercent < 100)) return
        const key = `${manga.source || source}:${manga.id}:${chapter.id}`
        if (resumeRestoreKey.current === key) return
        resumeRestoreKey.current = key

        if (resumePercent >= 95 && nextCh) {
            goToChapter(nextCh)
            return
        }

        const el = scrollRef.current
        if (!el) return
        const raf = requestAnimationFrame(() => {
            el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight) * (resumePercent / 100)
            scheduleProgressUpdate()
        })
        return () => cancelAnimationFrame(raf)
    }, [chapter?.id, goToChapter, loadingPages, manga?.id, manga?.source, nextCh, resumeChapterId, resumePercent, scheduleProgressUpdate, source, urls.length])

    // Keep latestProgress ref in sync (for flush callbacks  ref update only, no render)
    useEffect(() => {
        if (!manga?.id || !chapter?.id) return
        let pct = normalizeReadPercent(readProgress * 100)
        if (pct <= 0 && resumeChapterId && String(chapter.id) === resumeChapterId && resumePercent > 0)
            pct = resumePercent
        const prev = latestProgress.current
        if (prev?.manga?.id === manga.id && prev?.chapter?.id === chapter.id && pct <= 0 && Number(prev?.percent || 0) > 0)
            pct = Number(prev.percent)
        latestProgress.current = { manga, chapter, percent: pct }
    }, [readProgress, chapter, manga, resumeChapterId, resumePercent])

    // Checkpoint-driven progress save: fire exactly once per checkpoint per chapter.
    useEffect(() => {
        if (!manga?.id || !chapter?.id) return
        const pct = Math.round(readProgress * 100)
        checkAndFireCheckpoint(pct)
    }, [chapter?.id, manga?.id, readProgress, checkAndFireCheckpoint])

    // Flush on online / tab visible
    useEffect(() => {
        const onOnline  = () => void flushQueued()
        const onVisible = () => { if (document.visibilityState === 'visible') void flushQueued() }
        window.addEventListener('online', onOnline)
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            window.removeEventListener('online', onOnline)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [flushQueued])

    // Flush on page hide / unload / unmount
    useEffect(() => {
        const onPageHide = () => {
            persistLocal()
            void flushReading({ keepalive: true, queueFirst: true })
            void flushQueued({ keepalive: true, maxItems: 4 })
        }
        const onBeforeUnload = () => {
            persistLocal()
            void flushReading({ keepalive: true, queueFirst: true })
        }
        window.addEventListener('pagehide', onPageHide)
        window.addEventListener('beforeunload', onBeforeUnload)
        return () => {
            window.removeEventListener('pagehide', onPageHide)
            window.removeEventListener('beforeunload', onBeforeUnload)
            if (remoteFlushTimer.current) { window.clearTimeout(remoteFlushTimer.current); remoteFlushTimer.current = null }
            persistLocal()
            void flushReading({ queueFirst: true })
            void flushQueued({ maxItems: 6 })
        }
    }, [flushQueued, flushReading, persistLocal])

    // Unlock navBusy after route-driven chapter switch
    useEffect(() => {
        if (navBusy && String(chapterIdParam || '').trim()) setNavBusy(false)
    }, [chapterIdParam, navBusy])

    // Fullscreen state sync
    useEffect(() => {
        const sync = () => {
            const el = readerRootRef.current
            setFullscreen(Boolean(el) && (document.fullscreenElement === el || document.webkitFullscreenElement === el))
        }
        sync()
        document.addEventListener('fullscreenchange', sync)
        document.addEventListener('webkitfullscreenchange', sync)
        return () => {
            document.removeEventListener('fullscreenchange', sync)
            document.removeEventListener('webkitfullscreenchange', sync)
        }
    }, [])

    // Clamp zoom when fullscreen toggles
    useEffect(() => {
        setZoomPct(prev => clampZoom(prev, fullscreen))
    }, [fullscreen])

    // Keyboard: Escape
    useEffect(() => {
        const onKey = (e) => {
            if (e.key !== 'Escape') return
            if (fullscreen) { e.preventDefault(); void exitFullscreen(); return }
            closeReader()
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [fullscreen]) // eslint-disable-line react-hooks/exhaustive-deps
    // ^ closeReader/exitFullscreen are stable (defined below with useCallback)

    // ── actions ───────────────────────────────────────────────────────────────

    const enterFullscreen = useCallback(async () => {
        const el = readerRootRef.current
        if (!el) return
        if (document.fullscreenElement === el || document.webkitFullscreenElement === el) return
        try { await el.requestFullscreen?.({ navigationUI: 'hide' }); return } catch { /* ignore */ }
        try { el.webkitRequestFullscreen?.() } catch { /* ignore */ }
    }, [])

    const exitFullscreen = useCallback(async () => {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) return
        try { await document.exitFullscreen?.(); return } catch { /* ignore */ }
        try { document.webkitExitFullscreen?.() } catch { /* ignore */ }
    }, [])

    const adjustZoom = useCallback((dir) => {
        const step = fullscreen ? ZOOM_STEP_FS : ZOOM_STEP
        setZoomPct(prev => clampZoom(prev + (Number(dir) >= 0 ? step : -step), fullscreen))
    }, [fullscreen])

    const closeReader = useCallback(() => {
        persistLocal()
        void flushReading({ keepalive: true, queueFirst: true })
        void flushQueued({ maxItems: 6 })
        navigate(closeTo)
    }, [closeTo, flushQueued, flushReading, navigate, persistLocal])

    // ── gamepad ───────────────────────────────────────────────────────────────

    const controllerHandlers = useMemo(() => ({
        [XBOX_GAMEPAD_BUTTONS.LB]: () => { if (prevCh && !navBusy && !busy && !loadingPages) goToChapter(prevCh) },
        [XBOX_GAMEPAD_BUTTONS.RB]: () => { if (nextCh && !navBusy && !busy && !loadingPages) goToChapter(nextCh) },
        [XBOX_GAMEPAD_BUTTONS.LT]: () => adjustZoom(-1),
        [XBOX_GAMEPAD_BUTTONS.RT]: () => adjustZoom(1),
        [XBOX_GAMEPAD_BUTTONS.X]:  () => { if (fullscreen) void exitFullscreen(); else void enterFullscreen() },
        [XBOX_GAMEPAD_BUTTONS.B]:  () => { if (fullscreen) void exitFullscreen(); else closeReader() },
    }), [adjustZoom, busy, closeReader, enterFullscreen, exitFullscreen, goToChapter, loadingPages, navBusy, nextCh, prevCh, fullscreen])

    useLifeSyncGamepadInput({
        enabled: controllerSupportEnabled,
        handlers: controllerHandlers,
        repeatableButtons: [XBOX_GAMEPAD_BUTTONS.LT, XBOX_GAMEPAD_BUTTONS.RT],
    })

    // ── early exit ────────────────────────────────────────────────────────────

    if (!isLifeSyncConnected) return null

    // ── render ────────────────────────────────────────────────────────────────

    const progressPct = `${Math.round(readProgress * 1000) / 10}%`

    return (
        <div
            ref={readerRootRef}
            className="lifesync-manga-read fixed inset-0 z-[9999] flex h-dvh max-h-dvh w-full max-w-[100vw] flex-col overflow-hidden bg-black"
        >
            {/* ── header (hidden in fullscreen) ── */}
            {!fullscreen && (
                <header className={`shrink-0 border-b border-white/10 px-2 py-2 ${LOW_END ? 'bg-black' : 'bg-black/70 backdrop-blur-xl'}`}>
                    <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={closeReader}
                            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 text-[11px] font-semibold text-white"
                            title="Back to list"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                            </svg>
                            <span className="hidden sm:inline">Back</span>
                        </button>

                        <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-semibold text-white">{decodeHtmlEntities(manga?.title) || 'Manga'}</p>
                            <p className="truncate text-[10px] text-white/60">{formatChapterLabel(chapter)}</p>
                        </div>

                        {/* Zoom slider  hidden on small screens */}
                        <div className="hidden md:flex items-center gap-2">
                            <label className="text-[10px] font-semibold text-white/60 tabular-nums" htmlFor="manga-zoom">
                                Zoom {Math.round(zoomScale * 100)}%
                            </label>
                            <input
                                id="manga-zoom"
                                type="range"
                                min={ZOOM_MIN}
                                max={ZOOM_MAX}
                                step={1}
                                value={zoomPct}
                                onChange={e => setZoomPct(clampZoom(Number(e.target.value)))}
                                className="w-28 accent-[var(--mx-color-c6ff00)]"
                            />
                        </div>

                        <label className="sr-only" htmlFor="manga-chapter-select">Chapter</label>
                        <select
                            id="manga-chapter-select"
                            value={chapter?.id ? String(chapter.id) : ''}
                            onChange={e => {
                                const id = e.target.value
                                if (!id) return
                                const ch = sortedChapters.find(c => String(c?.id) === id)
                                if (ch) goToChapter(ch)
                            }}
                            disabled={navBusy || busy || loadingPages || !sortedChapters.length}
                            className="min-h-11 min-w-32 max-w-64 flex-1 rounded-lg border border-white/20 bg-white/5 px-3 text-[11px] font-semibold text-white focus:outline-none focus:ring-2 focus:ring-(--mx-color-c6ff00)/40 disabled:opacity-50 sm:flex-none sm:min-w-40 sm:max-w-64"
                        >
                            {!sortedChapters.length
                                ? <option value="">Loading…</option>
                                : sortedChapters.map(ch => (
                                    <option key={String(ch?.id)} value={String(ch?.id)}>
                                        {formatChapterLabel(ch) || 'Chapter'}
                                    </option>
                                ))
                            }
                        </select>

                        <button
                            type="button"
                            disabled={!prevCh || navBusy || busy || loadingPages}
                            onClick={() => prevCh && goToChapter(prevCh)}
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/20 bg-white/5 px-3 text-[11px] font-semibold text-white disabled:opacity-40"
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
                            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/20 bg-white/5 px-3 text-[11px] font-semibold text-white disabled:opacity-40"
                            title="Next chapter"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                        <button
                            type="button"
                            onClick={() => void enterFullscreen()}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-3 text-[11px] font-semibold text-white"
                            title="Fullscreen"
                        >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75h5.5m-5.5 0v5.5m0-5.5L9 9.25m11.25-5.5h-5.5m5.5 0v5.5m0-5.5L15 9.25M3.75 20.25h5.5m-5.5 0v-5.5m0 5.5L9 14.75m11.25 5.5h-5.5m5.5 0v-5.5m0 5.5L15 14.75" />
                            </svg>
                            <span className="hidden sm:inline">Fullscreen</span>
                        </button>
                    </div>
                </header>
            )}

            {/* ── scroll area ── */}
            <div
                ref={scrollRef}
                onScroll={onReaderScroll}
                className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {busy        && <p className="p-8 text-center text-[13px] text-white/40">Opening reader…</p>}
                {error       && <p className="p-8 text-center text-[13px] text-red-400">{error}</p>}
                {loadingPages && <PagesSkeleton />}
                {loadErr && !loadingPages && <p className="p-8 text-center text-[13px] text-red-400">{loadErr}</p>}
                {!loadingPages && !loadErr && !urls.length && (
                    <p className="p-8 text-center text-[13px] text-white/40">No page images returned for this chapter.</p>
                )}

                <div
                    ref={pagesInnerRef}
                    className={`lifesync-manga-read-media mx-auto pb-8 ${fullscreen ? 'max-w-none pt-0' : 'max-w-3xl pt-2'}`}
                    style={{
                        transform:       `scale(${zoomScale})`,
                        transformOrigin: 'top center',
                        transition:      `transform ${ZOOM_TRANSITION_MS}ms cubic-bezier(0.2,0,0,1)`,
                        willChange:      LOW_END ? 'auto' : 'transform',
                    }}
                >
                    {urls.map((src, i) => (
                        <div key={`${chapter?.id || 'ch'}-${i}`} className="w-full bg-black">
                            <img
                                src={src}
                                alt={`Page ${i + 1}`}
                                className="lifesync-manga-read-media w-full bg-black"
                                loading={i < INITIAL_PAGE_BURST ? 'eager' : 'lazy'}
                                fetchPriority={i < INITIAL_PAGE_BURST ? 'high' : 'low'}
                                decoding="async"
                                style={{ willChange: 'transform' }}
                                onLoad={onPageImageLoad}
                                {...imgProps(src)}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* ── footer ── */}
            <footer className={`shrink-0 border-t border-white/10 px-3 py-2 ${LOW_END ? 'bg-black' : 'bg-black/85 backdrop-blur-xl'}`}>
                <div className="mx-auto max-w-3xl">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full bg-[var(--mx-color-c6ff00)]"
                            style={{ width: progressPct }}
                            role="progressbar"
                            aria-valuenow={Math.round(readProgress * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Scroll position in this chapter"
                        />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-white/50">
                        {!fullscreen ? (
                            <span>
                                {urls.length > 0 ? `${urls.length} page${urls.length === 1 ? '' : 's'}` : loadingPages ? '…' : ''}
                            </span>
                        ) : (
                            <div className="inline-flex items-center gap-1.5 text-white/80">
                                <button
                                    type="button"
                                    onClick={() => adjustZoom(-1)}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/20 bg-black/40 text-[12px] font-bold text-white"
                                    title="Zoom out"
                                >−</button>
                                <span className="rounded border border-white/15 bg-black/35 px-2 py-0.5 tabular-nums">
                                    Zoom {Math.round(zoomScale * 100)}%
                                </span>
                                <input
                                    type="range"
                                    min={ZOOM_MIN_FS}
                                    max={ZOOM_MAX_FS}
                                    step={1}
                                    value={clampZoom(zoomPct, true)}
                                    onChange={e => setZoomPct(clampZoom(Number(e.target.value), true))}
                                    className="w-28 accent-[var(--mx-color-c6ff00)]"
                                    aria-label="Zoom"
                                />
                                <button
                                    type="button"
                                    onClick={() => adjustZoom(1)}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-white/20 bg-black/40 text-[12px] font-bold text-white"
                                    title="Zoom in"
                                >+</button>
                                <button
                                    type="button"
                                    onClick={() => void exitFullscreen()}
                                    className="inline-flex items-center rounded border border-white/20 bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white"
                                    title="Exit fullscreen"
                                >Exit</button>
                            </div>
                        )}
                        <span className="tabular-nums">{Math.round(readProgress * 100)}% through chapter</span>
                    </div>
                </div>
            </footer>

            {/* Controller hint overlay */}
            <ControllerHintOverlay
                dark
                position="bottom-right"
                cols={2}
                hints={[
                    { btns: ['LB'], label: 'Prev chapter' },
                    { btns: ['RB'], label: 'Next chapter' },
                    { btns: ['LT'], label: 'Zoom out' },
                    { btns: ['RT'], label: 'Zoom in' },
                    { btns: ['X'], label: 'Fullscreen' },
                    { btns: ['B'], label: 'Close reader' },
                ]}
            />
        </div>
    )
}
