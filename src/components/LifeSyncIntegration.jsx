import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLifeSync } from '../context/LifeSyncContext'
import useTimeoutRegistry from '../hooks/useTimeoutRegistry'
import {
    ANIPUB_API_REFERENCE_URL,
    isPluginEnabled,
    lifesyncFetch,
    lifesyncOAuthStartUrl,
} from '../lib/lifesyncApi'

function extractOpenXblPeople(payload) {
    if (!payload || typeof payload !== 'object') return []
    const raw = payload.content?.people ?? payload.people
    return Array.isArray(raw) ? raw : []
}

function pickPersonDisplayName(person) {
    if (!person || typeof person !== 'object') return 'Player'
    return (
        person.uniqueModernGamertag ||
        [person.modernGamertag, person.modernGamertagSuffix].filter(Boolean).join('') ||
        person.gamertag ||
        'Player'
    )
}

function pickBestGamertagMatch(people, query) {
    if (!Array.isArray(people) || people.length === 0) return null
    const q = String(query || '').trim().toLowerCase()
    if (!q) return people[0]
    return (
        people.find((p) => {
            const values = [
                p?.uniqueModernGamertag,
                p?.gamertag,
                p?.modernGamertag,
                [p?.modernGamertag, p?.modernGamertagSuffix].filter(Boolean).join(''),
            ].filter(Boolean)
            return values.some((v) => String(v).trim().toLowerCase() === q)
        }) || people[0]
    )
}

function readXboxLinkError(e, fallback) {
    if (e?.body && typeof e.body === 'object' && e.body.error) return String(e.body.error)
    return e?.message || fallback
}

const LifeSyncIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12a8 8 0 0113.657-5.657M20 12a8 8 0 01-13.657 5.657" />
        <path d="M8 5H4V1M16 19h4v4" />
    </svg>
)

