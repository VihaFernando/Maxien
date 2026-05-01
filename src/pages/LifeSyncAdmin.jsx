import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLifeSync } from '../context/LifeSyncContext'
import { getLifesyncToken, lifesyncFetch } from '../lib/lifesyncApi'
import { isLifeSyncAdmin } from '../lib/lifeSyncRoles'
import { LifeSyncSectionNav } from '../components/lifesync/LifeSyncSectionNav'

const ADMIN_TABS = [
    { id: 'overview', label: 'Overview', title: 'Growth, usage, and quick snapshot' },
    { id: 'health', label: 'Health & ops', title: 'Database, integrations, and system status' },
    { id: 'activity', label: 'Activity', title: 'Latest anime & manga progress across users' },
    { id: 'users', label: 'Users', title: 'Signups, lookup, and support tools' },
]

const VALID_TAB_IDS = new Set(ADMIN_TABS.map((t) => t.id))

const CAPABILITY_LABELS = {
    steamWebApi: 'Steam Web API',
    malOAuth: 'MAL OAuth',
    googleOAuth: 'Google OAuth',
    animeScheduleAppToken: 'AnimeSchedule app token',
    animeScheduleOAuth: 'AnimeSchedule OAuth',
    supabasePasswordless: 'Supabase passwordless',
    openXbl: 'OpenXBL',
    gameSearch: 'GameSearch',
    gameRantNews: 'GameRant news',
    cheapShark: 'CheapShark',
    watchHentai: 'WatchHentai',
    anitakuFallback: 'Anitaku fallback',
    mangaDistrict: 'Manga District',
    hentaiFox: 'HentaiFox NSFW',
}

const HEALTH_CHECK_LABELS = {
    mongoConnected: 'Mongo connected',
    mongoPingOk: 'Mongo ping ok',
    adminAllowlistConfigured: 'Admin allowlist configured',
    supabasePasswordlessConfigured: 'Supabase passwordless configured',
    steamWebApiConfigured: 'Steam Web API configured',
    openXblConfigured: 'OpenXBL configured',
    gameSearchEnabled: 'GameSearch enabled',
    mangaDistrictEnabled: 'Manga District enabled',
    hentaiFoxEnabled: 'HentaiFox enabled',
    anitakuFallbackEnabled: 'Anitaku fallback enabled',
}

const V1_ADMIN_MODE = false

