import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { GameRantGamingNews } from '../../components/lifesync/GameRantGamingNews'
import { useLifeSync } from '../../context/LifeSyncContext'

export default function LifeSyncGameRant() {
    const { isLifeSyncConnected } = useLifeSync()
    const [page, setPage] = useState(1)

    if (!isLifeSyncConnected) {
        return (
            <LifeSyncHubPageShell>
                <div className="mx-auto max-w-4xl rounded-[22px] border border-white/90 bg-white/90 px-8 py-16 text-center shadow-sm ring-1 ring-[#e8e4ef]/70">
                    <p className="text-[17px] font-bold text-[#1a1628]">LifeSync Not Connected</p>
                    <p className="mt-2 text-[14px] text-[#5b5670]">
                        Connect LifeSync in your profile to access the GameRant gaming news hub.
                    </p>
                    <Link
                        to="/dashboard/profile?tab=integrations"
                        className="mt-5 inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95"
                    >
                        Go to Integrations
                    </Link>
                </div>
            </LifeSyncHubPageShell>
        )
    }

    return (
        <LifeSyncHubPageShell>
            <div className="space-y-6">
                <header className="lifesync-games-glass rounded-[20px] border border-apple-border/60 bg-white/95 p-5 shadow-sm">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[#6e6e73]">LifeSync • GameRant</p>
                    <h1 className="mt-1 text-[30px] font-bold tracking-tight text-apple-text">Gaming News</h1>
                    <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[#515154]">
                        Browse featured headlines and latest gaming stories from GameRant. Open any card to read the full article inside LifeSync.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                            to="/dashboard/lifesync/games/deals"
                            className="inline-flex items-center rounded-lg border border-apple-border bg-white px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[#0071e3]"
                        >
                            View Game Deals
                        </Link>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-apple-bg px-3 py-1.5 text-[12px] text-[#515154]">
                        <span className="h-2 w-2 rounded-full bg-[#34c759]" />
                        Internal detail pages enabled
                    </div>
                </header>

                <GameRantGamingNews count={20} page={page} onPageChange={setPage} />
            </div>
        </LifeSyncHubPageShell>
    )
}
