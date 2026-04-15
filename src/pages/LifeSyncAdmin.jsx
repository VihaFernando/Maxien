import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLifeSync } from '../context/LifeSyncContext'
import { getLifesyncToken, lifesyncFetch } from '../lib/lifesyncApi'
import { isLifeSyncAdmin } from '../lib/lifeSyncRoles'
import { LifeSyncSectionNav } from '../components/lifesync/LifeSyncSectionNav'

const ADMIN_TABS = [
    { id: 'overview', label: 'Overview', title: 'Growth, usage, and quick snapshot' },
    { id: 'live', label: 'Live & ops', title: 'Real-time process, health, integrations, broadcast' },
    { id: 'activity', label: 'Activity', title: 'Latest anime & manga progress across users' },
    { id: 'users', label: 'Users', title: 'Signups, lookup, and support tools' },
]

const VALID_TAB_IDS = new Set(ADMIN_TABS.map((t) => t.id))

const CAPABILITY_LABELS = {
    steamWebApi: 'Steam Web API',
    malOAuth: 'MAL OAuth',
    googleOAuth: 'Google OAuth',
    mangadexServerClient: 'MangaDex server client',
    animeScheduleAppToken: 'AnimeSchedule app token',
    animeScheduleOAuth: 'AnimeSchedule OAuth',
    supabasePasswordless: 'Supabase passwordless',
    openXbl: 'OpenXBL',
    crackwatch: 'Crackwatch',
    hentaiOcean: 'HentaiOcean RSS',
    anitakuFallback: 'Anitaku fallback',
    mangaDistrict: 'Manga District',
}

const V1_ADMIN_MODE = false

function MetricCard({ label, value, hint }) {
    return (
        <div className="rounded-2xl border border-[#e5e5ea] bg-white p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-apple-subtext">{label}</p>
            <p className="mt-1.5 text-[22px] font-bold tabular-nums text-apple-text">{value ?? '—'}</p>
            {hint ? <p className="mt-1 text-[10px] leading-snug text-apple-subtext">{hint}</p> : null}
        </div>
    )
}

function BoolPill({ ok, label }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-900'
            }`}
        >
            <span className={`h-1.5 w-1.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {label}
        </span>
    )
}

function formatUptime(totalSeconds) {
    const s = Math.max(0, Math.floor(Number(totalSeconds) || 0))
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
}

