import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { useLifeSync } from '../../context/LifeSyncContext'
import { useGameCrackStatus } from '../../hooks/useGameCrackStatus'
import { useGameSearch } from '../../hooks/useGameSearch'
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
        <div className="mx-auto max-w-4xl rounded-[22px] border border-white/90 bg-white/90 px-8 py-16 text-center shadow-sm ring-1 ring-[#e8e4ef]/70">
            <p className="text-[17px] font-bold text-[#1a1628]">LifeSync Not Connected</p>
            <p className="mt-2 text-[14px] text-[#5b5670]">
                Connect LifeSync in your profile to check real-time crack status.
            </p>
            <Link
                to="/dashboard/profile?tab=integrations"
                className="mt-5 inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95"
            >
                Go to Integrations
            </Link>
        </div>
    )
}

function LifeSyncPluginPrompt() {
    return (
        <div className="mx-auto max-w-4xl rounded-[22px] border border-white/90 bg-white/90 px-8 py-16 text-center shadow-sm ring-1 ring-[#e8e4ef]/70">
            <p className="text-[17px] font-bold text-[#1a1628]">Crack Games Plugin Disabled</p>
            <p className="mt-2 text-[14px] text-[#5b5670]">
                Enable the Crack games content plugin to access crack status checks.
            </p>
            <Link
                to="/dashboard/lifesync/integrations"
                className="mt-5 inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95"
            >
                Open LifeSync Integrations
            </Link>
        </div>
    )
}

