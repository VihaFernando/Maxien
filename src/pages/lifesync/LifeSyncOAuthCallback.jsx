import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'

const OAUTH_MESSAGES = {
    steam_ok: { type: 'success', text: 'Steam linked successfully!', redirect: '/dashboard/lifesync/games/steam' },
    steam_error: { type: 'error', text: 'Steam OAuth failed. Check server configuration and try again.', redirect: '/dashboard/lifesync/games/steam' },
    epic_ok: { type: 'success', text: 'Epic Games linked successfully!', redirect: '/dashboard/lifesync/games/epic' },
    epic_error: { type: 'error', text: 'Epic Games OAuth failed. Check server logs and Epic portal settings.', redirect: '/dashboard/lifesync/games/epic' },
    epic_invalid_client: { type: 'error', text: 'Epic OAuth: token step failed. Confirm EPIC_CLIENT_ID and EPIC_CLIENT_SECRET match an active Epic Account Services client.', redirect: '/dashboard/lifesync/games/epic' },
    epic_invalid_grant: { type: 'error', text: 'Epic OAuth: the sign-in code was not accepted (often a redirect URI mismatch).', redirect: '/dashboard/lifesync/games/epic' },
    mal_ok: { type: 'success', text: 'MyAnimeList linked successfully!', redirect: '/dashboard/lifesync/anime/anime' },
    mal_error: { type: 'error', text: 'MyAnimeList OAuth failed. Make sure MAL_CLIENT_ID is configured.', redirect: '/dashboard/lifesync/anime/anime' },
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

        setTimeout(() => {
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

        const timer = setTimeout(() => {
            navigate(info.redirect, { replace: true })
        }, 1500)

        return () => clearTimeout(timer)
    }, [oauthResult, navigate, refreshLifeSyncMe])

    const info = OAUTH_MESSAGES[oauthResult] || {}
    const isSuccess = info.type === 'success'

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#f5f5f7]">
            <div className="bg-white rounded-[24px] border border-[#d2d2d7]/50 shadow-sm px-10 py-10 flex flex-col items-center gap-4 w-full max-w-sm">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg ${isSuccess ? 'bg-[#C6FF00]' : 'bg-[#1d1d1f]'}`}>
                    {isSuccess ? (
                        <svg className="w-7 h-7 text-[#1d1d1f]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                    ) : (
                        <svg className="w-7 h-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12a8 8 0 0113.657-5.657M20 12a8 8 0 01-13.657 5.657" />
                            <path d="M8 5H4V1M16 19h4v4" />
                        </svg>
                    )}
                </div>
                <div className="text-center">
                    <p className="text-[15px] font-bold text-[#1d1d1f]">LifeSync OAuth</p>
                    <p className={`text-[12px] mt-1 ${isSuccess ? 'text-emerald-600' : 'text-[#86868b]'}`}>{status}</p>
                </div>
                <div className="flex gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#C6FF00] animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full bg-[#C6FF00] animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 rounded-full bg-[#C6FF00] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <p className="text-[11px] text-[#86868b]">Redirecting...</p>
            </div>
        </div>
    )
}
