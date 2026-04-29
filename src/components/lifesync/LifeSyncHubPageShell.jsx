/**
 * Shared page chrome for LifeSync hub routes — matches CategoryHub (soft lavender base + pastel orbs).
 * Framer `MotionConfig` lives in `LifeSyncMotionRoot` (reduced-motion preference applies to portaled modals too).
 */
import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { useAppTheme } from '../../context/AppThemeContext'
import { lifesyncResolveYouTubeLoopSource } from '../../lib/lifesyncApi'
import {
    ANIME_STOCK_IMAGE_POOL,
    ANIME_STOCK_VIDEO_POOL,
    GAMES_STOCK_IMAGE_POOL,
    GAMES_STOCK_VIDEO_POOL,
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

const loadedBackgroundImages = new Set()
let lastDisplayedBackgroundMedia = null
const AREA_KEYS = ['games', 'anime']
const LIFESYNC_SCENE_BG_CACHE_KEY = 'maxien_lifesync_scene_background_cache_v1'

function normalizeBackgroundMediaPayload(media) {
    if (!media || typeof media !== 'object') return null
    const kindRaw = String(media.kind || '').trim().toLowerCase()
    const kind = kindRaw === 'image' || kindRaw === 'youtube_embed' ? kindRaw : 'video'
    const imageUrl = sanitizeBackgroundUrl(media.imageUrl)
    const posterUrl = sanitizeBackgroundUrl(media.posterUrl)
    const videoWebmUrl = sanitizeBackgroundUrl(media.videoWebmUrl)
    const videoMp4Url = sanitizeBackgroundUrl(media.videoMp4Url)
    const embedUrl = sanitizeBackgroundUrl(media.embedUrl)

    if (!imageUrl && !posterUrl && !videoWebmUrl && !videoMp4Url && !embedUrl) return null

    if (kind === 'image' && !imageUrl) {
        if (posterUrl) {
            return {
                kind: 'image',
                imageUrl: posterUrl,
                posterUrl: '',
                videoWebmUrl: '',
                videoMp4Url: '',
                embedUrl: '',
            }
        }
        return null
    }

    if (kind === 'youtube_embed' && !embedUrl) return null

    return {
        kind,
        imageUrl,
        posterUrl,
        videoWebmUrl,
        videoMp4Url,
        embedUrl,
    }
}

function readSceneBackgroundCache() {
    if (typeof localStorage === 'undefined') return { games: null, anime: null }
    try {
        const raw = localStorage.getItem(LIFESYNC_SCENE_BG_CACHE_KEY)
        if (!raw) return { games: null, anime: null }
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return { games: null, anime: null }
        return {
            games: normalizeBackgroundMediaPayload(parsed.games),
            anime: normalizeBackgroundMediaPayload(parsed.anime),
        }
    } catch {
        return { games: null, anime: null }
    }
}

function writeSceneBackgroundCache(cache) {
    if (typeof localStorage === 'undefined') return
    try {
        localStorage.setItem(
            LIFESYNC_SCENE_BG_CACHE_KEY,
            JSON.stringify({
                games: normalizeBackgroundMediaPayload(cache?.games),
                anime: normalizeBackgroundMediaPayload(cache?.anime),
            }),
        )
    } catch {
        // ignore storage failures
    }
}

let areaSceneBackgroundCache = readSceneBackgroundCache()

function getAreaSceneBackground(area) {
    if (!AREA_KEYS.includes(area)) return null
    return normalizeBackgroundMediaPayload(areaSceneBackgroundCache?.[area])
}

function rememberAreaSceneBackground(area, media) {
    if (!AREA_KEYS.includes(area)) return
    const next = normalizeBackgroundMediaPayload(media)
    areaSceneBackgroundCache = {
        ...areaSceneBackgroundCache,
        [area]: next,
    }
    writeSceneBackgroundCache(areaSceneBackgroundCache)
}

function backgroundMediaKey(media) {
    if (!media || typeof media !== 'object') return ''
    return [
        String(media.kind || ''),
        String(media.videoWebmUrl || ''),
        String(media.videoMp4Url || ''),
        String(media.imageUrl || ''),
        String(media.posterUrl || ''),
        String(media.embedUrl || ''),
    ].join('|')
}

function hasBackgroundMediaPayload(media) {
    return Boolean(
        media?.imageUrl ||
        media?.embedUrl ||
        media?.videoMp4Url ||
        media?.videoWebmUrl,
    )
}

/** Pass `staticInnerChrome` for layouts that own section chrome and only swap an inner `<Outlet />`. */
export function LifeSyncHubPageShell({ children, staticInnerChrome = false }) {
    const { pathname, search } = useLocation()
    const { resolvedTheme } = useAppTheme()
    const pathnameLower = String(pathname || '').toLowerCase()
    const {
        lifeSyncUser,
        lifeSyncLoading,
        lifeSyncSteamProfile,
        refreshLifeSyncSteamProfile,
    } = useLifeSync()
    const routeKey = `${pathname}${search}`
    const isDarkTheme = resolvedTheme === 'dark'
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
    const [youtubeLoopResolution, setYouTubeLoopResolution] = useState(null)
    const [displayBackgroundMedia, setDisplayBackgroundMedia] = useState(() => (
        lastDisplayedBackgroundMedia || (activeArea ? getAreaSceneBackground(activeArea) : null)
    ))
    const [pendingBackgroundMedia, setPendingBackgroundMedia] = useState(null)
    const [readyBackgroundMediaKey, setReadyBackgroundMediaKey] = useState('')

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
        if (!activeArea) return
        const cached = getAreaSceneBackground(activeArea)
        if (!cached) return
        setDisplayBackgroundMedia((prev) => prev || cached)
    }, [activeArea])

    useEffect(() => {
        const activeBackgroundMode = activeArea === 'games'
            ? gamesBackgroundMode
            : activeArea === 'anime'
                ? animeBackgroundMode
                : 'none'
        const activeCustomVideoUrl = activeArea === 'games'
            ? lifeSyncUser?.preferences?.gamesBackgroundCustomVideoUrl
            : activeArea === 'anime'
                ? lifeSyncUser?.preferences?.animeBackgroundCustomVideoUrl
                : ''

        if (!activeArea || activeBackgroundMode !== 'custom_video') {
            setYouTubeLoopResolution(null)
            return
        }

        const candidate = resolveBackgroundVideoSource(activeCustomVideoUrl)
        if (!candidate || candidate.kind !== 'youtube' || !candidate.youtubeId) {
            setYouTubeLoopResolution(null)
            return
        }

        const resolutionKey = `${activeArea}:${candidate.youtubeId}`
        setYouTubeLoopResolution((prev) => (
            prev && prev.key === resolutionKey
                ? prev
                : {
                    key: resolutionKey,
                    loading: true,
                    videoMp4Url: '',
                    videoWebmUrl: '',
                    posterUrl: sanitizeBackgroundUrl(candidate.posterUrl),
                }
        ))

        let cancelled = false
        void (async () => {
            try {
                const resolved = await lifesyncResolveYouTubeLoopSource({
                    videoId: candidate.youtubeId,
                })
                if (cancelled) return

                setYouTubeLoopResolution({
                    key: resolutionKey,
                    loading: false,
                    videoMp4Url: sanitizeBackgroundUrl(resolved?.videoMp4Url),
                    videoWebmUrl: sanitizeBackgroundUrl(resolved?.videoWebmUrl),
                    posterUrl: sanitizeBackgroundUrl(resolved?.posterUrl || candidate.posterUrl),
                })
            } catch {
                if (cancelled) return
                setYouTubeLoopResolution({
                    key: resolutionKey,
                    loading: false,
                    videoMp4Url: '',
                    videoWebmUrl: '',
                    posterUrl: sanitizeBackgroundUrl(candidate.posterUrl),
                })
            }
        })()

        return () => {
            cancelled = true
        }
    }, [
        activeArea,
        animeBackgroundMode,
        gamesBackgroundMode,
        lifeSyncUser?.preferences?.animeBackgroundCustomVideoUrl,
        lifeSyncUser?.preferences?.gamesBackgroundCustomVideoUrl,
    ])

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
                    `${lifeSyncUser?.id || 'anon'}:games:stock-image`,
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
                    `${lifeSyncUser?.id || 'anon'}:games:stock-video`,
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
                if (candidate.kind === 'youtube') {
                    const resolutionKey = `games:${candidate.youtubeId || ''}`
                    const resolved = youtubeLoopResolution?.key === resolutionKey
                        ? youtubeLoopResolution
                        : null
                    const resolvedWebm = sanitizeBackgroundUrl(resolved?.videoWebmUrl)
                    const resolvedMp4 = sanitizeBackgroundUrl(resolved?.videoMp4Url)
                    const poster = sanitizeBackgroundUrl(resolved?.posterUrl || candidate.posterUrl)
                    if (resolvedWebm || resolvedMp4) {
                        return {
                            kind: 'video',
                            videoWebmUrl: resolvedWebm,
                            videoMp4Url: resolvedMp4,
                            imageUrl: '',
                            posterUrl: poster,
                        }
                    }
                    if (candidate.embedUrl) {
                        return {
                            kind: 'youtube_embed',
                            videoWebmUrl: '',
                            videoMp4Url: '',
                            imageUrl: '',
                            posterUrl: poster,
                            embedUrl: candidate.embedUrl,
                        }
                    }
                    if (poster) {
                        return {
                            kind: 'image',
                            videoWebmUrl: '',
                            videoMp4Url: '',
                            imageUrl: poster,
                            posterUrl: '',
                        }
                    }
                    return null
                }
                return {
                    kind: 'video',
                    videoWebmUrl: candidate.videoWebmUrl,
                    videoMp4Url: candidate.videoMp4Url,
                    imageUrl: '',
                    posterUrl: candidate.posterUrl || '',
                }
            }

            return null
        }

        if (activeArea === 'anime') {
            if (animeBackgroundMode === 'stock_image') {
                const picked = pickDeterministicFromPool(
                    ANIME_STOCK_IMAGE_POOL,
                    `${lifeSyncUser?.id || 'anon'}:anime:stock-image`,
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
                    `${lifeSyncUser?.id || 'anon'}:anime:stock-video`,
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
                if (candidate.kind === 'youtube') {
                    const resolutionKey = `anime:${candidate.youtubeId || ''}`
                    const resolved = youtubeLoopResolution?.key === resolutionKey
                        ? youtubeLoopResolution
                        : null
                    const resolvedWebm = sanitizeBackgroundUrl(resolved?.videoWebmUrl)
                    const resolvedMp4 = sanitizeBackgroundUrl(resolved?.videoMp4Url)
                    const poster = sanitizeBackgroundUrl(resolved?.posterUrl || candidate.posterUrl)
                    if (resolvedWebm || resolvedMp4) {
                        return {
                            kind: 'video',
                            videoWebmUrl: resolvedWebm,
                            videoMp4Url: resolvedMp4,
                            imageUrl: '',
                            posterUrl: poster,
                        }
                    }
                    if (candidate.embedUrl) {
                        return {
                            kind: 'youtube_embed',
                            videoWebmUrl: '',
                            videoMp4Url: '',
                            imageUrl: '',
                            posterUrl: poster,
                            embedUrl: candidate.embedUrl,
                        }
                    }
                    if (poster) {
                        return {
                            kind: 'image',
                            videoWebmUrl: '',
                            videoMp4Url: '',
                            imageUrl: poster,
                            posterUrl: '',
                        }
                    }
                    return null
                }
                return {
                    kind: 'video',
                    videoWebmUrl: candidate.videoWebmUrl,
                    videoMp4Url: candidate.videoMp4Url,
                    imageUrl: '',
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
        steamTheme?.backgroundVideoWebmUrl,
        steamTheme?.backgroundVideoMp4Url,
        steamTheme?.backgroundVideoPosterUrl,
        steamTheme?.backgroundImageUrl,
        youtubeLoopResolution,
    ])

    const hasBackgroundMedia = hasBackgroundMediaPayload(backgroundMedia)
    const backgroundActive = isDarkTheme && hasBackgroundMedia

    useEffect(() => {
        const targetMedia = backgroundActive ? backgroundMedia : null
        if (!targetMedia) {
            setPendingBackgroundMedia(null)
            if (activeArea && lifeSyncLoading) {
                const cached = getAreaSceneBackground(activeArea)
                if (cached && backgroundMediaKey(cached) !== backgroundMediaKey(displayBackgroundMedia)) {
                    setDisplayBackgroundMedia(cached)
                    lastDisplayedBackgroundMedia = cached
                }
                return
            }
            if (activeArea && !lifeSyncLoading) {
                setDisplayBackgroundMedia(null)
                setReadyBackgroundMediaKey('')
            }
            return
        }

        const nextKey = backgroundMediaKey(targetMedia)
        const currentKey = backgroundMediaKey(displayBackgroundMedia)
        if (nextKey && nextKey === currentKey) {
            setPendingBackgroundMedia(null)
            return
        }

        if (!displayBackgroundMedia) {
            setPendingBackgroundMedia(null)
            setDisplayBackgroundMedia(targetMedia)
            lastDisplayedBackgroundMedia = targetMedia
            if (activeArea) rememberAreaSceneBackground(activeArea, targetMedia)
            return
        }

        if (targetMedia.kind === 'youtube_embed') {
            setPendingBackgroundMedia(targetMedia)
            return
        }

        let cancelled = false
        const commitNext = () => {
            if (cancelled) return
            setPendingBackgroundMedia(null)
            setDisplayBackgroundMedia(targetMedia)
            lastDisplayedBackgroundMedia = targetMedia
            if (activeArea) rememberAreaSceneBackground(activeArea, targetMedia)
        }

        const preloadUrl = sanitizeBackgroundUrl(
            targetMedia.kind === 'image'
                ? targetMedia.imageUrl
                : targetMedia.posterUrl,
        )

        if (preloadUrl && !loadedBackgroundImages.has(preloadUrl)) {
            const probe = new Image()
            probe.onload = () => {
                loadedBackgroundImages.add(preloadUrl)
                commitNext()
            }
            probe.onerror = commitNext
            probe.src = preloadUrl
            return () => {
                cancelled = true
            }
        }

        commitNext()
        return () => {
            cancelled = true
        }
    }, [activeArea, backgroundActive, backgroundMedia, displayBackgroundMedia, lifeSyncLoading])

    const renderedBackgroundMedia = backgroundActive
        ? (displayBackgroundMedia || backgroundMedia)
        : null
    const visibleBackgroundActive = hasBackgroundMediaPayload(renderedBackgroundMedia)
    const renderedBackgroundMediaKey = backgroundMediaKey(renderedBackgroundMedia)
    const renderedBackgroundPosterUrl = sanitizeBackgroundUrl(
        renderedBackgroundMedia?.kind === 'image'
            ? renderedBackgroundMedia?.imageUrl
            : renderedBackgroundMedia?.posterUrl,
    )
    const isBackgroundVisualReady = (
        !renderedBackgroundMedia ||
        renderedBackgroundMedia?.kind === 'image' ||
        readyBackgroundMediaKey === renderedBackgroundMediaKey
    )

    useEffect(() => {
        if (!renderedBackgroundMedia) {
            setReadyBackgroundMediaKey('')
            return
        }
        if (renderedBackgroundMedia.kind === 'image') {
            setReadyBackgroundMediaKey(renderedBackgroundMediaKey)
            return
        }
        setReadyBackgroundMediaKey((prev) => (
            prev === renderedBackgroundMediaKey ? prev : ''
        ))
    }, [renderedBackgroundMedia, renderedBackgroundMediaKey])

    const identityChip = useMemo(() => {
        if (!visibleBackgroundActive || activeArea !== 'games' || gamesBackgroundMode !== 'steam' || !steamProfile) return null
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
    }, [visibleBackgroundActive, activeArea, gamesBackgroundMode, steamProfile])

    const innerStyle = identityChip
        ? { paddingTop: 'max(4.25rem, env(safe-area-inset-top))' }
        : undefined

    return (
        <div
            className={`lifesync-theme-surface relative min-h-full overflow-x-hidden bg-transparent pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] ${
                visibleBackgroundActive ? 'lifesync-scene-bg-active' : ''
            }`}
        >
            {visibleBackgroundActive && (
                <div className="pointer-events-none fixed inset-0 overflow-hidden">
                    {renderedBackgroundMedia?.kind === 'youtube_embed' ? (
                        <>
                            {renderedBackgroundPosterUrl ? (
                                <img
                                    src={renderedBackgroundPosterUrl}
                                    alt=""
                                    className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ${
                                        isBackgroundVisualReady ? 'opacity-0' : 'opacity-100'
                                    }`}
                                    loading="eager"
                                    decoding="async"
                                />
                            ) : null}
                            <iframe
                                title="YouTube background"
                                src={renderedBackgroundMedia?.embedUrl}
                                className={`absolute inset-0 h-full w-full border-0 transition-opacity duration-300 ${
                                    isBackgroundVisualReady ? 'opacity-100' : 'opacity-0'
                                }`}
                                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                                referrerPolicy="strict-origin-when-cross-origin"
                                tabIndex={-1}
                                onLoad={() => setReadyBackgroundMediaKey(renderedBackgroundMediaKey)}
                            />
                        </>
                    ) : renderedBackgroundMedia?.kind === 'video' ? (
                        <>
                            {renderedBackgroundPosterUrl ? (
                                <img
                                    src={renderedBackgroundPosterUrl}
                                    alt=""
                                    className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ${
                                        isBackgroundVisualReady ? 'opacity-0' : 'opacity-100'
                                    }`}
                                    loading="eager"
                                    decoding="async"
                                />
                            ) : null}
                            <video
                                className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-300 ${
                                    isBackgroundVisualReady ? 'opacity-100' : 'opacity-0'
                                }`}
                                autoPlay
                                muted
                                loop
                                playsInline
                                poster={renderedBackgroundMedia?.posterUrl || undefined}
                                onLoadedData={() => setReadyBackgroundMediaKey(renderedBackgroundMediaKey)}
                                onCanPlay={() => setReadyBackgroundMediaKey(renderedBackgroundMediaKey)}
                            >
                                {renderedBackgroundMedia?.videoWebmUrl && (
                                    <source src={renderedBackgroundMedia.videoWebmUrl} type="video/webm" />
                                )}
                                {renderedBackgroundMedia?.videoMp4Url && (
                                    <source src={renderedBackgroundMedia.videoMp4Url} type="video/mp4" />
                                )}
                            </video>
                        </>
                    ) : (
                        <img
                            src={renderedBackgroundMedia?.imageUrl}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover object-center"
                            loading="eager"
                            decoding="async"
                        />
                    )}
                    {pendingBackgroundMedia?.kind === 'youtube_embed' &&
                        backgroundMediaKey(pendingBackgroundMedia) !== backgroundMediaKey(renderedBackgroundMedia) && (
                            <iframe
                                title="YouTube background preload"
                                src={pendingBackgroundMedia?.embedUrl}
                                className="absolute inset-0 h-full w-full border-0 opacity-0"
                                allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
                                referrerPolicy="strict-origin-when-cross-origin"
                                tabIndex={-1}
                                onLoad={() => {
                                    const nextKey = backgroundMediaKey(pendingBackgroundMedia)
                                    if (nextKey) setReadyBackgroundMediaKey(nextKey)
                                    setDisplayBackgroundMedia(pendingBackgroundMedia)
                                    lastDisplayedBackgroundMedia = pendingBackgroundMedia
                                    if (activeArea) rememberAreaSceneBackground(activeArea, pendingBackgroundMedia)
                                    setPendingBackgroundMedia(null)
                                }}
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
                                    className="h-8 w-8 rounded-lg object-cover ring-1 ring-[var(--color-border-strong)]/45"
                                    loading="lazy"
                                />
                            ) : (
                                <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-surface)]/15 text-[12px] font-bold">
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
