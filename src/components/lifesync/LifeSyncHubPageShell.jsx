/**
 * Shared page chrome for LifeSync hub routes — matches CategoryHub (soft lavender base + pastel orbs).
 * Framer `MotionConfig` lives in `LifeSyncMotionRoot` (reduced-motion preference applies to portaled modals too).
 */
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import {
    ANIME_STOCK_IMAGE_POOL,
    ANIME_STOCK_VIDEO_POOL,
    DEFAULT_BACKGROUND_POSITION,
    GAMES_STOCK_IMAGE_POOL,
    GAMES_STOCK_VIDEO_POOL,
    normalizeBackgroundPosition,
    normalizeAnimeBackgroundMode,
    normalizeGamesBackgroundMode,
    pickDeterministicFromPool,
    resolveBackgroundVideoSource,
    sanitizeBackgroundUrl,
} from '../../lib/lifeSyncBackgroundPrefs'
import {
    lifeSyncPageTransition,
    lifeSyncPageVariants,
    MotionDiv,
} from '../../lib/lifesyncMotion'

/** Wider than `max-w-6xl` so grids use large displays; horizontal padding scales with breakpoint. */
const shellInnerClass =
    'relative mx-auto w-full max-w-[min(100%,88rem)] px-4 pt-5 sm:px-6 sm:pt-6 md:px-8 lg:px-10 lg:pt-7 xl:px-12'