function ConnectedView({ lifeSyncUser, prefs, busy, error, setError, message, setMessage, togglePlugin, refreshLifeSyncMe, updatePreferences }) {
    const [oauthMsg, setOauthMsg] = useState('')
    const [mangadexStatus, setMangadexStatus] = useState(null)
    const [mangadexUser, setMangadexUser] = useState('')
    const [mangadexPassword, setMangadexPassword] = useState('')
    const [mangadexBusy, setMangadexBusy] = useState(false)
    const [unlinkBusy, setUnlinkBusy] = useState('')
    const [xboxOpenXbl, setXboxOpenXbl] = useState(null)
    const [xboxGamertagInput, setXboxGamertagInput] = useState('')
    const [xboxBusy, setXboxBusy] = useState(false)

    const integrations = lifeSyncUser?.integrations || {}
    const steamLinked = Boolean(integrations.steam || integrations.steamId)
    const malLinked = Boolean(integrations.mal || integrations.malUsername)
    const animeScheduleLinked = Boolean(integrations.animeschedule || integrations.animescheduleUsername)

    useEffect(() => {
        try {
            const raw = sessionStorage.getItem('maxien_lifesync_oauth')
            if (raw) {
                sessionStorage.removeItem('maxien_lifesync_oauth')
                const { type, text } = JSON.parse(raw)
                if (type === 'success') setMessage(text)
                else if (type === 'error') setError(text)
                else setOauthMsg(text)
                refreshLifeSyncMe().catch(() => {})
            }
        } catch { /* ignore */ }
    }, [setMessage, setError, refreshLifeSyncMe])

    useEffect(() => {
        let cancelled = false
        lifesyncFetch('/api/v1/manga/mangadex/auth/status?view=compact')
            .then(data => { if (!cancelled) setMangadexStatus(data) })
            .catch(() => { if (!cancelled) setMangadexStatus(null) })
        return () => { cancelled = true }
    }, [])

    useEffect(() => {
        let cancelled = false
        lifesyncFetch('/api/v1/xbox/openxbl/status?view=compact')
            .then(data => { if (!cancelled) setXboxOpenXbl(data || null) })
            .catch(() => { if (!cancelled) setXboxOpenXbl(null) })
        return () => { cancelled = true }
    }, [])

    useEffect(() => {
        setXboxGamertagInput(prefs?.xboxGamertag || '')
    }, [prefs?.xboxGamertag])

    async function linkMangaDex(e) {
        e.preventDefault()
        const u = mangadexUser.trim()
        const p = mangadexPassword
        if (!u || !p) {
            setError('Enter your MangaDex username and password.')
            return
        }
        setMangadexBusy(true)
        setError('')
        setMessage('')
        try {
            await lifesyncFetch('/api/v1/manga/mangadex/auth', { method: 'POST', json: { username: u, password: p } })
            setMangadexPassword('')
            setMessage(
                'MangaDex linked. Your MangaDex reading list is importing in the background — open Manga and refresh the reading shelf if titles do not appear right away.'
            )
            const st = await lifesyncFetch('/api/v1/manga/mangadex/auth/status?view=compact')
            setMangadexStatus(st)
        } catch (err) {
            setError(err.message || 'MangaDex login failed')
        } finally {
            setMangadexBusy(false)
        }
    }

    async function unlinkMangaDex() {
        setUnlinkBusy('MangaDex')
        setError('')
        try {
            await lifesyncFetch('/api/v1/manga/mangadex/auth', { method: 'DELETE' })
            setMessage('MangaDex disconnected.')
            setMangadexStatus(s => (s ? { ...s, connected: false, username: null } : s))
            const st = await lifesyncFetch('/api/v1/manga/mangadex/auth/status?view=compact').catch(() => null)
            if (st) setMangadexStatus(st)
        } catch (err) {
            setError(err.message || 'Could not disconnect MangaDex')
        } finally {
            setUnlinkBusy('')
        }
    }

    async function unlinkProvider(provider, apiPath) {
        setUnlinkBusy(provider)
        setError('')
        try {
            await lifesyncFetch(apiPath, { method: 'DELETE' })
            setMessage(`${provider} disconnected.`)
            await refreshLifeSyncMe()
        } catch (e) {
            setError(e.message || `Could not disconnect ${provider}`)
        } finally {
            setUnlinkBusy('')
        }
    }

    const xboxLinked = Boolean(String(prefs?.xboxGamertag || '').trim())
    const xboxOpenXblReady = Boolean(xboxOpenXbl?.configured)

    async function linkXboxGamertag(e) {
        e?.preventDefault?.()
        const gt = xboxGamertagInput.trim()
        if (!gt) {
            setError('Enter a gamertag first.')
            setMessage('')
            return
        }
        if (!xboxOpenXblReady) {
            setError('OpenXBL is not configured on the server (XBLIO_API_KEY).')
            setMessage('')
            return
        }
        setXboxBusy(true)
        setError('')
        setMessage('')
        try {
            const data = await lifesyncFetch(`/api/v1/xbox/openxbl/proxy/search/${encodeURIComponent(gt)}?view=standard`)
            const people = extractOpenXblPeople(data)
            const codeOk = data?.code === undefined || data?.code === 200
            if (!codeOk) {
                throw new Error(`OpenXBL returned code ${data.code}`)
            }
            const person = pickBestGamertagMatch(people, gt)
            if (!person) {
                throw new Error('No matching player profile was returned for that gamertag')
            }
            await lifesyncFetch('/api/v1/xbox/openxbl/saved', {
                method: 'POST',
                json: { response: { code: 200, content: { people: [person] } } },
            })
            await updatePreferences({ xboxGamertag: gt })
            setMessage(`Xbox linked as ${pickPersonDisplayName(person)}.`)
        } catch (err) {
            setError(readXboxLinkError(err, 'Could not link that gamertag'))
        } finally {
            setXboxBusy(false)
        }
    }

    async function unlinkXboxGamertag() {
        setXboxBusy(true)
        setError('')
        setMessage('')
        try {
            await updatePreferences({ xboxGamertag: '' })
            setXboxGamertagInput('')
            setMessage('Xbox gamertag removed.')
        } catch (err) {
            setError(readXboxLinkError(err, 'Could not remove Xbox gamertag'))
        } finally {
            setXboxBusy(false)
        }
    }

    return (
        <div className="space-y-5 sm:space-y-6">
            {error && (
                <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">
                    {error}
                </div>
            )}
            {message && (
                <div className="bg-green-50 text-green-700 text-[12px] font-medium px-4 py-3 rounded-xl border border-green-100">
                    {message}
                </div>
            )}
            {oauthMsg && (
                <div className="bg-blue-50 text-blue-700 text-[12px] font-medium px-4 py-3 rounded-xl border border-blue-100">
                    {oauthMsg}
                </div>
            )}

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-stretch lg:gap-5">
                {/* Service connections */}
                <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden">
                    <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#f0f0f0] flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-[#C6FF00]/25 flex items-center justify-center flex-shrink-0">
                            <svg className="w-3.5 h-3.5 text-[#1d1d1f]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-[13px] font-bold text-[#1d1d1f]">Service connections</h3>
                            <p className="text-[10px] text-[#86868b]">Link third-party accounts to unlock features</p>
                        </div>
                    </div>
                    <ul className="divide-y divide-[#f5f5f7]">
                    {/* Steam */}
                    <li className="px-5 sm:px-6 py-4 hover:bg-[#fafafa] transition-colors">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#171a21] flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M11.979 0C5.678 0 .511 4.86.022 10.95l6.432 2.658a3.387 3.387 0 011.912-.588c.064 0 .126.002.189.005l2.861-4.142V8.83a4.524 4.524 0 014.519-4.519 4.524 4.524 0 014.519 4.519 4.524 4.524 0 01-4.519 4.519h-.105l-4.076 2.911c0 .052.004.105.004.159a3.393 3.393 0 01-3.39 3.39 3.403 3.403 0 01-3.35-2.858L.453 15.16A11.98 11.98 0 0011.979 24c6.627 0 12-5.373 12-12S18.605 0 11.979 0z" /></svg>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-[#1d1d1f]">Steam</p>
                                    {steamLinked ? (
                                        <p className="text-[11px] text-emerald-600 font-medium">Connected</p>
                                    ) : (
                                        <p className="text-[11px] text-[#86868b]">Link via OpenID to sync your library</p>
                                    )}
                                </div>
                            </div>
                            {steamLinked ? (
                                <span className="w-fit shrink-0 text-[11px] font-semibold text-[#86868b] px-3 py-1.5 rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] sm:ml-auto">
                                    Connected
                                </span>
                            ) : (
                                <a href={lifesyncOAuthStartUrl('steam') || '#'} className={`w-fit shrink-0 text-[11px] font-semibold text-white bg-[#1d1d1f] hover:bg-black px-3.5 py-1.5 rounded-lg transition-colors sm:ml-auto ${!lifesyncOAuthStartUrl('steam') ? 'opacity-50 pointer-events-none' : ''}`}>
                                    Link Steam
                                </a>
                            )}
                        </div>
                    </li>

                    {/* MyAnimeList */}
                    <li className="px-5 sm:px-6 py-4 hover:bg-[#fafafa] transition-colors">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#2E51A2] flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-[11px] font-black leading-none">MAL</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-[#1d1d1f]">MyAnimeList</p>
                                    {malLinked ? (
                                        <p className="text-[11px] text-emerald-600 font-medium">
                                            Connected{integrations.malUsername ? ` as ${integrations.malUsername}` : ''}
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-[#86868b]">Link to sync your anime/manga lists</p>
                                    )}
                                </div>
                            </div>
                            {malLinked ? (
                                <button type="button" onClick={() => unlinkProvider('MAL', '/api/v1/anime/link')} disabled={unlinkBusy === 'MAL'} className="w-fit shrink-0 text-[11px] font-semibold text-[#86868b] hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-[#e5e5ea] hover:border-red-100 transition-colors disabled:opacity-50 sm:ml-auto">
                                    {unlinkBusy === 'MAL' ? 'Unlinking…' : 'Disconnect'}
                                </button>
                            ) : (
                                <a href={lifesyncOAuthStartUrl('mal') || '#'} className={`w-fit shrink-0 text-[11px] font-semibold text-white bg-[#2E51A2] hover:bg-[#24408a] px-3.5 py-1.5 rounded-lg transition-colors sm:ml-auto ${!lifesyncOAuthStartUrl('mal') ? 'opacity-50 pointer-events-none' : ''}`}>
                                    Connect MAL
                                </a>
                            )}
                        </div>
                    </li>

                    {/* AnimeSchedule */}
                    <li className="px-5 sm:px-6 py-4 hover:bg-[#fafafa] transition-colors">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                            <div className="flex min-w-0 items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#0f172a] flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-[9px] font-black leading-none">ASN</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-[#1d1d1f]">AnimeSchedule</p>
                                    {animeScheduleLinked ? (
                                        <p className="text-[11px] text-emerald-600 font-medium">
                                            Connected{integrations.animescheduleUsername ? ` as ${integrations.animescheduleUsername}` : ''}
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-[#86868b]">Optional: link to access your AnimeSchedule lists</p>
                                    )}
                                </div>
                            </div>
                            {animeScheduleLinked ? (
                                <span className="w-fit shrink-0 text-[11px] font-semibold text-[#86868b] px-3 py-1.5 rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] sm:ml-auto">
                                    Connected
                                </span>
                            ) : (
                                <a
                                    href={lifesyncOAuthStartUrl('animeschedule') || '#'}
                                    className={`w-fit shrink-0 text-[11px] font-semibold text-white bg-[#0f172a] hover:bg-black px-3.5 py-1.5 rounded-lg transition-colors sm:ml-auto ${!lifesyncOAuthStartUrl('animeschedule') ? 'opacity-50 pointer-events-none' : ''}`}
                                >
                                    Connect AnimeSchedule
                                </a>
                            )}
                        </div>
                    </li>

                    {/* MangaDex (password grant via server personal client) */}
                    <li className="px-5 sm:px-6 py-4 hover:bg-[#fafafa] transition-colors">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
                            <div className="flex min-w-0 items-start gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#FF6740] flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-[10px] font-black leading-none">MD</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-[#1d1d1f]">MangaDex</p>
                                    {mangadexStatus == null ? (
                                        <p className="text-[11px] text-[#86868b]">Checking server…</p>
                                    ) : mangadexStatus.oauthConfigured === false ? (
                                        <p className="text-[11px] text-amber-600 font-medium">Personal client not configured on server</p>
                                    ) : mangadexStatus?.connected ? (
                                        <p className="text-[11px] text-emerald-600 font-medium">
                                            Linked{mangadexStatus.username ? ` as ${mangadexStatus.username}` : ''}
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-[#86868b]">
                                            Optional: link to sync follows, follow/unfollow from the app, and push chapter read state to your MangaDex account.
                                        </p>
                                    )}
                                </div>
                            </div>
                            {mangadexStatus == null ? null : mangadexStatus.oauthConfigured === false ? null : mangadexStatus.connected ? (
                                <button
                                    type="button"
                                    onClick={() => void unlinkMangaDex()}
                                    disabled={unlinkBusy === 'MangaDex'}
                                    className="w-fit shrink-0 text-[11px] font-semibold text-[#86868b] hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-[#e5e5ea] hover:border-red-100 transition-colors disabled:opacity-50 md:ml-auto"
                                >
                                    {unlinkBusy === 'MangaDex' ? 'Disconnecting…' : 'Disconnect'}
                                </button>
                            ) : (
                                <form onSubmit={linkMangaDex} className="flex w-full max-w-full shrink-0 flex-col gap-2 md:max-w-[260px]">
                                    <input
                                        type="text"
                                        autoComplete="username"
                                        value={mangadexUser}
                                        onChange={(e) => setMangadexUser(e.target.value)}
                                        placeholder="MangaDex username"
                                        className="w-full px-3 py-2 bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg text-[12px] text-[#1d1d1f] focus:outline-none focus:border-[#C6FF00]/60"
                                    />
                                    <input
                                        type="password"
                                        autoComplete="current-password"
                                        value={mangadexPassword}
                                        onChange={(e) => setMangadexPassword(e.target.value)}
                                        placeholder="Password"
                                        className="w-full px-3 py-2 bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg text-[12px] text-[#1d1d1f] focus:outline-none focus:border-[#C6FF00]/60"
                                    />
                                    <button
                                        type="submit"
                                        disabled={mangadexBusy}
                                        className="text-[11px] font-semibold text-white bg-[#FF6740] hover:bg-[#e55a36] px-3.5 py-2 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {mangadexBusy ? 'Linking…' : 'Link MangaDex'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </li>

                    {/* Xbox (gamertag via OpenXBL — same as main app Settings) */}
                    <li className="px-5 sm:px-6 py-4 hover:bg-[#fafafa] transition-colors">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
                            <div className="flex min-w-0 items-start gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#107C10] flex items-center justify-center flex-shrink-0">
                                    <span className="text-white text-[9px] font-black leading-tight text-center px-0.5">XBOX</span>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-[#1d1d1f]">Xbox</p>
                                    {xboxOpenXbl == null ? (
                                        <p className="text-[11px] text-[#86868b]">Checking server…</p>
                                    ) : !xboxOpenXblReady ? (
                                        <p className="text-[11px] text-amber-600 font-medium">OpenXBL not configured (add XBLIO_API_KEY)</p>
                                    ) : xboxLinked ? (
                                        <p className="text-[11px] text-emerald-600 font-medium">
                                            Linked as <span className="font-semibold">{String(prefs?.xboxGamertag || '').trim()}</span>
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-[#86868b]">
                                            Link your gamertag for the LifeSync Xbox hub (library, Game Pass, achievements).{' '}
                                            <Link to="/dashboard/lifesync/games/xbox" className="text-[#107C10] font-semibold hover:underline">
                                                Open Xbox hub
                                            </Link>
                                        </p>
                                    )}
                                </div>
                            </div>
                            {xboxOpenXbl == null ? null : xboxLinked ? (
                                <button
                                    type="button"
                                    onClick={() => void unlinkXboxGamertag()}
                                    disabled={xboxBusy || busy}
                                    className="w-fit shrink-0 text-[11px] font-semibold text-[#86868b] hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-[#e5e5ea] hover:border-red-100 transition-colors disabled:opacity-50 md:ml-auto"
                                >
                                    {xboxBusy ? 'Removing…' : 'Disconnect'}
                                </button>
                            ) : (
                                <form onSubmit={linkXboxGamertag} className="flex w-full max-w-full shrink-0 flex-col gap-2 md:max-w-[280px]">
                                    <input
                                        type="text"
                                        autoComplete="off"
                                        value={xboxGamertagInput}
                                        onChange={(e) => setXboxGamertagInput(e.target.value)}
                                        placeholder="Xbox gamertag"
                                        disabled={!xboxOpenXblReady || xboxBusy || busy}
                                        className="w-full px-3 py-2 bg-[#f5f5f7] border border-[#e5e5ea] rounded-lg text-[12px] text-[#1d1d1f] focus:outline-none focus:border-[#107C10]/50 disabled:opacity-50"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!xboxOpenXblReady || xboxBusy || busy || !xboxGamertagInput.trim()}
                                        className="text-[11px] font-semibold text-white bg-[#107C10] hover:bg-[#0e6b0e] px-3.5 py-2 rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        {xboxBusy ? 'Linking…' : 'Link gamertag'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </li>
                </ul>
                </div>

                {/* Content plugins */}
                <div className="flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#d2d2d7]/50 bg-white shadow-sm sm:rounded-[24px]">
                    <div className="flex items-center gap-2.5 border-b border-[#f0f0f0] px-5 pb-4 pt-5 sm:px-6">
                        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-xl bg-[#C6FF00]/25">
                            <svg className="h-3.5 w-3.5 text-[#1d1d1f]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                            </svg>
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-[13px] font-bold text-[#1d1d1f]">Content plugins</h3>
                            <p className="text-[10px] text-[#86868b]">
                                {prefs?.nsfwContentEnabled
                                    ? 'Anime, Manga, Hentai Ocean visibility'
                                    : 'Anime & Manga visibility'}
                            </p>
                        </div>
                    </div>
                    <ul className="divide-y divide-[#f5f5f7]">
                        {[
                            { key: 'pluginAnimeEnabled', label: 'Anime', desc: 'LifeSync Anime hub, rankings, and in-app playback.' },
                            { key: 'pluginMangaEnabled', label: 'Manga', desc: 'LifeSync Manga hub and reading list features.' },
                            ...(prefs?.nsfwContentEnabled
                                ? [{ key: 'pluginHentaiEnabled', label: 'Hentai Ocean', desc: 'Adult catalog areas (requires NSFW content enabled).' }]
                                : []),
                        ].map(({ key, label }) => {
                            const on = isPluginEnabled(prefs, key)
                            const desc =
                                key === 'pluginAnimeEnabled'
                                    ? 'LifeSync Anime hub, rankings, and in-app playback.'
                                    : key === 'pluginMangaEnabled'
                                      ? 'LifeSync Manga hub and reading list features.'
                                      : 'Adult catalog areas (requires NSFW content enabled).'
                            return (
                                <li key={key}>
                                    <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                                        <div className="min-w-0">
                                            <p className="text-[13px] font-semibold text-[#1d1d1f]">{label}</p>
                                            <p className="mt-0.5 text-[11px] leading-relaxed text-[#86868b]">
                                                {desc}
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            disabled={busy}
                                            role="switch"
                                            aria-checked={on}
                                            onClick={() => togglePlugin(key, !on)}
                                            className={`relative h-6 w-11 flex-shrink-0 self-end rounded-full transition-colors sm:self-auto ${on ? 'bg-[#C6FF00]' : 'bg-[#d2d2d7]'} disabled:opacity-50`}
                                        >
                                            <span
                                                className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`}
                                            />
                                        </button>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                </div>
            </div>
        </div>
    )
}

export default function LifeSyncIntegration({ embedded = false }) {
    const { user: maxienUser, session } = useAuth()
    const {
        lifeSyncUser,
        lifeSyncLoading,
        lifeSyncEnsureAccount,
        lifeSyncConnectWithSupabase,
        lifeSyncLogout,
        lifeSyncUpdatePlugins,
        lifeSyncUpdatePreferences,
        refreshLifeSyncMe,
    } = useLifeSync()

    const [linkPassword, setLinkPassword] = useState('')
    const [connectExpanded, setConnectExpanded] = useState(false)
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')
    const { registerTimeout } = useTimeoutRegistry()

    const prefs = lifeSyncUser?.preferences
    const connected = Boolean(lifeSyncUser)

    const handleConnectAuto = async () => {
        setError('')
        setMessage('')
        setBusy(true)
        try {
            await lifeSyncConnectWithSupabase()
            setConnectExpanded(false)
        } catch (err) {
            if (err.status === 503) {
                setConnectExpanded(true)
                setError(
                    err.message ||
                        'Passwordless linking is not configured on the server. Set SUPABASE_JWT_SECRET on the API, or link with a password below.'
                )
            } else {
                setError(err.message || 'Could not connect LifeSync')
            }
        } finally {
            setBusy(false)
        }
    }

    const handleLinkWithPassword = async (e) => {
        e.preventDefault()
        const email = maxienUser?.email
        if (!email) {
            setError('No email on your Maxien account.')
            return
        }
        setError('')
        setMessage('')
        setBusy(true)
        try {
            const meta = maxienUser?.user_metadata || {}
            const name =
                meta.full_name || meta.display_name || meta.name || ''
            const { created } = await lifeSyncEnsureAccount(email, linkPassword, name)
            setLinkPassword('')
            setMessage(
                created
                    ? 'LifeSync account created and linked.'
                    : 'LifeSync linked successfully.'
            )
        } catch (err) {
            setError(err.message || 'Could not link LifeSync')
        } finally {
            setBusy(false)
        }
    }

    const togglePlugin = async (key, next) => {
        setError('')
        setBusy(true)
        try {
            await lifeSyncUpdatePlugins({ [key]: next })
            setMessage('Plugin settings saved.')
            registerTimeout(() => setMessage(''), 2500)
        } catch (err) {
            setError(err.message || 'Failed to update plugins')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className={embedded ? "" : "mb-5 sm:mb-6"}>
            {/* Connection card — matches GitHub integration row */}
            <div className={`rounded-[20px] border border-[#d2d2d7]/50 bg-white p-4 shadow-sm sm:rounded-[24px] sm:p-5 ${embedded ? "mb-5" : "mb-5 sm:mb-6"}`}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-center gap-3.5 flex-1 min-w-0">
                        <div className="w-11 h-11 rounded-2xl bg-[#1d1d1f] flex items-center justify-center flex-shrink-0 shadow-sm">
                            <LifeSyncIcon className="w-[22px] h-[22px] text-white" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[14px] font-bold text-[#1d1d1f]">LifeSync</span>
                                {connected && (
                                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
                                        Connected
                                    </span>
                                )}
                            </div>
                            {connected ? (
                                <p className="text-[12px] text-[#86868b] mt-0.5 truncate">
                                    Signed in as{' '}
                                    <span className="font-semibold text-[#1d1d1f]">{lifeSyncUser.email}</span>
                                </p>
                            ) : (
                                <p className="text-[12px] text-[#86868b] mt-0.5">
                                    Link plugins and your LifeSync backend session
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                        {connected ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        lifeSyncLogout()
                                        setMessage('')
                                        setError('')
                                    }}
                                    className="text-[12px] font-semibold text-[#86868b] hover:text-red-500 transition-colors px-3 py-2 rounded-xl hover:bg-red-50 border border-[#e5e5ea] hover:border-red-100 whitespace-nowrap"
                                >
                                    Disconnect
                                </button>
                            </>
                        ) : (
                            <div className="flex flex-wrap items-center gap-2 justify-end">
                                <button
                                    type="button"
                                    disabled={
                                        lifeSyncLoading ||
                                        busy ||
                                        !maxienUser?.email ||
                                        !session?.access_token
                                    }
                                    onClick={handleConnectAuto}
                                    className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] whitespace-nowrap disabled:opacity-50"
                                >
                                    {busy ? 'Connecting…' : 'Connect'}
                                </button>
                                <button
                                    type="button"
                                    disabled={lifeSyncLoading || busy || !maxienUser?.email}
                                    onClick={() => {
                                        setError('')
                                        setMessage('')
                                        setConnectExpanded((v) => !v)
                                    }}
                                    className="text-[12px] font-semibold text-[#86868b] hover:text-[#1d1d1f] px-2 py-2 rounded-xl whitespace-nowrap disabled:opacity-50"
                                >
                                    {connectExpanded ? 'Hide password' : 'Use password'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Expandable connect panel (matches GitHub card layout) */}
                {!connected && (
                    <div
                        className="grid overflow-hidden transition-[grid-template-rows,opacity,transform] duration-300 ease-out"
                        style={{
                            gridTemplateRows: connectExpanded ? '1fr' : '0fr',
                            opacity: connectExpanded ? 1 : 0,
                            transform: connectExpanded ? 'translateY(0px)' : 'translateY(-4px)',
                        }}
                        aria-hidden={!connectExpanded}
                    >
                        <div className="min-h-0">
                            <div className="mt-4 rounded-2xl border border-[#f0f0f0] bg-[#fafafa] p-4 sm:p-5">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-semibold text-[#1d1d1f]">Connect LifeSync</p>
                                        <p className="mt-1 text-[12px] text-[#86868b] leading-relaxed">
                                            <span className="font-mono text-[11px] text-[#1d1d1f]">
                                                {maxienUser?.email || '—'}
                                            </span>
                                            <span className="block mt-2 text-[11px] leading-relaxed">
                                                Prefer <strong className="font-semibold">Connect</strong> — it signs
                                                you in with your Maxien session (or creates a LifeSync user if needed).
                                                Use a password here only if the server is not configured for
                                                passwordless linking or you want a separate LifeSync password.
                                            </span>
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setConnectExpanded(false)
                                            setError('')
                                            setMessage('')
                                        }}
                                        className="shrink-0 text-[11px] font-semibold text-[#86868b] hover:text-[#1d1d1f] px-2 py-1 rounded-lg hover:bg-white/70 border border-transparent"
                                    >
                                        Close
                                    </button>
                                </div>

                                {lifeSyncLoading ? (
                                    <div className="mt-3 flex items-center gap-2 text-[12px] text-[#86868b]">
                                        <span className="w-2 h-2 rounded-full bg-[#C6FF00] animate-pulse" />
                                        Checking LifeSync session…
                                    </div>
                                ) : (
                                    <>
                                        {error && (
                                            <div className="mt-3 bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">
                                                {error}
                                            </div>
                                        )}
                                        {message && (
                                            <div className="mt-3 bg-green-50 text-green-700 text-[12px] font-medium px-4 py-3 rounded-xl border border-green-100">
                                                {message}
                                            </div>
                                        )}

                                        <div className="mt-4">
                                            <button
                                                type="button"
                                                disabled={
                                                    lifeSyncLoading ||
                                                    busy ||
                                                    !maxienUser?.email ||
                                                    !session?.access_token
                                                }
                                                onClick={handleConnectAuto}
                                                className="w-full sm:w-auto text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-4 py-2.5 rounded-xl border border-[#e5e5ea] disabled:opacity-50"
                                            >
                                                {busy ? 'Connecting…' : 'Try Connect (automatic)'}
                                            </button>
                                        </div>

                                        <form onSubmit={handleLinkWithPassword} className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                                            <div className="min-w-0">
                                                <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wide">
                                                    Password
                                                </label>
                                                <input
                                                    type="password"
                                                    required
                                                    value={linkPassword}
                                                    onChange={(e) => setLinkPassword(e.target.value)}
                                                    className="w-full px-4 py-3 bg-white border border-[#e5e5ea] focus:border-[#C6FF00]/60 rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all"
                                                    autoComplete="current-password"
                                                    placeholder="Your LifeSync password"
                                                />
                                                <p className="mt-1 text-[11px] text-[#86868b]">
                                                    If you don’t have an account yet, one will be created automatically.
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setConnectExpanded(false)
                                                        setError('')
                                                        setMessage('')
                                                    }}
                                                    className="flex-1 sm:flex-none text-[12px] font-semibold text-[#1d1d1f] bg-white hover:bg-[#f5f5f7] px-4 py-3 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50 whitespace-nowrap"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={busy || !maxienUser?.email}
                                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#1d1d1f] hover:bg-black text-white text-[13px] font-semibold px-5 py-3 rounded-xl transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 whitespace-nowrap"
                                                >
                                                    <LifeSyncIcon className="w-4 h-4 text-white" />
                                                    {busy ? 'Linking…' : 'Link LifeSync'}
                                                </button>
                                            </div>
                                        </form>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {connected ? (
                <ConnectedView
                    lifeSyncUser={lifeSyncUser}
                    prefs={prefs}
                    busy={busy}
                    error={error}
                    setError={setError}
                    message={message}
                    setMessage={setMessage}
                    togglePlugin={togglePlugin}
                    refreshLifeSyncMe={refreshLifeSyncMe}
                    updatePreferences={lifeSyncUpdatePreferences}
                />
            ) : null}
        </div>
    )
}
