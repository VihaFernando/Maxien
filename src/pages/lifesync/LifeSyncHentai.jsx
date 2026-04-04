import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch, lifesyncPatchPreferences, isPluginEnabled } from '../../lib/lifesyncApi'

function SeriesCard({ series, onSelect }) {
    return (
        <button type="button" onClick={() => onSelect?.(series)} className="group w-full text-left">
            <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#f5f5f7]">
                    {series.posterUrl ? (
                        <img src={series.posterUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75" /></svg>
                        </div>
                    )}
                    {series.episodeCount != null && (
                        <span className="absolute right-2 top-2 bg-white/90 text-[#1d1d1f] text-[10px] font-bold px-2 py-0.5 rounded-lg">
                            {series.episodeCount} ep
                        </span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-0 inset-x-0 p-3">
                        <p className="text-[13px] font-semibold text-white line-clamp-2 drop-shadow">{series.title}</p>
                    </div>
                </div>
            </div>
        </button>
    )
}

function EpisodeCard({ item, onSelect }) {
    return (
        <button type="button" onClick={() => onSelect?.(item)} className="group w-full text-left">
            <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="relative aspect-video w-full overflow-hidden bg-[#f5f5f7]">
                    {(item.posterUrl || item.thumbnail) ? (
                        <img src={item.posterUrl || item.thumbnail} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" /></svg>
                        </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-200 group-hover:bg-black/30 group-hover:opacity-100">
                        <span className="w-10 h-10 bg-[#C6FF00] rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 ml-0.5 text-[#1d1d1f]" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        </span>
                    </div>
                </div>
                <div className="p-3">
                    <p className="text-[13px] font-semibold text-[#1d1d1f] line-clamp-2">{item.title}</p>
                </div>
            </div>
        </button>
    )
}

function StreamPlayer({ slug, onClose }) {
    const [stream, setStream] = useState(null)
    const [busy, setBusy] = useState(true)

    useEffect(() => {
        if (!slug) return
        setBusy(true)
        lifesyncFetch(`/api/anime/hentai-ocean/stream?slug=${encodeURIComponent(slug)}`)
            .then(setStream)
            .catch(() => setStream(null))
            .finally(() => setBusy(false))
    }, [slug])

    if (!slug) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-[24px] shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#e5e5ea]">
                    <h3 className="text-[14px] font-bold text-[#1d1d1f] truncate">{stream?.title || 'Loading...'}</h3>
                    <button onClick={onClose} className="text-[#86868b] hover:text-[#1d1d1f] w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#f5f5f7] text-[16px] font-bold">×</button>
                </div>
                {busy ? (
                    <div className="px-8 py-20 text-center">
                        <div className="flex gap-1.5 justify-center">{[0, 150, 300].map(d => <span key={d} className="w-2.5 h-2.5 rounded-full bg-[#C6FF00] animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div>
                    </div>
                ) : stream?.embedUrl ? (
                    <div className="aspect-video w-full">
                        <iframe src={stream.embedUrl} className="w-full h-full" allowFullScreen allow="autoplay" title="Player" />
                    </div>
                ) : stream?.sources?.[0]?.url ? (
                    <div className="aspect-video w-full bg-black">
                        <video src={stream.sources[0].url} controls className="w-full h-full" autoPlay />
                    </div>
                ) : (
                    <div className="px-8 py-16 text-center">
                        <p className="text-[13px] text-[#86868b]">No stream source available.</p>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function LifeSyncHentai() {
    const { isLifeSyncConnected, lifeSyncUser, lifeSyncUpdatePlugins } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)
    const pluginEnabled = isPluginEnabled(prefs, 'pluginHentaiEnabled')

    const [catalog, setCatalog] = useState(null)
    const [searchQ, setSearchQ] = useState('')
    const [page, setPage] = useState(1)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [streamSlug, setStreamSlug] = useState(null)

    const load = useCallback(async (p = 1, q = '') => {
        setBusy(true)
        setError('')
        try {
            const params = new URLSearchParams({ page: String(p), perPage: '24' })
            if (q.trim()) params.set('q', q.trim())
            const data = await lifesyncFetch(`/api/anime/hentai-ocean/home?${params}`)
            setCatalog(data)
        } catch (e) {
            setError(e.message || 'Failed to load')
        } finally {
            setBusy(false)
        }
    }, [])

    useEffect(() => {
        if (isLifeSyncConnected && nsfwEnabled && pluginEnabled) load(1, '')
    }, [isLifeSyncConnected, nsfwEnabled, pluginEnabled, load])

    function handleSearch(e) {
        e.preventDefault()
        setPage(1)
        load(1, searchQ)
    }

    function goPage(p) {
        setPage(p)
        load(p, searchQ)
    }

    async function enableNsfw() {
        try {
            await lifesyncFetch('/api/auth/preferences', { method: 'PATCH', json: { nsfwContentEnabled: true } })
            window.location.reload()
        } catch { /* ignore */ }
    }

    if (!isLifeSyncConnected) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight mb-2">Hentai</h1>
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-16 text-center">
                    <p className="text-[15px] font-bold text-[#1d1d1f] mb-2">LifeSync Not Connected</p>
                    <p className="text-[13px] text-[#86868b] mb-4">Connect LifeSync in your profile first.</p>
                    <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors">
                        Go to Integrations
                    </Link>
                </div>
            </div>
        )
    }

    if (!nsfwEnabled || !pluginEnabled) {
        return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Anime</p>
                    <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">Hentai</h1>
                </div>
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-16 text-center">
                    <p className="text-[15px] font-bold text-[#1d1d1f] mb-2">Restricted Content</p>
                    <p className="text-[13px] text-[#86868b] mb-4">
                        {!nsfwEnabled ? 'NSFW content is disabled. Enable it in your LifeSync preferences.' : 'The Hentai plugin is disabled. Enable it in your profile integrations.'}
                    </p>
                    {!nsfwEnabled ? (
                        <button onClick={enableNsfw} className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors">
                            Enable NSFW Content
                        </button>
                    ) : (
                        <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors">
                            Go to Integrations
                        </Link>
                    )}
                </div>
            </div>
        )
    }

    const series = catalog?.series || []
    const items = catalog?.items || []
    const display = series.length > 0 ? series : items

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {streamSlug && <StreamPlayer slug={streamSlug} onClose={() => setStreamSlug(null)} />}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Anime</p>
                    <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">Hentai</h1>
                    <p className="text-[13px] text-[#86868b] mt-1">Browse and stream from Hentai Ocean.</p>
                </div>
                <button onClick={() => load(page, searchQ)} disabled={busy} className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50 self-start">
                    {busy ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>}

            <form onSubmit={handleSearch} className="flex gap-2">
                <input type="search" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search..." className="flex-1 px-4 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all" />
                <button type="submit" disabled={busy} className="bg-[#1d1d1f] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-black transition-colors disabled:opacity-50">Search</button>
            </form>

            {catalog?.catalogMeta && (
                <p className="text-[11px] text-[#86868b]">
                    {catalog.catalogMeta.totalSeries != null && <span>{catalog.catalogMeta.totalSeries} series</span>}
                    {catalog.catalogMeta.totalEpisodes != null && <span> · {catalog.catalogMeta.totalEpisodes} episodes</span>}
                </p>
            )}

            {display.length > 0 ? (
                <>
                    <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                        {display.map((item, i) => (
                            item.seriesKey || item.episodes
                                ? <SeriesCard key={item.seriesKey || i} series={item} onSelect={s => { if (s.episodes?.[0]?.slug) setStreamSlug(s.episodes[0].slug) }} />
                                : <EpisodeCard key={item.slug || i} item={item} onSelect={ep => { if (ep.slug) setStreamSlug(ep.slug) }} />
                        ))}
                    </div>
                    <div className="flex items-center justify-center gap-2">
                        <button disabled={page <= 1} onClick={() => goPage(page - 1)} className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-30">Prev</button>
                        <span className="text-[12px] text-[#86868b] px-2">Page {page}</span>
                        <button onClick={() => goPage(page + 1)} className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-30">Next</button>
                    </div>
                </>
            ) : !busy && (
                <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm px-6 py-10 text-center">
                    <p className="text-[13px] text-[#86868b]">No content to display.</p>
                </div>
            )}
        </div>
    )
}
