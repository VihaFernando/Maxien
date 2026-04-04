import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch, lifesyncOAuthStartUrl } from '../../lib/lifesyncApi'

function AnimeCard({ node, ranking, onSelect }) {
    const anime = node || {}
    const pic = anime.main_picture?.large || anime.main_picture?.medium
    return (
        <button type="button" onClick={() => anime.id != null && onSelect?.(anime.id)} className="group w-full text-left">
            <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all">
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#f5f5f7]">
                    {pic ? (
                        <img src={pic} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-2.625 0V5.625m0 12.75v-12.75A1.125 1.125 0 014.5 4.5h15a1.125 1.125 0 011.125 1.125v12.75M3.375 19.5h17.25m0 0a1.125 1.125 0 001.125-1.125m0 0V5.625" /></svg>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    {ranking != null && (
                        <span className="absolute left-2 top-2 bg-[#C6FF00] text-[#1d1d1f] text-[10px] font-bold px-2 py-0.5 rounded-lg">#{ranking}</span>
                    )}
                    {anime.mean != null && (
                        <span className="absolute right-2 top-2 bg-white/90 text-[#1d1d1f] text-[10px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-0.5">
                            <svg className="w-3 h-3 text-amber-500 fill-amber-500" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                            {anime.mean}
                        </span>
                    )}
                    <div className="absolute bottom-0 inset-x-0 p-3">
                        <p className="text-[13px] font-semibold text-white line-clamp-2 drop-shadow">{anime.title}</p>
                        <div className="flex gap-1 mt-1">
                            {anime.media_type && <span className="bg-white/20 text-white text-[10px] font-medium px-1.5 py-0.5 rounded uppercase backdrop-blur-sm">{anime.media_type}</span>}
                            {anime.num_episodes != null && <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">{anime.num_episodes} ep</span>}
                        </div>
                    </div>
                </div>
            </div>
        </button>
    )
}

function MyListCard({ node, listStatus, onSelect }) {
    const anime = node || {}
    const pic = anime.main_picture?.large || anime.main_picture?.medium
    const st = listStatus || {}
    const statusColors = {
        watching: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        completed: 'bg-blue-50 text-blue-700 border-blue-100',
        on_hold: 'bg-amber-50 text-amber-700 border-amber-100',
        dropped: 'bg-red-50 text-red-700 border-red-100',
        plan_to_watch: 'bg-[#f5f5f7] text-[#86868b] border-[#e5e5ea]',
    }
    const badge = statusColors[st.status] || 'bg-[#f5f5f7] text-[#86868b] border-[#e5e5ea]'

    return (
        <button type="button" onClick={() => anime.id != null && onSelect?.(anime.id)} className="group w-full text-left">
            <div className="bg-white rounded-[16px] border border-[#d2d2d7]/50 shadow-sm p-3 flex gap-3 hover:shadow-md transition-all">
                <div className="w-16 h-24 shrink-0 rounded-xl overflow-hidden bg-[#f5f5f7]">
                    {pic ? <img src={pic} alt="" className="h-full w-full object-cover" loading="lazy" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold text-[#1d1d1f] line-clamp-2">{anime.title}</p>
                    <span className={`inline-flex mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border capitalize ${badge}`}>
                        {(st.status || '').replace(/_/g, ' ')}
                    </span>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-[#86868b]">
                        {st.score > 0 && <span className="flex items-center gap-0.5"><svg className="w-3 h-3 text-amber-500 fill-amber-500" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>{st.score}/10</span>}
                        {st.num_episodes_watched != null && <span>{st.num_episodes_watched} ep watched</span>}
                    </div>
                </div>
            </div>
        </button>
    )
}

function DetailPanel({ animeId, onClose }) {
    const [data, setData] = useState(null)
    const [busy, setBusy] = useState(true)

    useEffect(() => {
        lifesyncFetch(`/api/anime/details/${animeId}`)
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setBusy(false))
    }, [animeId])

    if (busy) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"><div className="flex gap-1.5">{[0, 150, 300].map(d => <span key={d} className="w-2.5 h-2.5 rounded-full bg-[#C6FF00] animate-bounce" style={{ animationDelay: `${d}ms` }} />)}</div></div>
    if (!data) return null

    const pic = data.main_picture?.large || data.main_picture?.medium
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-[24px] shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <div className="relative">
                    {pic && <img src={pic} alt="" className="w-full aspect-video object-cover rounded-t-[24px]" />}
                    <button onClick={onClose} className="absolute top-3 right-3 bg-white/90 hover:bg-white text-[#1d1d1f] w-8 h-8 rounded-full flex items-center justify-center shadow-sm text-[16px] font-bold">×</button>
                </div>
                <div className="p-6 space-y-4">
                    <h2 className="text-[20px] font-bold text-[#1d1d1f]">{data.title}</h2>
                    <div className="flex flex-wrap gap-2">
                        {data.mean != null && <span className="bg-[#C6FF00]/20 text-[#1d1d1f] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">★ {data.mean}</span>}
                        {data.status && <span className="bg-[#f5f5f7] text-[#86868b] text-[11px] font-semibold px-2.5 py-0.5 rounded-full capitalize">{data.status.replace(/_/g, ' ')}</span>}
                        {data.num_episodes != null && <span className="bg-[#f5f5f7] text-[#86868b] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">{data.num_episodes} episodes</span>}
                        {data.media_type && <span className="bg-[#f5f5f7] text-[#86868b] text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase">{data.media_type}</span>}
                    </div>
                    {data.genres?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                            {data.genres.map(g => <span key={g.id || g.name} className="bg-[#f5f5f7] text-[#1d1d1f] text-[11px] font-medium px-2 py-0.5 rounded-full">{g.name}</span>)}
                        </div>
                    )}
                    {data.synopsis && <p className="text-[13px] text-[#1d1d1f] leading-relaxed whitespace-pre-line">{data.synopsis}</p>}
                    {data.my_list_status && (
                        <div className="bg-[#f5f5f7] rounded-xl p-4 space-y-2">
                            <p className="text-[12px] font-bold text-[#1d1d1f]">Your List Status</p>
                            <div className="flex flex-wrap gap-2 text-[11px]">
                                <span className="bg-white text-[#1d1d1f] font-semibold px-2.5 py-0.5 rounded-full capitalize border border-[#e5e5ea]">{(data.my_list_status.status || '').replace(/_/g, ' ')}</span>
                                {data.my_list_status.score > 0 && <span className="bg-white text-[#1d1d1f] font-semibold px-2.5 py-0.5 rounded-full border border-[#e5e5ea]">Score: {data.my_list_status.score}/10</span>}
                                {data.my_list_status.num_episodes_watched != null && <span className="bg-white text-[#86868b] font-medium px-2.5 py-0.5 rounded-full border border-[#e5e5ea]">{data.my_list_status.num_episodes_watched} ep watched</span>}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}

export default function LifeSyncAnime() {
    const { isLifeSyncConnected, lifeSyncUser, refreshLifeSyncMe } = useLifeSync()
    const [tab, setTab] = useState('seasonal')
    const [seasonal, setSeasonal] = useState([])
    const [ranking, setRanking] = useState([])
    const [myList, setMyList] = useState([])
    const [searchQ, setSearchQ] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [error, setError] = useState('')
    const [oauthMsg, setOauthMsg] = useState('')
    const [busy, setBusy] = useState(false)
    const [detailId, setDetailId] = useState(null)

    const malLinked = Boolean(lifeSyncUser?.integrations?.mal || lifeSyncUser?.integrations?.malUsername)

    const loadSeasonal = useCallback(async () => {
        try {
            const data = await lifesyncFetch('/api/anime/seasonal?limit=24&fields=mean,media_type,num_episodes')
            setSeasonal(data?.data || [])
        } catch { /* ignore */ }
    }, [])

    const loadRanking = useCallback(async () => {
        try {
            const data = await lifesyncFetch('/api/anime/ranking?type=all&limit=24')
            setRanking(data?.data || [])
        } catch { /* ignore */ }
    }, [])

    const loadMyList = useCallback(async () => {
        try {
            const data = await lifesyncFetch('/api/anime/mylist?limit=50')
            setMyList(data?.data || [])
        } catch { /* ignore */ }
    }, [])

    const load = useCallback(async () => {
        setBusy(true)
        setError('')
        try {
            await Promise.all([loadSeasonal(), loadRanking(), malLinked ? loadMyList() : Promise.resolve()])
        } catch (e) {
            setError(e.message || 'Failed to load anime data')
        } finally {
            setBusy(false)
        }
    }, [loadSeasonal, loadRanking, loadMyList, malLinked])

    useEffect(() => {
        if (isLifeSyncConnected) load()
    }, [isLifeSyncConnected, load])

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('maxien_lifesync_oauth')
            if (raw) {
                sessionStorage.removeItem('maxien_lifesync_oauth')
                const { type, text, provider } = JSON.parse(raw)
                if (provider?.startsWith('mal')) {
                    setOauthMsg(text)
                    if (type === 'error') setError(text)
                    refreshLifeSyncMe().then(() => load()).catch(() => {})
                    setTimeout(() => setOauthMsg(''), 8000)
                }
            }
        } catch { /* ignore */ }
    }, [refreshLifeSyncMe, load])

    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === 'visible' && isLifeSyncConnected) {
                refreshLifeSyncMe().then(() => load()).catch(() => {})
            }
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => document.removeEventListener('visibilitychange', onVisible)
    }, [isLifeSyncConnected, refreshLifeSyncMe, load])

    async function handleSearch(e) {
        e.preventDefault()
        if (!searchQ.trim()) return
        setSearching(true)
        try {
            const data = await lifesyncFetch(`/api/anime/search?q=${encodeURIComponent(searchQ.trim())}&limit=24`)
            setSearchResults(data?.data || [])
            setTab('search')
        } catch (e) {
            setError(e.message || 'Search failed')
        } finally {
            setSearching(false)
        }
    }

    if (!isLifeSyncConnected) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight mb-2">Anime</h1>
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-16 text-center">
                    <p className="text-[15px] font-bold text-[#1d1d1f] mb-2">LifeSync Not Connected</p>
                    <p className="text-[13px] text-[#86868b] mb-4">Connect LifeSync in your profile to access anime tracking.</p>
                    <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors">
                        Go to Integrations
                    </Link>
                </div>
            </div>
        )
    }

    const tabs = [
        { id: 'seasonal', label: 'Seasonal' },
        { id: 'ranking', label: 'Top Ranked' },
        ...(malLinked ? [{ id: 'mylist', label: 'My List' }] : []),
        ...(searchResults.length > 0 ? [{ id: 'search', label: 'Search Results' }] : []),
    ]

    const currentItems = tab === 'seasonal' ? seasonal : tab === 'ranking' ? ranking : tab === 'mylist' ? myList : searchResults

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {detailId && <DetailPanel animeId={detailId} onClose={() => setDetailId(null)} />}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Anime</p>
                    <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">Anime</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} disabled={busy} className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50">
                        {busy ? 'Loading...' : 'Refresh'}
                    </button>
                    {!malLinked && lifesyncOAuthStartUrl('mal') && (
                        <a href={lifesyncOAuthStartUrl('mal')} className="text-[12px] font-semibold bg-[#2E51A2] text-white px-4 py-2 rounded-xl hover:bg-[#24408a] transition-colors">
                            Link MAL
                        </a>
                    )}
                    {malLinked && (
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    await lifesyncFetch('/api/anime/link', { method: 'DELETE' })
                                    await refreshLifeSyncMe()
                                    setOauthMsg('MyAnimeList disconnected.')
                                    setTimeout(() => setOauthMsg(''), 5000)
                                } catch (e) {
                                    setError(e.message || 'Failed to disconnect MAL')
                                }
                            }}
                            className="text-[11px] font-semibold text-[#86868b] hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-[#e5e5ea] hover:border-red-100 transition-colors"
                        >
                            Disconnect MAL
                        </button>
                    )}
                </div>
            </div>

            {oauthMsg && !error && (
                <div className="bg-green-50 text-green-700 text-[12px] font-medium px-4 py-3 rounded-xl border border-green-100">{oauthMsg}</div>
            )}

            {error && (
                <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>
            )}

            <form onSubmit={handleSearch} className="flex gap-2">
                <input type="search" value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search anime..." className="flex-1 px-4 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all" />
                <button type="submit" disabled={searching} className="bg-[#1d1d1f] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-black transition-colors disabled:opacity-50">
                    {searching ? 'Searching...' : 'Search'}
                </button>
            </form>

            <div className="flex gap-1.5 overflow-x-auto pb-1">
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all ${tab === t.id ? 'bg-[#C6FF00] text-[#1d1d1f] shadow-sm' : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'}`}>
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === 'mylist' && currentItems.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {currentItems.map(item => (
                        <MyListCard key={item.node?.id} node={item.node} listStatus={item.list_status} onSelect={setDetailId} />
                    ))}
                </div>
            ) : currentItems.length > 0 ? (
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {currentItems.map((item, i) => (
                        <AnimeCard key={item.node?.id || i} node={item.node} ranking={tab === 'ranking' ? item.ranking?.rank : undefined} onSelect={setDetailId} />
                    ))}
                </div>
            ) : !busy && (
                <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm px-6 py-10 text-center">
                    <p className="text-[13px] text-[#86868b]">
                        {tab === 'mylist' ? 'Your anime list is empty. Link MAL to sync your list.' : 'No anime to display.'}
                    </p>
                </div>
            )}
        </div>
    )
}
