import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { LifesyncEpisodeThumbnail, LifesyncSteamLibraryGridSkeleton, LifesyncSteamMediaCardSkeleton } from '../../components/lifesync/EpisodeLoadingSkeletons'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch, lifesyncOAuthStartUrl } from '../../lib/lifesyncApi'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { lifeSyncStaggerContainer, lifeSyncStaggerItem, MotionDiv } from '../../lib/lifesyncMotion'

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
                    <span className="absolute right-2 top-2 z-[3] rounded-lg bg-[#C6FF00] px-2 py-0.5 text-[11px] font-bold text-[#1d1d1f] shadow-sm">
                        −{item.discountPercent}%
                    </span>
                )}
                {item.imageUrl && !imgErr ? (
                    <LifesyncEpisodeThumbnail
                        src={item.imageUrl}
                        className="absolute inset-0 h-full w-full"
                        imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        imgProps={{ onError: () => setImgErr(true) }}
                    />
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
                    <LifesyncEpisodeThumbnail
                        src={src}
                        className="absolute inset-0 h-full w-full"
                        imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        imgProps={{ onError: () => setImgErr(true) }}
                    />
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
            <MotionDiv
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                variants={lifeSyncStaggerContainer}
                initial="hidden"
                animate="show"
            >
                {items.map((it) => (
                    <MotionDiv key={it.appId || it.name} variants={lifeSyncStaggerItem}>
                        <StoreCard item={it} />
                    </MotionDiv>
                ))}
            </MotionDiv>
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
    const oauthMsgTimerRef = useRef(null)
    const [busy, setBusy] = useState(false)
    const [syncBusy, setSyncBusy] = useState(false)

    const scheduleClearOauthMsg = useCallback((ms) => {
        if (oauthMsgTimerRef.current != null) {
            window.clearTimeout(oauthMsgTimerRef.current)
            oauthMsgTimerRef.current = null
        }
        oauthMsgTimerRef.current = window.setTimeout(() => {
            oauthMsgTimerRef.current = null
            setOauthMsg('')
        }, ms)
    }, [])

    useEffect(
        () => () => {
            if (oauthMsgTimerRef.current != null) {
                window.clearTimeout(oauthMsgTimerRef.current)
                oauthMsgTimerRef.current = null
            }
        },
        [],
    )

    const steamPageMountedRef = useRef(true)
    useEffect(() => {
        steamPageMountedRef.current = true
        return () => {
            steamPageMountedRef.current = false
        }
    }, [])

    const load = useCallback(async () => {
        if (steamPageMountedRef.current) {
            setBusy(true)
            setError('')
        }
        try {
            const [st, gm, store] = await Promise.all([
                lifesyncFetch('/api/v1/steam/status?view=compact'),
                lifesyncFetch('/api/v1/steam/games?view=standard').catch(() => null),
                lifesyncFetch('/api/v1/steam/store?view=standard').catch(() => null),
            ])
            if (!steamPageMountedRef.current) return
            setStatus(st)
            if (gm) setDoc(gm)
            if (store) setStorePack(store)
        } catch (e) {
            if (steamPageMountedRef.current) {
                setError(e.message || 'Failed to load Steam data')
            }
        } finally {
            if (steamPageMountedRef.current) {
                setBusy(false)
            }
        }
    }, [])

    useEffect(() => {
        if (isLifeSyncConnected) load()
    }, [isLifeSyncConnected, load])

    useEffect(() => {
        let cancelled = false
        try {
            const raw = sessionStorage.getItem('maxien_lifesync_oauth')
            if (raw) {
                sessionStorage.removeItem('maxien_lifesync_oauth')
                const { type, text, provider } = JSON.parse(raw)
                if (provider?.startsWith('steam')) {
                    setOauthMsg(text)
                    if (type === 'error') setError(text)
                    refreshLifeSyncMe()
                        .then(() => {
                            if (!cancelled) void load()
                        })
                        .catch(() => {})
                    scheduleClearOauthMsg(8000)
                }
            }
        } catch { /* ignore */ }
        return () => {
            cancelled = true
        }
    }, [refreshLifeSyncMe, load, scheduleClearOauthMsg])

    useEffect(() => {
        let cancelled = false
        const onVisible = () => {
            if (document.visibilityState !== 'visible' || !isLifeSyncConnected) return
            refreshLifeSyncMe()
                .then(() => {
                    if (!cancelled) void load()
                })
                .catch(() => {})
        }
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            cancelled = true
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [isLifeSyncConnected, refreshLifeSyncMe, load])

    async function syncLibrary() {
        setSyncBusy(true)
        try {
            const data = await lifesyncFetch('/api/v1/steam/sync', { method: 'POST' })
            if (steamPageMountedRef.current) setDoc(data)
        } catch (e) {
            if (steamPageMountedRef.current) setError(e.message || 'Sync failed')
        } finally {
            if (steamPageMountedRef.current) setSyncBusy(false)
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
            <LifeSyncHubPageShell>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-[28px] font-bold text-[#1a1628] tracking-tight mb-2">Steam</h1>
                    <div className="rounded-[22px] border border-white/90 bg-white/90 px-8 py-16 text-center shadow-sm ring-1 ring-[#e8e4ef]/70">
                        <p className="text-[15px] font-bold text-[#1a1628] mb-2">LifeSync Not Connected</p>
                        <p className="text-[13px] text-[#5b5670] mb-4">Connect LifeSync in your profile to access Steam integration.</p>
                        <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 rounded-xl bg-[#C6FF00] px-5 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95">
                            Go to Integrations
                        </Link>
                    </div>
                </div>
            </LifeSyncHubPageShell>
        )
    }

    const p = status?.profile
    const canSync = status?.steamLinked && status?.steamWebApiConfigured

    return (
        <LifeSyncHubPageShell>
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Games</p>
                    <h1 className="text-[28px] font-bold text-[#1a1628] tracking-tight">Steam</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} disabled={busy} className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50">
                        {busy ? 'Loading...' : 'Refresh'}
                    </button>
                    {canSync && (
                        <button onClick={syncLibrary} disabled={syncBusy} className="rounded-xl bg-[#C6FF00] px-4 py-2 text-[12px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95 disabled:opacity-50">
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
                        <a href={lifesyncOAuthStartUrl('steam')} className="shrink-0 rounded-lg bg-[#C6FF00] px-3.5 py-1.5 text-[11px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95">Link Steam</a>
                    )}
                </div>
            )}

            {status?.steamLinked && (
                <div className="flex items-center gap-2 justify-end">
                    <span className="text-[11px] font-semibold text-[#86868b] px-3 py-1.5 rounded-lg border border-[#e5e5ea] bg-[#f5f5f7]">
                        Steam connected
                    </span>
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

            {busy && !storePack && (
                <div className="space-y-6">
                    <h2 className="text-[17px] font-bold text-[#1d1d1f]">Store Highlights</h2>
                    <MotionDiv
                        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                        variants={lifeSyncStaggerContainer}
                        initial="hidden"
                        animate="show"
                    >
                        {Array.from({ length: 4 }).map((_, i) => (
                            <MotionDiv key={i} variants={lifeSyncStaggerItem}>
                                <LifesyncSteamMediaCardSkeleton />
                            </MotionDiv>
                        ))}
                    </MotionDiv>
                </div>
            )}

            {storePack && (
                <div className="space-y-6">
                    <h2 className="text-[17px] font-bold text-[#1d1d1f]">Store Highlights</h2>
                    {storePack.dailyDeal && (
                        <a href={storePack.dailyDeal.storeUrl} target="_blank" rel="noreferrer" className="block bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all group">
                            <div className="grid sm:grid-cols-2">
                                <div className="relative aspect-video overflow-hidden bg-[#f5f5f7] sm:aspect-auto sm:min-h-[180px]">
                                    {storePack.dailyDeal.imageUrl ? (
                                        <LifesyncEpisodeThumbnail
                                            src={storePack.dailyDeal.imageUrl}
                                            className="absolute inset-0 h-full min-h-[180px] w-full sm:min-h-[180px]"
                                            imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                        />
                                    ) : null}
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
                    <MotionDiv
                        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
                        variants={lifeSyncStaggerContainer}
                        initial="hidden"
                        animate="show"
                    >
                        {games.map((g) => (
                            <MotionDiv key={g.appId} variants={lifeSyncStaggerItem}>
                                <LibraryCard game={g} />
                            </MotionDiv>
                        ))}
                    </MotionDiv>
                ) : busy ? (
                    <LifesyncSteamLibraryGridSkeleton count={9} />
                ) : (
                    <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm px-6 py-10 text-center">
                        <p className="text-[13px] text-[#86868b]">{filter.trim() ? 'No games match your filter.' : 'No games in cache. Link Steam and sync your library.'}</p>
                    </div>
                )}
            </div>
        </div>
        </LifeSyncHubPageShell>
    )
}
