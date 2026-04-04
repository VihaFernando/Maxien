import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch, lifesyncOAuthStartUrl } from '../../lib/lifesyncApi'

function GameCard({ title, imageUrl, storeUrl, subtitle }) {
    return (
        <a
            href={storeUrl}
            target="_blank"
            rel="noreferrer"
            className="group bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all"
        >
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#f5f5f7]">
                {imageUrl ? (
                    <img src={imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349m-16.5 11.65V9.35m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016A3.001 3.001 0 0021 9.349m-18 0V6.999a1.5 1.5 0 011.5-1.5h15a1.5 1.5 0 011.5 1.5V9.35" /></svg>
                    </div>
                )}
            </div>
            <div className="p-3">
                <p className="text-[13px] font-semibold text-[#1d1d1f] line-clamp-2">{title}</p>
                {subtitle && <p className="mt-0.5 text-[11px] text-[#86868b] line-clamp-2">{subtitle}</p>}
            </div>
        </a>
    )
}

function GameGridSection({ title, games, emptyText }) {
    return (
        <div className="space-y-3">
            <h3 className="text-[15px] font-bold text-[#1d1d1f]">{title}</h3>
            {!games?.length ? (
                <p className="text-[13px] text-[#86868b]">{emptyText}</p>
            ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {games.map(g => (
                        <GameCard key={`${g.namespace || ''}-${g.id || g.title}`} title={g.title} imageUrl={g.imageUrl} storeUrl={g.storeUrl} subtitle={g.description || g.offerType} />
                    ))}
                </div>
            )}
        </div>
    )
}

export default function LifeSyncEpic() {
    const { isLifeSyncConnected, lifeSyncUser, refreshLifeSyncMe } = useLifeSync()
    const [freePack, setFreePack] = useState(null)
    const [libraryPack, setLibraryPack] = useState(null)
    const [profilePack, setProfilePack] = useState(null)
    const [error, setError] = useState('')
    const [oauthMsg, setOauthMsg] = useState('')
    const [busy, setBusy] = useState(false)

    const epicLinked = Boolean(lifeSyncUser?.integrations?.epic)

    const load = useCallback(async () => {
        setBusy(true)
        setError('')
        try {
            const free = await lifesyncFetch('/api/epic/free-games').catch(() => null)
            if (free) setFreePack(free)

            if (epicLinked) {
                const [prof, lib] = await Promise.all([
                    lifesyncFetch('/api/epic/profile').catch(() => null),
                    lifesyncFetch('/api/epic/library').catch(() => null),
                ])
                if (prof) setProfilePack(prof)
                if (lib) setLibraryPack(lib)
            }
        } catch (e) {
            setError(e.message || 'Failed to load Epic data')
        } finally {
            setBusy(false)
        }
    }, [epicLinked])

    useEffect(() => {
        if (isLifeSyncConnected) load()
    }, [isLifeSyncConnected, load])

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('maxien_lifesync_oauth')
            if (raw) {
                sessionStorage.removeItem('maxien_lifesync_oauth')
                const { type, text, provider } = JSON.parse(raw)
                if (provider?.startsWith('epic')) {
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

    if (!isLifeSyncConnected) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight mb-2">Epic Games</h1>
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-16 text-center">
                    <p className="text-[15px] font-bold text-[#1d1d1f] mb-2">LifeSync Not Connected</p>
                    <p className="text-[13px] text-[#86868b] mb-4">Connect LifeSync in your profile to access Epic integration.</p>
                    <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors">
                        Go to Integrations
                    </Link>
                </div>
            </div>
        )
    }

    const p = profilePack?.profile

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Games</p>
                    <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">Epic Games</h1>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={load} disabled={busy} className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50">
                        {busy ? 'Loading...' : 'Refresh'}
                    </button>
                    {!epicLinked && lifesyncOAuthStartUrl('epic') && (
                        <a href={lifesyncOAuthStartUrl('epic')} className="text-[12px] font-semibold bg-[#1d1d1f] text-white px-4 py-2 rounded-xl hover:bg-black transition-colors">
                            Link Epic
                        </a>
                    )}
                    {epicLinked && (
                        <button
                            type="button"
                            onClick={async () => {
                                try {
                                    await lifesyncFetch('/api/epic/link', { method: 'DELETE' })
                                    await refreshLifeSyncMe()
                                    setOauthMsg('Epic Games disconnected.')
                                    setTimeout(() => setOauthMsg(''), 5000)
                                } catch (e) {
                                    setError(e.message || 'Failed to disconnect Epic')
                                }
                            }}
                            className="text-[11px] font-semibold text-[#86868b] hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-[#e5e5ea] hover:border-red-100 transition-colors"
                        >
                            Disconnect Epic
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

            {p && (
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm p-5 flex flex-col sm:flex-row items-center gap-5">
                    {p.avatarUrl ? (
                        <img src={p.avatarUrl} alt="" className="w-20 h-20 rounded-2xl object-cover ring-1 ring-[#d2d2d7]" />
                    ) : (
                        <div className="w-20 h-20 rounded-2xl bg-[#f5f5f7] flex items-center justify-center text-[#86868b] text-2xl font-bold">E</div>
                    )}
                    <div className="text-center sm:text-left">
                        <p className="text-[17px] font-bold text-[#1d1d1f]">{p.displayName || 'Epic Account'}</p>
                        {p.epicAccountId && <p className="text-[11px] text-[#86868b] font-mono mt-0.5">{p.epicAccountId}</p>}
                        {p.email && <p className="text-[12px] text-[#86868b] mt-1">{p.email}</p>}
                    </div>
                </div>
            )}

            {freePack && (
                <div className="space-y-6">
                    <GameGridSection title="Free This Week" games={freePack.currentGames} emptyText="No free promotions this week." />
                    <GameGridSection title="Free Next Week" games={freePack.nextGames} emptyText="No upcoming free games listed." />
                </div>
            )}

            {libraryPack && (
                <div className="space-y-3">
                    <h3 className="text-[15px] font-bold text-[#1d1d1f]">Your Epic Library</h3>
                    {libraryPack.needsLink ? (
                        <p className="text-[13px] text-[#86868b]">Connect Epic Games to load your library.</p>
                    ) : libraryPack.error ? (
                        <div className="bg-amber-50 text-amber-800 text-[12px] font-medium px-4 py-3 rounded-xl border border-amber-100">
                            {libraryPack.error}
                        </div>
                    ) : libraryPack.items?.length ? (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {libraryPack.items.map(g => (
                                <GameCard key={`${g.namespace || ''}-${g.id || g.title}`} title={g.title} imageUrl={g.imageUrl} storeUrl={g.storeUrl} />
                            ))}
                        </div>
                    ) : (
                        <p className="text-[13px] text-[#86868b]">No library items returned.</p>
                    )}
                </div>
            )}

            {!epicLinked && !busy && (
                <div className="bg-blue-50 text-blue-700 text-[12px] font-medium px-4 py-3 rounded-xl border border-blue-100">
                    Link your Epic account to see your profile and library. Free games above work without linking.
                </div>
            )}
        </div>
    )
}
