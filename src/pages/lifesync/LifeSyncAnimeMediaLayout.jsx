import { useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { useLifeSync } from '../../context/LifeSyncContext'
import { isLifeSyncAnimeNavVisible } from '../../lib/lifesyncApi'
import { AnimatePresence, LayoutGroup, lifeSyncPageTransition, lifeSyncPageVariants, MotionDiv } from '../../lib/lifesyncMotion'

const ANIME_HUB = '/dashboard/lifesync/anime'

/**
 * Route buckets for media-area transitions from hub → anime/manga/hentai/library.
 * Keep the key stable inside each area so detail modals/tabs don't retrigger full page transitions.
 */
function animeMediaRouteTransitionKey(pathname) {
    const path = pathname === `${ANIME_HUB}/` ? ANIME_HUB : pathname
    if (path === ANIME_HUB) return 'hub'
    if (path.startsWith(`${ANIME_HUB}/manga/library`)) return 'library'
    if (path.startsWith(`${ANIME_HUB}/anime`)) return 'anime'
    if (path.startsWith(`${ANIME_HUB}/manga`)) return 'manga'
    if (path.startsWith(`${ANIME_HUB}/hentai`)) return 'hentai'
    return path
}

function AnimeMediaOutlet() {
    const { pathname } = useLocation()
    const outlet = useOutlet()
    const routeKey = animeMediaRouteTransitionKey(pathname)
    return (
        <LayoutGroup id="lifesync-anime-media">
            <div className="relative min-w-0 flex-1">
                <AnimatePresence initial={false} mode="sync">
                    <MotionDiv
                        key={routeKey}
                        className="min-w-0 flex-1"
                        initial="initial"
                        animate="animate"
                        exit={{
                            opacity: 0,
                            y: -8,
                            position: 'absolute',
                            inset: 0,
                            width: '100%',
                        }}
                        variants={lifeSyncPageVariants}
                        transition={lifeSyncPageTransition}
                    >
                        {outlet}
                    </MotionDiv>
                </AnimatePresence>
            </div>
        </LayoutGroup>
    )
}

export default function LifeSyncAnimeMediaLayout() {
    const { pathname } = useLocation()
    const navigate = useNavigate()
    const { lifeSyncUser } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const showAreaNav = isLifeSyncAnimeNavVisible(prefs)

    const isHubIndex = pathname === ANIME_HUB || pathname === `${ANIME_HUB}/`
    const showBack = showAreaNav && !isHubIndex

    return (
        <LifeSyncHubPageShell staticInnerChrome>
            {showAreaNav ? (
                <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
                    {showBack && (
                        <button
                            type="button"
                            onClick={() => navigate(ANIME_HUB)}
                            className="hidden w-fit items-center gap-2 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] px-3 py-2 text-[13px] font-semibold text-[var(--mx-color-1d1d1f)] shadow-sm transition-colors hover:bg-[var(--mx-color-f5f5f7)] sm:inline-flex"
                        >
                            <FaChevronLeft className="h-3.5 w-3.5 text-[var(--mx-color-86868b)]" aria-hidden />
                            Back
                        </button>
                    )}
                    <AnimeMediaOutlet />
                </div>
            ) : (
                <AnimeMediaOutlet />
            )}
        </LifeSyncHubPageShell>
    )
}