function LinkPill({ label, active }) {
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                active ? 'bg-emerald-100 text-emerald-800' : 'bg-apple-bg text-apple-subtext'
            }`}
        >
            {label}
        </span>
    )
}

function SectionIntro({ title, children }) {
    return (
        <div className="mb-5">
            <h2 className="text-[15px] font-bold text-apple-text">{title}</h2>
            {children ? <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-apple-subtext">{children}</p> : null}
        </div>
    )
}

function Panel({ children, className = '' }) {
    return (
        <div className={`rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-sm sm:p-6 ${className}`}>{children}</div>
    )
}

async function copyText(text) {
    try {
        await navigator.clipboard.writeText(text)
    } catch {
        /* ignore */
    }
}

export default function LifeSyncAdmin() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { lifeSyncUser, lifeSyncLoading, isLifeSyncConnected, refreshLifeSyncMe } = useLifeSync()

    const tab = useMemo(() => {
        const raw = searchParams.get('tab') || 'overview'
        return VALID_TAB_IDS.has(raw) ? raw : 'overview'
    }, [searchParams])

    const setTab = useCallback(
        (id) => {
            setSearchParams(id === 'overview' ? {} : { tab: id }, { replace: true })
        },
        [setSearchParams],
    )

    const [overview, setOverview] = useState(null)
    const [loadError, setLoadError] = useState('')
    const [loadBusy, setLoadBusy] = useState(false)

    const [lookupEmail, setLookupEmail] = useState('')
    const [lookupBusy, setLookupBusy] = useState(false)
    const [lookupResult, setLookupResult] = useState(null)

    const [lookupUserId, setLookupUserId] = useState('')
    const [lookupIdBusy, setLookupIdBusy] = useState(false)
    const [lookupIdResult, setLookupIdResult] = useState(null)

    const [capabilities, setCapabilities] = useState(null)
    const [health, setHealth] = useState(null)
    const [healthBusy, setHealthBusy] = useState(false)
    const [broadcastText, setBroadcastText] = useState('')
    const [broadcastBusy, setBroadcastBusy] = useState(false)
    const [broadcastMsg, setBroadcastMsg] = useState('')

    const [activityAnime, setActivityAnime] = useState(null)
    const [activityManga, setActivityManga] = useState(null)
    const [activityBusy, setActivityBusy] = useState(false)
    const [activityError, setActivityError] = useState('')
    const [v1Health, setV1Health] = useState(null)
    const [v1HealthError, setV1HealthError] = useState('')

    const hasToken = Boolean(getLifesyncToken())
    const allowed = isLifeSyncAdmin(lifeSyncUser)

    useEffect(() => {
        if (!V1_ADMIN_MODE) return
        if (!allowed || !hasToken) return
        let cancelled = false
        setV1HealthError('')
        lifesyncFetch('/api/v1/health', { method: 'GET' })
            .then((data) => {
                if (!cancelled) setV1Health(data || null)
            })
            .catch((e) => {
                if (cancelled) return
                setV1Health(null)
                setV1HealthError(e?.message || 'Could not load v1 health.')
            })
        return () => {
            cancelled = true
        }
    }, [allowed, hasToken])

    const load = useCallback(async () => {
        if (V1_ADMIN_MODE) return
        setLoadError('')
        setLoadBusy(true)
        try {
            const data = await lifesyncFetch('/api/v1/admin/overview', { method: 'GET' })
            setOverview(data)
            try {
                setCapabilities(await lifesyncFetch('/api/v1/admin/capabilities', { method: 'GET' }))
            } catch {
                setCapabilities(null)
            }
            try {
                setHealth(await lifesyncFetch('/api/v1/admin/health', { method: 'GET' }))
            } catch {
                setHealth(null)
            }
        } catch (e) {
            if (e.status === 403) {
                setLoadError('Your session is not authorized as a LifeSync admin on this server.')
            } else {
                setLoadError(e?.message || 'Could not load admin data.')
            }
            setOverview(null)
        } finally {
            setLoadBusy(false)
        }
    }, [])

    const loadActivity = useCallback(async () => {
        if (V1_ADMIN_MODE) return
        setActivityBusy(true)
        setActivityError('')
        try {
            const [a, m] = await Promise.all([
                lifesyncFetch('/api/v1/admin/activity/recent-anime', { method: 'GET' }),
                lifesyncFetch('/api/v1/admin/activity/recent-manga', { method: 'GET' }),
            ])
            setActivityAnime(a)
            setActivityManga(m)
        } catch (e) {
            setActivityError(e?.message || 'Could not load activity.')
            setActivityAnime(null)
            setActivityManga(null)
        } finally {
            setActivityBusy(false)
        }
    }, [])

    const refreshHealth = async () => {
        setHealthBusy(true)
        try {
            setHealth(await lifesyncFetch('/api/v1/admin/health', { method: 'GET' }))
        } catch {
            setHealth(null)
        } finally {
            setHealthBusy(false)
        }
    }

    const sendBroadcast = async () => {
        const msg = broadcastText.trim()
        if (!msg) return
        setBroadcastBusy(true)
        setBroadcastMsg('')
        try {
            const r = await lifesyncFetch('/api/v1/admin/broadcast', {
                method: 'POST',
                json: { message: msg },
            })
            setBroadcastMsg(
                `Sent to ${r?.deliveredToUserListeners ?? 0} connected LifeSync session(s) on the broadcast channel. Open admin dashboards (ops stream): ${r?.deliveredToAdminListeners ?? 0}.`,
            )
            setBroadcastText('')
        } catch (e) {
            setBroadcastMsg(e?.message || 'Broadcast failed.')
        } finally {
            setBroadcastBusy(false)
        }
    }

    useEffect(() => {
        if (lifeSyncLoading) return
        if (!hasToken) return
        if (!allowed) return
        if (V1_ADMIN_MODE) return
        load()
    }, [lifeSyncLoading, hasToken, allowed, load])

    useEffect(() => {
        if (V1_ADMIN_MODE) return
        if (!allowed || tab !== 'activity') return
        loadActivity()
    }, [allowed, tab, loadActivity])

    const runLookup = async () => {
        const q = lookupEmail.trim()
        if (!q) {
            setLookupResult({ error: 'Enter an email address.' })
            return
        }
        setLookupBusy(true)
        setLookupResult(null)
        try {
            const data = await lifesyncFetch(`/api/v1/admin/users/lookup?email=${encodeURIComponent(q)}`, {
                method: 'GET',
            })
            setLookupResult(data)
        } catch (e) {
            setLookupResult({ error: e?.message || 'Lookup failed.' })
        } finally {
            setLookupBusy(false)
        }
    }

    const runLookupById = async () => {
        const id = lookupUserId.trim()
        if (!id) {
            setLookupIdResult({ error: 'Paste a 24-character user id from the tables above.' })
            return
        }
        if (!/^[a-fA-F0-9]{24}$/.test(id)) {
            setLookupIdResult({ error: 'User id must be 24 hex characters (Mongo ObjectId).' })
            return
        }
        setLookupIdBusy(true)
        setLookupIdResult(null)
        try {
            const data = await lifesyncFetch(`/api/v1/admin/users/by-id/${encodeURIComponent(id)}`, {
                method: 'GET',
            })
            setLookupIdResult(data)
        } catch (e) {
            setLookupIdResult({ error: e?.message || 'Lookup failed.' })
        } finally {
            setLookupIdBusy(false)
        }
    }

    const downloadOverviewJson = () => {
        if (!overview) return
        const blob = new Blob([JSON.stringify(overview, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `lifesync-admin-overview-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const copyServerTime = async () => {
        const t = overview?.serverTime
        if (!t) return
        await copyText(t)
    }

    const tabMeta = ADMIN_TABS.find((t) => t.id === tab) || ADMIN_TABS[0]

    if (lifeSyncLoading) {
        return (
            <div className="flex min-h-[40vh] items-center justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
        )
    }

    if (!hasToken || !isLifeSyncConnected) {
        return (
            <div className="mx-auto max-w-lg rounded-2xl border border-[#e5e5ea] bg-white p-8 shadow-sm">
                <h1 className="text-[18px] font-bold text-apple-text">LifeSync admin</h1>
                <p className="mt-2 text-[13px] leading-relaxed text-apple-subtext">
                    Connect LifeSync with your Maxien account to use the admin console.
                </p>
                <button
                    type="button"
                    onClick={() => navigate('/dashboard/profile?tab=integrations')}
                    className="mt-6 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-apple-text"
                >
                    Open integrations
                </button>
            </div>
        )
    }

    if (!allowed) {
        return (
            <div className="mx-auto max-w-lg rounded-2xl border border-red-200 bg-red-50/80 p-8 shadow-sm">
                <h1 className="text-[18px] font-bold text-red-950">Access denied</h1>
                <p className="mt-2 text-[13px] leading-relaxed text-red-900/90">
                    Your account is not in the server&apos;s admin allowlist. This page is only for configured
                    LifeSync operators.
                </p>
                <Link
                    to="/dashboard"
                    className="mt-6 inline-block rounded-xl border border-red-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-red-950 hover:bg-red-50"
                >
                    Back to overview
                </Link>
            </div>
        )
    }

    if (V1_ADMIN_MODE) {
        return (
            <div className="mx-auto max-w-3xl space-y-4">
                <div className="rounded-2xl border border-[#e5e5ea] bg-white p-6 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-apple-subtext">Operator</p>
                    <h1 className="mt-1 text-[22px] font-bold tracking-tight text-apple-text">LifeSync admin (v1)</h1>
                    <p className="mt-2 text-[13px] leading-relaxed text-apple-subtext">
                        Legacy admin endpoints were removed from v1. This page now exposes the v1 health contract only.
                    </p>
                    {v1HealthError ? (
                        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                            {v1HealthError}
                        </p>
                    ) : null}
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                    <MetricCard label="Service" value={v1Health?.service || '—'} />
                    <MetricCard label="Runtime" value={v1Health?.runtime || '—'} />
                    <MetricCard label="Health" value={v1Health?.ok ? 'OK' : '—'} />
                </div>
                <div className="rounded-2xl border border-[#e5e5ea] bg-white p-5 shadow-sm">
                    <p className="text-[12px] text-apple-subtext">
                        For full operator workflows, implement dedicated `/api/v1/admin/*` routes and then reconnect this UI.
                    </p>
                </div>
            </div>
        )
    }

    const m = overview?.metrics
    const s = overview?.system
    const recent = Array.isArray(overview?.recentSignups) ? overview.recentSignups : []
    const animeRows = Array.isArray(activityAnime?.rows) ? activityAnime.rows : []
    const mangaRows = Array.isArray(activityManga?.rows) ? activityManga.rows : []

    return (
        <div className="mx-auto max-w-6xl px-2 pb-12 sm:px-0">
            <div className="mb-6 rounded-2xl border border-[#e5e5ea] bg-linear-to-br from-white to-apple-bg/80 p-6 shadow-sm sm:p-8">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-apple-subtext">Operator</p>
                        <h1 className="mt-1 text-[24px] font-bold tracking-tight text-apple-text">LifeSync admin</h1>
                        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-apple-subtext">
                            Monitor the API host, integrations, and user activity. Use the tabs to focus each area —
                            nothing here shows OAuth tokens or passwords.
                        </p>
                    </div>
                    <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                        <button
                            type="button"
                            disabled={loadBusy}
                            onClick={() => load()}
                            className="w-full rounded-xl bg-primary px-4 py-2.5 text-[12px] font-semibold text-apple-text shadow-sm disabled:opacity-50 sm:w-auto"
                        >
                            {loadBusy ? 'Refreshing…' : 'Refresh all data'}
                        </button>
                        <button
                            type="button"
                            disabled={!overview}
                            onClick={downloadOverviewJson}
                            className="w-full rounded-xl border border-[#e5e5ea] bg-white px-4 py-2.5 text-[12px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50 sm:w-auto"
                        >
                            Export overview JSON
                        </button>
                    </div>
                </div>

                <div className="mt-6">
                    <LifeSyncSectionNav
                        items={ADMIN_TABS.map(({ id, label, title }) => ({ id, label, title }))}
                        activeId={tab}
                        onSelect={setTab}
                        ariaLabel="Admin sections"
                    />
                </div>
                <p className="mt-3 text-[12px] text-apple-subtext">
                    <span className="font-semibold text-apple-text">{tabMeta.label}</span>
                    {' · '}
                    {tabMeta.title}
                </p>
            </div>

            {loadError && (
                <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
                    {loadError}
                    <button
                        type="button"
                        onClick={() => refreshLifeSyncMe().catch(() => {})}
                        className="ml-2 font-semibold underline"
                    >
                        Refresh session
                    </button>
                </div>
            )}

            {/* ——— Overview ——— */}
            {tab === 'overview' && (
                <div className="space-y-8">
                    <Panel>
                        <SectionIntro title="Snapshot">
                            Server time and resource snapshot from the last overview refresh.
                        </SectionIntro>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <p className="text-[11px] font-bold uppercase tracking-widest text-apple-subtext">
                                    Server time
                                </p>
                                <p className="mt-1 font-mono text-[14px] text-apple-text">
                                    {overview?.serverTime || '—'}
                                </p>
                                <button
                                    type="button"
                                    disabled={!overview?.serverTime}
                                    onClick={copyServerTime}
                                    className="mt-2 text-[11px] font-semibold text-primary hover:underline disabled:opacity-40"
                                >
                                    Copy time
                                </button>
                            </div>
                            <dl className="space-y-2 text-[12px] text-apple-text">
                                <div className="flex justify-between gap-2 border-b border-[#f0f0f0] py-1">
                                    <dt className="text-apple-subtext">Node</dt>
                                    <dd className="font-mono">{s?.nodeVersion ?? '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-2 border-b border-[#f0f0f0] py-1">
                                    <dt className="text-apple-subtext">API uptime</dt>
                                    <dd>{s?.uptimeSeconds != null ? formatUptime(s.uptimeSeconds) : '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-2 py-1">
                                    <dt className="text-apple-subtext">Memory RSS / heap</dt>
                                    <dd className="tabular-nums">
                                        {s?.memoryRssMb ?? '—'} MB / {s?.memoryHeapUsedMb ?? '—'} MB
                                    </dd>
                                </div>
                            </dl>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                            <BoolPill
                                ok={s?.mongoReady}
                                label={s?.mongoReady ? 'MongoDB connected' : 'MongoDB not connected'}
                            />
                            <BoolPill
                                ok={s?.supabasePasswordlessConfigured}
                                label={s?.supabasePasswordlessConfigured ? 'Supabase linking on' : 'Supabase linking off'}
                            />
                        </div>
                    </Panel>

                    <div>
                        <SectionIntro title="Growth">New accounts and total users on this LifeSync database.</SectionIntro>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <MetricCard label="New users (7 days)" value={m?.newUsersLast7Days} hint="createdAt" />
                            <MetricCard label="New users (30 days)" value={m?.newUsersLast30Days} />
                            <MetricCard label="Total users" value={m?.userCount} />
                        </div>
                    </div>

                    <div>
                        <SectionIntro title="Usage & links">
                            Wishlists, password logins, and linked external accounts (counts only).
                        </SectionIntro>
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            <MetricCard label="Wishlist rows" value={m?.wishlistItemCount} />
                            <MetricCard label="Wishlist Steam" value={m?.wishlistSteamCount} />
                            <MetricCard label="Wishlist Xbox" value={m?.wishlistXboxCount} />
                            <MetricCard label="Password logins" value={m?.usersWithLocalPassword} />
                            <MetricCard label="Steam linked" value={m?.usersSteamLinked} />
                            <MetricCard label="MAL linked" value={m?.usersMalLinked} />
                            <MetricCard label="MangaDex linked" value={m?.usersMangadexLinked} />
                            <MetricCard label="Google linked" value={m?.usersGoogleLinked} />
                            <MetricCard label="AnimeSchedule" value={m?.usersAnimeScheduleLinked} />
                            <MetricCard label="Tips opt-in" value={m?.engagementOptInUsers} />
                            <MetricCard label="NSFW pref on" value={m?.usersNsfwEnabled} />
                            <MetricCard label="Users w/ anime rows" value={m?.usersWithAnimeWatchProgress} />
                            <MetricCard label="Users w/ manga rows" value={m?.usersWithMangaReadingProgress} />
                        </div>
                    </div>
                </div>
            )}

            {/* ——— Live & ops ——— */}
            {tab === 'live' && (
                <div className="space-y-8">
                    <Panel>
                        <SectionIntro title="Live process stream (WebSocket)">
                            Frontend live socket updates are disabled. This panel now reflects static values from the
                            latest overview refresh.
                        </SectionIntro>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <BoolPill ok={false} label="Disabled" />
                        </div>
                        <dl className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
                            <div>
                                <dt className="text-apple-subtext">Server time</dt>
                                <dd className="mt-0.5 font-mono text-[11px]">{overview?.serverTime ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">PID</dt>
                                <dd className="mt-0.5 font-mono">{s?.pid ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">Uptime</dt>
                                <dd className="mt-0.5">{s?.uptimeSeconds != null ? formatUptime(s.uptimeSeconds) : '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">Mongo state</dt>
                                <dd className="mt-0.5 font-mono">{health?.mongoReadyState ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">RSS / heap</dt>
                                <dd className="mt-0.5 tabular-nums">
                                    {s?.memoryRssMb ?? '—'} MB / {s?.memoryHeapUsedMb ?? '—'} MB
                                </dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">Admin sockets</dt>
                                <dd className="mt-0.5 tabular-nums">{s?.connectedAdminSockets ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">User broadcast sockets</dt>
                                <dd className="mt-0.5 tabular-nums">{s?.connectedUserBroadcastSockets ?? '—'}</dd>
                            </div>
                        </dl>
                    </Panel>

                    <Panel>
                        <SectionIntro title="Database health">Round-trip ping to MongoDB (admin command).</SectionIntro>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-mono text-[28px] font-bold tabular-nums text-apple-text">
                                    {health?.dbPingMs != null ? `${health.dbPingMs} ms` : '—'}
                                </p>
                                <p className="mt-1 text-[12px] text-apple-subtext">
                                    Ready state <span className="font-mono">{health?.mongoReadyState ?? '—'}</span>
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={healthBusy}
                                onClick={refreshHealth}
                                className="rounded-xl border border-[#e5e5ea] bg-apple-bg px-4 py-2.5 text-[12px] font-semibold text-apple-text disabled:opacity-50"
                            >
                                {healthBusy ? 'Pinging…' : 'Run ping'}
                            </button>
                        </div>
                    </Panel>

                    <Panel>
                        <SectionIntro title="Integration capabilities">
                            Which features are configured on the server (booleans only).
                        </SectionIntro>
                        <div className="flex flex-wrap gap-2">
                            {capabilities?.integrations
                                ? Object.entries(capabilities.integrations).map(([key, ok]) => (
                                      <BoolPill
                                          key={key}
                                          ok={Boolean(ok)}
                                          label={CAPABILITY_LABELS[key] || key}
                                      />
                                  ))
                                : (
                                      <span className="text-[12px] text-apple-subtext">Refresh overview to load.</span>
                                  )}
                        </div>
                    </Panel>

                    <Panel>
                        <SectionIntro title="Broadcast to all users">
                            Sends a dismissible banner to currently connected sessions.
                        </SectionIntro>
                        <textarea
                            value={broadcastText}
                            onChange={(e) => setBroadcastText(e.target.value)}
                            rows={3}
                            maxLength={500}
                            placeholder="e.g. Deploying API v2 at 22:00 UTC — ~2 min downtime."
                            className="mt-2 w-full resize-y rounded-xl border border-[#e5e5ea] bg-apple-bg px-3 py-2 text-[13px] text-apple-text"
                        />
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                disabled={broadcastBusy || !broadcastText.trim()}
                                onClick={sendBroadcast}
                                className="rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-apple-text disabled:opacity-50"
                            >
                                {broadcastBusy ? 'Sending…' : 'Send broadcast'}
                            </button>
                            <span className="text-[11px] text-apple-subtext">{broadcastText.length}/500</span>
                        </div>
                        {broadcastMsg ? <p className="mt-2 text-[12px] text-apple-text">{broadcastMsg}</p> : null}
                        <p className="mt-3 text-[11px] text-apple-subtext">
                            WebSocket broadcast feed is disabled in this client.
                        </p>
                    </Panel>

                    <Panel>
                        <SectionIntro title="API & deployment">Static flags from the last overview request.</SectionIntro>
                        <div className="flex flex-wrap gap-2">
                            <BoolPill ok={s?.mongoReady} label={s?.mongoReady ? 'Mongo ready' : 'Mongo not ready'} />
                            <BoolPill ok={s?.trustProxy} label={s?.trustProxy ? 'Trust proxy' : 'No trust proxy'} />
                        </div>
                        <dl className="mt-5 grid gap-3 text-[13px] sm:grid-cols-2">
                            <div>
                                <dt className="text-apple-subtext">Environment</dt>
                                <dd className="font-medium text-apple-text">{s?.nodeEnv ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">Listen port</dt>
                                <dd className="font-mono font-medium text-apple-text">{s?.apiPort ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">Database name</dt>
                                <dd className="font-mono text-[12px] text-apple-text">{s?.databaseName ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">Admin sockets (overview)</dt>
                                <dd className="font-medium text-apple-text">{s?.connectedAdminSockets ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">User broadcast sockets</dt>
                                <dd className="font-medium text-apple-text">{s?.connectedUserBroadcastSockets ?? '—'}</dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-apple-subtext">Client origin (CORS)</dt>
                                <dd className="break-all font-mono text-[12px] text-apple-text">{s?.clientOrigin ?? '—'}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">Admin allowlist slots</dt>
                                <dd className="font-medium text-apple-text">{s?.adminAllowlistSlots ?? '—'}</dd>
                            </div>
                        </dl>
                    </Panel>
                </div>
            )}

            {/* ——— Activity ——— */}
            {tab === 'activity' && (
                <div className="space-y-8">
                    {activityError ? (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-950">
                            {activityError}
                        </div>
                    ) : null}
                    <Panel>
                        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                            <SectionIntro title="Latest anime watch updates">
                                Per-user streaming progress rows, newest <code className="font-mono text-[11px]">updatedAt</code>{' '}
                                first (MAL id + episode).
                            </SectionIntro>
                            <button
                                type="button"
                                disabled={activityBusy}
                                onClick={loadActivity}
                                className="rounded-xl border border-[#e5e5ea] bg-apple-bg px-3 py-2 text-[11px] font-semibold text-apple-text disabled:opacity-50"
                            >
                                {activityBusy ? 'Loading…' : 'Reload'}
                            </button>
                        </div>
                        <div className="hidden overflow-x-auto rounded-xl border border-[#f0f0f0] md:block">
                            <table className="min-w-full text-left text-[12px]">
                                <thead className="bg-apple-bg text-[10px] font-bold uppercase tracking-wider text-apple-subtext">
                                    <tr>
                                        <th className="px-3 py-2">When</th>
                                        <th className="px-3 py-2">User</th>
                                        <th className="px-3 py-2">MAL</th>
                                        <th className="px-3 py-2">Episode</th>
                                        <th className="px-3 py-2">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#f0f0f0] text-apple-text">
                                    {activityBusy && animeRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-3 py-8 text-center text-apple-subtext">
                                                Loading…
                                            </td>
                                        </tr>
                                    ) : animeRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-3 py-8 text-center text-apple-subtext">
                                                No anime progress rows yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        animeRows.map((row, i) => (
                                            <tr key={`${row.userId}-${row.malId}-${i}`} className="hover:bg-apple-bg/60">
                                                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-apple-subtext">
                                                    {row.updatedAt ? row.updatedAt.slice(0, 16).replace('T', ' ') : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-apple-subtext">{row.emailMasked}</td>
                                                <td className="px-3 py-2 font-mono text-[11px]">{row.malId || '—'}</td>
                                                <td className="px-3 py-2 tabular-nums">{row.lastEpisodeNumber ?? '—'}</td>
                                                <td className="px-2 py-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => copyText(row.userId)}
                                                        className="rounded-lg border border-[#e5e5ea] px-2 py-1 text-[10px] font-semibold text-apple-text hover:bg-apple-bg"
                                                    >
                                                        Copy id
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 space-y-2 md:hidden">
                            {activityBusy && animeRows.length === 0 ? (
                                <div className="rounded-xl border border-[#f0f0f0] bg-apple-bg px-3 py-4 text-center text-[12px] text-apple-subtext">
                                    Loading…
                                </div>
                            ) : animeRows.length === 0 ? (
                                <div className="rounded-xl border border-[#f0f0f0] bg-apple-bg px-3 py-4 text-center text-[12px] text-apple-subtext">
                                    No anime progress rows yet.
                                </div>
                            ) : (
                                animeRows.map((row, i) => (
                                    <article key={`${row.userId}-${row.malId}-${i}`} className="rounded-xl border border-[#f0f0f0] bg-white p-3">
                                        <p className="font-mono text-[11px] text-apple-subtext">
                                            {row.updatedAt ? row.updatedAt.slice(0, 16).replace('T', ' ') : '—'}
                                        </p>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">User</p>
                                                <p className="truncate text-apple-text">{row.emailMasked || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">MAL</p>
                                                <p className="font-mono text-apple-text">{row.malId || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Episode</p>
                                                <p className="tabular-nums text-apple-text">{row.lastEpisodeNumber ?? '—'}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => copyText(row.userId)}
                                            className="mt-3 w-full rounded-lg border border-[#e5e5ea] px-2 py-2 text-[11px] font-semibold text-apple-text hover:bg-apple-bg"
                                        >
                                            Copy user id
                                        </button>
                                    </article>
                                ))
                            )}
                        </div>
                    </Panel>

                    <Panel>
                        <SectionIntro title="Latest manga reading updates">
                            Per-user shelf progress (source + title), newest first.
                        </SectionIntro>
                        <div className="hidden overflow-x-auto rounded-xl border border-[#f0f0f0] md:block">
                            <table className="min-w-full text-left text-[12px]">
                                <thead className="bg-apple-bg text-[10px] font-bold uppercase tracking-wider text-apple-subtext">
                                    <tr>
                                        <th className="px-3 py-2">When</th>
                                        <th className="px-3 py-2">User</th>
                                        <th className="px-3 py-2">Source</th>
                                        <th className="px-3 py-2">Title</th>
                                        <th className="px-3 py-2">Chapter</th>
                                        <th className="px-3 py-2">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#f0f0f0] text-apple-text">
                                    {activityBusy && mangaRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-8 text-center text-apple-subtext">
                                                Loading…
                                            </td>
                                        </tr>
                                    ) : mangaRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-8 text-center text-apple-subtext">
                                                No manga progress rows yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        mangaRows.map((row, i) => (
                                            <tr key={`${row.userId}-${row.mangaId}-${i}`} className="hover:bg-apple-bg/60">
                                                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-apple-subtext">
                                                    {row.updatedAt ? row.updatedAt.slice(0, 16).replace('T', ' ') : '—'}
                                                </td>
                                                <td className="max-w-30 truncate px-3 py-2 text-apple-subtext">
                                                    {row.emailMasked}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">
                                                    {row.source || '—'}
                                                </td>
                                                <td className="max-w-50 truncate px-3 py-2" title={row.title}>
                                                    {row.title || row.mangaId || '—'}
                                                </td>
                                                <td className="max-w-25 truncate px-3 py-2 text-apple-subtext">
                                                    {row.lastChapterLabel || '—'}
                                                </td>
                                                <td className="px-2 py-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => copyText(row.userId)}
                                                        className="rounded-lg border border-[#e5e5ea] px-2 py-1 text-[10px] font-semibold text-apple-text hover:bg-apple-bg"
                                                    >
                                                        Copy id
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 space-y-2 md:hidden">
                            {activityBusy && mangaRows.length === 0 ? (
                                <div className="rounded-xl border border-[#f0f0f0] bg-apple-bg px-3 py-4 text-center text-[12px] text-apple-subtext">
                                    Loading…
                                </div>
                            ) : mangaRows.length === 0 ? (
                                <div className="rounded-xl border border-[#f0f0f0] bg-apple-bg px-3 py-4 text-center text-[12px] text-apple-subtext">
                                    No manga progress rows yet.
                                </div>
                            ) : (
                                mangaRows.map((row, i) => (
                                    <article key={`${row.userId}-${row.mangaId}-${i}`} className="rounded-xl border border-[#f0f0f0] bg-white p-3">
                                        <p className="font-mono text-[11px] text-apple-subtext">
                                            {row.updatedAt ? row.updatedAt.slice(0, 16).replace('T', ' ') : '—'}
                                        </p>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">User</p>
                                                <p className="truncate text-apple-text">{row.emailMasked || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Source</p>
                                                <p className="font-mono text-apple-text">{row.source || '—'}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Title</p>
                                                <p className="text-apple-text">{row.title || row.mangaId || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Chapter</p>
                                                <p className="text-apple-text">{row.lastChapterLabel || '—'}</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => copyText(row.userId)}
                                            className="mt-3 w-full rounded-lg border border-[#e5e5ea] px-2 py-2 text-[11px] font-semibold text-apple-text hover:bg-apple-bg"
                                        >
                                            Copy user id
                                        </button>
                                    </article>
                                ))
                            )}
                        </div>
                    </Panel>
                </div>
            )}

            {/* ——— Users ——— */}
            {tab === 'users' && (
                <div className="space-y-8">
                    <Panel>
                        <SectionIntro title="Look up a user">
                            Support tools: find by verified email or by Mongo user id (from tables or logs).
                        </SectionIntro>
                        <div className="grid gap-6 lg:grid-cols-2">
                            <div>
                                <p className="text-[12px] font-semibold text-apple-text">By email</p>
                                <p className="mt-1 text-[11px] text-apple-subtext">Exact match, normalized.</p>
                                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                    <input
                                        type="email"
                                        autoComplete="off"
                                        placeholder="user@example.com"
                                        value={lookupEmail}
                                        onChange={(e) => setLookupEmail(e.target.value)}
                                        className="min-w-0 flex-1 rounded-xl border border-[#e5e5ea] bg-apple-bg px-3 py-2 text-[13px] text-apple-text"
                                    />
                                    <button
                                        type="button"
                                        disabled={lookupBusy}
                                        onClick={runLookup}
                                        className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-apple-text disabled:opacity-50 sm:w-auto"
                                    >
                                        {lookupBusy ? '…' : 'Search'}
                                    </button>
                                </div>
                                {lookupResult?.error ? (
                                    <p className="mt-2 text-[12px] text-amber-800">{lookupResult.error}</p>
                                ) : null}
                                {lookupResult && !lookupResult.error && lookupResult.found === false ? (
                                    <p className="mt-2 text-[12px] text-apple-subtext">{lookupResult.message}</p>
                                ) : null}
                                {lookupResult?.found && lookupResult.user ? (
                                    <UserSummaryCard user={lookupResult.user} />
                                ) : null}
                            </div>
                            <div>
                                <p className="text-[12px] font-semibold text-apple-text">By user id</p>
                                <p className="mt-1 text-[11px] text-apple-subtext">24-character hex ObjectId.</p>
                                <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                    <input
                                        autoComplete="off"
                                        placeholder="674a1b2c3d4e5f6789012345"
                                        value={lookupUserId}
                                        onChange={(e) => setLookupUserId(e.target.value.trim())}
                                        className="min-w-0 flex-1 rounded-xl border border-[#e5e5ea] bg-apple-bg px-3 py-2 font-mono text-[12px] text-apple-text"
                                    />
                                    <button
                                        type="button"
                                        disabled={lookupIdBusy}
                                        onClick={runLookupById}
                                        className="w-full rounded-xl border border-[#e5e5ea] bg-white px-4 py-2.5 text-[13px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50 sm:w-auto"
                                    >
                                        {lookupIdBusy ? '…' : 'Search'}
                                    </button>
                                </div>
                                {lookupIdResult?.error ? (
                                    <p className="mt-2 text-[12px] text-amber-800">{lookupIdResult.error}</p>
                                ) : null}
                                {lookupIdResult && !lookupIdResult.error && lookupIdResult.found === false ? (
                                    <p className="mt-2 text-[12px] text-apple-subtext">{lookupIdResult.message}</p>
                                ) : null}
                                {lookupIdResult?.found && lookupIdResult.user ? (
                                    <UserSummaryCard user={lookupIdResult.user} />
                                ) : null}
                            </div>
                        </div>
                    </Panel>

                    <Panel>
                        <SectionIntro title="Recent signups">Newest LifeSync accounts (masked email).</SectionIntro>
                        <div className="hidden overflow-x-auto rounded-xl border border-[#f0f0f0] md:block">
                            <table className="min-w-full text-left text-[12px]">
                                <thead className="bg-apple-bg text-[10px] font-bold uppercase tracking-wider text-apple-subtext">
                                    <tr>
                                        <th className="px-3 py-2">User id</th>
                                        <th className="px-3 py-2">Email</th>
                                        <th className="px-3 py-2">Name</th>
                                        <th className="px-3 py-2">Joined</th>
                                        <th className="px-3 py-2">Links</th>
                                        <th className="px-2 py-2" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#f0f0f0] text-apple-text">
                                    {recent.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-3 py-8 text-center text-apple-subtext">
                                                {loadBusy ? 'Loading…' : 'No users yet.'}
                                            </td>
                                        </tr>
                                    ) : (
                                        recent.map((row) => (
                                            <tr key={row.id} className="hover:bg-apple-bg/60">
                                                <td className="max-w-35 truncate px-3 py-2 font-mono text-[11px]">{row.id}</td>
                                                <td className="px-3 py-2">{row.emailMasked}</td>
                                                <td className="max-w-30 truncate px-3 py-2">{row.name || '—'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-apple-subtext">
                                                    {row.createdAt ? row.createdAt.slice(0, 10) : '—'}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        <LinkPill label="St" active={row.links?.steam} />
                                                        <LinkPill label="MAL" active={row.links?.mal} />
                                                        <LinkPill label="MD" active={row.links?.mangadex} />
                                                        <LinkPill label="G" active={row.links?.google} />
                                                        <LinkPill label="AS" active={row.links?.animeSchedule} />
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => copyText(row.id)}
                                                        className="rounded-lg border border-[#e5e5ea] px-2 py-1 text-[10px] font-semibold text-apple-text hover:bg-apple-bg"
                                                    >
                                                        Copy
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="mt-3 space-y-2 md:hidden">
                            {recent.length === 0 ? (
                                <div className="rounded-xl border border-[#f0f0f0] bg-apple-bg px-3 py-4 text-center text-[12px] text-apple-subtext">
                                    {loadBusy ? 'Loading…' : 'No users yet.'}
                                </div>
                            ) : (
                                recent.map((row) => (
                                    <article key={row.id} className="rounded-xl border border-[#f0f0f0] bg-white p-3">
                                        <p className="truncate font-mono text-[11px] text-apple-subtext">{row.id}</p>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                                            <div className="col-span-2">
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Email</p>
                                                <p className="text-apple-text">{row.emailMasked || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Name</p>
                                                <p className="truncate text-apple-text">{row.name || '—'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Joined</p>
                                                <p className="font-mono text-apple-text">{row.createdAt ? row.createdAt.slice(0, 10) : '—'}</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            <LinkPill label="St" active={row.links?.steam} />
                                            <LinkPill label="MAL" active={row.links?.mal} />
                                            <LinkPill label="MD" active={row.links?.mangadex} />
                                            <LinkPill label="G" active={row.links?.google} />
                                            <LinkPill label="AS" active={row.links?.animeSchedule} />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => copyText(row.id)}
                                            className="mt-3 w-full rounded-lg border border-[#e5e5ea] px-2 py-2 text-[11px] font-semibold text-apple-text hover:bg-apple-bg"
                                        >
                                            Copy user id
                                        </button>
                                    </article>
                                ))
                            )}
                        </div>
                    </Panel>
                </div>
            )}
        </div>
    )
}

function UserSummaryCard({ user }) {
    if (!user) return null
    return (
        <dl className="mt-4 grid gap-2 rounded-xl border border-[#e5e5ea] bg-apple-bg p-4 text-[12px] sm:grid-cols-2">
            <div>
                <dt className="text-apple-subtext">User id</dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px]">{user.id}</span>
                    <button
                        type="button"
                        onClick={() => copyText(user.id)}
                        className="text-[10px] font-semibold text-primary hover:underline"
                    >
                        Copy
                    </button>
                </dd>
            </div>
            <div>
                <dt className="text-apple-subtext">Email (masked)</dt>
                <dd className="mt-0.5">{user.emailMasked}</dd>
            </div>
            <div>
                <dt className="text-apple-subtext">Name</dt>
                <dd className="mt-0.5">{user.name || '—'}</dd>
            </div>
            <div>
                <dt className="text-apple-subtext">Created</dt>
                <dd className="mt-0.5 font-mono text-[11px]">{user.createdAt || '—'}</dd>
            </div>
            <div className="sm:col-span-2">
                <dt className="text-apple-subtext">Integrations</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                    <LinkPill label="Steam" active={user.links?.steam} />
                    <LinkPill label="MAL" active={user.links?.mal} />
                    <LinkPill label="MangaDex" active={user.links?.mangadex} />
                    <LinkPill label="Google" active={user.links?.google} />
                    <LinkPill label="AnimeSchedule" active={user.links?.animeSchedule} />
                </dd>
            </div>
        </dl>
    )
}
