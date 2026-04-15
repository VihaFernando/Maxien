import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch } from '../../lib/lifesyncApi'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'

export default function LifeSyncWishlist() {
    const { isLifeSyncConnected } = useLifeSync()
    const [steamStatus, setSteamStatus] = useState(null)
    const [busy, setBusy] = useState(false)

    useEffect(() => {
        if (!isLifeSyncConnected) return
        let cancelled = false
        setBusy(true)
        lifesyncFetch('/api/v1/steam/status?view=compact')
            .then((data) => {
                if (!cancelled) setSteamStatus(data || null)
            })
            .catch(() => {
                if (!cancelled) setSteamStatus(null)
            })
            .finally(() => {
                if (!cancelled) setBusy(false)
            })
        return () => {
            cancelled = true
        }
    }, [isLifeSyncConnected])

    if (!isLifeSyncConnected) {
        return (
            <LifeSyncHubPageShell>
                <div className="mx-auto max-w-4xl">
                    <h1 className="mb-2 text-[28px] font-bold tracking-tight text-[#1a1628]">Wishlist</h1>
                    <div className="rounded-[22px] border border-white/90 bg-white/90 px-8 py-16 text-center shadow-sm ring-1 ring-[#e8e4ef]/70">
                        <p className="mb-2 text-[15px] font-bold text-[#1a1628]">LifeSync Not Connected</p>
                        <p className="mb-4 text-[13px] text-[#5b5670]">Connect LifeSync in your profile to access game integrations.</p>
                        <Link
                            to="/dashboard/profile?tab=integrations"
                            className="inline-flex items-center gap-2 rounded-xl bg-[#C6FF00] px-5 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95"
                        >
                            Go to Integrations
                        </Link>
                    </div>
                </div>
            </LifeSyncHubPageShell>
        )
    }

    return (
        <LifeSyncHubPageShell>
            <div className="space-y-5">
                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-[#86868b]">LifeSync / Games</p>
                    <h1 className="text-[28px] font-bold tracking-tight text-[#1a1628]">Wishlist</h1>
                    <p className="mt-1 text-[13px] text-[#86868b]">
                        Wishlist APIs are not part of the current v1 backend profile.
                    </p>
                </div>

                <div className="rounded-[20px] border border-[#d2d2d7]/50 bg-white p-5 shadow-sm">
                    <p className="text-[14px] font-semibold text-[#1d1d1f]">Use Steam + Xbox hubs in v1</p>
                    <p className="mt-2 text-[12px] leading-relaxed text-[#5b5670]">
                        For this v1 release, game integration is focused on Steam library sync and OpenXBL data.
                        Wishlist import/write endpoints from the old backend were intentionally removed.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                            to="/dashboard/lifesync/games/steam"
                            className="inline-flex items-center rounded-xl bg-[#C6FF00] px-4 py-2 text-[12px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 hover:brightness-95"
                        >
                            Open Steam
                        </Link>
                        <Link
                            to="/dashboard/lifesync/games/xbox"
                            className="inline-flex items-center rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-4 py-2 text-[12px] font-semibold text-[#1d1d1f] hover:bg-[#ebebed]"
                        >
                            Open Xbox
                        </Link>
                    </div>
                </div>

                <div className="rounded-[20px] border border-[#d2d2d7]/50 bg-white p-5 shadow-sm">
                    <p className="text-[13px] font-bold text-[#1d1d1f]">Steam link status</p>
                    {busy ? (
                        <p className="mt-2 text-[12px] text-[#86868b]">Checking…</p>
                    ) : steamStatus?.steamLinked ? (
                        <p className="mt-2 text-[12px] text-emerald-700">
                            Connected{steamStatus?.profile?.personaName ? ` as ${steamStatus.profile.personaName}` : ''}.
                        </p>
                    ) : (
                        <p className="mt-2 text-[12px] text-amber-700">
                            Not linked yet. Connect Steam under Profile → Integrations.
                        </p>
                    )}
                </div>
            </div>
        </LifeSyncHubPageShell>
    )
}
