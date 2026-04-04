import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useLifeSync } from '../context/LifeSyncContext'
import { isPluginEnabled, lifesyncFetch, lifesyncOAuthStartUrl } from '../lib/lifesyncApi'

const LifeSyncIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12a8 8 0 0113.657-5.657M20 12a8 8 0 01-13.657 5.657" />
        <path d="M8 5H4V1M16 19h4v4" />
    </svg>
)

function ConnectedView({ lifeSyncUser, prefs, busy, setBusy, error, setError, message, setMessage, togglePlugin, refreshLifeSyncMe }) {
    const [oauthMsg, setOauthMsg] = useState('')
    const [epicStatus, setEpicStatus] = useState(null)
    const [unlinkBusy, setUnlinkBusy] = useState('')

    const integrations = lifeSyncUser?.integrations || {}
    const steamLinked = Boolean(integrations.steam || integrations.steamId)
    const epicLinked = Boolean(integrations.epic)
    const malLinked = Boolean(integrations.mal || integrations.malUsername)

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
        lifesyncFetch('/api/epic/status')
            .then(data => { if (!cancelled) setEpicStatus(data) })
            .catch(() => { if (!cancelled) setEpicStatus(null) })
        return () => { cancelled = true }
    }, [])

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

            {/* OAuth Integrations */}
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
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
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
                                <button type="button" onClick={() => unlinkProvider('Steam', '/api/steam/link')} disabled={unlinkBusy === 'Steam'} className="text-[11px] font-semibold text-[#86868b] hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-[#e5e5ea] hover:border-red-100 transition-colors disabled:opacity-50">
                                    {unlinkBusy === 'Steam' ? 'Unlinking…' : 'Disconnect'}
                                </button>
                            ) : (
                                <a href={lifesyncOAuthStartUrl('steam') || '#'} className={`text-[11px] font-semibold text-white bg-[#1d1d1f] hover:bg-black px-3.5 py-1.5 rounded-lg transition-colors ${!lifesyncOAuthStartUrl('steam') ? 'opacity-50 pointer-events-none' : ''}`}>
                                    Link Steam
                                </a>
                            )}
                        </div>
                    </li>

                    {/* Epic Games */}
                    <li className="px-5 sm:px-6 py-4 hover:bg-[#fafafa] transition-colors">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-9 h-9 rounded-xl bg-[#2f2f2f] flex items-center justify-center flex-shrink-0">
                                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M3.537 0C2.165 0 1.66.506 1.66 1.879V18.44c0 .166.014.332.044.495l.038.16c.206.758.755 1.266 1.49 1.39l8.15 1.381a2.5 2.5 0 00.839 0l8.15-1.381c.735-.124 1.284-.632 1.49-1.39l.038-.16c.03-.163.044-.329.044-.495V1.879C21.943.506 21.438 0 20.066 0H3.537zM9.39 4.955c1.233 0 1.85.558 1.85 1.674v6.548c0 1.116-.617 1.674-1.85 1.674H7.136V4.955H9.39zm5.122 0c1.274 0 1.911.567 1.911 1.7v2.882h-1.75V6.804c0-.38-.19-.571-.57-.571h-.49v7.342h.49c.38 0 .57-.19.57-.571v-2.51h1.75v2.363c0 1.133-.637 1.7-1.912 1.7h-2.286V4.955h2.287zM8.885 6.233v6.34h.382c.38 0 .571-.19.571-.571V6.805c0-.38-.19-.571-.57-.571h-.383z" /></svg>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-[#1d1d1f]">Epic Games</p>
                                    {epicLinked ? (
                                        <p className="text-[11px] text-emerald-600 font-medium">Connected</p>
                                    ) : epicStatus?.epicOAuthConfigured === false ? (
                                        <p className="text-[11px] text-amber-600 font-medium">OAuth not configured on server</p>
                                    ) : (
                                        <p className="text-[11px] text-[#86868b]">Link to access your library and profile</p>
                                    )}
                                </div>
                            </div>
                            {epicLinked ? (
                                <button type="button" onClick={() => unlinkProvider('Epic', '/api/epic/link')} disabled={unlinkBusy === 'Epic'} className="text-[11px] font-semibold text-[#86868b] hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-[#e5e5ea] hover:border-red-100 transition-colors disabled:opacity-50">
                                    {unlinkBusy === 'Epic' ? 'Unlinking…' : 'Disconnect'}
                                </button>
                            ) : (
                                <a href={lifesyncOAuthStartUrl('epic') || '#'} className={`text-[11px] font-semibold text-white bg-[#1d1d1f] hover:bg-black px-3.5 py-1.5 rounded-lg transition-colors ${!lifesyncOAuthStartUrl('epic') || epicStatus?.epicOAuthConfigured === false ? 'opacity-50 pointer-events-none' : ''}`}>
                                    Connect Epic
                                </a>
                            )}
                        </div>
                        {epicStatus?.epicOAuthConfigured && epicStatus?.oauthRedirectUri && !epicLinked && (
                            <p className="mt-2 ml-12 text-[10px] text-[#86868b]">
                                Redirect URI: <code className="bg-[#f5f5f7] px-1.5 py-0.5 rounded text-[10px] text-[#1d1d1f] break-all">{epicStatus.oauthRedirectUri}</code>
                            </p>
                        )}
                    </li>

                    {/* MyAnimeList */}
                    <li className="px-5 sm:px-6 py-4 hover:bg-[#fafafa] transition-colors">
                        <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
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
                                <button type="button" onClick={() => unlinkProvider('MAL', '/api/anime/link')} disabled={unlinkBusy === 'MAL'} className="text-[11px] font-semibold text-[#86868b] hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 border border-[#e5e5ea] hover:border-red-100 transition-colors disabled:opacity-50">
                                    {unlinkBusy === 'MAL' ? 'Unlinking…' : 'Disconnect'}
                                </button>
                            ) : (
                                <a href={lifesyncOAuthStartUrl('mal') || '#'} className={`text-[11px] font-semibold text-white bg-[#2E51A2] hover:bg-[#24408a] px-3.5 py-1.5 rounded-lg transition-colors ${!lifesyncOAuthStartUrl('mal') ? 'opacity-50 pointer-events-none' : ''}`}>
                                    Connect MAL
                                </a>
                            )}
                        </div>
                    </li>
                </ul>
            </div>

            {/* Content plugins */}
            <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden">
                <div className="px-5 sm:px-6 pt-5 pb-4 border-b border-[#f0f0f0] flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-xl bg-[#C6FF00]/25 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-[#1d1d1f]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="text-[13px] font-bold text-[#1d1d1f]">Content plugins</h3>
                        <p className="text-[10px] text-[#86868b]">Anime, Manga, Hentai Ocean visibility</p>
                    </div>
                </div>
                <ul className="divide-y divide-[#f5f5f7]">
                    {[
                        { key: 'pluginAnimeEnabled', label: 'Anime' },
                        { key: 'pluginMangaEnabled', label: 'Manga' },
                        { key: 'pluginHentaiEnabled', label: 'Hentai Ocean' },
                    ].map(({ key, label }) => {
                        const on = isPluginEnabled(prefs, key)
                        return (
                            <li
                                key={key}
                                className="px-5 sm:px-6 py-3.5 flex items-center justify-between gap-3 hover:bg-[#fafafa] transition-colors"
                            >
                                <span className="text-[13px] font-semibold text-[#1d1d1f]">{label}</span>
                                <button
                                    type="button"
                                    disabled={busy}
                                    role="switch"
                                    aria-checked={on}
                                    onClick={() => togglePlugin(key, !on)}
                                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-[#C6FF00]' : 'bg-[#d2d2d7]'} disabled:opacity-50`}
                                >
                                    <span
                                        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? 'translate-x-5' : ''}`}
                                    />
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </div>
    )
}

export default function LifeSyncIntegration() {
    const { user: maxienUser } = useAuth()
    const {
        lifeSyncUser,
        lifeSyncLoading,
        lifeSyncEnsureAccount,
        lifeSyncLogout,
        lifeSyncUpdatePlugins,
        refreshLifeSyncMe,
    } = useLifeSync()

    const [linkPassword, setLinkPassword] = useState('')
    const [busy, setBusy] = useState(false)
    const [message, setMessage] = useState('')
    const [error, setError] = useState('')

    const prefs = lifeSyncUser?.preferences
    const connected = Boolean(lifeSyncUser)

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
            setTimeout(() => setMessage(''), 2500)
        } catch (err) {
            setError(err.message || 'Failed to update plugins')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="mb-5 sm:mb-6">
            {/* Connection card — matches GitHub integration row */}
            <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-4 sm:p-5 mb-5 sm:mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                        {connected ? (
                            <>
                                <button
                                    type="button"
                                    disabled={busy}
                                    onClick={() => refreshLifeSyncMe().catch(() => {})}
                                    className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                    Refresh profile
                                </button>
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
                        ) : null}
                    </div>
                </div>
            </div>

            {lifeSyncLoading && !connected ? (
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-16 flex flex-col items-center gap-3 mb-5 sm:mb-6">
                    <div className="flex gap-1.5">
                        {[0, 150, 300].map((d) => (
                            <span
                                key={d}
                                className="w-2.5 h-2.5 rounded-full bg-[#C6FF00] animate-bounce"
                                style={{ animationDelay: `${d}ms` }}
                            />
                        ))}
                    </div>
                    <p className="text-[13px] font-medium text-[#86868b]">Checking LifeSync session…</p>
                </div>
            ) : !connected ? (
                <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm px-6 py-16 flex flex-col items-center gap-4 text-center mb-5 sm:mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-[#f5f5f7] flex items-center justify-center">
                        <LifeSyncIcon className="w-9 h-9 text-[#1d1d1f]" />
                    </div>
                    <div>
                        <p className="text-[15px] font-bold text-[#1d1d1f]">Link LifeSync</p>
                        <p className="text-[12px] text-[#86868b] mt-1 max-w-md mx-auto leading-relaxed">
                            Use the same email as Maxien (
                            <span className="font-mono text-[11px] text-[#1d1d1f]">{maxienUser?.email || '—'}</span>
                            ). Email/password sign-in usually links automatically; otherwise enter your password here. A new LifeSync account is created if one does not exist.
                        </p>
                    </div>

                    {error && (
                        <div className="w-full max-w-md bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100 text-left">
                            {error}
                        </div>
                    )}
                    {message && (
                        <div className="w-full max-w-md bg-green-50 text-green-700 text-[12px] font-medium px-4 py-3 rounded-xl border border-green-100 text-left">
                            {message}
                        </div>
                    )}

                    <form
                        onSubmit={handleLinkWithPassword}
                        className="w-full max-w-md flex flex-col sm:flex-row gap-3 items-stretch sm:items-end"
                    >
                        <div className="flex-1 min-w-0 text-left">
                            <label className="block text-[11px] font-semibold text-[#1d1d1f] mb-1.5 uppercase tracking-wide">
                                Password
                            </label>
                            <input
                                type="password"
                                required
                                value={linkPassword}
                                onChange={(e) => setLinkPassword(e.target.value)}
                                className="w-full px-4 py-3 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all"
                                autoComplete="current-password"
                                placeholder="Your LifeSync password"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={busy || !maxienUser?.email}
                            className="flex items-center justify-center gap-2 bg-[#1d1d1f] hover:bg-black text-white text-[13px] font-semibold px-5 py-3 rounded-xl transition-all shadow-sm active:scale-[0.98] disabled:opacity-50 whitespace-nowrap sm:mb-0"
                        >
                            <LifeSyncIcon className="w-4 h-4 text-white" />
                            {busy ? 'Linking…' : 'Link LifeSync'}
                        </button>
                    </form>
                </div>
            ) : (
                <ConnectedView
                    lifeSyncUser={lifeSyncUser}
                    prefs={prefs}
                    busy={busy}
                    setBusy={setBusy}
                    error={error}
                    setError={setError}
                    message={message}
                    setMessage={setMessage}
                    togglePlugin={togglePlugin}
                    refreshLifeSyncMe={refreshLifeSyncMe}
                />
            )}
        </div>
    )
}