/** Pass `staticInnerChrome` for layouts that own section chrome and only swap an inner `<Outlet />`. */
export function LifeSyncHubPageShell({ children, staticInnerChrome = false }) {
    const { pathname, search } = useLocation()
    const pathnameLower = String(pathname || '').toLowerCase()
    const {
        lifeSyncUser,
        lifeSyncSteamProfile,
        refreshLifeSyncSteamProfile,
    } = useLifeSync()
    const routeKey = `${pathname}${search}`
    const [isDarkTheme, setIsDarkTheme] = useState(() => {
        if (typeof document === 'undefined') return false
        return document.documentElement?.dataset?.maxienTheme === 'dark'
    })
    const isGameRoute = pathname.startsWith('/dashboard/lifesync/games')
    const isAnimeRoute = pathname.startsWith('/dashboard/lifesync/anime')
    const isAnimeMediaWatchRoute = (
        pathnameLower.includes('/anime/watch/') ||
        pathnameLower.includes('/manga/read/') ||
        pathnameLower.includes('/hentai/watch/')
    )
    const activeArea = isGameRoute ? 'games' : isAnimeRoute && !isAnimeMediaWatchRoute ? 'anime' : null

    const gamesBackgroundMode = normalizeGamesBackgroundMode(
        lifeSyncUser?.preferences?.gamesBackgroundMode,
        Boolean(lifeSyncUser?.preferences?.gamesUseSteamProfileBackground),
    )
    const animeBackgroundMode = normalizeAnimeBackgroundMode(
        lifeSyncUser?.preferences?.animeBackgroundMode,
    )
    const gamesBackgroundPositionX = normalizeBackgroundPosition(
        lifeSyncUser?.preferences?.gamesBackgroundPositionX,
        DEFAULT_BACKGROUND_POSITION,
    )
    const gamesBackgroundPositionY = normalizeBackgroundPosition(
        lifeSyncUser?.preferences?.gamesBackgroundPositionY,
        DEFAULT_BACKGROUND_POSITION,
    )
    const animeBackgroundPositionX = normalizeBackgroundPosition(
        lifeSyncUser?.preferences?.animeBackgroundPositionX,
        DEFAULT_BACKGROUND_POSITION,
    )
    const animeBackgroundPositionY = normalizeBackgroundPosition(
        lifeSyncUser?.preferences?.animeBackgroundPositionY,
        DEFAULT_BACKGROUND_POSITION,
    )

    const shouldUseSteamBackground = Boolean(
        activeArea === 'games' &&
        gamesBackgroundMode === 'steam' &&
        lifeSyncUser?.integrations?.steam,
    )

    useEffect(() => {
        if (!shouldUseSteamBackground) return
        void refreshLifeSyncSteamProfile().catch(() => {})
    }, [shouldUseSteamBackground, refreshLifeSyncSteamProfile])

    useEffect(() => {
        if (typeof document === 'undefined') return undefined
        const root = document.documentElement
        const syncTheme = () => setIsDarkTheme(root?.dataset?.maxienTheme === 'dark')
        syncTheme()

        const observer = new MutationObserver(syncTheme)
        observer.observe(root, {
            attributes: true,
            attributeFilter: ['data-maxien-theme'],
        })
        return () => observer.disconnect()
    }, [])

    const steamProfile = lifeSyncSteamProfile?.profile && typeof lifeSyncSteamProfile.profile === 'object'
        ? lifeSyncSteamProfile.profile
        : null
    const steamTheme = steamProfile?.theme && typeof steamProfile.theme === 'object'
        ? steamProfile.theme
        : null

    const backgroundMedia = useMemo(() => {
        if (activeArea === 'games') {
            if (gamesBackgroundMode === 'steam') {
                const videoWebm = sanitizeBackgroundUrl(steamTheme?.backgroundVideoWebmUrl)
                const videoMp4 = sanitizeBackgroundUrl(steamTheme?.backgroundVideoMp4Url)
                const poster = sanitizeBackgroundUrl(
                    steamTheme?.backgroundVideoPosterUrl || steamTheme?.backgroundImageUrl,
                )
                const image = sanitizeBackgroundUrl(steamTheme?.backgroundImageUrl)
                if (videoWebm || videoMp4) {
                    return {
                        kind: 'video',
                        videoWebmUrl: videoWebm,
                        videoMp4Url: videoMp4,
                        imageUrl: '',
                        posterUrl: poster || image,
                    }
                }
                if (image) {
                    return {
                        kind: 'image',
                        videoWebmUrl: '',
                        videoMp4Url: '',
                        imageUrl: image,
                        posterUrl: '',
                    }
                }
                return null
            }

            if (gamesBackgroundMode === 'stock_image') {
                const picked = pickDeterministicFromPool(
                    GAMES_STOCK_IMAGE_POOL,
                    `${lifeSyncUser?.id || 'anon'}:games:${pathname}`,
                )
                const image = sanitizeBackgroundUrl(picked)
                if (!image) return null
                return {
                    kind: 'image',
                    videoWebmUrl: '',
                    videoMp4Url: '',
                    imageUrl: image,
                    posterUrl: '',
                }
            }

            if (gamesBackgroundMode === 'stock_video') {
                const picked = pickDeterministicFromPool(
                    GAMES_STOCK_VIDEO_POOL,
                    `${lifeSyncUser?.id || 'anon'}:games:video:${pathname}`,
                )
                if (!picked || typeof picked !== 'object') return null
                const videoWebm = sanitizeBackgroundUrl(picked.webm)
                const videoMp4 = sanitizeBackgroundUrl(picked.mp4)
                if (!videoWebm && !videoMp4) return null
                return {
                    kind: 'video',
                    videoWebmUrl: videoWebm,
                    videoMp4Url: videoMp4,
                    imageUrl: '',
                    posterUrl: sanitizeBackgroundUrl(picked.poster),
                }
            }

            if (gamesBackgroundMode === 'custom_image') {
                const image = sanitizeBackgroundUrl(
                    lifeSyncUser?.preferences?.gamesBackgroundCustomImageUrl,
                )
                if (!image) return null
                return {
                    kind: 'image',
                    videoWebmUrl: '',
                    videoMp4Url: '',
                    imageUrl: image,
                    posterUrl: '',
                }
            }

            if (gamesBackgroundMode === 'custom_video') {
                const candidate = resolveBackgroundVideoSource(
                    lifeSyncUser?.preferences?.gamesBackgroundCustomVideoUrl,
                )
                if (!candidate) return null
                return {
                    kind: candidate.kind === 'youtube' ? 'youtube' : 'video',
                    videoWebmUrl: candidate.videoWebmUrl,
                    videoMp4Url: candidate.videoMp4Url,
                    imageUrl: '',
                    embedUrl: candidate.embedUrl || '',
                    posterUrl: candidate.posterUrl || '',
                }
            }

            return null
        }

        if (activeArea === 'anime') {
            if (animeBackgroundMode === 'stock_image') {
                const picked = pickDeterministicFromPool(
                    ANIME_STOCK_IMAGE_POOL,
                    `${lifeSyncUser?.id || 'anon'}:anime:${pathname}`,
                )
                const image = sanitizeBackgroundUrl(picked)
                if (!image) return null
                return {
                    kind: 'image',
                    videoWebmUrl: '',
                    videoMp4Url: '',
                    imageUrl: image,
                    posterUrl: '',
                }
            }

            if (animeBackgroundMode === 'stock_video') {
                const picked = pickDeterministicFromPool(
                    ANIME_STOCK_VIDEO_POOL,
                    `${lifeSyncUser?.id || 'anon'}:anime:video:${pathname}`,
                )
                if (!picked || typeof picked !== 'object') return null
                const videoWebm = sanitizeBackgroundUrl(picked.webm)
                const videoMp4 = sanitizeBackgroundUrl(picked.mp4)
                if (!videoWebm && !videoMp4) return null
                return {
                    kind: 'video',
                    videoWebmUrl: videoWebm,
                    videoMp4Url: videoMp4,
                    imageUrl: '',
                    posterUrl: sanitizeBackgroundUrl(picked.poster),
                }
            }

            if (animeBackgroundMode === 'custom_image') {
                const image = sanitizeBackgroundUrl(
                    lifeSyncUser?.preferences?.animeBackgroundCustomImageUrl,
                )
                if (!image) return null
                return {
                    kind: 'image',
                    videoWebmUrl: '',
                    videoMp4Url: '',
                    imageUrl: image,
                    posterUrl: '',
                }
            }

            if (animeBackgroundMode === 'custom_video') {
                const candidate = resolveBackgroundVideoSource(
                    lifeSyncUser?.preferences?.animeBackgroundCustomVideoUrl,
                )
                if (!candidate) return null
                return {
                    kind: candidate.kind === 'youtube' ? 'youtube' : 'video',
                    videoWebmUrl: candidate.videoWebmUrl,
                    videoMp4Url: candidate.videoMp4Url,
                    imageUrl: '',
                    embedUrl: candidate.embedUrl || '',
                    posterUrl: candidate.posterUrl || '',
                }
            }
        }

        return null
    }, [
        activeArea,
        gamesBackgroundMode,
        animeBackgroundMode,
        lifeSyncUser?.id,
        lifeSyncUser?.preferences?.gamesBackgroundCustomImageUrl,
        lifeSyncUser?.preferences?.gamesBackgroundCustomVideoUrl,
        lifeSyncUser?.preferences?.animeBackgroundCustomImageUrl,
        lifeSyncUser?.preferences?.animeBackgroundCustomVideoUrl,
        pathname,
        steamTheme?.backgroundVideoWebmUrl,
        steamTheme?.backgroundVideoMp4Url,
        steamTheme?.backgroundVideoPosterUrl,
        steamTheme?.backgroundImageUrl,
    ])

    const hasBackgroundMedia = Boolean(
        backgroundMedia?.imageUrl ||
        backgroundMedia?.videoMp4Url ||
        backgroundMedia?.videoWebmUrl ||
        backgroundMedia?.embedUrl,
    )
    const backgroundActive = isDarkTheme && hasBackgroundMedia

    const identityChip = useMemo(() => {
        if (!backgroundActive || activeArea !== 'games' || gamesBackgroundMode !== 'steam' || !steamProfile) return null
        const level = Number(steamProfile?.steamLevel)
        const badges = Number(steamProfile?.badges?.count)
        return {
            personaName: String(steamProfile?.personaName || 'Steam Player').trim(),
            avatarUrl: String(steamProfile?.avatarUrl || '').trim(),
            steamId: String(steamProfile?.steamId || '').trim(),
            profileUrl: String(steamProfile?.profileUrl || '').trim(),
            steamLevel: Number.isFinite(level) ? level : null,
            badgesCount: Number.isFinite(badges) ? badges : null,
        }
    }, [backgroundActive, activeArea, gamesBackgroundMode, steamProfile])

    const innerStyle = identityChip
        ? { paddingTop: 'max(4.25rem, env(safe-area-inset-top))' }
        : undefined
    const backgroundPositionX = activeArea === 'games' ? gamesBackgroundPositionX : animeBackgroundPositionX
    const backgroundPositionY = activeArea === 'games' ? gamesBackgroundPositionY : animeBackgroundPositionY
    const objectPositionStyle = {
        objectPosition: `${backgroundPositionX}% ${backgroundPositionY}%`,
    }
    const youtubeFrameStyle = {
        left: `${backgroundPositionX}%`,
        top: `${backgroundPositionY}%`,
        transform: `translate(-${backgroundPositionX}%, -${backgroundPositionY}%) scale(1.42)`,
        transformOrigin: 'center center',
    }

    return (
        <div
            className={`lifesync-theme-surface relative min-h-full overflow-x-hidden bg-transparent pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] ${
                backgroundActive ? 'lifesync-scene-bg-active' : ''
            }`}
        >
            {backgroundActive && (
                <div className="pointer-events-none fixed inset-0 overflow-hidden">
                    {backgroundMedia?.kind === 'youtube' && backgroundMedia?.embedUrl ? (
                        <iframe
                            title="LifeSync background video"
                            className="absolute h-[56.25vw] min-h-full w-[177.78vh] min-w-full"
                            src={backgroundMedia.embedUrl}
                            allow="autoplay; encrypted-media; picture-in-picture"
                            referrerPolicy="strict-origin-when-cross-origin"
                            tabIndex={-1}
                            style={youtubeFrameStyle}
                        />
                    ) : backgroundMedia?.kind === 'video' ? (
                        <video
                            className="absolute inset-0 h-full w-full object-cover object-left"
                            autoPlay
                            muted
                            loop
                            playsInline
                            poster={backgroundMedia?.posterUrl || undefined}
                            style={objectPositionStyle}
                        >
                            {backgroundMedia?.videoWebmUrl && (
                                <source src={backgroundMedia.videoWebmUrl} type="video/webm" />
                            )}
                            {backgroundMedia?.videoMp4Url && (
                                <source src={backgroundMedia.videoMp4Url} type="video/mp4" />
                            )}
                        </video>
                    ) : (
                        <img
                            src={backgroundMedia?.imageUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover object-left"
                            loading="eager"
                            decoding="async"
                            style={objectPositionStyle}
                        />
                    )}
                    <div className="absolute inset-0 bg-[linear-gradient(168deg,rgba(6,7,15,0.66)_0%,rgba(11,14,25,0.58)_36%,rgba(20,25,38,0.46)_100%)]" />
                    <div className="absolute inset-0 bg-[radial-gradient(120%_55%_at_15%_5%,rgba(173,216,255,0.24),transparent),radial-gradient(85%_48%_at_90%_10%,rgba(198,255,0,0.16),transparent)]" />
                </div>
            )}

            {identityChip && (
                <div className="pointer-events-none absolute inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-10">
                    <div className="mx-auto flex w-full max-w-[min(100%,88rem)] justify-end px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12">
                        <a
                            href={identityChip.profileUrl || undefined}
                            target="_blank"
                            rel="noreferrer"
                            className="lifesync-games-steam-identity-chip pointer-events-auto inline-flex max-w-full items-center gap-2 rounded-2xl px-2.5 py-2 text-white/95 shadow-lg transition hover:brightness-110"
                        >
                            {identityChip.avatarUrl ? (
                                <img
                                    src={identityChip.avatarUrl}
                                    alt=""
                                    className="h-8 w-8 rounded-lg object-cover ring-1 ring-white/45"
                                    loading="lazy"
                                />
                            ) : (
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-[12px] font-bold">
                                    S
                                </span>
                            )}
                            <span className="min-w-0">
                                <span className="block max-w-[170px] truncate text-[12px] font-semibold">
                                    {identityChip.personaName}
                                </span>
                                <span className="block text-[10px] text-white/75">
                                    {identityChip.steamLevel != null ? `Lv ${identityChip.steamLevel}` : 'Steam'}
                                    {identityChip.badgesCount != null ? ` • ${identityChip.badgesCount} badges` : ''}
                                </span>
                            </span>
                        </a>
                    </div>
                </div>
            )}

            <MotionDiv
                className="lifesync-shell-glow lifesync-shell-glow-a pointer-events-none absolute -left-24 top-0 h-[420px] w-[420px] rounded-full blur-3xl"
                aria-hidden
                initial={{ opacity: 0.6, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
            />
            <MotionDiv
                className="lifesync-shell-glow lifesync-shell-glow-b pointer-events-none absolute -right-20 top-32 h-[380px] w-[380px] rounded-full blur-3xl"
                aria-hidden
                initial={{ opacity: 0.55, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.15, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            />
            <MotionDiv
                className="lifesync-shell-glow lifesync-shell-glow-c pointer-events-none absolute bottom-0 left-1/3 h-[300px] w-[500px] -translate-x-1/2 rounded-full blur-3xl"
                aria-hidden
                initial={{ opacity: 0.5, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.12, ease: [0.16, 1, 0.3, 1] }}
            />

            {staticInnerChrome ? (
                <div className={shellInnerClass} style={innerStyle}>{children}</div>
            ) : (
                <MotionDiv
                    key={routeKey}
                    className={shellInnerClass}
                    style={innerStyle}
                    initial="initial"
                    animate="animate"
                    variants={lifeSyncPageVariants}
                    transition={lifeSyncPageTransition}
                >
                    {children}
                </MotionDiv>
            )}
        </div>
    )
}
