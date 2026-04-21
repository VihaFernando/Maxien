import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { isLifeSyncCrackGamesVisible, lifesyncFetch } from '../../lib/lifesyncApi'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'

function statusChipClass(status) {
    if (status === 'cracked') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (status === 'not_cracked') return 'bg-rose-100 text-rose-700 border-rose-200'
    if (status === 'upcoming' || status === 'release_today') return 'bg-amber-100 text-amber-800 border-amber-200'
    if (status === 'released') return 'bg-sky-100 text-sky-700 border-sky-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
}

function titleCaseStatus(status) {
    if (!status) return 'Unknown'
    return String(status)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (x) => x.toUpperCase())
}

function formatDate(value) {
    if (!value) return ''
    try {
        return new Intl.DateTimeFormat('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }).format(new Date(value))
    } catch {
        return String(value)
    }
}

function formatCurrencyMinor(amount, currency) {
    const n = Number(amount)
    const code = String(currency || 'USD').toUpperCase()
    if (!Number.isFinite(n)) return ''
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: code,
        }).format(n / 100)
    } catch {
        return `${(n / 100).toFixed(2)} ${code}`
    }
}

function toStringArray(value) {
    if (!Array.isArray(value)) return []
    return value.map((entry) => String(entry || '').trim()).filter(Boolean)
}

function hasEarlyAccessSignal(values) {
    return toStringArray(values).some((value) => /\bearly\s+access\b/i.test(value))
}

function LifeSyncConnectPrompt() {
    return (
        <div className="mx-auto max-w-4xl rounded-[22px] border border-white/90 bg-white/90 px-8 py-16 text-center shadow-sm ring-1 ring-[#e8e4ef]/70">
            <p className="mb-2 text-[15px] font-bold text-[#1a1628]">LifeSync Not Connected</p>
            <p className="mb-4 text-[13px] text-[#5b5670]">Connect LifeSync in your profile to access wishlist integrations.</p>
            <Link
                to="/dashboard/profile?tab=integrations"
                className="inline-flex items-center gap-2 rounded-xl bg-[#C6FF00] px-5 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95"
            >
                Go to Integrations
            </Link>
        </div>
    )
}

