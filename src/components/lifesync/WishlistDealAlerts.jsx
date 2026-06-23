import { useState } from 'react'
import { FaBolt, FaTags, FaChevronDown, FaChevronUp } from 'react-icons/fa'
import { useWishlistAlerts } from '../../hooks/useWishlistAlerts'

function money(value) {
    if (value == null) return ''
    return `$${Number(value).toFixed(2)}`
}

/**
 * Price-drop scan + best-deals digest for the wishlist page. Self-contained so it can be
 * dropped into the existing Wishlist Command Deck without restructuring it.
 */
export default function WishlistDealAlerts() {
    const [expanded, setExpanded] = useState(false)
    const { digest, digestLoading, checking, lastCheck, error, loadDigest, checkPriceDrops } = useWishlistAlerts()

    const toggle = () => {
        const next = !expanded
        setExpanded(next)
        if (next && digest.length === 0) void loadDigest()
    }

    return (
        <section className="lifesync-games-glass rounded-[20px] border border-[var(--mx-color-d2d2d7)]/50 bg-[var(--color-surface)] p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--mx-color-c6ff00)] text-black">
                        <FaTags className="h-4 w-4" />
                    </span>
                    <div>
                        <p className="text-[14px] font-bold text-[var(--mx-color-1a1628)]">Deal Alerts</p>
                        <p className="text-[12px] text-[var(--mx-color-5b5670)]">Price-drop scan & best-deal digest for your wishlist</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => checkPriceDrops()}
                        disabled={checking}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--mx-color-1a1628)] px-3.5 py-2 text-[12px] font-semibold text-white transition-all hover:brightness-110 disabled:opacity-50"
                    >
                        <FaBolt className="h-3 w-3" />
                        {checking ? 'Scanning…' : 'Check price drops'}
                    </button>
                    <button
                        type="button"
                        onClick={toggle}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] px-3.5 py-2 text-[12px] font-semibold text-[var(--mx-color-1d1d1f)] transition-all hover:brightness-95"
                    >
                        {expanded ? <FaChevronUp className="h-3 w-3" /> : <FaChevronDown className="h-3 w-3" />}
                        Digest
                    </button>
                </div>
            </div>

            {lastCheck && (
                <p className="mt-3 text-[12px] text-[var(--mx-color-5b5670)]">
                    Checked {lastCheck.checked} item{lastCheck.checked === 1 ? '' : 's'} ·{' '}
                    <span className="font-semibold text-[var(--mx-color-1a1628)]">{lastCheck.triggered} drop{lastCheck.triggered === 1 ? '' : 's'}</span>{' '}
                    found{lastCheck.triggered > 0 ? ' — see your notifications' : ''}.
                </p>
            )}

            {error && <p className="mt-3 text-[12px] text-red-600">{error}</p>}

            {expanded && (
                <div className="mt-4 border-t border-[var(--mx-color-d2d2d7)]/60 pt-4">
                    {digestLoading ? (
                        <p className="py-6 text-center text-[12px] text-[var(--mx-color-5b5670)]">Loading deals…</p>
                    ) : digest.length === 0 ? (
                        <p className="py-6 text-center text-[12px] text-[var(--mx-color-5b5670)]">No active discounts on your wishlist right now.</p>
                    ) : (
                        <ul className="space-y-2">
                            {digest.map((d) => (
                                <li key={d.itemId} className="flex items-center gap-3 rounded-xl border border-[var(--mx-color-d2d2d7)]/60 bg-[var(--mx-color-f5f5f7)] px-3 py-2">
                                    {d.thumb && <img src={d.thumb} alt="" className="h-9 w-16 flex-shrink-0 rounded-md object-cover" />}
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-[12px] font-bold text-[var(--mx-color-1a1628)]">{d.title}</p>
                                        <p className="text-[11px] text-[var(--mx-color-5b5670)]">
                                            <span className="font-semibold text-emerald-600">{money(d.salePrice)}</span>
                                            {d.normalPrice != null && <span className="ml-1 line-through">{money(d.normalPrice)}</span>}
                                        </p>
                                    </div>
                                    {d.savingsPct != null && (
                                        <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-600">-{d.savingsPct}%</span>
                                    )}
                                    {d.link && (
                                        <a href={d.link} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[var(--mx-color-1a1628)] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:brightness-110">
                                            View
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </section>
    )
}