function MetricCard({ label, value, hint }) {
    return (
        <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4 shadow-sm">
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

function formatBoolean(value) {
    if (typeof value !== 'boolean') return '—'
    return value ? 'true' : 'false'
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
        <div className={`rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6 ${className}`}>{children}</div>
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
    const [animeDb, setAnimeDb] = useState(null)
    const [animeDbBusy, setAnimeDbBusy] = useState(false)
    const [animeDbError, setAnimeDbError] = useState('')
    const [auditSummary, setAuditSummary] = useState(null)
    const [auditBusy, setAuditBusy] = useState(false)
    const [auditError, setAuditError] = useState('')
    const [cacheFlushBusy, setCacheFlushBusy] = useState(false)
    const [animeCleanupBusy, setAnimeCleanupBusy] = useState(false)
    const [opsMessage, setOpsMessage] = useState('')
    const [opsError, setOpsError] = useState('')

    const [maintenanceUserId, setMaintenanceUserId] = useState('')
    const [maintenanceBusy, setMaintenanceBusy] = useState(false)
    const [maintenanceError, setMaintenanceError] = useState('')
    const [maintenanceResult, setMaintenanceResult] = useState(null)
    const [unlinkIntegration, setUnlinkIntegration] = useState('mal')

    const [activityAnime, setActivityAnime] = useState(null)
    const [activityManga, setActivityManga] = useState(null)
    const [activityBusy, setActivityBusy] = useState(false)
    const [activityError, setActivityError] = useState('')
    const [v1Health, setV1Health] = useState(null)
    const [v1HealthError, setV1HealthError] = useState('')

    const [malCheckId, setMalCheckId] = useState('')
    const [malCheckBusy, setMalCheckBusy] = useState(false)
    const [malCheckResult, setMalCheckResult] = useState(null)
    const [malMapId, setMalMapId] = useState('')
    const [malMapSlug, setMalMapSlug] = useState('')
    const [malMapSearchTitle, setMalMapSearchTitle] = useState('')
    const [malMapBusy, setMalMapBusy] = useState(false)
    const [malMapResult, setMalMapResult] = useState(null)


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
            try {
                setAnimeDb(await lifesyncFetch('/api/v1/admin/anime-db/summary', { method: 'GET' }))
                setAnimeDbError('')
            } catch (e) {
                setAnimeDb(null)
                setAnimeDbError(e?.message || 'Could not load anime DB summary.')
            }
            try {
                setAuditSummary(await lifesyncFetch('/api/v1/admin/audit/summary', { method: 'GET' }))
                setAuditError('')
            } catch (e) {
                setAuditSummary(null)
                setAuditError(e?.message || 'Could not load audit summary.')
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

    const refreshAnimeDb = async () => {
        setAnimeDbBusy(true)
        setAnimeDbError('')
        try {
            setAnimeDb(await lifesyncFetch('/api/v1/admin/anime-db/summary', { method: 'GET' }))
        } catch (e) {
            setAnimeDb(null)
            setAnimeDbError(e?.message || 'Could not load anime DB summary.')
        } finally {
            setAnimeDbBusy(false)
        }
    }

    const refreshAudit = async () => {
        setAuditBusy(true)
        setAuditError('')
        try {
            setAuditSummary(await lifesyncFetch('/api/v1/admin/audit/summary', { method: 'GET' }))
        } catch (e) {
            setAuditSummary(null)
            setAuditError(e?.message || 'Could not load audit summary.')
        } finally {
            setAuditBusy(false)
        }
    }

    const runCacheFlush = async () => {
        setOpsMessage('')
        setOpsError('')
        setCacheFlushBusy(true)
        try {
            const data = await lifesyncFetch('/api/v1/admin/cache/flush', { method: 'POST' })
            const flushed = Array.isArray(data?.flushed) ? data.flushed.join(', ') : 'cache flush complete'
            setOpsMessage(`Flushed: ${flushed}`)
        } catch (e) {
            setOpsError(e?.message || 'Cache flush failed.')
        } finally {
            setCacheFlushBusy(false)
        }
    }

    const runAnimeCleanup = async () => {
        setOpsMessage('')
        setOpsError('')
        setAnimeCleanupBusy(true)
        try {
            const data = await lifesyncFetch('/api/v1/admin/anime-db/cleanup', { method: 'POST' })
            const modified = data?.modified ?? 0
            setOpsMessage(`Anime cache cleanup updated ${modified} rows.`)
        } catch (e) {
            setOpsError(e?.message || 'Anime cache cleanup failed.')
        } finally {
            setAnimeCleanupBusy(false)
        }
    }

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

    const runUserMaintenance = async (path, options = {}) => {
        const id = maintenanceUserId.trim()
        if (!id) {
            setMaintenanceError('Enter a user id to run maintenance actions.')
            return
        }
        if (!/^[a-fA-F0-9]{24}$/.test(id)) {
            setMaintenanceError('User id must be 24 hex characters (Mongo ObjectId).')
            return
        }
        setMaintenanceBusy(true)
        setMaintenanceError('')
        setMaintenanceResult(null)
        try {
            const data = await lifesyncFetch(`/api/v1/admin/users/${encodeURIComponent(id)}/${path}`, {
                method: 'POST',
                ...options,
            })
            setMaintenanceResult(data)
        } catch (e) {
            setMaintenanceError(e?.message || 'Maintenance action failed.')
        } finally {
            setMaintenanceBusy(false)
        }
    }

    const runUnlinkIntegration = async () => {
        await runUserMaintenance('unlink', { json: { integration: unlinkIntegration } })
    }


    const runMalCheck = async () => {
        const id = malCheckId.trim()
        if (!id) {
            setMalCheckResult({ error: 'Enter a MAL anime id.' })
            return
        }
        if (!/^\d+$/.test(id)) {
            setMalCheckResult({ error: 'MAL id must be numeric.' })
            return
        }
        setMalCheckBusy(true)
        setMalCheckResult(null)
        try {
            const data = await lifesyncFetch(`/api/v1/admin/mal/check?malId=${encodeURIComponent(id)}`, {
                method: 'GET',
            })
            setMalCheckResult(data)
        } catch (e) {
            setMalCheckResult({ error: e?.message || 'MAL check failed.' })
        } finally {
            setMalCheckBusy(false)
        }
    }

    const runMalMap = async () => {
        const id = malMapId.trim()
        if (!id) {
            setMalMapResult({ error: 'Enter a MAL anime id.' })
            return
        }
        if (!/^\d+$/.test(id)) {
            setMalMapResult({ error: 'MAL id must be numeric.' })
            return
        }
        const title = malMapSearchTitle.trim()
        const slug = malMapSlug.trim().replace(/^\/+|\/+$/g, '')
        setMalMapBusy(true)
        setMalMapResult(null)
        try {
            const data = await lifesyncFetch('/api/v1/admin/anime-db/map-mal-to-anitaku', {
                method: 'POST',
                json: {
                    malId: id,
                    ...(title ? { searchTitle: title } : {}),
                    ...(!title && slug ? { anitakuSlug: slug } : {}),
                },
            })
            setMalMapResult(data)
            setMalCheckId(id)
            setMalCheckResult(null)
            refreshAnimeDb().catch(() => {})
        } catch (e) {
            setMalMapResult({ error: e?.message || 'MAL to Anitaku mapping failed.' })
        } finally {
            setMalMapBusy(false)
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
            <div className="mx-auto max-w-lg rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-8 shadow-sm">
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
                    className="mt-6 inline-block rounded-xl border border-red-200 bg-[var(--color-surface)] px-4 py-2.5 text-[13px] font-semibold text-red-950 hover:bg-red-50"
                >
                    Back to overview
                </Link>
            </div>
        )
    }

    if (V1_ADMIN_MODE) {
        return (
            <div className="mx-auto max-w-3xl space-y-4">
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-6 shadow-sm">
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
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5 shadow-sm">
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
    const auditAnimeSample = Array.isArray(auditSummary?.progressOrphans?.anime?.sample)
        ? auditSummary.progressOrphans.anime.sample
        : []
    const auditMangaSample = Array.isArray(auditSummary?.progressOrphans?.manga?.sample)
        ? auditSummary.progressOrphans.manga.sample
        : []
    const maintenanceSummary = (() => {
        if (!maintenanceResult) return ''
        if (maintenanceResult.ok) {
            if (typeof maintenanceResult.cleared === 'number') {
                return `Cleared ${maintenanceResult.cleared} entries.`
            }
            if (typeof maintenanceResult.deleted === 'number') {
                return `Deleted ${maintenanceResult.deleted} wishlist items.`
            }
            if (maintenanceResult.integration) {
                return `Unlinked ${maintenanceResult.integration}.`
            }
            return 'Action completed.'
        }
        if (maintenanceResult.found === false && maintenanceResult.message) return maintenanceResult.message
        return ''
    })()

    return (
        <div className="mx-auto max-w-6xl px-2 pb-12 sm:px-0">
            <div className="mb-6 rounded-2xl border border-[var(--mx-color-e5e5ea)] p-6 shadow-sm sm:p-8">
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
                            className="w-full rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-4 py-2.5 text-[12px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50 sm:w-auto"
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
                                <div className="flex justify-between gap-2 border-b border-[var(--mx-color-f0f0f0)] py-1">
                                    <dt className="text-apple-subtext">Node</dt>
                                    <dd className="font-mono">{s?.nodeVersion ?? '—'}</dd>
                                </div>
                                <div className="flex justify-between gap-2 border-b border-[var(--mx-color-f0f0f0)] py-1">
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
                            <MetricCard label="Google linked" value={m?.usersGoogleLinked} />
                            <MetricCard label="AnimeSchedule" value={m?.usersAnimeScheduleLinked} />
                            <MetricCard label="Tips opt-in" value={m?.engagementOptInUsers} />
                            <MetricCard label="NSFW pref on" value={m?.usersNsfwEnabled} />
                            <MetricCard label="H manhwa plugin" value={m?.usersHManhwaPluginEnabled} />
                            <MetricCard label="Crack plugin" value={m?.usersCrackGamesPluginEnabled} />
                            <MetricCard label="Users w/ anime rows" value={m?.usersWithAnimeWatchProgress} />
                            <MetricCard label="Users w/ manga rows" value={m?.usersWithMangaReadingProgress} />
                        </div>
                    </div>
                </div>
            )}

            {/* ——— Health & ops ——— */}
            {tab === 'health' && (
                <div className="space-y-8">
                    <Panel>
                        <SectionIntro title="Process status">
                            Server snapshot from the last refresh, including uptime and resource usage.
                        </SectionIntro>
                        <dl className="grid gap-3 text-[12px] sm:grid-cols-2">
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
                                <dt className="text-apple-subtext">Mongo connected</dt>
                                <dd className="mt-0.5 font-mono">{formatBoolean(health?.mongoConnected)}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">RSS / heap</dt>
                                <dd className="mt-0.5 tabular-nums">
                                    {s?.memoryRssMb ?? '—'} MB / {s?.memoryHeapUsedMb ?? '—'} MB
                                </dd>
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
                                    Mongo connected <span className="font-mono">{formatBoolean(health?.mongoConnected)}</span>
                                    {' · '}
                                    Ping ok <span className="font-mono">{formatBoolean(health?.mongoPingOk)}</span>
                                </p>
                            </div>
                            <button
                                type="button"
                                disabled={healthBusy}
                                onClick={refreshHealth}
                                className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-4 py-2.5 text-[12px] font-semibold text-apple-text disabled:opacity-50"
                            >
                                {healthBusy ? 'Pinging…' : 'Run ping'}
                            </button>
                        </div>
                    </Panel>

                    <Panel>
                        <SectionIntro title="Health checks">
                            Boolean status checks from the health endpoint. Values are explicit true/false.
                        </SectionIntro>
                        {health?.checks && typeof health.checks === 'object' ? (
                            <dl className="grid gap-3 text-[12px] sm:grid-cols-2">
                                {Object.entries(health.checks).map(([key, value]) => (
                                    <div key={key}>
                                        <dt className="text-apple-subtext">{HEALTH_CHECK_LABELS[key] || key}</dt>
                                        <dd className="mt-0.5 font-mono">{formatBoolean(value)}</dd>
                                    </div>
                                ))}
                            </dl>
                        ) : (
                            <p className="text-[12px] text-apple-subtext">Refresh health to load checks.</p>
                        )}
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
                        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                            <SectionIntro title="Anime DB snapshot">
                                Cache coverage for AnimeData (stream pointers + MAL detail).
                            </SectionIntro>
                            <button
                                type="button"
                                disabled={animeDbBusy}
                                onClick={refreshAnimeDb}
                                className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 text-[11px] font-semibold text-apple-text disabled:opacity-50"
                            >
                                {animeDbBusy ? 'Refreshing…' : 'Refresh'}
                            </button>
                        </div>
                        {animeDbError ? (
                            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                                {animeDbError}
                            </p>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <MetricCard label="AnimeData rows" value={animeDb?.totals?.totalRows} />
                            <MetricCard
                                label="Stale rows"
                                value={animeDb?.totals?.staleRows}
                                hint={
                                    animeDb?.window?.staleAfterDays
                                        ? `>${animeDb.window.staleAfterDays} days`
                                        : undefined
                                }
                            />
                            <MetricCard label="With streams" value={animeDb?.totals?.withStreams} />
                            <MetricCard label="With MAL detail" value={animeDb?.totals?.withMalDetail} />
                        </div>
                        <div className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
                            <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-apple-subtext">Newest</p>
                                <p className="mt-1 font-mono text-apple-text">
                                    {animeDb?.newest?.malId ? `MAL ${animeDb.newest.malId}` : '—'}
                                </p>
                                <p className="mt-1 text-apple-subtext">{animeDb?.newest?.title || '—'}</p>
                                <p className="mt-1 font-mono text-[11px] text-apple-subtext">
                                    {animeDb?.newest?.fetchedAt || '—'}
                                </p>
                            </div>
                            <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-apple-subtext">Oldest</p>
                                <p className="mt-1 font-mono text-apple-text">
                                    {animeDb?.oldest?.malId ? `MAL ${animeDb.oldest.malId}` : '—'}
                                </p>
                                <p className="mt-1 text-apple-subtext">{animeDb?.oldest?.title || '—'}</p>
                                <p className="mt-1 font-mono text-[11px] text-apple-subtext">
                                    {animeDb?.oldest?.fetchedAt || '—'}
                                </p>
                            </div>
                        </div>
                    </Panel>

                    <Panel>
                        <SectionIntro title="MAL id check">
                            Validate a MAL anime id against the cache and the MAL API.
                        </SectionIntro>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                                autoComplete="off"
                                placeholder="MAL anime id"
                                value={malCheckId}
                                onChange={(e) => setMalCheckId(e.target.value.trim())}
                                className="min-w-0 flex-1 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 font-mono text-[12px] text-apple-text"
                            />
                            <button
                                type="button"
                                disabled={malCheckBusy}
                                onClick={runMalCheck}
                                className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-4 py-2.5 text-[12px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50"
                            >
                                {malCheckBusy ? 'Checking…' : 'Check'}
                            </button>
                        </div>
                        {malCheckResult?.error ? (
                            <p className="mt-2 text-[12px] text-amber-800">{malCheckResult.error}</p>
                        ) : null}
                        {malCheckResult && !malCheckResult.error ? (
                            <div className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
                                <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-apple-subtext">Cache</p>
                                    <p className="mt-1 text-apple-text">
                                        {malCheckResult.db?.found ? 'Found' : 'Not found'}
                                    </p>
                                    <p className="mt-1 font-mono text-[11px] text-apple-subtext">
                                        {malCheckResult.db?.malId ? `MAL ${malCheckResult.db.malId}` : '—'}
                                    </p>
                                    <p className="mt-1 text-apple-subtext">{malCheckResult.db?.title || '—'}</p>
                                    <p className="mt-1 text-apple-subtext">
                                        Streams: {malCheckResult.db?.hasStreams ? 'yes' : 'no'}
                                    </p>
                                    <p className="mt-1 text-apple-subtext">
                                        MAL detail: {malCheckResult.db?.malDetailCached ? 'yes' : 'no'}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-apple-subtext">MAL</p>
                                    {malCheckResult.mal?.ok ? (
                                        <>
                                            <p className="mt-1 text-apple-text">OK</p>
                                            <p className="mt-1 font-mono text-[11px] text-apple-subtext">
                                                {malCheckResult.mal?.id ? `MAL ${malCheckResult.mal.id}` : '—'}
                                            </p>
                                            <p className="mt-1 text-apple-subtext">{malCheckResult.mal?.title || '—'}</p>
                                            <p className="mt-1 text-apple-subtext">
                                                Status: {malCheckResult.mal?.status || '—'}
                                            </p>
                                            <p className="mt-1 text-apple-subtext">
                                                Episodes: {malCheckResult.mal?.numEpisodes ?? '—'}
                                            </p>
                                        </>
                                    ) : (
                                        <p className="mt-1 text-amber-800">
                                            {malCheckResult.mal?.error || 'MAL lookup failed.'}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : null}
                    </Panel>

                    <Panel>
                        <SectionIntro title="MAL → Anitaku map">
                            Map by MAL id using either an Anitaku slug or search text, then persist the mapping.
                        </SectionIntro>
                        <div className="grid gap-2 sm:grid-cols-[minmax(120px,180px)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                            <input
                                autoComplete="off"
                                placeholder="MAL anime id"
                                value={malMapId}
                                onChange={(e) => setMalMapId(e.target.value.trim())}
                                className="min-w-0 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 font-mono text-[12px] text-apple-text"
                            />
                            <input
                                autoComplete="off"
                                placeholder="Optional Anitaku slug (category slug)"
                                value={malMapSlug}
                                onChange={(e) => setMalMapSlug(e.target.value.trim())}
                                className="min-w-0 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 font-mono text-[12px] text-apple-text"
                            />
                            <input
                                autoComplete="off"
                                placeholder="Optional search title override"
                                value={malMapSearchTitle}
                                onChange={(e) => {
                                    const next = e.target.value
                                    setMalMapSearchTitle(next)
                                    if (next.trim()) setMalMapSlug('')
                                }}
                                className="min-w-0 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 text-[12px] text-apple-text"
                            />
                            <button
                                type="button"
                                disabled={malMapBusy}
                                onClick={runMalMap}
                                className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-4 py-2.5 text-[12px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50"
                            >
                                {malMapBusy ? 'Mapping…' : 'Map & save'}
                            </button>
                        </div>
                        <p className="mt-2 text-[11px] text-apple-subtext">
                            Enter slug or search text. If you type search text, slug is reset automatically.
                        </p>
                        {malMapResult?.error ? (
                            <p className="mt-2 text-[12px] text-amber-800">{malMapResult.error}</p>
                        ) : null}
                        {malMapResult && !malMapResult.error ? (
                            <div className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
                                <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-apple-subtext">Mapped</p>
                                    <p className="mt-1 text-apple-text">{malMapResult.mapped?.title || '—'}</p>
                                    <p className="mt-1 font-mono text-[11px] text-apple-subtext">
                                        {malMapResult.mapped?.anitakuSlug
                                            ? `anitaku:${malMapResult.mapped.anitakuSlug}`
                                            : '—'}
                                    </p>
                                    <p className="mt-1 text-apple-subtext">
                                        Episodes: {malMapResult.mapped?.episodeCount ?? '—'}
                                    </p>
                                    <p className="mt-1 text-apple-subtext">
                                        Search match: {malMapResult.mapped?.matchedStreamTitle || '—'}
                                    </p>
                                    <p className="mt-1 text-apple-subtext">
                                        Mode: {malMapResult.mappingMode || 'search'}
                                    </p>
                                    <p className="mt-1 text-apple-subtext">
                                        MAL lookup: {malMapResult.mal?.ok ? 'ok' : (malMapResult.mal?.error || 'failed')}
                                    </p>
                                </div>
                                <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wide text-apple-subtext">Saved row</p>
                                    <p className="mt-1 text-apple-text">
                                        {malMapResult.db?.found ? 'Found' : 'Not found'}
                                    </p>
                                    <p className="mt-1 font-mono text-[11px] text-apple-subtext">
                                        {malMapResult.db?.malId ? `MAL ${malMapResult.db.malId}` : '—'}
                                    </p>
                                    <p className="mt-1 text-apple-subtext">{malMapResult.db?.title || '—'}</p>
                                    <p className="mt-1 text-apple-subtext">
                                        Slug: {malMapResult.db?.anitakuSlug || '—'}
                                    </p>
                                    <p className="mt-1 text-apple-subtext">
                                        DB episodes: {malMapResult.db?.epCount ?? '—'}
                                    </p>
                                    {malMapResult.db?.mirrorEpisodeCount != null ? (
                                        <p className="mt-1 text-apple-subtext">
                                            Mirror episodes: {malMapResult.db.mirrorEpisodeCount}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                        ) : null}
                        {Array.isArray(malMapResult?.titlesTried) && malMapResult.titlesTried.length ? (
                            <p className="mt-2 text-[11px] text-apple-subtext">
                                Titles used: {malMapResult.titlesTried.slice(0, 5).join(' · ')}
                            </p>
                        ) : null}
                    </Panel>

                    <Panel>
                        <SectionIntro title="Maintenance actions">
                            Run cache and system maintenance tasks.
                        </SectionIntro>
                        {opsError ? (
                            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                                {opsError}
                            </p>
                        ) : null}
                        {opsMessage ? (
                            <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-900">
                                {opsMessage}
                            </p>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                disabled={cacheFlushBusy}
                                onClick={runCacheFlush}
                                className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50"
                            >
                                {cacheFlushBusy ? 'Flushing…' : 'Flush caches'}
                            </button>
                            <button
                                type="button"
                                disabled={animeCleanupBusy}
                                onClick={runAnimeCleanup}
                                className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50"
                            >
                                {animeCleanupBusy ? 'Cleaning…' : 'Anime cache cleanup'}
                            </button>
                        </div>
                    </Panel>

                    <Panel>
                        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                            <SectionIntro title="Data audits">
                                Cache coverage and orphan checks (sampled when large).
                            </SectionIntro>
                            <button
                                type="button"
                                disabled={auditBusy}
                                onClick={refreshAudit}
                                className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 text-[11px] font-semibold text-apple-text disabled:opacity-50"
                            >
                                {auditBusy ? 'Refreshing…' : 'Refresh'}
                            </button>
                        </div>
                        {auditError ? (
                            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                                {auditError}
                            </p>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <MetricCard label="Anime cache total" value={auditSummary?.animeCache?.total} />
                            <MetricCard label="Anime missing streams" value={auditSummary?.animeCache?.missingStreams} />
                            <MetricCard label="Anime missing MAL" value={auditSummary?.animeCache?.missingMalDetail} />
                            <MetricCard label="Anime stale" value={auditSummary?.animeCache?.stale} />
                            <MetricCard label="Manga cache total" value={auditSummary?.mangaCache?.total} />
                            <MetricCard label="Manga missing details" value={auditSummary?.mangaCache?.missingDetails} />
                            <MetricCard label="Manga details stale" value={auditSummary?.mangaCache?.staleDetails} />
                        </div>
                        <div className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
                            <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-apple-subtext">Anime progress orphans</p>
                                <p className="mt-1 text-apple-text">
                                    Missing: {auditSummary?.progressOrphans?.anime?.missingCount ?? '—'}
                                </p>
                                <p className="mt-1 text-[11px] text-apple-subtext">
                                    Sampled: {auditSummary?.progressOrphans?.anime?.sampled ? 'yes' : 'no'}
                                </p>
                                {auditAnimeSample.length ? (
                                    <p className="mt-2 font-mono text-[11px] text-apple-subtext">
                                        {auditAnimeSample.join(', ')}
                                    </p>
                                ) : null}
                            </div>
                            <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-apple-subtext">Manga progress orphans</p>
                                <p className="mt-1 text-apple-text">
                                    Missing: {auditSummary?.progressOrphans?.manga?.missingCount ?? '—'}
                                </p>
                                <p className="mt-1 text-[11px] text-apple-subtext">
                                    Sampled: {auditSummary?.progressOrphans?.manga?.sampled ? 'yes' : 'no'}
                                </p>
                                {auditMangaSample.length ? (
                                    <p className="mt-2 font-mono text-[11px] text-apple-subtext">
                                        {auditMangaSample.map((row) => `${row.source}:${row.mangaId}`).join(', ')}
                                    </p>
                                ) : null}
                            </div>
                        </div>
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
                                className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 text-[11px] font-semibold text-apple-text disabled:opacity-50"
                            >
                                {activityBusy ? 'Loading…' : 'Reload'}
                            </button>
                        </div>
                        <div className="hidden overflow-x-auto rounded-xl border border-[var(--mx-color-f0f0f0)] md:block">
                            <table className="min-w-full text-left text-[12px]">
                                <thead className="bg-apple-bg text-[10px] font-bold uppercase tracking-wider text-apple-subtext">
                                    <tr>
                                        <th className="px-3 py-2">When</th>
                                        <th className="px-3 py-2">User id</th>
                                        <th className="px-3 py-2">MAL</th>
                                        <th className="px-3 py-2">Episode</th>
                                        <th className="px-3 py-2">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className=" text-apple-text">
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
                                                <td className="max-w-40 truncate px-3 py-2 font-mono text-[11px] text-apple-subtext">
                                                    {row.userId || '—'}
                                                </td>
                                                <td className="px-3 py-2 font-mono text-[11px]">{row.malId || '—'}</td>
                                                <td className="px-3 py-2 tabular-nums">{row.lastEpisodeNumber ?? '—'}</td>
                                                <td className="px-2 py-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => copyText(row.userId)}
                                                        className="rounded-lg border border-[var(--mx-color-e5e5ea)] px-2 py-1 text-[10px] font-semibold text-apple-text hover:bg-apple-bg"
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
                                <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-4 text-center text-[12px] text-apple-subtext">
                                    Loading…
                                </div>
                            ) : animeRows.length === 0 ? (
                                <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-4 text-center text-[12px] text-apple-subtext">
                                    No anime progress rows yet.
                                </div>
                            ) : (
                                animeRows.map((row, i) => (
                                    <article key={`${row.userId}-${row.malId}-${i}`} className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-[var(--color-surface)] p-3">
                                        <p className="font-mono text-[11px] text-apple-subtext">
                                            {row.updatedAt ? row.updatedAt.slice(0, 16).replace('T', ' ') : '—'}
                                        </p>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">User id</p>
                                                <p className="truncate font-mono text-apple-text">{row.userId || '—'}</p>
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
                                            className="mt-3 w-full rounded-lg border border-[var(--mx-color-e5e5ea)] px-2 py-2 text-[11px] font-semibold text-apple-text hover:bg-apple-bg"
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
                        <div className="hidden overflow-x-auto rounded-xl border border-[var(--mx-color-f0f0f0)] md:block">
                            <table className="min-w-full text-left text-[12px]">
                                <thead className="bg-apple-bg text-[10px] font-bold uppercase tracking-wider text-apple-subtext">
                                    <tr>
                                        <th className="px-3 py-2">When</th>
                                        <th className="px-3 py-2">User id</th>
                                        <th className="px-3 py-2">Source</th>
                                        <th className="px-3 py-2">Title</th>
                                        <th className="px-3 py-2">Chapter</th>
                                        <th className="px-3 py-2">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className=" text-apple-text">
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
                                                <td className="max-w-40 truncate px-3 py-2 font-mono text-[11px] text-apple-subtext">
                                                    {row.userId || '—'}
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
                                                        className="rounded-lg border border-[var(--mx-color-e5e5ea)] px-2 py-1 text-[10px] font-semibold text-apple-text hover:bg-apple-bg"
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
                                <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-4 text-center text-[12px] text-apple-subtext">
                                    Loading…
                                </div>
                            ) : mangaRows.length === 0 ? (
                                <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-4 text-center text-[12px] text-apple-subtext">
                                    No manga progress rows yet.
                                </div>
                            ) : (
                                mangaRows.map((row, i) => (
                                    <article key={`${row.userId}-${row.mangaId}-${i}`} className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-[var(--color-surface)] p-3">
                                        <p className="font-mono text-[11px] text-apple-subtext">
                                            {row.updatedAt ? row.updatedAt.slice(0, 16).replace('T', ' ') : '—'}
                                        </p>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">User id</p>
                                                <p className="truncate font-mono text-apple-text">{row.userId || '—'}</p>
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
                                            className="mt-3 w-full rounded-lg border border-[var(--mx-color-e5e5ea)] px-2 py-2 text-[11px] font-semibold text-apple-text hover:bg-apple-bg"
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
                                        className="min-w-0 flex-1 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 text-[13px] text-apple-text"
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
                                        className="min-w-0 flex-1 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 font-mono text-[12px] text-apple-text"
                                    />
                                    <button
                                        type="button"
                                        disabled={lookupIdBusy}
                                        onClick={runLookupById}
                                        className="w-full rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-4 py-2.5 text-[13px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50 sm:w-auto"
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
                        <SectionIntro title="User maintenance">
                            Clear stored user data or unlink integrations (affects the user immediately).
                        </SectionIntro>
                        <div className="grid gap-4 lg:grid-cols-3">
                            <div className="lg:col-span-2">
                                <label className="text-[11px] font-semibold text-apple-subtext">Target user id</label>
                                <input
                                    autoComplete="off"
                                    placeholder="674a1b2c3d4e5f6789012345"
                                    value={maintenanceUserId}
                                    onChange={(e) => setMaintenanceUserId(e.target.value.trim())}
                                    className="mt-2 w-full rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 font-mono text-[12px] text-apple-text"
                                />
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                        type="button"
                                        disabled={maintenanceBusy}
                                        onClick={() => runUserMaintenance('clear-anime-progress')}
                                        className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-3 py-2 text-[11px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50"
                                    >
                                        Clear anime progress
                                    </button>
                                    <button
                                        type="button"
                                        disabled={maintenanceBusy}
                                        onClick={() => runUserMaintenance('clear-manga-progress')}
                                        className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-3 py-2 text-[11px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50"
                                    >
                                        Clear manga progress
                                    </button>
                                    <button
                                        type="button"
                                        disabled={maintenanceBusy}
                                        onClick={() => runUserMaintenance('clear-anime-pins')}
                                        className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-3 py-2 text-[11px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50"
                                    >
                                        Clear anime pins
                                    </button>
                                    <button
                                        type="button"
                                        disabled={maintenanceBusy}
                                        onClick={() => runUserMaintenance('clear-wishlist')}
                                        className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-3 py-2 text-[11px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50"
                                    >
                                        Clear wishlist
                                    </button>
                                </div>
                            </div>
                            <div>
                                <label className="text-[11px] font-semibold text-apple-subtext">Unlink integration</label>
                                <div className="mt-2 flex flex-col gap-2">
                                    <select
                                        value={unlinkIntegration}
                                        onChange={(e) => setUnlinkIntegration(e.target.value)}
                                        className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 text-[12px] text-apple-text"
                                    >
                                        <option value="mal">MAL</option>
                                        <option value="steam">Steam</option>
                                        <option value="google">Google</option>
                                        <option value="animeschedule">AnimeSchedule</option>
                                        <option value="all">All integrations</option>
                                    </select>
                                    <button
                                        type="button"
                                        disabled={maintenanceBusy}
                                        onClick={runUnlinkIntegration}
                                        className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-3 py-2 text-[11px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50"
                                    >
                                        Unlink
                                    </button>
                                </div>
                            </div>
                        </div>
                        {maintenanceError ? (
                            <p className="mt-3 text-[12px] text-amber-800">{maintenanceError}</p>
                        ) : null}
                        {maintenanceSummary ? (
                            <p className="mt-2 text-[12px] text-apple-subtext">{maintenanceSummary}</p>
                        ) : null}
                    </Panel>

                    <Panel>
                        <SectionIntro title="Recent signups">Newest LifeSync accounts (email shown).</SectionIntro>
                        <div className="hidden overflow-x-auto rounded-xl border border-[var(--mx-color-f0f0f0)] md:block">
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
                                <tbody className=" text-apple-text">
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
                                                <td className="px-3 py-2">{row.email || row.emailMasked || '—'}</td>
                                                <td className="max-w-30 truncate px-3 py-2">{row.name || '—'}</td>
                                                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-apple-subtext">
                                                    {row.createdAt ? row.createdAt.slice(0, 10) : '—'}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        <LinkPill label="St" active={row.links?.steam} />
                                                        <LinkPill label="MAL" active={row.links?.mal} />
                                                        <LinkPill label="G" active={row.links?.google} />
                                                        <LinkPill label="AS" active={row.links?.animeSchedule} />
                                                    </div>
                                                </td>
                                                <td className="px-2 py-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => copyText(row.id)}
                                                        className="rounded-lg border border-[var(--mx-color-e5e5ea)] px-2 py-1 text-[10px] font-semibold text-apple-text hover:bg-apple-bg"
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
                                <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-4 text-center text-[12px] text-apple-subtext">
                                    {loadBusy ? 'Loading…' : 'No users yet.'}
                                </div>
                            ) : (
                                recent.map((row) => (
                                    <article key={row.id} className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-[var(--color-surface)] p-3">
                                        <p className="truncate font-mono text-[11px] text-apple-subtext">{row.id}</p>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                                            <div className="col-span-2">
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Email</p>
                                                <p className="text-apple-text">{row.email || row.emailMasked || '—'}</p>
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
                                            <LinkPill label="G" active={row.links?.google} />
                                            <LinkPill label="AS" active={row.links?.animeSchedule} />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => copyText(row.id)}
                                            className="mt-3 w-full rounded-lg border border-[var(--mx-color-e5e5ea)] px-2 py-2 text-[11px] font-semibold text-apple-text hover:bg-apple-bg"
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
        <dl className="mt-4 grid gap-2 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg p-4 text-[12px] sm:grid-cols-2">
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
                <dt className="text-apple-subtext">Email</dt>
                <dd className="mt-0.5">{user.email || user.emailMasked || '—'}</dd>
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
                    <LinkPill label="Google" active={user.links?.google} />
                    <LinkPill label="AnimeSchedule" active={user.links?.animeSchedule} />
                </dd>
            </div>
        </dl>
    )
}