function WishlistItemCard({ item, onRemove, removing, crackGamesPluginOn }) {
    const crack = item?.intelligence?.crack_status || {}
    const game = item?.intelligence?.game || {}
    const steam = item?.intelligence?.steam || {}
    const live = item?.live || {}
    const stores = Array.isArray(item?.intelligence?.stores) ? item.intelligence.stores : []

    const crackStatusKey = String(crack?.status_key || '').trim().toLowerCase() || 'unknown'
    const isUnknownStatus = crackStatusKey === 'unknown'

    const liveStoreUrl = item.storeUrl || live?.storeUrl || ''
    const steamStoreUrl = String(steam?.steam_url || liveStoreUrl || '').trim()
    const steamWebsite = String(steam?.website || '').trim()

    const steamGenres = toStringArray(steam?.genres).slice(0, 3)
    const steamCategories = toStringArray(steam?.categories).slice(0, 2)
    const steamDevelopers = toStringArray(steam?.developers).slice(0, 2)
    const steamShortDescription = String(steam?.short_description || live?.shortDescription || '').trim()
    const steamReleaseDate = steam?.release_date || live?.releaseDate || game?.release_date || ''
    const steamComingSoon = Boolean(steam?.coming_soon || live?.comingSoon)
    const isEarlyAccess = Boolean(
        steam?.is_early_access ||
        live?.isEarlyAccess ||
        hasEarlyAccessSignal([...steamGenres, ...steamCategories])
    )
    const showSteamFallback =
        crackGamesPluginOn &&
        isUnknownStatus &&
        (steamShortDescription || steamReleaseDate || steamGenres.length || steamDevelopers.length)

    const imageUrl = game?.image || steam?.header_image || crack?.image || crack?.full_image || live?.headerImage || null
    const discountPercent = Number(live?.discountPercent || 0)
    const finalPrice = live?.finalFormatted || formatCurrencyMinor(live?.final, live?.currency)
    const initialPrice = live?.initialFormatted || formatCurrencyMinor(live?.initial, live?.currency)

    return (
        <article className="lifesync-games-glass rounded-2xl border border-[#d2d2d7]/60 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="h-[78px] w-full shrink-0 overflow-hidden rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] sm:h-[74px] sm:w-[132px]">
                    {imageUrl ? (
                        <img src={imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase text-[#86868b]">
                            No Image
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="truncate text-[15px] font-bold text-[#1d1d1f]">{item.title}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                                <span className="rounded-full border border-[#e5e5ea] bg-[#f5f5f7] px-2 py-0.5 font-semibold uppercase text-[#515154]">
                                    {item.platform}
                                </span>
                                {crackGamesPluginOn && (
                                    <span className={`rounded-full border px-2 py-0.5 font-semibold ${statusChipClass(crackStatusKey)}`}>
                                        {titleCaseStatus(crackStatusKey)}
                                    </span>
                                )}
                                {steamReleaseDate && (
                                    <span className="rounded-full border border-[#e5e5ea] bg-[#f5f5f7] px-2 py-0.5 font-medium text-[#515154]">
                                        {formatDate(steamReleaseDate)}
                                    </span>
                                )}
                                {isEarlyAccess && (
                                    <span className="rounded-full border border-[#f59e0b]/30 bg-[#fff7e6] px-2 py-0.5 font-semibold text-[#9a3412]">
                                        Early Access
                                    </span>
                                )}
                                {steamComingSoon && (
                                    <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-700">
                                        Coming Soon
                                    </span>
                                )}
                            </div>

                            {(live?.isFree || finalPrice || initialPrice) && (
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                                    {live?.isFree ? (
                                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700">
                                            Free to play
                                        </span>
                                    ) : (
                                        <>
                                            {finalPrice && (
                                                <span className="rounded-full border border-[#e5e5ea] bg-[#f5f5f7] px-2 py-0.5 font-semibold text-[#1d1d1f]">
                                                    {finalPrice}
                                                </span>
                                            )}
                                            {discountPercent > 0 && (
                                                <span className="rounded-full border border-[#bef264] bg-[#ecfccb] px-2 py-0.5 font-bold text-[#365314]">
                                                    -{discountPercent}%
                                                </span>
                                            )}
                                            {initialPrice && discountPercent > 0 && (
                                                <span className="text-[#86868b] line-through">{initialPrice}</span>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={onRemove}
                            disabled={removing}
                            className="rounded-lg border border-[#e5e5ea] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#7c7c80] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                            {removing ? 'Removing…' : 'Remove'}
                        </button>
                    </div>

                    {showSteamFallback && (
                        <div className="lifesync-games-glass mt-3 rounded-xl border border-[#dbeafe] bg-[#f8fbff] px-3 py-2">
                            <p className="text-[11px] font-semibold text-[#1e40af]">Crack status unknown. Showing Steam details fallback.</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px] text-[#334155]">
                                {steamDevelopers.map((name) => (
                                    <span key={name} className="rounded-full border border-[#bfdbfe] bg-white px-2 py-0.5 font-medium">
                                        {name}
                                    </span>
                                ))}
                                {steamGenres.map((genre) => (
                                    <span key={genre} className="rounded-full border border-[#bfdbfe] bg-white px-2 py-0.5 font-medium">
                                        {genre}
                                    </span>
                                ))}
                            </div>
                            {steamShortDescription && (
                                <p className="mt-1 text-[11px] leading-relaxed text-[#4b5563]">{steamShortDescription}</p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                {crackGamesPluginOn && (
                    <>
                        <Link
                            to={`/dashboard/lifesync/games/search?q=${encodeURIComponent(item.title)}`}
                            className="rounded-lg border border-[#e5e5ea] bg-white px-2.5 py-1 font-semibold text-[#1d1d1f] hover:border-[#0071e3]"
                        >
                            Search
                        </Link>
                        <Link
                            to={`/dashboard/lifesync/games/crack-status?q=${encodeURIComponent(item.title)}`}
                            className="rounded-lg border border-[#e5e5ea] bg-white px-2.5 py-1 font-semibold text-[#1d1d1f] hover:border-[#0071e3]"
                        >
                            Crack Status
                        </Link>
                    </>
                )}
                {steamStoreUrl && (
                    <a
                        href={steamStoreUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-[#e5e5ea] bg-white px-2.5 py-1 font-semibold text-[#1d1d1f] hover:border-[#0071e3]"
                    >
                        Store
                    </a>
                )}
                {steamWebsite && (
                    <a
                        href={steamWebsite}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-[#e5e5ea] bg-white px-2.5 py-1 font-semibold text-[#1d1d1f] hover:border-[#0071e3]"
                    >
                        Official Site
                    </a>
                )}
            </div>

            {stores.length > 0 && (
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {stores.slice(0, 4).map((store, idx) => (
                        <a
                            key={`${store.url || store.source || 'store'}-${idx}`}
                            href={store.url}
                            target="_blank"
                            rel="noreferrer"
                            className="lifesync-games-glass rounded-lg border border-[#e5e5ea] bg-[#fbfbfd] px-3 py-2 text-[11px] text-[#515154] transition hover:bg-white"
                        >
                            <p className="truncate font-semibold text-[#1d1d1f]">{store.name || 'Store link'}</p>
                            <p className="mt-0.5 uppercase text-[#4f46e5]">{store.source || 'store'}</p>
                        </a>
                    ))}
                </div>
            )}
        </article>
    )
}

export default function LifeSyncWishlist() {
    const {
        isLifeSyncConnected,
        refreshLifeSyncMe,
        lifeSyncUser,
        lifeSyncUpdatePreferences,
        lifeSyncSteamProfile,
        refreshLifeSyncSteamProfile,
    } = useLifeSync()

    const [steamIdInput, setSteamIdInput] = useState('')
    const [steamBusy, setSteamBusy] = useState(false)

    const [wishlistData, setWishlistData] = useState([])
    const [loading, setLoading] = useState(false)
    const [importBusy, setImportBusy] = useState(false)
    const [removingId, setRemovingId] = useState('')
    const [addingBusy, setAddingBusy] = useState(false)
    const [preferenceBusy, setPreferenceBusy] = useState(false)

    const [newTitle, setNewTitle] = useState('')
    const [newStoreUrl, setNewStoreUrl] = useState('')

    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    const loadSteamStatus = useCallback(async ({ force = false } = {}) => {
        try {
            const status = await refreshLifeSyncSteamProfile({ force })
            setSteamIdInput(String(status?.profile?.steamId || '').trim())
            return status || null
        } catch {
            return null
        }
    }, [refreshLifeSyncSteamProfile])

    const loadWishlist = useCallback(async () => {
        setLoading(true)
        setError('')

        try {
            const response = await lifesyncFetch('/api/v1/wishlist?limit=120&with_intelligence=1&with_live_prices=1&view=standard')
            const items = Array.isArray(response?.items) ? response.items : []
            setWishlistData(items)
        } catch (err) {
            setError(err?.message || 'Could not load wishlist')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        if (!isLifeSyncConnected) return
        void loadSteamStatus()
        void loadWishlist()
    }, [isLifeSyncConnected, loadSteamStatus, loadWishlist])

    const steamStatus = lifeSyncSteamProfile
    const steamLinked = Boolean(steamStatus?.steamLinked)
    const canSaveSteamId = useMemo(() => /^\d{17}$/.test(String(steamIdInput || '').trim()), [steamIdInput])
    const crackGamesPluginOn = isLifeSyncCrackGamesVisible(lifeSyncUser?.preferences)

    const requireCracked = crackGamesPluginOn && Boolean(lifeSyncUser?.preferences?.wishlistRequireCracked)
    const filteredWishlist = useMemo(() => {
        if (!crackGamesPluginOn || !requireCracked) return wishlistData
        return wishlistData.filter((item) => {
            const key = String(item?.intelligence?.crack_status?.status_key || '').trim().toLowerCase()
            return key === 'cracked'
        })
    }, [crackGamesPluginOn, requireCracked, wishlistData])

    const wishlistCount = wishlistData.length
    const visibleCount = filteredWishlist.length

    async function saveSteamId() {
        if (!canSaveSteamId) {
            setError('SteamID64 must be 17 numeric digits.')
            setMessage('')
            return
        }

        setSteamBusy(true)
        setError('')
        setMessage('')

        try {
            await lifesyncFetch('/api/v1/steam/link', {
                method: 'PUT',
                json: { steamId: steamIdInput.trim() },
            })
            await refreshLifeSyncMe().catch(() => {})
            await loadSteamStatus({ force: true })
            setMessage('Steam ID saved.')
        } catch (err) {
            setError(err?.message || 'Could not save Steam ID')
        } finally {
            setSteamBusy(false)
        }
    }

    async function disconnectSteam() {
        setSteamBusy(true)
        setError('')
        setMessage('')

        try {
            await lifesyncFetch('/api/v1/steam/link', { method: 'DELETE' })
            await refreshLifeSyncMe().catch(() => {})
            await loadSteamStatus({ force: true })
            setSteamIdInput('')
            setMessage('Steam disconnected.')
        } catch (err) {
            setError(err?.message || 'Could not disconnect Steam')
        } finally {
            setSteamBusy(false)
        }
    }

    async function importSteamWishlist() {
        setImportBusy(true)
        setError('')
        setMessage('')

        try {
            const payload = await lifesyncFetch('/api/v1/wishlist/import/steam', { method: 'POST', json: {} })
            await loadWishlist()
            setMessage(`Steam import complete: ${payload?.imported ?? 0} imported, ${payload?.skipped ?? 0} skipped.`)
        } catch (err) {
            setError(err?.message || 'Steam wishlist import failed')
        } finally {
            setImportBusy(false)
        }
    }

    async function addManualItem(e) {
        e.preventDefault()
        const title = newTitle.trim()
        if (!title) {
            setError('Title is required.')
            setMessage('')
            return
        }

        setAddingBusy(true)
        setError('')
        setMessage('')

        try {
            await lifesyncFetch('/api/v1/wishlist', {
                method: 'POST',
                json: {
                    platform: 'steam',
                    title,
                    storeUrl: newStoreUrl.trim() || undefined,
                },
            })
            setNewTitle('')
            setNewStoreUrl('')
            await loadWishlist()
            setMessage('Wishlist item added.')
        } catch (err) {
            setError(err?.message || 'Could not add wishlist item')
        } finally {
            setAddingBusy(false)
        }
    }

    async function removeItem(id) {
        setRemovingId(id)
        setError('')
        setMessage('')

        try {
            await lifesyncFetch(`/api/v1/wishlist/${encodeURIComponent(id)}`, {
                method: 'DELETE',
            })
            await loadWishlist()
            setMessage('Wishlist item removed.')
        } catch (err) {
            setError(err?.message || 'Could not remove wishlist item')
        } finally {
            setRemovingId('')
        }
    }

    async function toggleRequireCracked() {
        if (!crackGamesPluginOn) return
        const next = !requireCracked
        setPreferenceBusy(true)
        setError('')
        setMessage('')

        try {
            await lifeSyncUpdatePreferences({ wishlistRequireCracked: next })
            setMessage(next ? 'Showing cracked games only.' : 'Showing all games in wishlist.')
        } catch (err) {
            setError(err?.message || 'Could not update wishlist preference')
        } finally {
            setPreferenceBusy(false)
        }
    }

    if (!isLifeSyncConnected) {
        return (
            <LifeSyncHubPageShell>
                <LifeSyncConnectPrompt />
            </LifeSyncHubPageShell>
        )
    }

    return (
        <LifeSyncHubPageShell>
            <div className="space-y-6">
                <header className="lifesync-games-glass overflow-hidden rounded-[24px] border border-[#d2d2d7]/60 bg-[radial-gradient(circle_at_top_right,_#f2ffe0_0%,_#ffffff_52%,_#eef6ff_100%)] p-6 shadow-sm">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#86868b]">LifeSync / Games</p>
                    <div className="mt-2 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <h1 className="text-[28px] font-bold tracking-tight text-[#1a1628]">Wishlist Command Deck</h1>
                            <p className="mt-1 text-[13px] text-[#5b5670]">
                                {crackGamesPluginOn
                                    ? 'Steam import, crack intelligence, unknown-status fallback from Steam, and Early Access detection in one board.'
                                    : 'Steam import and Early Access detection in one board. Crack tools are hidden by your content plugins.'}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 text-[11px]">
                            <span className="rounded-full border border-[#d2d2d7] bg-white px-2.5 py-1 font-semibold text-[#1d1d1f]">
                                Total {wishlistCount}
                            </span>
                            <span className="rounded-full border border-[#d2d2d7] bg-white px-2.5 py-1 font-semibold text-[#1d1d1f]">
                                Visible {visibleCount}
                            </span>
                            <span className="rounded-full border border-[#d2d2d7] bg-white px-2.5 py-1 font-semibold text-[#1d1d1f]">
                                Steam {steamLinked ? 'Linked' : 'Not linked'}
                            </span>
                        </div>
                    </div>
                </header>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
                )}

                {message && (
                    <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-[13px] text-green-700">{message}</div>
                )}

                <div className="grid gap-4 xl:grid-cols-12">
                    <aside className="space-y-4 xl:col-span-4">
                        <section className="lifesync-games-glass rounded-[20px] border border-[#d2d2d7]/50 bg-white p-5 shadow-sm">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="text-[14px] font-semibold text-[#1d1d1f]">Steam import channel</p>
                                    <p className="mt-1 text-[12px] text-[#5b5670]">
                                        Set SteamID64 once and import directly from your Steam wishlist.
                                    </p>
                                </div>
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${steamLinked ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                    {steamLinked ? 'Connected' : 'Disconnected'}
                                </span>
                            </div>
                            <div className="mt-3 space-y-2">
                                <input
                                    type="text"
                                    value={steamIdInput}
                                    onChange={(e) => setSteamIdInput(e.target.value.replace(/[^\d]/g, '').slice(0, 17))}
                                    placeholder="SteamID64 (17 digits)"
                                    className="w-full rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2 text-[12px] text-[#1d1d1f] outline-none focus:border-[#0071e3]/60"
                                />
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void saveSteamId()}
                                        disabled={!canSaveSteamId || steamBusy}
                                        className="rounded-xl bg-[#1d1d1f] px-3.5 py-2 text-[12px] font-semibold text-white transition hover:bg-black disabled:opacity-50"
                                    >
                                        {steamBusy ? 'Saving…' : 'Save'}
                                    </button>
                                    {steamLinked && (
                                        <button
                                            type="button"
                                            onClick={() => void disconnectSteam()}
                                            disabled={steamBusy}
                                            className="rounded-xl border border-[#e5e5ea] bg-white px-3.5 py-2 text-[12px] font-semibold text-[#86868b] transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                                        >
                                            Disconnect
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => void importSteamWishlist()}
                                        disabled={importBusy || !steamLinked}
                                        className="rounded-xl bg-[#C6FF00] px-3.5 py-2 text-[12px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition hover:brightness-95 disabled:opacity-50"
                                    >
                                        {importBusy ? 'Importing…' : 'Import Wishlist'}
                                    </button>
                                </div>
                            </div>
                        </section>

                        {crackGamesPluginOn ? (
                            <section className="lifesync-games-glass rounded-[20px] border border-[#d2d2d7]/50 bg-white p-5 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-[14px] font-semibold text-[#1d1d1f]">Crack preference</p>
                                        <p className="mt-1 text-[12px] text-[#5b5670]">
                                            Toggle whether your wishlist should only show cracked games.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => void toggleRequireCracked()}
                                        disabled={preferenceBusy}
                                        aria-pressed={requireCracked}
                                        className="inline-flex items-center disabled:opacity-60"
                                        title={requireCracked ? 'Disable cracked-only mode' : 'Enable cracked-only mode'}
                                    >
                                        <span className={`relative inline-flex h-6 w-11 rounded-full transition ${requireCracked ? 'bg-[#1d1d1f]' : 'bg-[#d1d1d6]'}`}>
                                            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${requireCracked ? 'translate-x-5' : 'translate-x-0.5'}`} />
                                        </span>
                                    </button>
                                </div>
                                <p className="mt-3 rounded-lg border border-[#e5e5ea] bg-[#f8f8fb] px-3 py-2 text-[12px] text-[#4b5563]">
                                    {requireCracked
                                        ? 'Cracked-only mode is ON. Non-cracked and unknown-status items are hidden.'
                                        : 'Cracked-only mode is OFF. All wishlist entries are visible.'}
                                </p>
                            </section>
                        ) : (
                            <section className="lifesync-games-glass rounded-[20px] border border-[#d2d2d7]/50 bg-white p-5 shadow-sm">
                                <p className="text-[14px] font-semibold text-[#1d1d1f]">Crack tools hidden</p>
                                <p className="mt-1 text-[12px] text-[#5b5670]">
                                    Enable the Crack games content plugin in LifeSync integrations to show crack status and cracked-only filters.
                                </p>
                            </section>
                        )}

                        <section className="lifesync-games-glass rounded-[20px] border border-[#d2d2d7]/50 bg-white p-5 shadow-sm">
                            <p className="text-[14px] font-semibold text-[#1d1d1f]">Quick add</p>
                            <form onSubmit={addManualItem} className="mt-3 space-y-2">
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="Game title"
                                    className="w-full rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2 text-[12px] text-[#1d1d1f] outline-none focus:border-[#0071e3]/60"
                                />
                                <input
                                    type="url"
                                    value={newStoreUrl}
                                    onChange={(e) => setNewStoreUrl(e.target.value)}
                                    placeholder="Store URL (optional)"
                                    className="w-full rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2 text-[12px] text-[#1d1d1f] outline-none focus:border-[#0071e3]/60"
                                />
                                <button
                                    type="submit"
                                    disabled={addingBusy}
                                    className="w-full rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-[12px] font-semibold text-[#1d1d1f] transition hover:border-[#0071e3] disabled:opacity-50"
                                >
                                    {addingBusy ? 'Adding…' : 'Add to Wishlist'}
                                </button>
                            </form>
                        </section>
                    </aside>

                    <section className="space-y-3 xl:col-span-8">
                        <div className="lifesync-games-glass flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[#d2d2d7]/50 bg-white px-5 py-4 shadow-sm">
                            <div>
                                <p className="text-[14px] font-semibold text-[#1d1d1f]">Wishlist items ({visibleCount})</p>
                                {crackGamesPluginOn && requireCracked && (
                                    <p className="mt-0.5 text-[11px] text-[#6b7280]">Filtered from {wishlistCount} total entries by your cracked-only preference.</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => void loadWishlist()}
                                disabled={loading}
                                className="rounded-lg border border-[#e5e5ea] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1d1d1f] transition hover:border-[#0071e3] disabled:opacity-50"
                            >
                                {loading ? 'Loading…' : 'Refresh'}
                            </button>
                        </div>

                        {wishlistData.length === 0 ? (
                            <div className="lifesync-games-glass rounded-2xl border border-dashed border-[#cbd5e1] bg-white/80 px-6 py-12 text-center">
                                <p className="text-[14px] font-semibold text-[#1d1d1f]">No wishlist items yet</p>
                                <p className="mt-1 text-[12px] text-[#64748b]">Import from Steam or add items manually.</p>
                            </div>
                        ) : filteredWishlist.length === 0 ? (
                            <div className="lifesync-games-glass rounded-2xl border border-dashed border-[#cbd5e1] bg-white/80 px-6 py-12 text-center">
                                <p className="text-[14px] font-semibold text-[#1d1d1f]">No cracked games in current wishlist</p>
                                <p className="mt-1 text-[12px] text-[#64748b]">Turn off cracked-only mode to view unknown, upcoming, and uncracked entries.</p>
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {filteredWishlist.map((item) => {
                                    const rowId = item.id || item._id
                                    return (
                                        <WishlistItemCard
                                            key={rowId || item.externalRef || item.title}
                                            item={item}
                                            crackGamesPluginOn={crackGamesPluginOn}
                                            removing={removingId === rowId}
                                            onRemove={() => {
                                                if (rowId) void removeItem(rowId)
                                            }}
                                        />
                                    )
                                })}
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </LifeSyncHubPageShell>
    )
}