export default function LifeSyncGameCrackStatus() {
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const crackGamesPluginOn = isLifeSyncCrackGamesVisible(lifeSyncUser?.preferences)
    const [searchParams] = useSearchParams()
    const seedQuery = searchParams.get('q') || ''

    const [queryInput, setQueryInput] = useState(seedQuery)
    const [query, setQuery] = useState(seedQuery)
    const [mode, setMode] = useState('fast')
    const [sourcesInput, setSourcesInput] = useState('')
    const [wishlistBusy, setWishlistBusy] = useState(false)
    const [wishlistMsg, setWishlistMsg] = useState('')

    const parsedSources = useMemo(
        () => sourcesInput.split(',').map((x) => x.trim()).filter(Boolean),
        [sourcesInput],
    )

    const { data, loading, error, refetch } = useGameCrackStatus({
        query,
        view: 'standard',
        enabled: isLifeSyncConnected && crackGamesPluginOn,
    })

    const linkedSearch = useGameSearch({
        query,
        mode,
        sources: parsedSources.length ? parsedSources : undefined,
        limit: 20,
        view: 'full',
        enabled: isLifeSyncConnected && crackGamesPluginOn && Boolean(String(query || '').trim()),
    })

    const payload = data?.data && typeof data.data === 'object' ? data.data : null
    const linkedPayload = linkedSearch.data?.data && typeof linkedSearch.data.data === 'object'
        ? linkedSearch.data.data
        : null
    const linkedDetails = buildGameDetailsFromSearchPayload(linkedPayload || {}, { fallbackTitle: query })
    const directStores = Array.isArray(linkedDetails.stores) ? linkedDetails.stores : []
    const availableProviders = Array.isArray(linkedPayload?.available_providers) ? linkedPayload.available_providers : []

    function onSubmit(e) {
        e.preventDefault()
        setQuery(queryInput.trim())
    }

    async function addToWishlist() {
        const title = String(payload?.title || query || '').trim()
        if (!title) return

        const steamAppId = Number(linkedPayload?.game?.steam_appid || 0)
        const preferredStoreUrl = steamAppId > 0
            ? `https://store.steampowered.com/app/${steamAppId}/`
            : String(directStores?.[0]?.url || '').trim()

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
                <header className="lifesync-games-glass rounded-[20px] border border-apple-border/60 bg-white/95 p-5 shadow-sm">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6e6e73]">LifeSync • GameStatus</p>
                    <h1 className="mt-1 text-[30px] font-bold tracking-tight text-apple-text">Crack Status</h1>
                    <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[#515154]">
                        Search any game title and inspect release protection, group, and crack timeline metadata.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                            to="/dashboard/lifesync/games/search"
                            className="inline-flex items-center rounded-lg border border-apple-border bg-white px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[#0071e3]"
                        >
                            Search Sources
                        </Link>
                        <Link
                            to="/dashboard/lifesync/games/releases"
                            className="inline-flex items-center rounded-lg border border-apple-border bg-white px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[#0071e3]"
                        >
                            View Releases
                        </Link>
                    </div>
                </header>

                <section className="lifesync-games-glass rounded-[20px] border border-apple-border/60 bg-white/95 p-5 shadow-sm">
                    <form onSubmit={onSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <label className="flex-1">
                            <span className="mb-1 block text-[12px] font-semibold text-[#515154]">Game name</span>
                            <input
                                type="text"
                                value={queryInput}
                                onChange={(e) => setQueryInput(e.target.value)}
                                placeholder="Hogwarts Legacy"
                                className="h-11 w-full rounded-xl border border-apple-border px-3 text-[14px] text-apple-text outline-none ring-[#0071e3]/30 transition focus:ring-2"
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={loading}
                            className="h-11 rounded-xl bg-primary px-5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition hover:brightness-95 disabled:opacity-60"
                        >
                            {loading ? 'Checking...' : 'Check status'}
                        </button>
                        <button
                            type="button"
                            onClick={() => void refetch()}
                            disabled={loading || !query}
                            className="h-11 rounded-xl border border-apple-border bg-white px-4 text-[13px] font-semibold text-apple-text transition hover:border-[#0071e3] disabled:opacity-60"
                        >
                            Refresh
                        </button>
                    </form>
                    <div className="mt-3 grid gap-3 md:grid-cols-12">
                        <label className="flex flex-col gap-1 md:col-span-3">
                            <span className="text-[12px] font-semibold text-[#515154]">Providers mode</span>
                            <select
                                value={mode}
                                onChange={(e) => setMode(e.target.value)}
                                className="h-10 rounded-xl border border-apple-border px-3 text-[13px] text-apple-text outline-none ring-[#0071e3]/30 transition focus:ring-2"
                            >
                                <option value="fast">Fast</option>
                                <option value="all">All providers</option>
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 md:col-span-9">
                            <span className="text-[12px] font-semibold text-[#515154]">Specific sources (optional)</span>
                            <input
                                type="text"
                                value={sourcesInput}
                                onChange={(e) => setSourcesInput(e.target.value)}
                                placeholder="gamestatus,goggames,fitgirl"
                                className="h-10 rounded-xl border border-apple-border px-3 text-[13px] text-apple-text outline-none ring-[#0071e3]/30 transition focus:ring-2"
                            />
                        </label>
                    </div>
                    {availableProviders.length > 0 && (
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-[#6e6e73]">
                            <span className="font-semibold">Available providers:</span>
                            {availableProviders.map((provider) => (
                                <span key={provider} className="rounded-full border border-apple-border bg-apple-bg px-2 py-1 font-medium text-[#515154]">
                                    {provider}
                                </span>
                            ))}
                        </div>
                    )}
                </section>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
                        {error.message || 'Failed to load crack status'}
                    </div>
                )}

                {wishlistMsg && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-[13px] text-blue-700">
                        {wishlistMsg}
                    </div>
                )}

                {!query && (
                    <div className="lifesync-games-glass rounded-[20px] border border-dashed border-apple-border bg-white/70 px-6 py-12 text-center text-[14px] text-[#6e6e73]">
                        Enter a game title to inspect crack timeline metadata.
                    </div>
                )}

                {query && payload && !error && (
                    <section className="lifesync-games-glass rounded-[20px] border border-apple-border/60 bg-white p-5 shadow-sm">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-apple-subtext">Result</p>
                                <h2 className="mt-1 text-[24px] font-bold leading-tight text-apple-text">{payload.title || query}</h2>
                            </div>
                            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusChipClass(payload.status_key)}`}>
                                {titleCaseStatus(payload.status_key)}
                            </span>
                        </div>

                        {(linkedDetails.bannerImage || linkedDetails.heroImage || payload.image) && (
                            <div className="mt-4 grid gap-3 lg:grid-cols-12">
                                {(linkedDetails.bannerImage || payload.image) && (
                                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 lg:col-span-7">
                                        <img
                                            src={linkedDetails.bannerImage || payload.image}
                                            alt=""
                                            className="h-40 w-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                )}
                                {linkedDetails.heroImage && (
                                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 lg:col-span-5">
                                        <img
                                            src={linkedDetails.heroImage}
                                            alt=""
                                            className="h-40 w-full object-cover"
                                            loading="lazy"
                                        />
                                    </div>
                                )}
                            </div>
                        )}

                        {linkedDetails.description && (
                            <p className="mt-4 text-[13px] leading-relaxed text-[#515154]">{linkedDetails.description}</p>
                        )}

                        <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="lifesync-games-glass rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] p-3">
                                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-apple-subtext">Release date</dt>
                                <dd className="mt-1 text-[13px] font-semibold text-apple-text">{formatDate(payload.release_date)}</dd>
                            </div>
                            <div className="lifesync-games-glass rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] p-3">
                                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-apple-subtext">Crack date</dt>
                                <dd className="mt-1 text-[13px] font-semibold text-apple-text">{formatDate(payload.crack_date)}</dd>
                            </div>
                            <div className="lifesync-games-glass rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] p-3">
                                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-apple-subtext">Protection</dt>
                                <dd className="mt-1 text-[13px] font-semibold text-apple-text">{payload.protection || 'Unknown'}</dd>
                            </div>
                            <div className="lifesync-games-glass rounded-xl border border-[#e5e5ea] bg-[#fbfbfd] p-3">
                                <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-apple-subtext">Group</dt>
                                <dd className="mt-1 text-[13px] font-semibold text-apple-text">{payload.group || 'Unknown'}</dd>
                            </div>
                        </dl>

                        <div className="mt-5">
                            <h3 className="text-[14px] font-bold text-apple-text">Direct store links</h3>
                            {linkedSearch.loading && (
                                <p className="mt-2 text-[12px] text-[#6e6e73]">Loading store links...</p>
                            )}
                            {!linkedSearch.loading && directStores.length === 0 && (
                                <p className="mt-2 text-[12px] text-[#6e6e73]">No direct store/provider links available (GameStatus links are intentionally hidden).</p>
                            )}
                            {directStores.length > 0 && (
                                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                    {directStores.map((store, idx) => (
                                        <a
                                            key={`${store.url || store.source || 'store'}-${idx}`}
                                            href={store.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="lifesync-games-glass rounded-lg border border-[#e5e5ea] bg-[#fbfbfd] px-3 py-2 transition hover:border-[#0071e3]/40 hover:bg-white"
                                        >
                                            <p className="text-[13px] font-semibold text-apple-text line-clamp-1">{store.name || 'Store link'}</p>
                                            <p className="mt-0.5 text-[11px] uppercase text-[#4f46e5]">{store.source || 'store'}</p>
                                        </a>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <Link
                                to={`/dashboard/lifesync/games/search${query ? `?q=${encodeURIComponent(query)}` : ''}`}
                                className="inline-flex items-center rounded-lg border border-apple-border bg-white px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[#0071e3]"
                            >
                                Search Similar
                            </Link>
                            <button
                                type="button"
                                onClick={() => void addToWishlist()}
                                disabled={wishlistBusy}
                                className="inline-flex items-center rounded-lg border border-apple-border bg-white px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[#0071e3] disabled:opacity-60"
                            >
                                {wishlistBusy ? 'Adding…' : 'Add to Wishlist'}
                            </button>
                        </div>
                    </section>
                )}
            </div>
        </LifeSyncHubPageShell>
    )
}
