import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LifesyncEpisodeThumbnail, LifesyncSteamMediaCardSkeleton } from '../../components/lifesync/EpisodeLoadingSkeletons'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch } from '../../lib/lifesyncApi'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { lifeSyncStaggerContainer, lifeSyncStaggerItem, MotionDiv } from '../../lib/lifesyncMotion'

function StoreCard({ item }) {
    const [imgErr, setImgErr] = useState(false)

    return (
        <a
            href={item.storeUrl}
            target="_blank"
            rel="noreferrer"
            className="lifesync-games-glass group bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all"
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
    const {
        isLifeSyncConnected,
        lifeSyncSteamProfile,
        refreshLifeSyncSteamProfile,
    } = useLifeSync()
    const [storePack, setStorePack] = useState(null)
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)

    const load = useCallback(async ({ forceSteamStatus = false, refreshStore = false } = {}) => {
        setBusy(true)
        setError('')

        try {
            const [st, store] = await Promise.all([
                refreshLifeSyncSteamProfile({ force: forceSteamStatus }),
                lifesyncFetch(`/api/v1/steam/store?view=standard${refreshStore ? '&refresh=1' : ''}`).catch(() => null),
            ])
            if (store) setStorePack(store)
            if (!st && !store) {
                throw new Error('Steam data unavailable')
            }
        } catch (e) {
            setError(e?.message || 'Failed to load Steam data')
        } finally {
            setBusy(false)
        }
    }, [refreshLifeSyncSteamProfile])

    useEffect(() => {
        if (isLifeSyncConnected) {
            void load()
        }
    }, [isLifeSyncConnected, load])

    const status = lifeSyncSteamProfile

    if (!isLifeSyncConnected) {
        return (
            <LifeSyncHubPageShell>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-[28px] font-bold text-[#1a1628] tracking-tight mb-2">Steam</h1>
                    <div className="rounded-[22px] border border-white/90 bg-white/90 px-8 py-16 text-center shadow-sm ring-1 ring-[#e8e4ef]/70">
                        <p className="text-[15px] font-bold text-[#1a1628] mb-2">LifeSync Not Connected</p>
                        <p className="text-[13px] text-[#5b5670] mb-4">Connect LifeSync in your profile to access Steam deals.</p>
                        <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 rounded-xl bg-[#C6FF00] px-5 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95">
                            Go to Integrations
                        </Link>
                    </div>
                </div>
            </LifeSyncHubPageShell>
        )
    }

    const profile = status?.profile
    const profileTheme = profile?.theme || {}
    const badgePreview = Array.isArray(profile?.badges?.preview) ? profile.badges.preview : []
    const hasBackgroundVideo = Boolean(profileTheme?.backgroundVideoWebmUrl || profileTheme?.backgroundVideoMp4Url)
    const hasBackgroundImage = Boolean(profileTheme?.backgroundImageUrl)

    return (
        <LifeSyncHubPageShell>
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Games</p>
                        <h1 className="text-[28px] font-bold text-[#1a1628] tracking-tight">Steam Deals</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            to="/dashboard/lifesync/games/wishlist"
                            className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors"
                        >
                            Wishlist
                        </Link>
                        <button onClick={() => void load({ forceSteamStatus: true, refreshStore: true })} disabled={busy} className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50">
                            {busy ? 'Loading...' : 'Refresh'}
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>
                )}

                {profile ? (
                    <div className="lifesync-games-glass relative overflow-hidden rounded-[20px] border border-[#d2d2d7]/50 shadow-sm">
                        {hasBackgroundVideo ? (
                            <video
                                className="absolute inset-0 h-full w-full object-cover"
                                autoPlay
                                muted
                                loop
                                playsInline
                                poster={profileTheme?.backgroundVideoPosterUrl || profileTheme?.backgroundImageUrl || undefined}
                            >
                                {profileTheme?.backgroundVideoWebmUrl && (
                                    <source src={profileTheme.backgroundVideoWebmUrl} type="video/webm" />
                                )}
                                {profileTheme?.backgroundVideoMp4Url && (
                                    <source src={profileTheme.backgroundVideoMp4Url} type="video/mp4" />
                                )}
                            </video>
                        ) : hasBackgroundImage ? (
                            <img
                                src={profileTheme.backgroundImageUrl}
                                alt=""
                                className="absolute inset-0 h-full w-full object-cover"
                            />
                        ) : null}

                        {(hasBackgroundVideo || hasBackgroundImage) && (
                            <div className="absolute inset-0 bg-gradient-to-br from-black/70 via-black/45 to-black/70" />
                        )}

                        <div className={`relative p-5 ${hasBackgroundVideo || hasBackgroundImage ? 'text-white' : 'bg-white text-[#1d1d1f]'} `}>
                            <div className="flex flex-col sm:flex-row items-center gap-5">
                                {profile.avatarUrl ? (
                                    <img src={profile.avatarUrl} alt="" className="w-20 h-20 rounded-2xl object-cover ring-1 ring-white/40" />
                                ) : (
                                    <div className="w-20 h-20 rounded-2xl bg-[#f5f5f7] flex items-center justify-center text-[#86868b] text-2xl font-bold">S</div>
                                )}
                                <div className="text-center sm:text-left">
                                    <p className="text-[17px] font-bold">{profile.personaName || 'Steam Player'}</p>
                                    <p className={`text-[11px] font-mono mt-0.5 ${hasBackgroundVideo || hasBackgroundImage ? 'text-white/80' : 'text-[#86868b]'}`}>
                                        SteamID {profile.steamId}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                        {Number.isFinite(Number(profile?.steamLevel)) && (
                                            <span className="rounded-full bg-[#C6FF00] px-2.5 py-1 text-[11px] font-bold text-[#1a1628]">
                                                Level {profile.steamLevel}
                                            </span>
                                        )}
                                        {Number.isFinite(Number(profile?.badges?.count)) && (
                                            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${hasBackgroundVideo || hasBackgroundImage ? 'border-white/30 bg-white/10 text-white' : 'border-[#d2d2d7] bg-[#f5f5f7] text-[#1d1d1f]'}`}>
                                                {profile.badges.count} badges
                                            </span>
                                        )}
                                    </div>
                                    <p className={`mt-2 text-[11px] ${hasBackgroundVideo || hasBackgroundImage ? 'text-white/75' : 'text-[#86868b]'}`}>
                                        Steam library sync was removed. Use Wishlist import by SteamID from the Wishlist page.
                                    </p>
                                </div>
                            </div>

                            {badgePreview.length > 0 && (
                                <div className="mt-4 flex flex-wrap items-center gap-2">
                                    {badgePreview.slice(0, 8).map((badge, idx) => (
                                        <a
                                            key={`${badge?.badgeUrl || badge?.imageUrl || idx}-${idx}`}
                                            href={badge?.badgeUrl || profile?.profileUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className={`group flex items-center gap-2 rounded-lg border px-2 py-1.5 transition ${hasBackgroundVideo || hasBackgroundImage ? 'border-white/20 bg-white/10 hover:bg-white/15' : 'border-[#e5e5ea] bg-white hover:bg-[#f9fafb]'}`}
                                        >
                                            {badge?.imageUrl ? (
                                                <img src={badge.imageUrl} alt="" className="h-6 w-6 rounded object-cover" />
                                            ) : (
                                                <span className={`inline-flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold ${hasBackgroundVideo || hasBackgroundImage ? 'bg-white/15 text-white' : 'bg-[#f3f4f6] text-[#6b7280]'}`}>
                                                    B
                                                </span>
                                            )}
                                            <span className="max-w-[150px] truncate text-[11px] font-medium">
                                                {badge?.name || 'Badge'}
                                            </span>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-blue-50 text-blue-700 text-[12px] font-medium px-4 py-3 rounded-xl border border-blue-100">
                        Set your SteamID in Profile → Integrations to enable Steam wishlist import.
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
                            <a href={storePack.dailyDeal.storeUrl} target="_blank" rel="noreferrer" className="lifesync-games-glass block bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all group">
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
            </div>
        </LifeSyncHubPageShell>
    )
}
