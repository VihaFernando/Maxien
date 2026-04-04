import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch } from '../../lib/lifesyncApi'

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

function ReadingCard({ entry, onRemove }) {
    return (
        <div className="bg-white rounded-[16px] border border-[#d2d2d7]/50 shadow-sm p-3 flex gap-3">
            <div className="w-14 h-20 shrink-0 rounded-xl overflow-hidden bg-[#f5f5f7]">
                {entry.coverUrl ? <img src={entry.coverUrl} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#1d1d1f] line-clamp-2">{entry.title}</p>
                <p className="text-[11px] text-[#86868b] mt-0.5">
                    {entry.source && <span className="capitalize">{entry.source === 'mangadistrict' ? 'Manga District' : entry.source === 'hentaifox' ? 'HentaiFox' : entry.source}</span>}
                    {entry.lastChapterLabel && <span> · Ch. {entry.lastChapterLabel}</span>}
                </p>
                {entry.hasNewChapter && <span className="inline-flex mt-1 bg-[#C6FF00]/20 text-[#1d1d1f] text-[10px] font-semibold px-2 py-0.5 rounded-full">New chapter</span>}
            </div>
            {onRemove && (
                <button onClick={() => onRemove(entry.source, entry.mangaId)} className="shrink-0 self-start p-1.5 text-[#86868b] hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            )}
        </div>
    )
}

function MangaDetail({ manga, onClose, source }) {
    const [detail, setDetail] = useState(null)
    const [chapters, setChapters] = useState([])
    const [busy, setBusy] = useState(true)

    useEffect(() => {
        if (!manga?.id) return
        const src = manga.source || source

        if (src === 'hentaifox') {
            lifesyncFetch(`/api/manga/hentaifox/info/${encodeURIComponent(manga.id)}`)
                .then(d => { setDetail(d); setChapters(d?.chapters || []) })
                .catch(() => setDetail(null))
                .finally(() => setBusy(false))
            return
        }
        if (src === 'mangadistrict') {
            lifesyncFetch(`/api/manga/mangadistrict/info/${encodeURIComponent(manga.id)}`)
                .then(d => { setDetail(d); setChapters(d?.chapters || []) })
                .catch(() => setDetail(null))
                .finally(() => setBusy(false))
            return
        }

        Promise.all([
            lifesyncFetch(`/api/manga/details/${manga.id}`).catch(() => null),
            lifesyncFetch(`/api/manga/chapters/${manga.id}?limit=20&order=asc`).catch(() => ({ data: [] })),
        ]).then(([d, c]) => {
            setDetail(d)
            setChapters(c?.data || [])
        }).finally(() => setBusy(false))
    }, [manga?.id, manga?.source, source])

    if (!manga) return null

    const d = detail || manga

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-[24px] shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="relative">
                    {(d.coverUrl || d.backgroundImageUrl) && <img src={d.coverUrl || d.backgroundImageUrl} alt="" className="w-full aspect-[3/2] object-cover rounded-t-[24px]" />}
                    <button onClick={onClose} className="absolute top-3 right-3 bg-white/90 hover:bg-white text-[#1d1d1f] w-8 h-8 rounded-full flex items-center justify-center shadow-sm text-[16px] font-bold">×</button>
                </div>
                <div className="p-6 space-y-4">
                    <h2 className="text-[20px] font-bold text-[#1d1d1f]">{d.title || manga.title}</h2>
                    {d.description && <p className="text-[13px] text-[#1d1d1f] leading-relaxed line-clamp-6">{d.description.replace(/<[^>]*>/g, '')}</p>}
                    {d.author && <p className="text-[12px] text-[#86868b]">Author: {d.author}</p>}
                    {d.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {d.tags.map(t => <span key={t} className="bg-[#f5f5f7] text-[#1d1d1f] text-[11px] font-medium px-2 py-0.5 rounded-full">{t}</span>)}
                        </div>
                    )}
                    {chapters.length > 0 && (
                        <div>
                            <h3 className="text-[13px] font-bold text-[#1d1d1f] mb-2">Chapters ({chapters.length})</h3>
                            <div className="space-y-1 max-h-[200px] overflow-y-auto">
                                {chapters.map(ch => (
                                    <div key={ch.id} className="text-[12px] text-[#1d1d1f] px-3 py-2 rounded-lg hover:bg-[#f5f5f7]">
                                        {ch.volume ? `Vol. ${ch.volume} ` : ''}Ch. {ch.chapter || '?'}{ch.title ? ` — ${ch.title}` : ''}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {busy && <div className="text-center py-4"><span className="text-[12px] text-[#86868b]">Loading details...</span></div>}
                </div>
            </div>
        </div>
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
    { id: 'reading', label: 'Reading' },
]

const NSFW_TABS = [
    { id: 'latest', label: 'Latest' },
    { id: 'directory', label: 'Directory' },
    { id: 'search', label: 'Search' },
]

export default function LifeSyncManga() {
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)

    const [source, setSource] = useState('mangadex')
    const [tab, setTab] = useState('popular')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [selectedManga, setSelectedManga] = useState(null)

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

    // Check NSFW source availability
    useEffect(() => {
        if (!isLifeSyncConnected) return
        lifesyncFetch('/api/manga/hentaifox/status').then(setHfStatus).catch(() => setHfStatus({ configured: false }))
        lifesyncFetch('/api/manga/mangadistrict/status').then(setMdStatus).catch(() => setMdStatus({ configured: false }))
    }, [isLifeSyncConnected, nsfwEnabled])

    // MangaDex loaders
    const loadPopular = useCallback(async () => {
        try { const d = await lifesyncFetch('/api/manga/popular?limit=24'); setPopular(d?.data || d || []) } catch { /* ignore */ }
    }, [])
    const loadRecent = useCallback(async () => {
        try { const d = await lifesyncFetch('/api/manga/recent?limit=24'); setRecent(d?.data || d || []) } catch { /* ignore */ }
    }, [])
    const loadReading = useCallback(async () => {
        try { const d = await lifesyncFetch('/api/manga/reading'); setReading(Array.isArray(d) ? d : d?.entries || []) } catch { /* ignore */ }
    }, [])

    const loadDex = useCallback(async () => {
        setBusy(true); setError('')
        try { await Promise.all([loadPopular(), loadRecent(), loadReading()]) }
        catch (e) { setError(e.message || 'Failed') }
        finally { setBusy(false) }
    }, [loadPopular, loadRecent, loadReading])

    useEffect(() => { if (isLifeSyncConnected && source === 'mangadex') loadDex() }, [isLifeSyncConnected, source, loadDex])

    // HentaiFox loaders
    const loadHfLatest = useCallback(async (page = 1) => {
        setBusy(true); setError('')
        try {
            const d = await lifesyncFetch(`/api/manga/hentaifox/latest/${page}`)
            setHfLatest(d); setHfPage(page)
        } catch (e) { setError(e.message || 'Failed to load HentaiFox') }
        finally { setBusy(false) }
    }, [])

    const loadHfAll = useCallback(async () => {
        setBusy(true); setError('')
        try { const d = await lifesyncFetch('/api/manga/hentaifox/all'); setHfAll(d?.data || d || []) }
        catch (e) { setError(e.message || 'Failed to load directory') }
        finally { setBusy(false) }
    }, [])

    useEffect(() => {
        if (source !== 'hentaifox') return
        if (tab === 'latest' && !hfLatest) loadHfLatest(1)
        if (tab === 'directory' && hfAll.length === 0) loadHfAll()
    }, [source, tab, hfLatest, hfAll.length, loadHfLatest, loadHfAll])

    useEffect(() => {
        if (source !== 'hentaifox' || tab !== 'search') return
        const q = hfFilter.trim()
        if (!q) { setHfSearchResults([]); return }
        let cancelled = false
        const t = setTimeout(async () => {
            setHfSearchBusy(true)
            try {
                const d = await lifesyncFetch(`/api/manga/hentaifox/search?q=${encodeURIComponent(q)}`)
                if (!cancelled) setHfSearchResults(d?.data || d || [])
            } catch { if (!cancelled) setHfSearchResults([]) }
            finally { if (!cancelled) setHfSearchBusy(false) }
        }, 400)
        return () => { cancelled = true; clearTimeout(t) }
    }, [source, tab, hfFilter])

    // Manga District loaders
    const loadMdLatest = useCallback(async (page = 1) => {
        setBusy(true); setError('')
        try {
            const d = await lifesyncFetch(`/api/manga/mangadistrict/latest/${page}?section=${mdSection}`)
            setMdLatest(d); setMdPage(page)
        } catch (e) { setError(e.message || 'Failed to load Manga District') }
        finally { setBusy(false) }
    }, [mdSection])

    const loadMdAll = useCallback(async () => {
        setBusy(true); setError('')
        try { const d = await lifesyncFetch(`/api/manga/mangadistrict/all?section=${mdSection}`); setMdAll(d?.data || d || []) }
        catch (e) { setError(e.message || 'Failed to load directory') }
        finally { setBusy(false) }
    }, [mdSection])

    useEffect(() => { setMdLatest(null); setMdAll([]) }, [mdSection])

    useEffect(() => {
        if (source !== 'mangadistrict') return
        if (tab === 'latest' && !mdLatest) loadMdLatest(1)
        if (tab === 'directory' && mdAll.length === 0) loadMdAll()
    }, [source, tab, mdLatest, mdAll.length, loadMdLatest, loadMdAll])

    useEffect(() => {
        if (source !== 'mangadistrict' || tab !== 'search') return
        const q = mdFilter.trim()
        if (!q) { setMdSearchResults([]); return }
        let cancelled = false
        const t = setTimeout(async () => {
            setMdSearchBusy(true)
            try {
                const d = await lifesyncFetch(`/api/manga/mangadistrict/search?q=${encodeURIComponent(q)}`)
                if (!cancelled) setMdSearchResults(d?.data || d || [])
            } catch { if (!cancelled) setMdSearchResults([]) }
            finally { if (!cancelled) setMdSearchBusy(false) }
        }, 400)
        return () => { cancelled = true; clearTimeout(t) }
    }, [source, tab, mdFilter])

    // MangaDex search
    async function handleDexSearch(e) {
        e.preventDefault()
        if (!searchQ.trim()) return
        setSearching(true)
        try {
            const d = await lifesyncFetch(`/api/manga/search?q=${encodeURIComponent(searchQ.trim())}&limit=24`)
            setSearchResults(d?.data || d || [])
            setTab('search')
        } catch (e) { setError(e.message || 'Search failed') }
        finally { setSearching(false) }
    }

    async function removeReading(src, mangaId) {
        try {
            await lifesyncFetch(`/api/manga/reading/${src}/${mangaId}`, { method: 'DELETE' })
            setReading(prev => prev.filter(r => !(r.source === src && r.mangaId === mangaId)))
        } catch (e) { setError(e.message || 'Failed to remove') }
    }

    function switchSource(s) {
        setSource(s)
        setSelectedManga(null)
        setTab(s === 'mangadex' ? 'popular' : 'latest')
        setError('')
    }

    const hfLastPage = Math.max(1, parseInt(String(hfLatest?.lastPage ?? '1'), 10) || 1)
    const hfCurPage = Math.min(hfLastPage, Math.max(1, parseInt(String(hfLatest?.currentPage ?? hfPage), 10) || 1))
    const mdLastPage = Math.max(1, parseInt(String(mdLatest?.lastPage ?? '1'), 10) || 1)
    const mdCurPage = Math.min(mdLastPage, Math.max(1, parseInt(String(mdLatest?.currentPage ?? mdPage), 10) || 1))

    const currentItems = useMemo(() => {
        if (source === 'mangadex') {
            if (tab === 'popular') return popular
            if (tab === 'recent') return recent
            if (tab === 'reading') return reading
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
    }, [source, tab, popular, recent, reading, searchResults, hfLatest, hfAll, hfSearchResults, mdLatest, mdAll, mdSearchResults])

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
            {selectedManga && <MangaDetail manga={selectedManga} source={source} onClose={() => setSelectedManga(null)} />}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Anime</p>
                    <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">Manga</h1>
                </div>
                <button
                    onClick={() => source === 'mangadex' ? loadDex() : source === 'hentaifox' ? (tab === 'latest' ? loadHfLatest(hfCurPage) : loadHfAll()) : (tab === 'latest' ? loadMdLatest(mdCurPage) : loadMdAll())}
                    disabled={busy}
                    className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50 self-start"
                >
                    {busy ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>}

            {/* Source selector */}
            <div className="flex gap-2 flex-wrap">
                {SOURCES.map(s => {
                    const disabled = s.nsfw && !nsfwEnabled
                    const isNsfwNotConfigured = (s.id === 'hentaifox' && hfStatus?.configured === false) || (s.id === 'mangadistrict' && mdStatus?.configured === false)
                    return (
                        <button
                            key={s.id}
                            type="button"
                            disabled={disabled || isNsfwNotConfigured}
                            onClick={() => switchSource(s.id)}
                            className={`px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                                source === s.id
                                    ? 'bg-[#1d1d1f] text-white shadow-sm'
                                    : disabled || isNsfwNotConfigured
                                        ? 'bg-[#f5f5f7] text-[#d2d2d7] cursor-not-allowed'
                                        : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#ebebed]'
                            }`}
                            title={disabled ? 'Enable NSFW in Settings to use this source' : isNsfwNotConfigured ? 'Not configured on the server' : ''}
                        >
                            {s.label}
                            {s.nsfw && <span className="ml-1.5 text-[10px] opacity-60">NSFW</span>}
                        </button>
                    )
                })}
            </div>

            {/* Manga District section sub-filter */}
            {source === 'mangadistrict' && tab !== 'search' && (
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#86868b] uppercase tracking-wider">Section</span>
                    {['latest', 'censored', 'uncensored'].map(s => (
                        <button key={s} onClick={() => setMdSection(s)} className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold capitalize transition-all ${mdSection === s ? 'bg-[#C6FF00] text-[#1d1d1f] shadow-sm' : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'}`}>
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
                    <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all ${tab === t.id ? 'bg-[#C6FF00] text-[#1d1d1f] shadow-sm' : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* Pagination for HentaiFox/MangaDistrict latest */}
            {source === 'hentaifox' && tab === 'latest' && hfLatest && (
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-[#86868b]">Page {hfCurPage} of {hfLastPage}</p>
                    <div className="flex gap-2">
                        <button disabled={busy || hfCurPage <= 1} onClick={() => loadHfLatest(hfCurPage - 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <button disabled={busy || hfCurPage >= hfLastPage} onClick={() => loadHfLatest(hfCurPage + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {source === 'mangadistrict' && tab === 'latest' && mdLatest && (
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-[#86868b]">Page {mdCurPage} of {mdLastPage}</p>
                    <div className="flex gap-2">
                        <button disabled={busy || mdCurPage <= 1} onClick={() => loadMdLatest(mdCurPage - 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <button disabled={busy || mdCurPage >= mdLastPage} onClick={() => loadMdLatest(mdCurPage + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {/* Content grid */}
            {source === 'mangadex' && tab === 'reading' && currentItems.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {currentItems.map(entry => <ReadingCard key={`${entry.source}-${entry.mangaId}`} entry={entry} onRemove={removeReading} />)}
                </div>
            ) : currentItems.length > 0 ? (
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {currentItems.map((manga, i) => <MangaCard key={`${manga.source || source}-${manga.id || i}`} manga={{ ...manga, source: manga.source || source }} onClick={setSelectedManga} />)}
                </div>
            ) : !busy && (
                <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm px-6 py-10 text-center">
                    <p className="text-[13px] text-[#86868b]">
                        {source === 'mangadex' && tab === 'reading' ? 'No reading progress saved yet.'
                            : (source === 'hentaifox' || source === 'mangadistrict') && tab === 'search' && !(source === 'hentaifox' ? hfFilter : mdFilter).trim() ? 'Type a query to search.'
                            : (source === 'hentaifox' || source === 'mangadistrict') && tab === 'search' && (source === 'hentaifox' ? hfSearchBusy : mdSearchBusy) ? 'Searching...'
                            : 'No manga to display.'}
                    </p>
                </div>
            )}
        </div>
    )
}
