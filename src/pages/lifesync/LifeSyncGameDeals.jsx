import { Link } from 'react-router-dom'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { CheapSharkGameDeals } from '../../components/lifesync/CheapSharkGameDeals'
import { useLifeSync } from '../../context/LifeSyncContext'

export default function LifeSyncGameDeals() {
    const { isLifeSyncConnected } = useLifeSync()

    if (!isLifeSyncConnected) {
        return (
            <LifeSyncHubPageShell>
                <div className="mx-auto max-w-4xl rounded-[22px] border border-[var(--color-border-strong)]/90 bg-[var(--color-surface)]/90 px-8 py-16 text-center shadow-sm ring-1 ring-[var(--mx-color-e8e4ef)]/70">
                    <p className="text-[17px] font-bold text-[var(--mx-color-1a1628)]">LifeSync Not Connected</p>
                    <p className="mt-2 text-[14px] text-[var(--mx-color-5b5670)]">
                        Connect LifeSync in your profile to access the game deals hub.
                    </p>
                    <Link
                        to="/dashboard/profile?tab=integrations"
                        className="mt-5 inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-[var(--mx-color-1a1628)] shadow-sm ring-1 ring-[var(--mx-color-1a1628)]/10 transition-all hover:brightness-95"
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
                <header className="lifesync-games-glass rounded-[20px] border border-apple-border/60 bg-[var(--color-surface)]/95 p-5 shadow-sm">
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--mx-color-6e6e73)]">LifeSync • CheapShark</p>
                    <h1 className="mt-1 text-[30px] font-bold tracking-tight text-apple-text">Game Deals</h1>
                    <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-[var(--mx-color-515154)]">
                        Browse live game deals powered by CheapShark with Mongo-backed fallback for faster and more resilient loads.
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                        <Link
                            to="/dashboard/lifesync/games/gamerant"
                            className="inline-flex items-center rounded-lg border border-apple-border bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-apple-text transition hover:border-[var(--mx-color-0071e3)]"
                        >
                            Read Gaming News
                        </Link>
                    </div>
                    <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-apple-bg px-3 py-1.5 text-[12px] text-[var(--mx-color-515154)]">
                        <span className="h-2 w-2 rounded-full bg-[var(--mx-color-34c759)]" />
                        Live pricing and store filters enabled
                    </div>
                </header>

                <CheapSharkGameDeals />
            </div>
        </LifeSyncHubPageShell>
    )
}
