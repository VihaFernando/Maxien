import { useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { FaChevronLeft } from 'react-icons/fa'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { useLifeSync } from '../../context/LifeSyncContext'
import { isLifeSyncAnimeNavVisible } from '../../lib/lifesyncApi'
import { LayoutGroup } from '../../lib/lifesyncMotion'

const ANIME_HUB = '/dashboard/lifesync/anime'

/**
 * One `LayoutGroup` for shared `layoutId` (e.g. anime poster → detail / watch) without an extra
 * `AnimatePresence` + motion wrapper on the outlet — that layer fought page dolly + section motion.
 */
function AnimeMediaOutlet() {
    const outlet = useOutlet()
    return (
        <LayoutGroup id="lifesync-anime-media">
            <div className="min-w-0 flex-1">{outlet}</div>
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
                            className="hidden w-fit items-center gap-2 rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-[13px] font-semibold text-[#1d1d1f] shadow-sm transition-colors hover:bg-[#f5f5f7] sm:inline-flex"
                        >
                            <FaChevronLeft className="h-3.5 w-3.5 text-[#86868b]" aria-hidden />
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
