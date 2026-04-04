import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch, lifesyncOAuthStartUrl } from '../../lib/lifesyncApi'

const STEAM_APP_CDN = 'https://cdn.akamai.steamstatic.com/steam/apps'

function steamImage(appId) {
    return `${STEAM_APP_CDN}/${appId}/header.jpg`
}

function formatHours(minutes) {
    const h = Math.round((minutes || 0) / 60)
    return h < 1 ? '<1 h' : `${h} h`
}

function StoreCard({ item }) {
    const [imgErr, setImgErr] = useState(false)
    return (
        <a
            href={item.storeUrl}
            target="_blank"
            rel="noreferrer"
            className="group bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all"
        >
            <div className="relative aspect-video w-full overflow-hidden bg-[#f5f5f7]">
                {item.discountPercent > 0 && (
                    <span className="absolute right-2 top-2 z-10 rounded-lg bg-[#C6FF00] px-2 py-0.5 text-[11px] font-bold text-[#1d1d1f] shadow-sm">
                        −{item.discountPercent}%
                    </span>
                )}
                {item.imageUrl && !imgErr ? (
                    <img src={item.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" onError={() => setImgErr(true)} />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.491 48.491 0 01-4.163-.3c.186 1.613.96 3.073 2.062 4.063C9.442 11.56 10.652 12 12 12s2.558-.44 3.555-1.338a8.37 8.37 0 002.062-4.062 48.366 48.366 0 01-4.163.3.64.64 0 01-.657-.643v0z" /></svg>
                    </div>
                )}
            </div>
            <div className="p-3">
                <p className="text-[13px] font-semibold text-[#1d1d1f] line-clamp-2">{item.name}</p>
                {item.priceText && <p className="mt-0.5 text-[12px] text-[#C6FF00] font-medium">{item.priceText}</p>}
            </div>
        </a>
    )
}

function LibraryCard({ game }) {
    const [imgErr, setImgErr] = useState(false)
    const src = steamImage(game.appId)
    return (
        <a
            href={`https://store.steampowered.com/app/${game.appId}/`}
            target="_blank"
            rel="noreferrer"
            className="group bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all"
        >
            <div className="relative aspect-video w-full overflow-hidden bg-[#f5f5f7]">
                {!imgErr ? (
                    <img src={src} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" onError={() => setImgErr(true)} />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5.25 7.5A2.25 2.25 0 017.5 5.25h9a2.25 2.25 0 012.25 2.25v9a2.25 2.25 0 01-2.25 2.25h-9a2.25 2.25 0 01-2.25-2.25v-9z" /></svg>
                    </div>
                )}
            </div>
            <div className="p-3">
                <p className="text-[13px] font-semibold text-[#1d1d1f] line-clamp-2">{game.name}</p>
                <p className="mt-0.5 text-[11px] text-[#86868b]">{formatHours(game.playtimeForever)} played</p>
            </div>
        </a>
    )
}

function StoreSection({ title, items }) {
    if (!items?.length) return null
    return (
        <div>
            <h3 className="text-[15px] font-bold text-[#1d1d1f] mb-3">{title}</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((it) => <StoreCard key={it.appId || it.name} item={it} />)}
            </div>
        </div>
    )
}

