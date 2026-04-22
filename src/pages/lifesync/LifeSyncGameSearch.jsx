import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { useLifeSync } from '../../context/LifeSyncContext'
import { useGameSearch } from '../../hooks/useGameSearch'
import { GameSearchDetailsPopup } from '../../components/lifesync/GameSearchDetailsPopup'
import { buildGameDetailsFromSearchPayload } from '../../lib/gamesearchDetails'
import { isLifeSyncCrackGamesVisible, lifesyncFetch } from '../../lib/lifesyncApi'

function formatDate(value) {
    if (!value) return 'Unknown'
    try {
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
    } catch {
        return String(value)
    }
}

function statusChipClass(status) {
    if (status === 'cracked') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (status === 'not_cracked') return 'bg-rose-100 text-rose-700 border-rose-200'
    if (status === 'upcoming') return 'bg-amber-100 text-amber-800 border-amber-200'
    if (status === 'release_today') return 'bg-indigo-100 text-indigo-700 border-indigo-200'
    if (status === 'released') return 'bg-sky-100 text-sky-700 border-sky-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
}

function titleCaseStatus(status) {
    if (!status) return 'Unknown'
    return String(status)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (x) => x.toUpperCase())
}

function LifeSyncConnectPrompt() {
    return (
        <div className="mx-auto max-w-4xl rounded-[22px] border border-[var(--color-border-strong)]/90 bg-[var(--color-surface)]/90 px-8 py-16 text-center shadow-sm ring-1 ring-[var(--mx-color-e8e4ef)]/70">
            <p className="text-[17px] font-bold text-[var(--mx-color-1a1628)]">LifeSync Not Connected</p>
            <p className="mt-2 text-[14px] text-[var(--mx-color-5b5670)]">
                Connect LifeSync in your profile to search GameStatus crack and release data.
            </p>
            <Link
                to="/dashboard/profile?tab=integrations"
                className="mt-5 inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-[var(--mx-color-1a1628)] shadow-sm ring-1 ring-[var(--mx-color-1a1628)]/10 transition-all hover:brightness-95"
            >
                Go to Integrations
            </Link>
        </div>
    )
}

function LifeSyncPluginPrompt() {
    return (
        <div className="mx-auto max-w-4xl rounded-[22px] border border-[var(--color-border-strong)]/90 bg-[var(--color-surface)]/90 px-8 py-16 text-center shadow-sm ring-1 ring-[var(--mx-color-e8e4ef)]/70">
            <p className="text-[17px] font-bold text-[var(--mx-color-1a1628)]">Crack Games Plugin Disabled</p>
            <p className="mt-2 text-[14px] text-[var(--mx-color-5b5670)]">
                Enable the Crack games content plugin to use GameSearch crack lookup.
            </p>
            <Link
                to="/dashboard/lifesync/integrations"
                className="mt-5 inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-[var(--mx-color-1a1628)] shadow-sm ring-1 ring-[var(--mx-color-1a1628)]/10 transition-all hover:brightness-95"
            >
                Open LifeSync Integrations
            </Link>
        </div>
    )
}

