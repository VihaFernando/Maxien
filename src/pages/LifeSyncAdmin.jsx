import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLifeSync } from '../context/LifeSyncContext'
import { getLifesyncToken, lifesyncFetch } from '../lib/lifesyncApi'
import { isLifeSyncAdmin } from '../lib/lifeSyncRoles'
import { LifeSyncSectionNav } from '../components/lifesync/LifeSyncSectionNav'
import { LineChart, RangeToggle, Sparkline } from '../components/lifesync/AdminCharts'

const CHART_COLORS = {
    signups: 'var(--mx-color-c6ff00)',
    anime: '#0080FF',
    manga: '#FF9500',
}

function sum(arr) {
    return Array.isArray(arr) ? arr.reduce((a, b) => a + (Number(b) || 0), 0) : 0
}

function deltaPct(series) {
    if (!Array.isArray(series) || series.length < 2) return null
    const half = Math.floor(series.length / 2)
    const prev = sum(series.slice(0, half))
    const curr = sum(series.slice(half))
    if (prev === 0) return curr > 0 ? 100 : 0
    return Math.round(((curr - prev) / prev) * 100)
}

const ADMIN_TABS = [
    { id: 'overview', label: 'Overview', title: 'Growth, usage, and quick snapshot' },
    { id: 'health', label: 'Health & ops', title: 'Database, integrations, and system status' },
    { id: 'activity', label: 'Activity', title: 'Latest anime & manga progress across users' },
    { id: 'users', label: 'Users', title: 'Signups, lookup, and support tools' },
]

const VALID_TAB_IDS = new Set(ADMIN_TABS.map((t) => t.id))

const CAPABILITY_LABELS = {
    steamWebApi: 'Steam Web API',
    googleOAuth: 'Google OAuth',
    supabasePasswordless: 'Supabase passwordless',
    openXbl: 'OpenXBL',
    gameSearch: 'GameSearch',
    gameRantNews: 'GameRant news',
    cheapShark: 'CheapShark',
    watchHentai: 'WatchHentai',
    aninekoFallback: 'Anineko fallback',
    mangaDistrict: 'Manga District',
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
    aninekoFallbackEnabled: 'Anineko fallback enabled',
}

const V1_ADMIN_MODE = false

function MetricCard({ label, value, hint }) {
    return (
        <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-widest text-apple-subtext">{label}</p>
            <p className="mt-1.5 text-[22px] font-bold tabular-nums text-apple-text">{value ?? ''}</p>
            {hint ? <p className="mt-1 text-[10px] leading-snug text-apple-subtext">{hint}</p> : null}
        </div>
    )
}

