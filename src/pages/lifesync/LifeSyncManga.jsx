import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MangaReadingShelf } from '../../components/lifesync/MangaReadingRail'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch } from '../../lib/lifesyncApi'
import { compareChapters, formatChapterLabel } from '../../lib/mangaChapterUtils'

function MangaCard({ manga, onClick }) {
    const rating = manga.ratings?.average ?? manga.ratingAverage
    const ratingNum = rating != null ? Number(rating) : null
    const showRating = ratingNum != null && Number.isFinite(ratingNum) && ratingNum > 0
    return (
        <button type="button" onClick={() => onClick?.(manga)} className="group w-full text-left">
            <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#f5f5f7]">
                    {manga.coverUrl ? (
                        <img src={manga.coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                        </div>
                    )}
                    {manga.status && (
                        <span className="absolute left-2 top-2 bg-white/90 text-[#1d1d1f] text-[10px] font-medium px-2 py-0.5 rounded-lg capitalize">{manga.status}</span>
                    )}
                    {manga.contentRating && manga.contentRating !== 'safe' && (
                        <span className="absolute right-2 top-2 bg-amber-100 text-amber-700 text-[10px] font-medium px-1.5 py-0.5 rounded-lg uppercase">{manga.contentRating}</span>
                    )}
                    {manga.source && manga.source !== 'mangadex' && (
                        <span className="absolute left-2 bottom-2 bg-black/60 text-white text-[9px] font-medium px-1.5 py-0.5 rounded uppercase backdrop-blur-sm">
                            {manga.source === 'mangadistrict' ? 'District' : manga.source === 'hentaifox' ? 'HF' : manga.source}
                        </span>
                    )}
                </div>
                <div className="p-3">
                    <p className="text-[13px] font-semibold text-[#1d1d1f] line-clamp-2">{manga.title}</p>
                    {manga.author && <p className="mt-0.5 text-[11px] text-[#86868b] line-clamp-1">{manga.author}</p>}
                    <div className="flex flex-wrap gap-1 mt-1.5">
                        {manga.year && <span className="bg-[#f5f5f7] text-[#86868b] text-[10px] px-1.5 py-0.5 rounded">{manga.year}</span>}
                        {showRating && (
                            <span className="bg-amber-50 text-amber-700 text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <svg className="w-2.5 h-2.5 fill-amber-500 text-amber-500" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                {ratingNum.toFixed(1)}
                            </span>
                        )}
                        {manga.tags?.slice(0, 2).map(tag => (
                            <span key={tag} className="bg-[#C6FF00]/10 text-[#1d1d1f] text-[10px] px-1.5 py-0.5 rounded">{tag}</span>
                        ))}
                    </div>
                </div>
            </div>
        </button>
    )
}

function MangaReader({ manga, chapter, sortedChapters, chapterIndex, onClose, onChangeChapter, onReportProgress }) {
    const [pack, setPack] = useState(null)
    const [loadErr, setLoadErr] = useState('')
    const [loading, setLoading] = useState(true)
    const [dataSaver, setDataSaver] = useState(false)

    useEffect(() => {
        if (!onReportProgress || !manga?.id || !chapter?.id) return undefined
        onReportProgress(manga, chapter)
        return undefined
    }, [manga, chapter, onReportProgress])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            setLoading(true)
            setLoadErr('')
            setPack(null)
            const path =
                manga.source === 'hentaifox'
                    ? `/api/manga/hentaifox/chapter/${encodeURIComponent(chapter.id)}`
                    : manga.source === 'mangadistrict'
                        ? `/api/manga/mangadistrict/chapter/${encodeURIComponent(manga.id)}/${encodeURIComponent(chapter.id)}`
                        : `/api/manga/pages/${chapter.id}`
            try {
                const data = await lifesyncFetch(path)
                if (!cancelled) setPack(data)
            } catch (e) {
                if (!cancelled) setLoadErr(e.message || 'Could not load chapter pages')
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [chapter.id, manga.id, manga.source])

    const urls = useMemo(() => {
        if (!pack) return []
        if (dataSaver && pack.dataSaver?.length) return pack.dataSaver
        return pack.pages || []
    }, [pack, dataSaver])

    const idx =
        typeof chapterIndex === 'number' && chapterIndex >= 0
            ? chapterIndex
            : sortedChapters.findIndex(c => c.id === chapter.id)
    const safeIdx = idx >= 0 ? idx : -1

    const prevCh = safeIdx > 0 ? sortedChapters[safeIdx - 1] : null
    const nextCh =
        safeIdx >= 0 && safeIdx < sortedChapters.length - 1 ? sortedChapters[safeIdx + 1] : null

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0a0a0a]">
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/70 px-3 py-2 backdrop-blur-xl">
                <div className="min-w-0 flex-1">
                    <button type="button" onClick={onClose} className="text-left text-[12px] font-semibold text-[#C6FF00] hover:underline">
                        ← Back to list
                    </button>
                    <p className="truncate text-[11px] text-[#86868b]">{manga.title}</p>
                    <p className="truncate text-[10px] text-[#a1a1a6]">{formatChapterLabel(chapter)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[#a1a1a6]">
                        <input
                            type="checkbox"
                            checked={dataSaver}
                            onChange={e => setDataSaver(e.target.checked)}
                            className="rounded border-[#3a3a3c] bg-[#1c1c1e]"
                        />
                        Smaller images
                    </label>
                    <button
                        type="button"
                        disabled={!prevCh}
                        onClick={() => prevCh && onChangeChapter(prevCh)}
                        className="inline-flex items-center gap-0.5 rounded-lg border border-[#3a3a3c] bg-[#1c1c1e] px-2 py-1.5 text-[11px] text-[#f5f5f7] hover:bg-[#2c2c2e] disabled:opacity-40"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        Prev
                    </button>
                    <button
                        type="button"
                        disabled={!nextCh}
                        onClick={() => nextCh && onChangeChapter(nextCh)}
                        className="inline-flex items-center gap-0.5 rounded-lg border border-[#3a3a3c] bg-[#1c1c1e] px-2 py-1.5 text-[11px] text-[#f5f5f7] hover:bg-[#2c2c2e] disabled:opacity-40"
                    >
                        Next
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto">
                {loading && <p className="p-8 text-center text-[13px] text-[#86868b]">Loading pages…</p>}
                {loadErr && !loading && <p className="p-8 text-center text-[13px] text-red-400">{loadErr}</p>}
                {!loading && !loadErr && urls.length === 0 && (
                    <p className="p-8 text-center text-[13px] text-[#86868b]">No page images returned for this chapter.</p>
                )}
                <div className="mx-auto max-w-3xl pb-8 pt-2">
                    {urls.map((src, i) => (
                        <img
                            key={`${chapter.id}-${i}`}
                            src={src}
                            alt={`Page ${i + 1}`}
                            className="w-full bg-black"
                            loading={i < 3 ? 'eager' : 'lazy'}
                            decoding="async"
                        />
                    ))}
                </div>
            </div>
        </div>,
        document.body
    )
}

function MangaDetail({ manga, onClose, source, onStartRead }) {
    const [detail, setDetail] = useState(null)
    const [chapters, setChapters] = useState(null)
    const [chapBusy, setChapBusy] = useState(false)
    const [descExpanded, setDescExpanded] = useState(false)

    useEffect(() => {
        if (!manga?.id) return undefined
        const src = manga.source || source

        if (src === 'hentaifox' || src === 'mangadistrict') {
            const list = Array.isArray(manga.chapters) ? manga.chapters : []
            setChapters({ data: [...list] })
            setDetail(null)
            setChapBusy(false)
            return undefined
        }

        let cancelled = false
        ;(async () => {
            setChapBusy(true)
            try {
                const d = await lifesyncFetch(`/api/manga/details/${manga.id}`).catch(() => null)
                if (!cancelled) setDetail(d)
                const c = await lifesyncFetch(`/api/manga/chapters/${manga.id}?limit=500&lang=en&order=asc`).catch(() => ({ data: [] }))
                if (!cancelled) setChapters(c)
            } catch {
                if (!cancelled) {
                    setChapters({ data: [] })
                }
            } finally {
                if (!cancelled) setChapBusy(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [manga?.id, manga?.source, source, manga?.chapters])

    const sortedChapters = useMemo(() => {
        const list = chapters?.data ? [...chapters.data] : []
        list.sort(compareChapters)
        return list
    }, [chapters])

    if (!manga) return null

    const d = detail || manga
    const src = manga.source || source
    const mergedManga = { ...d, id: d.id || manga.id, source: src }
    const tagList = d.tags?.length ? d.tags : manga.tags
    const coverImg = d.coverUrl || d.backgroundImageUrl || manga.coverUrl
    const rating = d.ratings?.average ?? d.ratingAverage
    const ratingNum = rating != null ? Number(rating) : null
    const showRating = ratingNum != null && Number.isFinite(ratingNum) && ratingNum > 0
    const cleanDesc = d.description ? String(d.description).replace(/<[^>]*>/g, '') : ''

    return createPortal(
        <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

            {/* Panel */}
            <div
                className="relative w-full max-w-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-white sm:rounded-2xl overflow-hidden shadow-2xl animate-[slideUp_0.3s_ease-out]"
                onClick={e => e.stopPropagation()}
            >
                {/* Hero section with blurred background + cover art */}
                <div className="relative shrink-0">
                    {coverImg && (
                        <>
                            <div className="absolute inset-0 overflow-hidden">
                                <img src={coverImg} alt="" className="w-full h-full object-cover scale-110 blur-2xl opacity-60" />
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-white" />
                        </>
                    )}
                    {!coverImg && <div className="absolute inset-0 bg-gradient-to-b from-[#1d1d1f] to-white" />}

                    {/* Close button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/90 hover:text-white transition-all"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    {/* Cover + title row */}
                    <div className="relative flex gap-4 sm:gap-5 px-5 sm:px-6 pt-5 pb-4">
                        <div className="shrink-0 w-28 sm:w-32">
                            {coverImg ? (
                                <img src={coverImg} alt="" className="w-full aspect-[2/3] object-cover rounded-xl shadow-lg ring-1 ring-black/10" />
                            ) : (
                                <div className="w-full aspect-[2/3] rounded-xl bg-[#f5f5f7] flex items-center justify-center">
                                    <svg className="w-10 h-10 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                                </div>
                            )}
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col justify-end pb-1">
                            <h2 className="text-[18px] sm:text-[22px] font-bold text-[#1d1d1f] leading-tight line-clamp-3">
                                {d.title || manga.title}
                            </h2>
                            {d.author && (
                                <p className="mt-1.5 text-[12px] text-[#86868b] flex items-center gap-1.5">
                                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    {d.author}
                                </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                {d.status && (
                                    <span className="inline-flex items-center gap-1 bg-[#C6FF00]/20 text-[#1d1d1f] text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize">
                                        <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'completed' || d.status === 'cancelled' ? 'bg-[#86868b]' : 'bg-[#C6FF00]'}`} />
                                        {d.status}
                                    </span>
                                )}
                                {d.year && <span className="text-[10px] font-medium text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full">{d.year}</span>}
                                {showRating && (
                                    <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                        <svg className="w-2.5 h-2.5 fill-amber-500" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                        {ratingNum.toFixed(1)}
                                    </span>
                                )}
                                {d.contentRating && d.contentRating !== 'safe' && (
                                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase">{d.contentRating}</span>
                                )}
                                {sortedChapters.length > 0 && (
                                    <span className="text-[10px] font-medium text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full">
                                        {sortedChapters.length} ch.
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <div className="px-5 sm:px-6 py-4 space-y-4">
                        {/* Tags */}
                        {tagList?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {tagList.map(t => (
                                    <span key={t} className="bg-[#f5f5f7] hover:bg-[#ebebed] text-[#1d1d1f] text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors cursor-default">{t}</span>
                                ))}
                            </div>
                        )}

                        {/* Description */}
                        {cleanDesc && (
                            <div>
                                <p className={`text-[13px] text-[#3a3a3c] leading-relaxed ${descExpanded ? '' : 'line-clamp-3'}`}>
                                    {cleanDesc}
                                </p>
                                {cleanDesc.length > 200 && (
                                    <button type="button" onClick={() => setDescExpanded(v => !v)} className="mt-1 text-[11px] font-semibold text-[#C6FF00] hover:underline">
                                        {descExpanded ? 'Show less' : 'Read more'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Chapters */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-[13px] font-bold text-[#1d1d1f]">
                                    {src === 'hentaifox' || src === 'mangadistrict' ? 'Chapters' : 'Chapters (English)'}
                                </h3>
                                {sortedChapters.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => onStartRead(mergedManga, sortedChapters[0], sortedChapters)}
                                        className="text-[11px] font-semibold text-white bg-[#1d1d1f] hover:bg-black px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                                    >
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                                        Start reading
                                    </button>
                                )}
                            </div>
                            {chapBusy ? (
                                <div className="flex items-center gap-2 py-6 justify-center">
                                    <div className="w-4 h-4 border-2 border-[#C6FF00] border-t-transparent rounded-full animate-spin" />
                                    <p className="text-[12px] text-[#86868b]">Loading chapters…</p>
                                </div>
                            ) : sortedChapters.length === 0 ? (
                                <div className="bg-[#f5f5f7] rounded-xl px-4 py-6 text-center">
                                    <p className="text-[12px] text-[#86868b]">
                                        {src === 'hentaifox' || src === 'mangadistrict' ? 'No chapters in listing.' : 'No English chapters found.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-[#e5e5ea] overflow-hidden">
                                    <ul className="max-h-80 overflow-y-auto divide-y divide-[#f0f0f0]">
                                        {sortedChapters.map((ch, i) => (
                                            <li key={ch.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => onStartRead(mergedManga, ch, sortedChapters)}
                                                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[#f5f5f7] transition-colors group"
                                                >
                                                    <span className="shrink-0 w-7 h-7 rounded-lg bg-[#f5f5f7] group-hover:bg-[#C6FF00]/20 flex items-center justify-center text-[10px] font-bold text-[#86868b] group-hover:text-[#1d1d1f] transition-colors">
                                                        {i + 1}
                                                    </span>
                                                    <span className="flex-1 min-w-0">
                                                        <span className="block text-[12px] font-medium text-[#1d1d1f] truncate">{formatChapterLabel(ch)}</span>
                                                        {ch.scanlationGroup && <span className="block text-[10px] text-[#86868b] truncate">{ch.scanlationGroup}</span>}
                                                    </span>
                                                    <svg className="w-3.5 h-3.5 shrink-0 text-[#d2d2d7] group-hover:text-[#C6FF00] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}

const SOURCES = [
    { id: 'mangadex', label: 'MangaDex' },
    { id: 'hentaifox', label: 'HentaiFox', nsfw: true },
    { id: 'mangadistrict', label: 'Manga District', nsfw: true },
]

const DEX_TABS = [
    { id: 'popular', label: 'Popular' },
    { id: 'recent', label: 'Recent' },
]

const NSFW_TABS = [
    { id: 'latest', label: 'Latest' },
    { id: 'directory', label: 'Directory' },
    { id: 'search', label: 'Search' },
]

export default function LifeSyncManga() {
    const location = useLocation()
    const navigate = useNavigate()
    const resumeKeyDone = useRef(null)
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)

    const [source, setSource] = useState('mangadex')
    const [tab, setTab] = useState('popular')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [selectedManga, setSelectedManga] = useState(null)
    const [reader, setReader] = useState(null)

    const [readingLoadBusy, setReadingLoadBusy] = useState(false)
    const [readingSyncBusy, setReadingSyncBusy] = useState(false)
    const [resumeBusy, setResumeBusy] = useState(false)

    // MangaDex state
    const [popular, setPopular] = useState([])
    const [recent, setRecent] = useState([])
    const [reading, setReading] = useState([])
    const [searchQ, setSearchQ] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)

    // HentaiFox state
    const [hfStatus, setHfStatus] = useState(null)
    const [hfLatest, setHfLatest] = useState(null)
    const [hfPage, setHfPage] = useState(1)
    const [hfAll, setHfAll] = useState([])
    const [hfFilter, setHfFilter] = useState('')
    const [hfSearchResults, setHfSearchResults] = useState([])
    const [hfSearchBusy, setHfSearchBusy] = useState(false)

    // Manga District state
    const [mdStatus, setMdStatus] = useState(null)
    const [mdLatest, setMdLatest] = useState(null)
    const [mdPage, setMdPage] = useState(1)
    const [mdSection, setMdSection] = useState('latest')
    const [mdAll, setMdAll] = useState([])
    const [mdFilter, setMdFilter] = useState('')
    const [mdSearchResults, setMdSearchResults] = useState([])
    const [mdSearchBusy, setMdSearchBusy] = useState(false)

    const loadReading = useCallback(async () => {
        setReadingLoadBusy(true)
        try {
            const d = await lifesyncFetch('/api/manga/reading')
            setReading(Array.isArray(d) ? d : d?.entries || [])
        } catch {
            setReading([])
        } finally {
            setReadingLoadBusy(false)
        }
    }, [])

    const syncReading = useCallback(async () => {
        setReadingSyncBusy(true)
        try {
            const d = await lifesyncFetch('/api/manga/reading/sync', { method: 'POST', json: {} })
            setReading(Array.isArray(d?.entries) ? d.entries : [])
        } catch {
            /* keep list */
        } finally {
            setReadingSyncBusy(false)
        }
    }, [])

    const saveProgress = useCallback(async (manga, chapter) => {
        if (!manga?.id || !chapter?.id) return
        const src =
            manga.source === 'mangadistrict' || manga.source === 'hentaifox'
                ? manga.source
                : 'mangadex'
        try {
            await lifesyncFetch('/api/manga/reading', {
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
                },
            })
        } catch {
            /* offline */
        }
    }, [])

    const resumeFromEntry = useCallback(async entry => {
        setResumeBusy(true)
        setError('')
        try {
            if (
                !nsfwEnabled &&
                (entry.source === 'hentaifox' || entry.source === 'mangadistrict')
            ) {
                setError('Enable NSFW content in LifeSync preferences to open this title.')
                return
            }
            if (entry.source === 'mangadex') {
                const detail = await lifesyncFetch(`/api/manga/details/${encodeURIComponent(entry.mangaId)}`)
                const feed = await lifesyncFetch(`/api/manga/chapters/${encodeURIComponent(entry.mangaId)}?limit=500&lang=en&order=asc`)
                const list = [...(feed.data || [])]
                list.sort(compareChapters)
                let ch = list.find(c => c.id === entry.lastChapterId)
                if (!ch && list.length) ch = list[list.length - 1]
                if (!ch) {
                    setError('No chapters available to resume.')
                    return
                }
                const m = { ...detail, source: 'mangadex' }
                const idx = list.findIndex(c => c.id === ch.id)
                setSelectedManga(null)
                setSource('mangadex')
                setReader({ manga: m, chapter: ch, sortedChapters: list, chapterIndex: idx })
                return
            }
            if (entry.source === 'mangadistrict') {
                const data = await lifesyncFetch(`/api/manga/mangadistrict/info/${encodeURIComponent(entry.mangaId)}`)
                const list = [...(data.chapters || [])]
                list.sort(compareChapters)
                let ch = list.find(c => c.id === entry.lastChapterId)
                if (!ch && list.length) ch = list[list.length - 1]
                if (!ch) {
                    setError('No chapters available to resume.')
                    return
                }
                const idx = list.findIndex(c => c.id === ch.id)
                setSelectedManga(null)
                setSource('mangadistrict')
                setReader({ manga: data, chapter: ch, sortedChapters: list, chapterIndex: idx })
                return
            }
            if (entry.source === 'hentaifox') {
                const data = await lifesyncFetch(`/api/manga/hentaifox/info/${encodeURIComponent(entry.mangaId)}`)
                const list = [...(data.chapters || [])]
                let ch = list.find(c => c.id === entry.lastChapterId)
                if (!ch && list.length) ch = list[0]
                if (!ch) {
                    setError('Could not open this title.')
                    return
                }
                const idx = list.findIndex(c => c.id === ch.id)
                setSelectedManga(null)
                setSource('hentaifox')
                setReader({ manga: data, chapter: ch, sortedChapters: list, chapterIndex: idx >= 0 ? idx : 0 })
            }
        } catch (e) {
            setError(e.message || 'Could not resume reading')
        } finally {
            setResumeBusy(false)
        }
    }, [nsfwEnabled])

    useEffect(() => {
        if (source === 'mangadex' && tab === 'reading') setTab('popular')
    }, [source, tab])

    useEffect(() => {
        const entry = location.state?.resumeEntry
        if (!entry?.mangaId || !entry?.source) return
        const k = `${entry.source}:${entry.mangaId}`
        if (resumeKeyDone.current === k) return
        resumeKeyDone.current = k
        void resumeFromEntry(entry).finally(() => {
            navigate(`${location.pathname}${location.search || ''}`, { replace: true, state: {} })
            resumeKeyDone.current = null
        })
    }, [location.state, location.pathname, location.search, navigate, resumeFromEntry])

    // Check NSFW source availability (only when NSFW is allowed — no UI for those sources otherwise)
    useEffect(() => {
        if (!isLifeSyncConnected || !nsfwEnabled) return
        lifesyncFetch('/api/manga/hentaifox/status').then(setHfStatus).catch(() => setHfStatus({ configured: false }))
        lifesyncFetch('/api/manga/mangadistrict/status').then(setMdStatus).catch(() => setMdStatus({ configured: false }))
    }, [isLifeSyncConnected, nsfwEnabled])

    useEffect(() => {
        if (!nsfwEnabled && (source === 'hentaifox' || source === 'mangadistrict')) {
            setSource('mangadex')
            setTab('popular')
        }
    }, [nsfwEnabled, source])

    useEffect(() => {
        if (nsfwEnabled) return
        const nsfwSrc = m => m?.source === 'hentaifox' || m?.source === 'mangadistrict'
        if (reader?.manga && nsfwSrc(reader.manga)) setReader(null)
        if (selectedManga && nsfwSrc(selectedManga)) setSelectedManga(null)
    }, [nsfwEnabled, reader, selectedManga])

    // MangaDex loaders
    const loadPopular = useCallback(async () => {
        try {
            const d = await lifesyncFetch('/api/manga/popular?limit=24')
            setPopular(d?.data || d || [])
        } catch { /* ignore */ }
    }, [])
    const loadRecent = useCallback(async () => {
        try {
            const d = await lifesyncFetch('/api/manga/recent?limit=24')
            setRecent(d?.data || d || [])
        } catch { /* ignore */ }
    }, [])

    const loadDex = useCallback(async () => {
        setBusy(true)
        setError('')
        try {
            await Promise.all([loadPopular(), loadRecent()])
        } catch (e) {
            setError(e.message || 'Failed')
        } finally {
            setBusy(false)
        }
    }, [loadPopular, loadRecent])

    useEffect(() => {
        if (!isLifeSyncConnected) return
        void loadReading()
    }, [isLifeSyncConnected, loadReading])

    useEffect(() => {
        if (isLifeSyncConnected && source === 'mangadex') loadDex()
    }, [isLifeSyncConnected, source, loadDex])

    // HentaiFox loaders
    const loadHfLatest = useCallback(async (page = 1) => {
        setBusy(true)
        setError('')
        try {
            const d = await lifesyncFetch(`/api/manga/hentaifox/latest/${page}`)
            setHfLatest(d)
            setHfPage(page)
        } catch (e) {
            setError(e.message || 'Failed to load HentaiFox')
        } finally {
            setBusy(false)
        }
    }, [])

    const loadHfAll = useCallback(async () => {
        setBusy(true)
        setError('')
        try {
            const d = await lifesyncFetch('/api/manga/hentaifox/all')
            setHfAll(d?.data || d || [])
        } catch (e) {
            setError(e.message || 'Failed to load directory')
        } finally {
            setBusy(false)
        }
    }, [])

    useEffect(() => {
        if (source !== 'hentaifox') return
        if (tab === 'latest' && !hfLatest) loadHfLatest(1)
        if (tab === 'directory' && hfAll.length === 0) loadHfAll()
    }, [source, tab, hfLatest, hfAll.length, loadHfLatest, loadHfAll])

    useEffect(() => {
        if (source !== 'hentaifox' || tab !== 'search') return
        const q = hfFilter.trim()
        if (!q) {
            setHfSearchResults([])
            return
        }
        let cancelled = false
        const t = setTimeout(async () => {
            setHfSearchBusy(true)
            try {
                const d = await lifesyncFetch(`/api/manga/hentaifox/search?q=${encodeURIComponent(q)}`)
                if (!cancelled) setHfSearchResults(d?.data || d || [])
            } catch {
                if (!cancelled) setHfSearchResults([])
            } finally {
                if (!cancelled) setHfSearchBusy(false)
            }
        }, 400)
        return () => {
            cancelled = true
            clearTimeout(t)
        }
    }, [source, tab, hfFilter])

    // Manga District loaders
    const loadMdLatest = useCallback(async (page = 1) => {
        setBusy(true)
        setError('')
        try {
            const d = await lifesyncFetch(`/api/manga/mangadistrict/latest/${page}?section=${mdSection}`)
            setMdLatest(d)
            setMdPage(page)
        } catch (e) {
            setError(e.message || 'Failed to load Manga District')
        } finally {
            setBusy(false)
        }
    }, [mdSection])

    const loadMdAll = useCallback(async () => {
        setBusy(true)
        setError('')
        try {
            const d = await lifesyncFetch(`/api/manga/mangadistrict/all?section=${mdSection}`)
            setMdAll(d?.data || d || [])
        } catch (e) {
            setError(e.message || 'Failed to load directory')
        } finally {
            setBusy(false)
        }
    }, [mdSection])

    useEffect(() => {
        setMdLatest(null)
        setMdAll([])
    }, [mdSection])

    useEffect(() => {
        if (source !== 'mangadistrict') return
        if (tab === 'latest' && !mdLatest) loadMdLatest(1)
        if (tab === 'directory' && mdAll.length === 0) loadMdAll()
    }, [source, tab, mdLatest, mdAll.length, loadMdLatest, loadMdAll])

    useEffect(() => {
        if (source !== 'mangadistrict' || tab !== 'search') return
        const q = mdFilter.trim()
        if (!q) {
            setMdSearchResults([])
            return
        }
        let cancelled = false
        const t = setTimeout(async () => {
            setMdSearchBusy(true)
            try {
                const d = await lifesyncFetch(`/api/manga/mangadistrict/search?q=${encodeURIComponent(q)}`)
                if (!cancelled) setMdSearchResults(d?.data || d || [])
            } catch {
                if (!cancelled) setMdSearchResults([])
            } finally {
                if (!cancelled) setMdSearchBusy(false)
            }
        }, 400)
        return () => {
            cancelled = true
            clearTimeout(t)
        }
    }, [source, tab, mdFilter])

    async function handleDexSearch(e) {
        e.preventDefault()
        if (!searchQ.trim()) return
        setSearching(true)
        try {
            const d = await lifesyncFetch(`/api/manga/search?q=${encodeURIComponent(searchQ.trim())}&limit=24`)
            setSearchResults(d?.data || d || [])
            setTab('search')
        } catch (e) {
            setError(e.message || 'Search failed')
        } finally {
            setSearching(false)
        }
    }

    async function handleSelectManga(manga) {
        const src = manga.source || source
        if (!nsfwEnabled && (src === 'hentaifox' || src === 'mangadistrict')) return
        setError('')
        try {
            if (src === 'hentaifox') {
                const data = await lifesyncFetch(`/api/manga/hentaifox/info/${encodeURIComponent(manga.id)}`)
                setSelectedManga({
                    ...data,
                    id: data.id || manga.id,
                    coverUrl: manga.coverUrl || data.coverUrl,
                    source: 'hentaifox',
                })
                return
            }
            if (src === 'mangadistrict') {
                const data = await lifesyncFetch(`/api/manga/mangadistrict/info/${encodeURIComponent(manga.id)}`)
                setSelectedManga({
                    ...data,
                    id: data.id || manga.id,
                    coverUrl: manga.coverUrl || data.coverUrl,
                    source: 'mangadistrict',
                })
                return
            }
            const data = await lifesyncFetch(`/api/manga/details/${manga.id}`)
            setSelectedManga({ ...data, source: 'mangadex' })
        } catch (e) {
            setError(e.message || 'Could not open manga')
        }
    }

    async function removeReadingEntry(entry) {
        try {
            await lifesyncFetch(`/api/manga/reading/${entry.source}/${entry.mangaId}`, { method: 'DELETE' })
            setReading(prev => prev.filter(r => !(r.source === entry.source && r.mangaId === entry.mangaId)))
        } catch (e) {
            setError(e.message || 'Failed to remove')
        }
    }

    function switchSource(s) {
        setSource(s)
        setSelectedManga(null)
        setReader(null)
        setTab(s === 'mangadex' ? 'popular' : 'latest')
        setError('')
    }

    function handleStartRead(mergedManga, chapter, sortedChapters) {
        const chapterIndex = sortedChapters.findIndex(c => c.id === chapter.id)
        setSelectedManga(null)
        setReader({
            manga: mergedManga,
            chapter,
            sortedChapters,
            chapterIndex: chapterIndex >= 0 ? chapterIndex : 0,
        })
    }

    const hfLastPage = Math.max(1, parseInt(String(hfLatest?.lastPage ?? '1'), 10) || 1)
    const hfCurPage = Math.min(hfLastPage, Math.max(1, parseInt(String(hfLatest?.currentPage ?? hfPage), 10) || 1))
    const mdLastPage = Math.max(1, parseInt(String(mdLatest?.lastPage ?? '1'), 10) || 1)
    const mdCurPage = Math.min(mdLastPage, Math.max(1, parseInt(String(mdLatest?.currentPage ?? mdPage), 10) || 1))

    const visibleReadingEntries = useMemo(() => {
        if (nsfwEnabled) return reading
        return reading.filter(e => e.source === 'mangadex')
    }, [reading, nsfwEnabled])

    const sourceChoices = useMemo(() => SOURCES.filter(s => !s.nsfw || nsfwEnabled), [nsfwEnabled])

    const currentItems = useMemo(() => {
        if (source === 'mangadex') {
            if (tab === 'popular') return popular
            if (tab === 'recent') return recent
            if (tab === 'search') return searchResults
        }
        if (source === 'hentaifox') {
            if (tab === 'latest') return hfLatest?.data || []
            if (tab === 'directory') return hfAll
            if (tab === 'search') return hfSearchResults
        }
        if (source === 'mangadistrict') {
            if (tab === 'latest') return mdLatest?.data || []
            if (tab === 'directory') return mdAll
            if (tab === 'search') return mdSearchResults
        }
        return []
    }, [source, tab, popular, recent, searchResults, hfLatest, hfAll, hfSearchResults, mdLatest, mdAll, mdSearchResults])

    const tabs = source === 'mangadex'
        ? [...DEX_TABS, ...(searchResults.length > 0 ? [{ id: 'search', label: 'Search Results' }] : [])]
        : NSFW_TABS

    if (!isLifeSyncConnected) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight mb-2">Manga</h1>
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-16 text-center">
                    <p className="text-[15px] font-bold text-[#1d1d1f] mb-2">LifeSync Not Connected</p>
                    <p className="text-[13px] text-[#86868b] mb-4">Connect LifeSync in your profile to access manga.</p>
                    <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors">
                        Go to Integrations
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {reader?.manga && reader?.chapter && (
                <MangaReader
                    manga={reader.manga}
                    chapter={reader.chapter}
                    sortedChapters={reader.sortedChapters}
                    chapterIndex={reader.chapterIndex}
                    onClose={() => setReader(null)}
                    onChangeChapter={ch => {
                        const idx = reader.sortedChapters.findIndex(c => c.id === ch.id)
                        setReader(r => (r ? { ...r, chapter: ch, chapterIndex: idx >= 0 ? idx : r.chapterIndex } : r))
                    }}
                    onReportProgress={saveProgress}
                />
            )}

            {selectedManga && (
                <MangaDetail
                    manga={selectedManga}
                    source={source}
                    onClose={() => setSelectedManga(null)}
                    onStartRead={handleStartRead}
                />
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Anime</p>
                    <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">Manga</h1>
                </div>
                <button
                    type="button"
                    onClick={() => (source === 'mangadex' ? loadDex() : source === 'hentaifox' ? (tab === 'latest' ? loadHfLatest(hfCurPage) : loadHfAll()) : tab === 'latest' ? loadMdLatest(mdCurPage) : loadMdAll())}
                    disabled={busy}
                    className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50 self-start"
                >
                    {busy ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>}

            <MangaReadingShelf
                entries={visibleReadingEntries}
                loading={readingLoadBusy}
                syncBusy={readingSyncBusy}
                nsfwHiddenCount={nsfwEnabled ? 0 : Math.max(0, reading.length - visibleReadingEntries.length)}
                onRefresh={() => loadReading()}
                onSync={() => syncReading()}
                onContinue={resumeFromEntry}
                onRemove={removeReadingEntry}
                continueDisabled={resumeBusy}
            />

            {/* Source selector — NSFW sources omitted entirely when NSFW is disabled in LifeSync preferences */}
            {sourceChoices.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {sourceChoices.map(s => {
                        const isNsfwNotConfigured =
                            (s.id === 'hentaifox' && hfStatus?.configured === false) ||
                            (s.id === 'mangadistrict' && mdStatus?.configured === false)
                        return (
                            <button
                                key={s.id}
                                type="button"
                                disabled={isNsfwNotConfigured}
                                onClick={() => switchSource(s.id)}
                                className={`rounded-xl px-4 py-2 text-[13px] font-semibold transition-all ${
                                    source === s.id
                                        ? 'bg-[#1d1d1f] text-white shadow-sm'
                                        : isNsfwNotConfigured
                                          ? 'cursor-not-allowed bg-[#f5f5f7] text-[#d2d2d7]'
                                          : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed] hover:text-[#1d1d1f]'
                                }`}
                                title={isNsfwNotConfigured ? 'Not configured on the server' : ''}
                            >
                                {s.label}
                                {s.nsfw && <span className="ml-1.5 text-[10px] opacity-60">NSFW</span>}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Manga District section sub-filter */}
            {source === 'mangadistrict' && tab !== 'search' && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">Section</span>
                    {['latest', 'censored', 'uncensored'].map(s => (
                        <button key={s} type="button" onClick={() => setMdSection(s)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition-all ${mdSection === s ? 'bg-[#C6FF00] text-[#1d1d1f] shadow-sm' : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'}`}>
                            {s === 'latest' ? 'All Latest' : s}
                        </button>
                    ))}
                </div>
            )}

            {/* Search bar */}
            {source === 'mangadex' && (
                <form onSubmit={handleDexSearch} className="flex gap-2">
                    <input type="search" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search MangaDex..." className="flex-1 px-4 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all" />
                    <button type="submit" disabled={searching} className="bg-[#1d1d1f] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-black transition-colors disabled:opacity-50">
                        {searching ? 'Searching...' : 'Search'}
                    </button>
                </form>
            )}

            {source === 'hentaifox' && tab === 'search' && (
                <input type="search" value={hfFilter} onChange={e => setHfFilter(e.target.value)} placeholder="Search HentaiFox..." className="w-full px-4 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all" />
            )}

            {source === 'mangadistrict' && tab === 'search' && (
                <input type="search" value={mdFilter} onChange={e => setMdFilter(e.target.value)} placeholder="Search Manga District..." className="w-full px-4 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all" />
            )}

            {/* Content tabs */}
            <div className="flex gap-1.5 overflow-x-auto pb-1">
                {tabs.map(t => (
                    <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all ${tab === t.id ? 'bg-[#C6FF00] text-[#1d1d1f] shadow-sm' : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Pagination for HentaiFox/MangaDistrict latest */}
            {source === 'hentaifox' && tab === 'latest' && hfLatest && (
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-[#86868b]">Page {hfCurPage} of {hfLastPage}</p>
                    <div className="flex gap-2">
                        <button type="button" disabled={busy || hfCurPage <= 1} onClick={() => loadHfLatest(hfCurPage - 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <button type="button" disabled={busy || hfCurPage >= hfLastPage} onClick={() => loadHfLatest(hfCurPage + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {source === 'mangadistrict' && tab === 'latest' && mdLatest && (
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-[#86868b]">Page {mdCurPage} of {mdLastPage}</p>
                    <div className="flex gap-2">
                        <button type="button" disabled={busy || mdCurPage <= 1} onClick={() => loadMdLatest(mdCurPage - 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <button type="button" disabled={busy || mdCurPage >= mdLastPage} onClick={() => loadMdLatest(mdCurPage + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {/* Content grid */}
            {currentItems.length > 0 ? (
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {currentItems.map((manga, i) => (
                        <MangaCard key={`${manga.source || source}-${manga.id || i}`} manga={{ ...manga, source: manga.source || source }} onClick={handleSelectManga} />
                    ))}
                </div>
            ) : !busy ? (
                <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm px-6 py-10 text-center">
                    <p className="text-[13px] text-[#86868b]">
                        {(source === 'hentaifox' || source === 'mangadistrict') && tab === 'search' && !(source === 'hentaifox' ? hfFilter : mdFilter).trim() ? 'Type a query to search.'
                            : (source === 'hentaifox' || source === 'mangadistrict') && tab === 'search' && (source === 'hentaifox' ? hfSearchBusy : mdSearchBusy) ? 'Searching...'
                            : 'No manga to display.'}
                    </p>
                </div>
            ) : null}
        </div>
    )
}