export default function LifeSyncGameSearch() {
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const crackGamesPluginOn = isLifeSyncCrackGamesVisible(lifeSyncUser?.preferences)
    const [searchParams] = useSearchParams()
    const seedQuery = searchParams.get('q') || ''
    const [queryInput, setQueryInput] = useState(seedQuery)
    const [query, setQuery] = useState(seedQuery)
    const [mode, setMode] = useState('fast')
    const [limit, setLimit] = useState(16)
    const [sourcesInput, setSourcesInput] = useState('')
    const [detailsOpen, setDetailsOpen] = useState(false)
    const [wishlistBusy, setWishlistBusy] = useState(false)
    const [wishlistMsg, setWishlistMsg] = useState('')

    const parsedSources = useMemo(
        () => sourcesInput.split(',').map((x) => x.trim()).filter(Boolean),
        [sourcesInput],
    )

    const { data, loading, error, refetch } = useGameSearch({
        query,
        mode,
        sources: parsedSources.length ? parsedSources : undefined,
        limit,
        view: 'standard',
        enabled: isLifeSyncConnected && crackGamesPluginOn,
    })

    const payload = data?.data && typeof data.data === 'object' ? data.data : null
    const links = Array.isArray(payload?.links) ? payload.links : []
    const game = payload?.game && typeof payload.game === 'object' ? payload.game : null
    const gamestatus = payload?.metadata?.gamestatus && typeof payload.metadata.gamestatus === 'object'
        ? payload.metadata.gamestatus
        : null
    const availableProviders = Array.isArray(payload?.available_providers) ? payload.available_providers : []

    const details = useMemo(
        () => (payload ? buildGameDetailsFromSearchPayload(payload, { fallbackTitle: query }) : null),
        [payload, query],
    )

    const directStoreLinks = Array.isArray(details?.stores) ? details.stores : []

    async function addToWishlist() {
        const title = String(game?.name || gamestatus?.title || query || '').trim()
        if (!title) return

        const steamAppId = Number(game?.steam_appid || 0)
        const preferredStoreUrl = steamAppId > 0
            ? `https://store.steampowered.com/app/${steamAppId}/`
            : String(directStoreLinks?.[0]?.url || '').trim()

        setWishlistBusy(true)
        setWishlistMsg('')

        try {
            await lifesyncFetch('/api/v1/wishlist', {
                method: 'POST',
                json: {
                    platform: 'steam',
                    title,
                    storeUrl: preferredStoreUrl || undefined,
                    ...(steamAppId > 0 ? { externalRef: String(steamAppId) } : {}),
                },
            })
            setWishlistMsg('Added to wishlist.')
        } catch (err) {
            setWishlistMsg(err?.message || 'Could not add to wishlist')
        } finally {
            setWishlistBusy(false)
        }
    }

    function onSubmit(e) {
        e.preventDefault()
        const next = queryInput.trim()
        setQuery(next)
    }

    if (!isLifeSyncConnected) {
        return (
            <LifeSyncHubPageShell>
                <LifeSyncConnectPrompt />
            </LifeSyncHubPageShell>
        )
    }

    if (!crackGamesPluginOn) {
        return (
            <LifeSyncHubPageShell>
                <LifeSyncPluginPrompt />
            </LifeSyncHubPageShell>
        )
    }

    return (
        <LifeSyncHubPageShell>
            <div className="space-y-6">
                <header className="lifesync-games-glass rounded-[20px] border border-apple-border/60 bg-[var(--color-surface)]/95 p-5 shadow-sm">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--mx-color-6e6e73)]">LifeSync • GameSearch</p>
                    <h1 className="mt-1 text-[30px] font-bold tracking-tight text-apple-text">Search Crack Status</h1>
                    <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--mx-color-515154)]">
                        Find game release entries with crack status metadata and deep links from GameStatus.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                            to="/dashboard/lifesync/games/releases"
                            className="inline-flex items-center rounded-lg border border-apple-border bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[var(--mx-color-0071e3)]"
                        >
                            Browse Upcoming Releases
                        </Link>
                        <Link
                            to="/dashboard/lifesync/games/crack-status"
                            className="inline-flex items-center rounded-lg border border-apple-border bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[var(--mx-color-0071e3)]"
                        >
                            Quick Crack Check
                        </Link>
                    </div>
                </header>

                <section className="lifesync-games-glass rounded-[20px] border border-apple-border/60 bg-[var(--color-surface)]/95 p-5 shadow-sm">
                    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-12 md:items-end">
                        <label className="flex flex-col gap-1 md:col-span-5">
                            <span className="text-[12px] font-semibold text-[var(--mx-color-515154)]">Game name</span>
                            <input
                                type="text"
                                value={queryInput}
                                onChange={(e) => setQueryInput(e.target.value)}
                                placeholder="Elden Ring"
                                className="h-11 rounded-xl border border-apple-border px-3 text-[14px] text-apple-text outline-none ring-[var(--mx-color-0071e3)]/30 transition focus:ring-2"
                            />
                        </label>
                        <label className="flex flex-col gap-1 md:col-span-2">
                            <span className="text-[12px] font-semibold text-[var(--mx-color-515154)]">Mode</span>
                            <select
                                value={mode}
                                onChange={(e) => setMode(e.target.value)}
                                className="h-11 rounded-xl border border-apple-border px-3 text-[14px] text-apple-text outline-none ring-[var(--mx-color-0071e3)]/30 transition focus:ring-2"
                            >
                                <option value="fast">Fast</option>
                                <option value="all">All providers</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 md:col-span-2">
                            <span className="text-[12px] font-semibold text-[var(--mx-color-515154)]">Max links</span>
                            <input
                                type="number"
                                min="1"
                                max="50"
                                value={limit}
                                onChange={(e) => setLimit(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                                className="h-11 rounded-xl border border-apple-border px-3 text-[14px] text-apple-text outline-none ring-[var(--mx-color-0071e3)]/30 transition focus:ring-2"
                            />
                        </label>
                        <div className="md:col-span-3">
                            <button
                                type="submit"
                                disabled={loading}
                                className="h-11 w-full rounded-xl bg-primary px-4 text-[13px] font-semibold text-[var(--mx-color-1a1628)] shadow-sm ring-1 ring-[var(--mx-color-1a1628)]/10 transition hover:brightness-95 disabled:opacity-60"
                            >
                                {loading ? 'Searching...' : 'Search'}
                            </button>
                        </div>
                        <label className="flex flex-col gap-1 md:col-span-12">
                            <span className="text-[12px] font-semibold text-[var(--mx-color-515154)]">Sources (optional, comma-separated)</span>
                            <input
                                type="text"
                                value={sourcesInput}
                                onChange={(e) => setSourcesInput(e.target.value)}
                                placeholder="gamestatus,steamrip"
                                className="h-10 rounded-xl border border-apple-border px-3 text-[13px] text-apple-text outline-none ring-[var(--mx-color-0071e3)]/30 transition focus:ring-2"
                            />
                        </label>
                    </form>
                    {availableProviders.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[var(--mx-color-6e6e73)]">
                            <span className="font-semibold">Available providers:</span>
                            {availableProviders.map((provider) => (
                                <span key={provider} className="rounded-full border border-apple-border bg-apple-bg px-2 py-1 font-medium text-[var(--mx-color-515154)]">
                                    {provider}
                                </span>
                            ))}
                        </div>
                    )}
                </section>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                        {error.message || 'Failed to load search results'}
                    </div>
                )}

                {wishlistMsg && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-700">
                        {wishlistMsg}
                    </div>
                )}

                {!query && (
                    <div className="lifesync-games-glass rounded-[20px] border border-dashed border-apple-border bg-[var(--color-surface)]/70 px-6 py-12 text-center text-[14px] text-[var(--mx-color-6e6e73)]">
                        Search for any game title to see release metadata and crack status.
                    </div>
                )}

                {query && !loading && !error && (
                    <section className="grid gap-4 lg:grid-cols-12">
                        <article className="lifesync-games-glass rounded-[20px] border border-apple-border/60 bg-[var(--color-surface)] p-5 shadow-sm lg:col-span-5">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-apple-subtext">Best match</p>
                            <h2 className="mt-2 text-[20px] font-bold leading-tight text-apple-text">
                                {game?.name || gamestatus?.title || query}
                            </h2>
                            {details?.heroImage && (
                                <div className="mt-3 overflow-hidden rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg">
                                    <img
                                        src={details.heroImage}
                                        alt=""
                                        className="h-32 w-full object-cover sm:h-36"
                                        loading="lazy"
                                    />
                                </div>
                            )}
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusChipClass(gamestatus?.status_key)}`}>
                                    {titleCaseStatus(gamestatus?.status_key)}
                                </span>
                                {game?.release_date && (
                                    <span className="rounded-full border border-apple-border bg-apple-bg px-3 py-1 text-[11px] font-medium text-[var(--mx-color-515154)]">
                                        Released {formatDate(game.release_date)}
                                    </span>
                                )}
                                {game?.steam_appid && (
                                    <a
                                        href={`https://store.steampowered.com/app/${game.steam_appid}/`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-full border border-apple-border bg-[var(--color-surface)] px-3 py-1 text-[11px] font-semibold text-apple-text transition hover:border-[var(--mx-color-0071e3)]"
                                    >
                                        Steam {game.steam_appid}
                                    </a>
                                )}
                            </div>
                            {gamestatus?.slug && (
                                <div className="mt-4">
                                    <Link
                                        to={`/dashboard/lifesync/games/crack-status?q=${encodeURIComponent(game?.name || gamestatus.title || query)}`}
                                        className="inline-flex items-center rounded-lg border border-apple-border bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[var(--mx-color-0071e3)]"
                                    >
                                        Open Detailed Crack Status
                                    </Link>
                                </div>
                            )}
                            <div className="mt-3">
                                <button
                                    type="button"
                                    onClick={() => setDetailsOpen(true)}
                                    className="inline-flex items-center rounded-lg border border-apple-border bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[var(--mx-color-0071e3)]"
                                >
                                    Open Popup Details
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void addToWishlist()}
                                    disabled={wishlistBusy}
                                    className="ml-2 inline-flex items-center rounded-lg border border-apple-border bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[var(--mx-color-0071e3)] disabled:opacity-60"
                                >
                                    {wishlistBusy ? 'Adding…' : 'Add to Wishlist'}
                                </button>
                            </div>
                        </article>

                        <article className="lifesync-games-glass rounded-[20px] border border-apple-border/60 bg-[var(--color-surface)] p-5 shadow-sm lg:col-span-7">
                            <div className="flex items-center justify-between gap-3">
                                <h3 className="text-[16px] font-bold text-apple-text">Available Stores</h3>
                                <button
                                    type="button"
                                    onClick={() => void refetch()}
                                    className="rounded-lg border border-apple-border bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[var(--mx-color-0071e3)]"
                                >
                                    Refresh
                                </button>
                            </div>
                            {links.length > 0 && (
                                <p className="mt-2 text-[11px] text-[var(--mx-color-6e6e73)]">GameStatus links are hidden. Direct store/provider links only.</p>
                            )}
                            {directStoreLinks.length === 0 ? (
                                <p className="mt-4 text-[13px] text-[var(--mx-color-6e6e73)]">No direct store links returned for this query.</p>
                            ) : (
                                <div className="mt-4 space-y-3">
                                    {directStoreLinks.map((item, idx) => (
                                        <a
                                            key={`${item.url || item.source || 'source'}-${idx}`}
                                            href={item.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="lifesync-games-glass block rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fbfbfd)] p-3 transition hover:border-[var(--mx-color-0071e3)]/50 hover:bg-[var(--color-surface)]"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="text-[13px] font-semibold text-apple-text">{item.name || item.title || 'Source link'}</p>
                                                <span className="rounded-full bg-[var(--mx-color-eef2ff)] px-2 py-1 text-[11px] font-semibold uppercase text-[var(--mx-color-4f46e5)]">
                                                    {item.source || 'provider'}
                                                </span>
                                            </div>
                                            <p className="mt-1 truncate text-[12px] text-[var(--mx-color-6e6e73)]">{item.url}</p>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </article>
                    </section>
                )}
            </div>

            <GameSearchDetailsPopup
                open={detailsOpen && Boolean(details)}
                onClose={() => setDetailsOpen(false)}
                detail={details}
            />
        </LifeSyncHubPageShell>
    )
}
