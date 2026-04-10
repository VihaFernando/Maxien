import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LifesyncTextLinesSkeleton } from '../../components/lifesync/EpisodeLoadingSkeletons'
import { useLifeSync } from '../../context/LifeSyncContext'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { lifeSyncPageTransition, MotionDiv } from '../../lib/lifesyncMotion'

const OAUTH_MESSAGES = {
    steam_ok: { type: 'success', text: 'Steam linked successfully!', redirect: '/dashboard/lifesync/games/steam' },
    steam_error: { type: 'error', text: 'Steam OAuth failed. Check server configuration and try again.', redirect: '/dashboard/lifesync/games/steam' },
    mal_ok: { type: 'success', text: 'MyAnimeList linked successfully!', redirect: '/dashboard/lifesync/anime/anime' },
    mal_error: { type: 'error', text: 'MyAnimeList OAuth failed. Make sure MAL_CLIENT_ID is configured.', redirect: '/dashboard/lifesync/anime/anime' },
    animeschedule_ok: { type: 'success', text: 'AnimeSchedule linked successfully!', redirect: '/dashboard/profile?tab=integrations' },
    animeschedule_error: { type: 'error', text: 'AnimeSchedule OAuth failed. Make sure ANIMESCHEDULE_CLIENT_ID is configured.', redirect: '/dashboard/profile?tab=integrations' },
    invalid_state: { type: 'error', text: 'OAuth state was rejected (expired link or JWT_SECRET changed). Try connecting again.', redirect: '/dashboard/profile?tab=integrations' },
}

export default function LifeSyncOAuthCallback() {
    const navigate = useNavigate()
    const [params] = useSearchParams()
    const { refreshLifeSyncMe } = useLifeSync()
    const [status, setStatus] = useState('Processing OAuth callback...')

    const oauthResult = useMemo(() => params.get('oauth'), [params])

    useEffect(() => {
        if (!oauthResult) {
            navigate('/dashboard', { replace: true })
            return
        }

        const info = OAUTH_MESSAGES[oauthResult] || {
            type: 'info',
            text: `OAuth result: ${oauthResult}`,
            redirect: '/dashboard/profile?tab=integrations',
        }

        const statusTimer = window.setTimeout(() => {
            setStatus(info.text)
        }, 1000)

        refreshLifeSyncMe().catch(() => {})

        try {
            sessionStorage.setItem('maxien_lifesync_oauth', JSON.stringify({
                type: info.type,
                text: info.text,
                provider: oauthResult,
            }))
        } catch { /* ignore */ }

        const navTimer = window.setTimeout(() => {
            navigate(info.redirect, { replace: true })
        }, 1500)

        return () => {
            window.clearTimeout(statusTimer)
            window.clearTimeout(navTimer)
        }
    }, [oauthResult, navigate, refreshLifeSyncMe])

    const info = OAUTH_MESSAGES[oauthResult] || {}
    const isSuccess = info.type === 'success'

    return (
        <LifeSyncHubPageShell>
            <div className="flex min-h-[min(75vh,calc(100dvh-6rem))] items-center justify-center py-10 sm:py-14">
                <MotionDiv
                    className="flex w-full max-w-sm flex-col items-center gap-4 rounded-[24px] border border-white/90 bg-white/95 px-10 py-10 shadow-[0_12px_40px_-14px_rgba(100,90,130,0.12)] ring-1 ring-[#e8e4ef]/70"
                    initial={{ opacity: 0, y: 16, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={lifeSyncPageTransition}
                >
                    <div className={`flex h-14 w-14 items-center justify-center rounded-2xl shadow-md ring-2 ring-white ${isSuccess ? 'bg-gradient-to-br from-[#C6FF00] to-[#9fe870]' : 'bg-gradient-to-br from-[#fce7f3] to-[#ddd6fe]'}`}>
                        {isSuccess ? (
                            <svg className="h-7 w-7 text-[#1a1628]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                        ) : (
                            <svg className="h-7 w-7 text-[#9d174d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M4 12a8 8 0 0113.657-5.657M20 12a8 8 0 01-13.657 5.657" />
                                <path d="M8 5H4V1M16 19h4v4" />
                            </svg>
                        )}
                    </div>
                    <div className="w-full text-center">
                        <p className="text-[15px] font-bold text-[#1a1628]">LifeSync OAuth</p>
                        <p className={`mt-1 text-[12px] ${isSuccess ? 'text-emerald-600' : 'text-[#5b5670]'}`}>{status}</p>
                        {status.includes('Processing') ? (
                            <div className="mx-auto mt-3 max-w-[200px]">
                                <LifesyncTextLinesSkeleton lines={2} />
                            </div>
                        ) : null}
                    </div>
                    <div className="flex gap-1">
                        <span className="lifesync-dot-bounce h-2 w-2 rounded-full bg-[#C6FF00]" aria-hidden />
                        <span
                            className="lifesync-dot-bounce lifesync-dot-bounce-delay-1 h-2 w-2 rounded-full bg-[#a78bfa]"
                            aria-hidden
                        />
                        <span
                            className="lifesync-dot-bounce lifesync-dot-bounce-delay-2 h-2 w-2 rounded-full bg-[#5eead4]"
                            aria-hidden
                        />
                    </div>
                    <p className="text-[11px] text-[#7c7794]">Redirecting...</p>
                </MotionDiv>
            </div>
        </LifeSyncHubPageShell>
    )
}