export default function LifeSyncSteam() {
    const { isLifeSyncConnected, refreshLifeSyncMe } = useLifeSync()
    const [status, setStatus] = useState(null)
    const [doc, setDoc] = useState(null)
    const [storePack, setStorePack] = useState(null)
    const [filter, setFilter] = useState('')
    const [error, setError] = useState('')
    const [oauthMsg, setOauthMsg] = useState('')
    const [busy, setBusy] = useState(false)
    const [syncBusy, setSyncBusy] = useState(false)

    const load = useCallback(async () => {
        setBusy(true)
        setError('')
        try {
            const [st, gm, store] = await Promise.all([
                lifesyncFetch('/api/steam/status'),
                lifesyncFetch('/api/steam/games').catch(() => null),
                lifesyncFetch('/api/steam/store').catch(() => null),
            ])
            setStatus(st)
            if (gm) setDoc(gm)
            if (store) setStorePack(store)
        } catch (e) {
            setError(e.message || 'Failed to load Steam data')
        } finally {
            setBusy(false)
        }
    }, [])

    useEffect(() => {
        if (isLifeSyncConnected) load()
    }, [isLifeSyncConnected, load])

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('maxien_lifesync_oauth')
            if (raw) {
                sessionStorage.removeItem('maxien_lifesync_oauth')
                const { type, text, provider } = JSON.parse(raw)
                if (provider?.startsWith('steam')) {
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

    async function syncLibrary() {
        setSyncBusy(true)
        try {
            const data = await lifesyncFetch('/api/steam/sync-games', { method: 'POST' })
            setDoc(data)
        } catch (e) {
            setError(e.message || 'Sync failed')
        } finally {
            setSyncBusy(false)
        }
    }

    const games = useMemo(() => {
        const list = [...(doc?.games || [])].sort((a, b) => (b.playtimeForever || 0) - (a.playtimeForever || 0))
        const q = filter.trim().toLowerCase()
        return q ? list.filter(g => g.name?.toLowerCase().includes(q)) : list
    }, [doc?.games, filter])

    const stats = useMemo(() => {
        const all = doc?.games || []
        return { count: all.length, hours: Math.round(all.reduce((s, g) => s + (g.playtimeForever || 0), 0) / 60) }
    }, [doc?.games])

    if (!isLifeSyncConnected) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight mb-2">Steam</h1>
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-16 text-center">
                    <p className="text-[15px] font-bold text-[#1d1d1f] mb-2">LifeSync Not Connected</p>
                    <p className="text-[13px] text-[#86868b] mb-4">Connect LifeSync in your profile to access Steam integration.</p>
                    <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors">
                        Go to Integrations
                    </Link>
                </div>
            </div>
        )
    }

    const p = status?.profile
    const canSync = status?.steamLinked && status?.steamWebApiConfigured

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Games</p>
                    <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">Steam</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} disabled={busy} className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50">
                        {busy ? 'Loading...' : 'Refresh'}
                    </button>
                    {canSync && (
                        <button onClick={syncLibrary} disabled={syncBusy} className="text-[12px] font-semibold bg-[#1d1d1f] text-white px-4 py-2 rounded-xl hover:bg-black transition-colors disabled:opacity-50">
                            {syncBusy ? 'Syncing...' : 'Sync Library'}
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

            {!status?.steamWebApiConfigured && !busy && (
                <div className="bg-amber-50 text-amber-800 text-[12px] font-medium px-4 py-3 rounded-xl border border-amber-100">
                    Steam Web API key is not configured on the server. Store highlights still work, but library sync requires the key.
                </div>
            )}

            {status?.steamWebApiConfigured && !status?.steamLinked && (
                <div className="bg-blue-50 text-blue-700 text-[12px] font-medium px-4 py-3 rounded-xl border border-blue-100 flex items-center justify-between gap-3">
                    <span>Connect your Steam account to sync your library.</span>
                    {lifesyncOAuthStartUrl('steam') && (
                        <a href={lifesyncOAuthStartUrl('steam')} className="shrink-0 bg-[#1d1d1f] text-white text-[11px] font-semibold px-3.5 py-1.5 rounded-lg hover:bg-black transition-colors">Link Steam</a>
                    )}
                </div>
            )}

            {status?.steamLinked && (
                <div className="flex items-center gap-2 justify-end">
                    <button
                        type="button"
                        onClick={async () => {
                            try {
                                await lifesyncFetch('/api/steam/link', { method: 'DELETE' })
                                await refreshLifeSyncMe()
                                setStatus(prev => ({ ...prev, steamLinked: false }))
                                setOauthMsg('Steam disconnected.')
                                setTimeout(() => setOauthMsg(''), 5000)
                            } catch (e) {
                                setError(e.message || 'Failed to disconnect Steam')
                            }
                        }}
                        className="text-[11px] font-semibold text-[#86868b] hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-[#e5e5ea] hover:border-red-100 transition-colors"
                    >
                        Disconnect Steam
                    </button>
                </div>
            )}

            {p && (
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm p-5 flex flex-col sm:flex-row items-center gap-5">
                    {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt="" className="w-20 h-20 rounded-2xl object-cover ring-1 ring-[#d2d2d7]" />
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-[#f5f5f7] flex items-center justify-center text-[#86868b] text-2xl font-bold">S</div>
                    )}
                    <div className="text-center sm:text-left">
                        <p className="text-[17px] font-bold text-[#1d1d1f]">{p.personaName || 'Steam Player'}</p>
                        <p className="text-[11px] text-[#86868b] font-mono mt-0.5">SteamID {p.steamId}</p>
                        <div className="flex items-center gap-2 mt-2 justify-center sm:justify-start">
                            <span className="bg-[#C6FF00]/20 text-[#1d1d1f] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">{stats.count} games</span>
                            <span className="bg-[#f5f5f7] text-[#86868b] text-[11px] font-semibold px-2.5 py-0.5 rounded-full">~{stats.hours}h total</span>
                        </div>
                    </div>
                </div>
            )}

            {storePack && (
                <div className="space-y-6">
                    <h2 className="text-[17px] font-bold text-[#1d1d1f]">Store Highlights</h2>
                    {storePack.dailyDeal && (
                        <a href={storePack.dailyDeal.storeUrl} target="_blank" rel="noreferrer" className="block bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all group">
                            <div className="grid sm:grid-cols-2">
                                <div className="aspect-video sm:aspect-auto sm:min-h-[180px] bg-[#f5f5f7] overflow-hidden">
                                    {storePack.dailyDeal.imageUrl && <img src={storePack.dailyDeal.imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />}
                                </div>
                                <div className="p-5 flex flex-col justify-center">
                                    <span className="text-[10px] font-bold text-[#C6FF00] uppercase tracking-widest">Daily Deal</span>
                                    <p className="text-[17px] font-bold text-[#1d1d1f] mt-1">{storePack.dailyDeal.name}</p>
                                    {storePack.dailyDeal.priceText && <p className="text-[14px] text-[#C6FF00] font-semibold mt-1">{storePack.dailyDeal.priceText}</p>}
                                    {storePack.dailyDeal.discountPercent > 0 && <span className="inline-flex w-fit mt-2 bg-[#C6FF00] text-[#1d1d1f] text-[11px] font-bold px-2 py-0.5 rounded-lg">−{storePack.dailyDeal.discountPercent}%</span>}
                                </div>
                            </div>
                        </a>
                    )}
                    <StoreSection title="On Sale" items={storePack.specials} />
                    <StoreSection title="Top Sellers" items={storePack.topSellers} />
                    <StoreSection title="New Releases" items={storePack.newReleases} />
                    <StoreSection title="Coming Soon" items={storePack.comingSoon} />
                </div>
            )}

            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h2 className="text-[17px] font-bold text-[#1d1d1f]">Your Library {games.length > 0 && <span className="text-[13px] font-medium text-[#86868b]">({games.length})</span>}</h2>
                    <input
                        type="search"
                        value={filter}
                        onChange={e => setFilter(e.target.value)}
                        placeholder="Filter games..."
                        className="w-full sm:max-w-xs px-4 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all"
                    />
                </div>
                {games.length > 0 ? (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {games.map(g => <LibraryCard key={g.appId} game={g} />)}
                    </div>
                ) : !busy && (
                    <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm px-6 py-10 text-center">
                        <p className="text-[13px] text-[#86868b]">{filter.trim() ? 'No games match your filter.' : 'No games in cache. Link Steam and sync your library.'}</p>
                    </div>
                )}
            </div>
        </div>
    )
}