function StatCard({ label, value, hint, spark, sparkColor, delta }) {
    const deltaUp = typeof delta === 'number' && delta > 0
    const deltaDown = typeof delta === 'number' && delta < 0
    return (
        <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-apple-subtext">{label}</p>
                {typeof delta === 'number' ? (
                    <span
                        className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                            deltaUp
                                ? 'bg-emerald-100 text-emerald-800'
                                : deltaDown
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-apple-bg text-apple-subtext'
                        }`}
                        title="Change vs the previous half of the selected range"
                    >
                        {deltaUp ? '▲' : deltaDown ? '▼' : '•'} {Math.abs(delta)}%
                    </span>
                ) : null}
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-2">
                <p className="text-[22px] font-bold tabular-nums text-apple-text">{value ?? '—'}</p>
                {Array.isArray(spark) && spark.length > 1 ? (
                    <Sparkline data={spark} color={sparkColor || 'var(--color-primary)'} ariaLabel={`${label} trend`} />
                ) : null}
            </div>
            {hint ? <p className="mt-1 text-[10px] leading-snug text-apple-subtext">{hint}</p> : null}
        </div>
    )
}

function ChartCard({ title, subtitle, action, busy, error, empty, children }) {
    return (
        <Panel>
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <SectionIntro title={title}>{subtitle}</SectionIntro>
                {action}
            </div>
            {error ? (
                <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">{error}</p>
            ) : null}
            {busy ? (
                <div className="h-60 animate-pulse rounded-xl bg-apple-bg" aria-label="Loading chart" />
            ) : empty ? (
                <div className="flex h-60 flex-col items-center justify-center rounded-xl border border-dashed border-[var(--mx-color-e5e5ea)] text-center">
                    <p className="text-[13px] font-semibold text-apple-text">No data in this range yet</p>
                    <p className="mt-1 text-[12px] text-apple-subtext">Activity will appear here as users engage.</p>
                </div>
            ) : (
                children
            )}
        </Panel>
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
    if (typeof value !== 'boolean') return ''
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
    const [scheduleRefreshBusy, setScheduleRefreshBusy] = useState(false)
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

    const [series, setSeries] = useState(null)
    const [seriesBusy, setSeriesBusy] = useState(false)
    const [seriesError, setSeriesError] = useState('')
    const [seriesRange, setSeriesRange] = useState(30)

    const [scraperStats, setScraperStats] = useState(null)
    const [scraperStatsBusy, setScraperStatsBusy] = useState(false)
    const [scraperStatsError, setScraperStatsError] = useState('')
    const [scraperResetBusy, setScraperResetBusy] = useState(false)

    const [liveOn, setLiveOn] = useState(false)
    const [liveSamples, setLiveSamples] = useState([]) // { t, rssMb, heapMb, pingMs }
    const liveTimerRef = useRef(null)

    const [slugCheckId, setSlugCheckId] = useState('')
    const [slugCheckBusy, setSlugCheckBusy] = useState(false)
    const [slugCheckResult, setSlugCheckResult] = useState(null)
    const [hydrateSlug, setHydrateSlug] = useState('')
    const [hydrateBusy, setHydrateBusy] = useState(false)
    const [hydrateResult, setHydrateResult] = useState(null)

    const [regLocked, setRegLocked] = useState(null)  // null = not yet loaded
    const [regLockBusy, setRegLockBusy] = useState(false)
    const [regLockError, setRegLockError] = useState('')


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

    const loadSeries = useCallback(async (range) => {
        if (V1_ADMIN_MODE) return
        setSeriesBusy(true)
        setSeriesError('')
        try {
            const data = await lifesyncFetch(`/api/v1/admin/metrics/series?range=${range}`, { method: 'GET' })
            setSeries(data)
        } catch (e) {
            setSeriesError(e?.message || 'Could not load growth series.')
            setSeries(null)
        } finally {
            setSeriesBusy(false)
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

    const refreshScraperStats = async () => {
        setScraperStatsBusy(true)
        setScraperStatsError('')
        try {
            setScraperStats(await lifesyncFetch('/api/v1/admin/scraper-stats', { method: 'GET' }))
        } catch (e) {
            setScraperStats(null)
            setScraperStatsError(e?.message || 'Could not load scraper stats.')
        } finally {
            setScraperStatsBusy(false)
        }
    }

    const runScraperStatsReset = async () => {
        setScraperResetBusy(true)
        try {
            await lifesyncFetch('/api/v1/admin/scraper-stats/reset', { method: 'POST' })
            await refreshScraperStats()
        } catch {
            // ignore
        } finally {
            setScraperResetBusy(false)
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

    const runScheduleRefresh = async () => {
        setOpsMessage('')
        setOpsError('')
        setScheduleRefreshBusy(true)
        try {
            const data = await lifesyncFetch('/api/v1/admin/anime-schedule/refresh', { method: 'POST' })
            setOpsMessage(`Weekly anime schedule refreshed for ${data?.weekKey ?? 'this week'}.`)
        } catch (e) {
            setOpsError(e?.message || 'Schedule refresh failed.')
        } finally {
            setScheduleRefreshBusy(false)
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

    const loadRegLock = useCallback(async () => {
        try {
            const data = await lifesyncFetch('/api/v1/admin/settings', { method: 'GET' })
            setRegLocked(Boolean(data?.registrationLocked))
            setRegLockError('')
        } catch (e) {
            setRegLockError(e?.message || 'Could not load registration lock state.')
        }
    }, [])

    const toggleRegLock = async (next) => {
        setRegLockBusy(true)
        setRegLockError('')
        try {
            const data = await lifesyncFetch('/api/v1/admin/settings', {
                method: 'POST',
                json: { registrationLocked: next },
            })
            setRegLocked(Boolean(data?.registrationLocked))
        } catch (e) {
            setRegLockError(e?.message || 'Could not update registration lock.')
        } finally {
            setRegLockBusy(false)
        }
    }


    const runSlugCheck = async () => {
        const slug = slugCheckId.trim().replace(/^\/+|\/+$/g, '')
        if (!slug) {
            setSlugCheckResult({ error: 'Enter an Anineko anime slug.' })
            return
        }
        setSlugCheckBusy(true)
        setSlugCheckResult(null)
        try {
            const data = await lifesyncFetch(`/api/v1/admin/anime-db/check?slug=${encodeURIComponent(slug)}`, {
                method: 'GET',
            })
            setSlugCheckResult(data)
        } catch (e) {
            setSlugCheckResult({ error: e?.message || 'Slug check failed.' })
        } finally {
            setSlugCheckBusy(false)
        }
    }

    const runHydrate = async () => {
        const slug = hydrateSlug.trim().replace(/^\/+|\/+$/g, '')
        if (!slug) {
            setHydrateResult({ error: 'Enter an Anineko anime slug.' })
            return
        }
        setHydrateBusy(true)
        setHydrateResult(null)
        try {
            const data = await lifesyncFetch('/api/v1/admin/anime-db/hydrate', {
                method: 'POST',
                json: { aninekoSlug: slug },
            })
            setHydrateResult(data)
            refreshAnimeDb().catch(() => {})
        } catch (e) {
            setHydrateResult({ error: e?.message || 'Hydrate failed.' })
        } finally {
            setHydrateBusy(false)
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

    useEffect(() => {
        if (V1_ADMIN_MODE) return
        if (!allowed || tab !== 'users') return
        loadRegLock()
    }, [allowed, tab, loadRegLock])

    useEffect(() => {
        if (V1_ADMIN_MODE) return
        if (!allowed || tab !== 'overview') return
        loadSeries(seriesRange)
    }, [allowed, tab, seriesRange, loadSeries])

    // Live system monitor: poll on a 10s interval and keep a rolling window.
    // One light /health call per tick (ping + checks); memory is refreshed from
    // /overview only once every 6 ticks (~1 min) since RSS/heap drift slowly. This
    // keeps well under the admin rate limit (120 req / 15 min) for long sessions.
    useEffect(() => {
        if (!liveOn || !allowed) return undefined
        let cancelled = false
        let n = 0
        const tick = async () => {
            try {
                const h = await lifesyncFetch('/api/v1/admin/health', { method: 'GET' })
                if (cancelled) return
                setHealth(h)
                let mem = null
                if (n % 6 === 0) {
                    mem = await lifesyncFetch('/api/v1/admin/overview', { method: 'GET' }).catch(() => null)
                    if (cancelled) return
                    if (mem) setOverview(mem)
                }
                n += 1
                setLiveSamples((prev) => {
                    const lastMem = prev[prev.length - 1]
                    const next = [
                        ...prev,
                        {
                            t: Date.now(),
                            rssMb: mem?.system?.memoryRssMb ?? lastMem?.rssMb ?? null,
                            heapMb: mem?.system?.memoryHeapUsedMb ?? lastMem?.heapMb ?? null,
                            pingMs: h?.dbPingMs ?? null,
                        },
                    ]
                    return next.slice(-40)
                })
            } catch {
                /* keep last samples; transient errors are fine */
            }
        }
        tick()
        liveTimerRef.current = window.setInterval(tick, 10000)
        return () => {
            cancelled = true
            if (liveTimerRef.current) window.clearInterval(liveTimerRef.current)
            liveTimerRef.current = null
        }
    }, [liveOn, allowed])

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
                    <MetricCard label="Service" value={v1Health?.service || ''} />
                    <MetricCard label="Runtime" value={v1Health?.runtime || ''} />
                    <MetricCard label="Health" value={v1Health?.ok ? 'OK' : ''} />
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
    const sLabels = Array.isArray(series?.labels) ? series.labels : []
    const sSignups = Array.isArray(series?.series?.signups) ? series.series.signups : []
    const sAnime = Array.isArray(series?.series?.animeProgress) ? series.series.animeProgress : []
    const sManga = Array.isArray(series?.series?.mangaProgress) ? series.series.mangaProgress : []
    const seriesEmpty = !seriesBusy && sLabels.length > 0 && sum(sSignups) + sum(sAnime) + sum(sManga) === 0
    const growthSeries = [
        { key: 'signups', name: 'Signups', color: CHART_COLORS.signups, values: sSignups },
    ]
    const engagementSeries = [
        { key: 'anime', name: 'Anime updates', color: CHART_COLORS.anime, values: sAnime },
        { key: 'manga', name: 'Manga updates', color: CHART_COLORS.manga, values: sManga },
    ]
    const liveRss = liveSamples.map((x) => x.rssMb).filter((v) => v != null)
    const liveHeap = liveSamples.map((x) => x.heapMb).filter((v) => v != null)
    const livePing = liveSamples.map((x) => x.pingMs).filter((v) => v != null)
    const lastLive = liveSamples[liveSamples.length - 1] || null
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
                            Monitor the API host, integrations, and user activity. Use the tabs to focus each area 
                            nothing here shows OAuth tokens or passwords.
                        </p>
                    </div>
                    <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">
                        <button
                            type="button"
                            disabled={loadBusy}
                            onClick={() => load()}
                            className="w-full rounded-xl bg-primary px-4 py-2.5 text-[12px] font-semibold text-black shadow-sm disabled:opacity-50 sm:w-auto"
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

            {/*  Overview  */}
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
                                    {overview?.serverTime || ''}
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
                                    <dd className="font-mono">{s?.nodeVersion ?? ''}</dd>
                                </div>
                                <div className="flex justify-between gap-2 border-b border-[var(--mx-color-f0f0f0)] py-1">
                                    <dt className="text-apple-subtext">API uptime</dt>
                                    <dd>{s?.uptimeSeconds != null ? formatUptime(s.uptimeSeconds) : ''}</dd>
                                </div>
                                <div className="flex justify-between gap-2 py-1">
                                    <dt className="text-apple-subtext">Memory RSS / heap</dt>
                                    <dd className="tabular-nums">
                                        {s?.memoryRssMb ?? ''} MB / {s?.memoryHeapUsedMb ?? ''} MB
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
                        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                            <SectionIntro title="Growth & engagement">
                                New accounts and reading/watching activity over the selected window. Deltas compare the
                                latest half of the range with the previous half.
                            </SectionIntro>
                            <RangeToggle value={seriesRange} onChange={setSeriesRange} disabled={seriesBusy} />
                        </div>
                        {seriesError ? (
                            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                                {seriesError}
                            </p>
                        ) : null}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            <StatCard
                                label={`New signups (${seriesRange}d)`}
                                value={sum(sSignups)}
                                spark={sSignups}
                                sparkColor={CHART_COLORS.signups}
                                delta={deltaPct(sSignups)}
                            />
                            <StatCard
                                label={`Anime updates (${seriesRange}d)`}
                                value={sum(sAnime)}
                                spark={sAnime}
                                sparkColor={CHART_COLORS.anime}
                                delta={deltaPct(sAnime)}
                            />
                            <StatCard
                                label={`Manga updates (${seriesRange}d)`}
                                value={sum(sManga)}
                                spark={sManga}
                                sparkColor={CHART_COLORS.manga}
                                delta={deltaPct(sManga)}
                            />
                            <StatCard
                                label="Total users"
                                value={m?.userCount}
                                hint={`${m?.newUsersLast7Days ?? 0} new in last 7 days`}
                            />
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <ChartCard
                            title="Signups over time"
                            subtitle="Daily new LifeSync accounts."
                            busy={seriesBusy}
                            empty={seriesEmpty}
                        >
                            <LineChart labels={sLabels} series={growthSeries} />
                        </ChartCard>
                        <ChartCard
                            title="Content engagement"
                            subtitle="Daily anime watch and manga reading progress events."
                            busy={seriesBusy}
                            empty={seriesEmpty}
                        >
                            <LineChart labels={sLabels} series={engagementSeries} />
                        </ChartCard>
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
                            <MetricCard label="Google linked" value={m?.usersGoogleLinked} />
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

            {/*  Health & ops  */}
            {tab === 'health' && (
                <div className="space-y-8">
                    <Panel>
                        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                            <SectionIntro title="Live system monitor">
                                Polls health and resource usage every 5s while enabled. Pause to stop network traffic.
                            </SectionIntro>
                            <div className="flex items-center gap-2">
                                {liveOn ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                        </span>
                                        Live
                                    </span>
                                ) : null}
                                <button
                                    type="button"
                                    onClick={() => setLiveOn((v) => !v)}
                                    aria-pressed={liveOn}
                                    className={`rounded-xl px-4 py-2 text-[12px] font-semibold shadow-sm transition-colors ${
                                        liveOn
                                            ? 'border border-[var(--mx-color-e5e5ea)] bg-(--color-surface) text-white hover:bg-apple-bg'
                                            : 'bg-primary text-black'
                                    }`}
                                >
                                    {liveOn ? 'Pause' : 'Start monitor'}
                                </button>
                            </div>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-apple-subtext">Memory RSS</p>
                                <div className="mt-1.5 flex items-end justify-between gap-2">
                                    <p className="text-[22px] font-bold tabular-nums text-apple-text">
                                        {lastLive?.rssMb ?? s?.memoryRssMb ?? '—'}
                                        <span className="ml-1 text-[12px] font-medium text-apple-subtext">MB</span>
                                    </p>
                                    <Sparkline data={liveRss} color={CHART_COLORS.anime} ariaLabel="Memory RSS trend" />
                                </div>
                            </div>
                            <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-apple-subtext">Heap used</p>
                                <div className="mt-1.5 flex items-end justify-between gap-2">
                                    <p className="text-[22px] font-bold tabular-nums text-apple-text">
                                        {lastLive?.heapMb ?? s?.memoryHeapUsedMb ?? '—'}
                                        <span className="ml-1 text-[12px] font-medium text-apple-subtext">MB</span>
                                    </p>
                                    <Sparkline data={liveHeap} color={CHART_COLORS.signups} ariaLabel="Heap used trend" />
                                </div>
                            </div>
                            <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg p-4">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-apple-subtext">DB ping</p>
                                <div className="mt-1.5 flex items-end justify-between gap-2">
                                    <p className="text-[22px] font-bold tabular-nums text-apple-text">
                                        {lastLive?.pingMs ?? health?.dbPingMs ?? '—'}
                                        <span className="ml-1 text-[12px] font-medium text-apple-subtext">ms</span>
                                    </p>
                                    <Sparkline data={livePing} color={CHART_COLORS.manga} ariaLabel="DB ping trend" />
                                </div>
                            </div>
                        </div>
                        {!liveOn && liveSamples.length === 0 ? (
                            <p className="mt-3 text-[12px] text-apple-subtext">
                                Start the monitor to collect a rolling ~6-minute window of live samples.
                            </p>
                        ) : null}
                    </Panel>

                    <Panel>
                        <SectionIntro title="Process status">
                            Server snapshot from the last refresh, including uptime and resource usage.
                        </SectionIntro>
                        <dl className="grid gap-3 text-[12px] sm:grid-cols-2">
                            <div>
                                <dt className="text-apple-subtext">Server time</dt>
                                <dd className="mt-0.5 font-mono text-[11px]">{overview?.serverTime ?? ''}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">PID</dt>
                                <dd className="mt-0.5 font-mono">{s?.pid ?? ''}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">Uptime</dt>
                                <dd className="mt-0.5">{s?.uptimeSeconds != null ? formatUptime(s.uptimeSeconds) : ''}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">Mongo connected</dt>
                                <dd className="mt-0.5 font-mono">{formatBoolean(health?.mongoConnected)}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">RSS / heap</dt>
                                <dd className="mt-0.5 tabular-nums">
                                    {s?.memoryRssMb ?? ''} MB / {s?.memoryHeapUsedMb ?? ''} MB
                                </dd>
                            </div>
                        </dl>
                    </Panel>

                    <Panel>
                        <SectionIntro title="Database health">Round-trip ping to MongoDB (admin command).</SectionIntro>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="font-mono text-[28px] font-bold tabular-nums text-apple-text">
                                    {health?.dbPingMs != null ? `${health.dbPingMs} ms` : ''}
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
                                Cache coverage for AnimeData (stream pointers + Anineko catalog).
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
                            <MetricCard label="With catalog" value={animeDb?.totals?.withStreams} />
                        </div>
                        <div className="mt-4 grid gap-3 text-[12px] sm:grid-cols-2">
                            <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-apple-subtext">Newest</p>
                                <p className="mt-1 font-mono text-apple-text">
                                    {animeDb?.newest?.aninekoSlug || ''}
                                </p>
                                <p className="mt-1 text-apple-subtext">{animeDb?.newest?.title || ''}</p>
                                <p className="mt-1 font-mono text-[11px] text-apple-subtext">
                                    {animeDb?.newest?.fetchedAt || ''}
                                </p>
                            </div>
                            <div className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-3">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-apple-subtext">Oldest</p>
                                <p className="mt-1 font-mono text-apple-text">
                                    {animeDb?.oldest?.aninekoSlug || ''}
                                </p>
                                <p className="mt-1 text-apple-subtext">{animeDb?.oldest?.title || ''}</p>
                                <p className="mt-1 font-mono text-[11px] text-apple-subtext">
                                    {animeDb?.oldest?.fetchedAt || ''}
                                </p>
                            </div>
                        </div>
                    </Panel>

                    <Panel>
                        <SectionIntro title="Anime slug check">
                            Validate an Anineko slug against the local cache.
                        </SectionIntro>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                                autoComplete="off"
                                placeholder="Anineko slug (e.g. one-piece)"
                                value={slugCheckId}
                                onChange={(e) => setSlugCheckId(e.target.value.trim())}
                                className="min-w-0 flex-1 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 font-mono text-[12px] text-apple-text"
                            />
                            <button
                                type="button"
                                disabled={slugCheckBusy}
                                onClick={runSlugCheck}
                                className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-4 py-2.5 text-[12px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50"
                            >
                                {slugCheckBusy ? 'Checking…' : 'Check'}
                            </button>
                        </div>
                        {slugCheckResult?.error ? (
                            <p className="mt-2 text-[12px] text-amber-800">{slugCheckResult.error}</p>
                        ) : null}
                        {slugCheckResult && !slugCheckResult.error ? (
                            <div className="mt-4 rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-3 text-[12px]">
                                <p className="text-[10px] font-bold uppercase tracking-wide text-apple-subtext">Cache</p>
                                <p className="mt-1 text-apple-text">{slugCheckResult.db?.found ? 'Found' : 'Not found'}</p>
                                <p className="mt-1 font-mono text-[11px] text-apple-subtext">{slugCheckResult.db?.aninekoSlug || ''}</p>
                                <p className="mt-1 text-apple-subtext">{slugCheckResult.db?.title || ''}</p>
                                <p className="mt-1 text-apple-subtext">Streams: {slugCheckResult.db?.hasStreams ? 'yes' : 'no'}</p>
                                <p className="mt-1 text-apple-subtext">Episodes: {slugCheckResult.db?.epCount ?? ''}</p>
                            </div>
                        ) : null}
                    </Panel>

                    <Panel>
                        <SectionIntro title="Hydrate Anineko slug">
                            Fetch and persist catalog data for an Anineko slug into the database.
                        </SectionIntro>
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <input
                                autoComplete="off"
                                placeholder="Anineko slug (e.g. one-piece)"
                                value={hydrateSlug}
                                onChange={(e) => setHydrateSlug(e.target.value.trim())}
                                className="min-w-0 flex-1 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 font-mono text-[12px] text-apple-text"
                            />
                            <button
                                type="button"
                                disabled={hydrateBusy}
                                onClick={runHydrate}
                                className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-4 py-2.5 text-[12px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50"
                            >
                                {hydrateBusy ? 'Hydrating…' : 'Hydrate'}
                            </button>
                        </div>
                        {hydrateResult?.error ? (
                            <p className="mt-2 text-[12px] text-amber-800">{hydrateResult.error}</p>
                        ) : null}
                        {hydrateResult && !hydrateResult.error ? (
                            <div className="mt-4 rounded-xl border border-[var(--mx-color-f0f0f0)] bg-apple-bg px-3 py-3 text-[12px]">
                                <p className="mt-1 text-apple-text">{hydrateResult.ok ? 'Hydrated successfully' : 'No data returned'}</p>
                                <p className="mt-1 text-apple-subtext">{hydrateResult.title || ''}</p>
                                <p className="mt-1 text-apple-subtext">Episodes: {hydrateResult.episodeCount ?? ''}</p>
                            </div>
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
                            <button
                                type="button"
                                disabled={scheduleRefreshBusy}
                                onClick={runScheduleRefresh}
                                className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50"
                            >
                                {scheduleRefreshBusy ? 'Refreshing…' : 'Refresh weekly anime schedule'}
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
                                    Missing: {auditSummary?.progressOrphans?.anime?.missingCount ?? ''}
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
                                    Missing: {auditSummary?.progressOrphans?.manga?.missingCount ?? ''}
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

                    {/* Scraper stats */}
                    <Panel>
                        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                            <SectionIntro title="Web scraper status">
                                Live request counters per scraper label — tracked in-process since last reset or server restart.
                            </SectionIntro>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    disabled={scraperResetBusy}
                                    onClick={runScraperStatsReset}
                                    className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-3 py-2 text-[11px] font-semibold text-apple-text hover:bg-apple-bg disabled:opacity-50"
                                >
                                    {scraperResetBusy ? 'Resetting…' : 'Reset stats'}
                                </button>
                                <button
                                    type="button"
                                    disabled={scraperStatsBusy}
                                    onClick={refreshScraperStats}
                                    className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 text-[11px] font-semibold text-apple-text disabled:opacity-50"
                                >
                                    {scraperStatsBusy ? 'Loading…' : 'Refresh'}
                                </button>
                            </div>
                        </div>
                        {scraperStatsError ? (
                            <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">{scraperStatsError}</p>
                        ) : null}
                        {scraperStats ? (
                            <>
                                {/* Totals row */}
                                <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                    {[
                                        { label: 'Total requests', value: scraperStats.totals?.requests ?? 0 },
                                        { label: 'Successes', value: scraperStats.totals?.successes ?? 0, ok: true },
                                        { label: 'Failures', value: scraperStats.totals?.failures ?? 0, bad: true },
                                        { label: 'Retries', value: scraperStats.totals?.retries ?? 0 },
                                    ].map(({ label, value, ok, bad }) => (
                                        <div
                                            key={label}
                                            className={`rounded-2xl border p-4 ${ok ? 'border-emerald-200 bg-emerald-50' : bad && value > 0 ? 'border-rose-200 bg-rose-50' : 'border-[var(--mx-color-e5e5ea)] bg-apple-bg'}`}
                                        >
                                            <p className="text-[10px] font-bold uppercase tracking-widest text-apple-subtext">{label}</p>
                                            <p className={`mt-1.5 text-[22px] font-bold tabular-nums ${ok ? 'text-emerald-800' : bad && value > 0 ? 'text-rose-800' : 'text-apple-text'}`}>{value}</p>
                                        </div>
                                    ))}
                                </div>

                                {/* Per-scraper table */}
                                {Array.isArray(scraperStats.scrapers) && scraperStats.scrapers.length > 0 ? (
                                    <div className="overflow-x-auto rounded-xl border border-[var(--mx-color-f0f0f0)]">
                                        <table className="min-w-full text-left text-[12px]">
                                            <thead className="bg-apple-bg text-[10px] font-bold uppercase tracking-wider text-apple-subtext">
                                                <tr>
                                                    <th className="px-3 py-2">Scraper</th>
                                                    <th className="px-3 py-2 text-right">Requests</th>
                                                    <th className="px-3 py-2 text-right">OK</th>
                                                    <th className="px-3 py-2 text-right">Fail</th>
                                                    <th className="px-3 py-2 text-right">Retries</th>
                                                    <th className="px-3 py-2 text-right">Avg ms</th>
                                                    <th className="px-3 py-2 text-right">Status</th>
                                                    <th className="px-3 py-2">Last error</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-[var(--mx-color-f0f0f0)]">
                                                {scraperStats.scrapers.map((s) => {
                                                    const pct = s.requests > 0 ? Math.round((s.successes / s.requests) * 100) : null
                                                    const healthy = pct === null ? null : pct >= 80
                                                    return (
                                                        <tr key={s.label} className="hover:bg-apple-bg">
                                                            <td className="px-3 py-2.5 font-mono font-semibold text-apple-text">{s.label}</td>
                                                            <td className="px-3 py-2.5 text-right tabular-nums text-apple-subtext">{s.requests}</td>
                                                            <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{s.successes}</td>
                                                            <td className={`px-3 py-2.5 text-right tabular-nums ${s.failures > 0 ? 'font-semibold text-rose-700' : 'text-apple-subtext'}`}>{s.failures}</td>
                                                            <td className="px-3 py-2.5 text-right tabular-nums text-apple-subtext">{s.retries}</td>
                                                            <td className="px-3 py-2.5 text-right tabular-nums text-apple-subtext">{s.avgLatencyMs != null ? `${s.avgLatencyMs}` : '—'}</td>
                                                            <td className="px-3 py-2.5 text-right">
                                                                {healthy === null ? (
                                                                    <span className="text-apple-subtext">—</span>
                                                                ) : healthy ? (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                                                        {pct}%
                                                                    </span>
                                                                ) : (
                                                                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                                                                        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                                                        {pct}%
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="max-w-[200px] truncate px-3 py-2.5 font-mono text-[10px] text-apple-subtext" title={s.lastErrorMessage || ''}>{s.lastErrorMessage || '—'}</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-[12px] text-apple-subtext">No scraper activity recorded yet. Scrapers are instrumented automatically when the server processes requests.</p>
                                )}
                                <p className="mt-2 text-[11px] text-apple-subtext">Last updated: {scraperStats.serverTime || ''}</p>
                            </>
                        ) : (
                            <p className="text-[12px] text-apple-subtext">Click Refresh to load live scraper counters.</p>
                        )}
                    </Panel>

                    {/* Backend architecture diagram */}
                    <Panel>
                        <SectionIntro title="Backend architecture">
                            How the LifeSync server routes requests through its scraper integrations, cache, and database layers.
                        </SectionIntro>
                        <div className="mt-4 overflow-x-auto">
                            <div className="min-w-[600px] space-y-3 font-mono text-[11px]">
                                {/* Client layer */}
                                <div className="flex items-center justify-center gap-2">
                                    {['Web client', 'Mobile PWA', 'TV mode'].map((label) => (
                                        <div key={label} className="flex-1 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-2 text-center text-apple-text">
                                            {label}
                                        </div>
                                    ))}
                                </div>
                                {/* Arrow */}
                                <div className="flex justify-center text-apple-subtext">↓ HTTPS / REST</div>

                                {/* API gateway */}
                                <div className="rounded-xl border-2 border-[var(--color-primary)] bg-[color-mix(in_srgb,var(--color-primary)_8%,transparent)] px-4 py-2.5 text-center font-semibold text-apple-text">
                                    Express API gateway · /api/v1
                                    <span className="ml-2 rounded-full bg-[var(--color-primary)] px-2 py-0.5 text-[10px] font-bold text-black">Auth · Rate-limit · CORS</span>
                                </div>

                                {/* Router row */}
                                <div className="flex justify-center text-apple-subtext">↓ module router</div>
                                <div className="grid grid-cols-5 gap-2">
                                    {[
                                        { label: 'Anime', color: '#0080FF' },
                                        { label: 'Manga', color: '#FF9500' },
                                        { label: 'Games / Xbox', color: '#107C10' },
                                        { label: 'Feed / Media', color: '#8B5CF6' },
                                        { label: 'Admin', color: '#EF4444' },
                                    ].map(({ label, color }) => (
                                        <div
                                            key={label}
                                            className="rounded-xl border px-2 py-2 text-center text-[10px] font-semibold text-apple-text"
                                            style={{ borderColor: color, background: `${color}14` }}
                                        >
                                            {label}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex justify-center text-apple-subtext">↓ services + repositories</div>

                                {/* Middle: Cache + DB side by side */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-3">
                                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-apple-subtext">In-process cache</p>
                                        {[
                                            { label: 'Listing snapshot cache', hint: 'manga / anime pages' },
                                            { label: 'Steam store featured', hint: 'in-memory TTL' },
                                            { label: 'OpenXBL get cache', hint: 'per-key TTL' },
                                            { label: 'Proxy cookie jars', hint: 'per-egress session' },
                                            { label: 'Scraper stats', hint: 'in-memory counters' },
                                        ].map(({ label, hint }) => (
                                            <div key={label} className="flex items-center gap-2 py-0.5">
                                                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[var(--mx-color-c6ff00)]" />
                                                <span className="text-apple-text">{label}</span>
                                                <span className="ml-auto text-apple-subtext">{hint}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-apple-bg px-3 py-3">
                                        <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-apple-subtext">MongoDB (Mongoose)</p>
                                        {[
                                            { label: 'User', hint: 'auth · progress · pins' },
                                            { label: 'AnimeData', hint: 'stream pointers' },
                                            { label: 'MangaCatalog', hint: 'chapter cache' },
                                            { label: 'MangaProgress', hint: 'per-user reading' },
                                            { label: 'WishlistItem', hint: 'game deals' },
                                        ].map(({ label, hint }) => (
                                            <div key={label} className="flex items-center gap-2 py-0.5">
                                                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#0080FF]" />
                                                <span className="text-apple-text">{label}</span>
                                                <span className="ml-auto text-apple-subtext">{hint}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex justify-center text-apple-subtext">↓ outbound HTTP (stealth-client · proxy rotation · fingerprint pool)</div>

                                {/* External scrapers */}
                                <div className="rounded-xl border border-dashed border-[var(--mx-color-e5e5ea)] px-3 py-3">
                                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-apple-subtext">External integrations</p>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 sm:grid-cols-3">
                                        {[
                                            { label: 'Anineko', tag: 'anime · scraper' },
                                            { label: 'WatchHentai', tag: 'anime · scraper' },
                                            { label: 'MangaDNA', tag: 'manga · scraper' },
                                            { label: 'Manga District', tag: 'manga · scraper' },
                                            { label: 'Roliascan', tag: 'manga · API' },
                                            { label: 'Comix', tag: 'manga · API' },
                                            { label: 'Steam Web API', tag: 'games · API' },
                                            { label: 'OpenXBL', tag: 'xbox · API' },
                                            { label: 'CheapShark', tag: 'deals · API' },
                                            { label: 'GameRant', tag: 'news · scraper' },
                                            { label: 'Google OAuth', tag: 'auth · OAuth2' },
                                            { label: 'Supabase', tag: 'auth · JWT' },
                                        ].map(({ label, tag }) => (
                                            <div key={label} className="flex items-center gap-1.5 py-0.5">
                                                <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#FF9500]" />
                                                <span className="text-apple-text">{label}</span>
                                                <span className="text-apple-subtext">· {tag}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Legend */}
                                <div className="flex flex-wrap gap-4 pt-1 text-[10px] text-apple-subtext">
                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[var(--mx-color-c6ff00)]" /> In-process cache</span>
                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#0080FF]" /> MongoDB collections</span>
                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#FF9500]" /> External services</span>
                                    <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm border-2 border-[var(--color-primary)]" /> API gateway</span>
                                </div>
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
                                <dd className="font-medium text-apple-text">{s?.nodeEnv ?? ''}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">Listen port</dt>
                                <dd className="font-mono font-medium text-apple-text">{s?.apiPort ?? ''}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">Database name</dt>
                                <dd className="font-mono text-[12px] text-apple-text">{s?.databaseName ?? ''}</dd>
                            </div>
                            <div className="sm:col-span-2">
                                <dt className="text-apple-subtext">Client origin (CORS)</dt>
                                <dd className="break-all font-mono text-[12px] text-apple-text">{s?.clientOrigin ?? ''}</dd>
                            </div>
                            <div>
                                <dt className="text-apple-subtext">Admin allowlist slots</dt>
                                <dd className="font-medium text-apple-text">{s?.adminAllowlistSlots ?? ''}</dd>
                            </div>
                        </dl>
                    </Panel>
                </div>
            )}

            {/*  Activity  */}
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
                                first (anime id + episode).
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
                                        <th className="px-3 py-2">Anime</th>
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
                                            <tr key={`${row.userId}-${row.animeId}-${i}`} className="hover:bg-apple-bg/60">
                                                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-apple-subtext">
                                                    {row.updatedAt ? row.updatedAt.slice(0, 16).replace('T', ' ') : ''}
                                                </td>
                                                <td className="max-w-40 truncate px-3 py-2 font-mono text-[11px] text-apple-subtext">
                                                    {row.userId || ''}
                                                </td>
                                                <td className="px-3 py-2 font-mono text-[11px]">{row.animeId || ''}</td>
                                                <td className="px-3 py-2 tabular-nums">{row.lastEpisodeNumber ?? ''}</td>
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
                                    <article key={`${row.userId}-${row.animeId}-${i}`} className="rounded-xl border border-[var(--mx-color-f0f0f0)] bg-[var(--color-surface)] p-3">
                                        <p className="font-mono text-[11px] text-apple-subtext">
                                            {row.updatedAt ? row.updatedAt.slice(0, 16).replace('T', ' ') : ''}
                                        </p>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">User id</p>
                                                <p className="truncate font-mono text-apple-text">{row.userId || ''}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Anime</p>
                                                <p className="font-mono text-apple-text">{row.animeId || ''}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Episode</p>
                                                <p className="tabular-nums text-apple-text">{row.lastEpisodeNumber ?? ''}</p>
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
                                                    {row.updatedAt ? row.updatedAt.slice(0, 16).replace('T', ' ') : ''}
                                                </td>
                                                <td className="max-w-40 truncate px-3 py-2 font-mono text-[11px] text-apple-subtext">
                                                    {row.userId || ''}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px]">
                                                    {row.source || ''}
                                                </td>
                                                <td className="max-w-50 truncate px-3 py-2" title={row.title}>
                                                    {row.title || row.mangaId || ''}
                                                </td>
                                                <td className="max-w-25 truncate px-3 py-2 text-apple-subtext">
                                                    {row.lastChapterLabel || ''}
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
                                            {row.updatedAt ? row.updatedAt.slice(0, 16).replace('T', ' ') : ''}
                                        </p>
                                        <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">User id</p>
                                                <p className="truncate font-mono text-apple-text">{row.userId || ''}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Source</p>
                                                <p className="font-mono text-apple-text">{row.source || ''}</p>
                                            </div>
                                            <div className="col-span-2">
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Title</p>
                                                <p className="text-apple-text">{row.title || row.mangaId || ''}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Chapter</p>
                                                <p className="text-apple-text">{row.lastChapterLabel || ''}</p>
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

            {/*  Users  */}
            {tab === 'users' && (
                <div className="space-y-8">
                    <Panel>
                        <SectionIntro title="Registration lock">
                            When locked, new users cannot sign up or connect LifeSync from the Maxien frontend.
                            Existing users who are already signed in are unaffected — only the connect / sign-up flow is hidden.
                        </SectionIntro>
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-3">
                                {regLocked === null ? (
                                    <span className="text-[12px] text-apple-subtext">Loading…</span>
                                ) : (
                                    <>
                                        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-semibold ${
                                            regLocked
                                                ? 'bg-red-100 text-red-800'
                                                : 'bg-emerald-100 text-emerald-800'
                                        }`}>
                                            <span className={`h-1.5 w-1.5 rounded-full ${regLocked ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                            {regLocked ? 'Locked — new connections blocked' : 'Open — new connections allowed'}
                                        </span>
                                    </>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    disabled={regLockBusy || regLocked === null}
                                    onClick={() => toggleRegLock(true)}
                                    className={`rounded-xl px-4 py-2.5 text-[12px] font-semibold shadow-sm transition-colors disabled:opacity-50 ${
                                        regLocked
                                            ? 'bg-red-600 text-white ring-2 ring-red-600/30'
                                            : 'border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] text-apple-text hover:bg-apple-bg'
                                    }`}
                                >
                                    {regLockBusy && regLocked !== true ? 'Locking…' : 'Lock registrations'}
                                </button>
                                <button
                                    type="button"
                                    disabled={regLockBusy || regLocked === null}
                                    onClick={() => toggleRegLock(false)}
                                    className={`rounded-xl px-4 py-2.5 text-[12px] font-semibold shadow-sm transition-colors disabled:opacity-50 ${
                                        !regLocked && regLocked !== null
                                            ? 'bg-emerald-600 text-white ring-2 ring-emerald-600/30'
                                            : 'border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] text-apple-text hover:bg-apple-bg'
                                    }`}
                                >
                                    {regLockBusy && regLocked !== false ? 'Unlocking…' : 'Unlock registrations'}
                                </button>
                            </div>
                        </div>
                        {regLockError ? (
                            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                                {regLockError}
                            </p>
                        ) : null}
                        <p className="mt-4 text-[11px] leading-relaxed text-apple-subtext">
                            This setting is persisted server-side. The Maxien frontend reads it on load and hides the
                            LifeSync connect flow for any user who is not already signed in.
                        </p>
                    </Panel>

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
                                        className="w-full rounded-xl bg-primary px-4 py-2.5 text-[13px] font-semibold text-black disabled:opacity-50 sm:w-auto"
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
                                        <option value="steam">Steam</option>
                                        <option value="google">Google</option>
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
                                                <td className="px-3 py-2">{row.email || row.emailMasked || ''}</td>
                                                <td className="max-w-30 truncate px-3 py-2">{row.name || ''}</td>
                                                <td className="whitespace-nowrap px-3 py-2 font-mono text-[11px] text-apple-subtext">
                                                    {row.createdAt ? row.createdAt.slice(0, 10) : ''}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-wrap gap-1">
                                                        <LinkPill label="St" active={row.links?.steam} />
                                                        <LinkPill label="G" active={row.links?.google} />
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
                                                <p className="text-apple-text">{row.email || row.emailMasked || ''}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Name</p>
                                                <p className="truncate text-apple-text">{row.name || ''}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wide text-apple-subtext">Joined</p>
                                                <p className="font-mono text-apple-text">{row.createdAt ? row.createdAt.slice(0, 10) : ''}</p>
                                            </div>
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-1">
                                            <LinkPill label="St" active={row.links?.steam} />
                                            <LinkPill label="G" active={row.links?.google} />
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
                <dd className="mt-0.5">{user.email || user.emailMasked || ''}</dd>
            </div>
            <div>
                <dt className="text-apple-subtext">Name</dt>
                <dd className="mt-0.5">{user.name || ''}</dd>
            </div>
            <div>
                <dt className="text-apple-subtext">Created</dt>
                <dd className="mt-0.5 font-mono text-[11px]">{user.createdAt || ''}</dd>
            </div>
            <div className="sm:col-span-2">
                <dt className="text-apple-subtext">Integrations</dt>
                <dd className="mt-1 flex flex-wrap gap-1">
                    <LinkPill label="Steam" active={user.links?.steam} />
                    <LinkPill label="Google" active={user.links?.google} />
                </dd>
            </div>
        </dl>
    )
}
