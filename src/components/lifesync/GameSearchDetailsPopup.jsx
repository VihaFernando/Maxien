import { useEffect } from 'react'

function formatDate(value) {
    if (!value) return 'Unknown'
    try {
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
    } catch {
        return String(value)
    }
}

function statusChipClass(status) {
    if (status === 'cracked') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    if (status === 'not_cracked') return 'bg-rose-100 text-rose-700 border-rose-200'
    if (status === 'upcoming') return 'bg-amber-100 text-amber-800 border-amber-200'
    return 'bg-slate-100 text-slate-700 border-slate-200'
}

function titleCaseStatus(status) {
    if (!status) return 'Unknown'
    return String(status)
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (x) => x.toUpperCase())
}

export function GameSearchDetailsPopup({
    open,
    onClose,
    detail,
    loading = false,
    error = '',
}) {
    useEffect(() => {
        if (!open) return undefined

        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose?.()
            }
        }

        window.addEventListener('keydown', onKeyDown)

        return () => {
            document.body.style.overflow = prevOverflow
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [open, onClose])

    if (!open) return null

    const stores = Array.isArray(detail?.stores) ? detail.stores : []
    const title = detail?.title || 'Game details'
    const heroImage = detail?.heroImage || detail?.bannerImage || null
    const bannerImage = detail?.bannerImage || detail?.heroImage || null

    return (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/55 p-3 sm:p-6" onClick={() => onClose?.()}>
            <div
                className="lifesync-games-glass max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200/70 bg-[var(--color-surface)] shadow-2xl"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-slate-200 bg-[var(--color-surface)] px-4 py-3 sm:px-5">
                    <h3 className="truncate text-[16px] font-bold text-apple-text sm:text-[18px]">{title}</h3>
                    <button
                        type="button"
                        onClick={() => onClose?.()}
                        className="rounded-lg border border-slate-200 bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:border-slate-300"
                    >
                        Close
                    </button>
                </div>

                <div className="max-h-[calc(92vh-56px)] overflow-y-auto">
                    {loading ? (
                        <div className="px-5 py-12 text-center text-[14px] text-[var(--mx-color-6e6e73)]">Loading game details...</div>
                    ) : error ? (
                        <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</div>
                    ) : (
                        <>
                            {bannerImage && (
                                <div className="relative h-48 w-full overflow-hidden bg-slate-100 sm:h-56">
                                    <img
                                        src={bannerImage}
                                        alt=""
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-linear-to-t from-black/45 to-transparent" />
                                </div>
                            )}

                            <div className="space-y-5 p-5">
                                <div className="grid gap-4 lg:grid-cols-12">
                                    {heroImage ? (
                                        <div className="lifesync-games-glass overflow-hidden rounded-xl border border-slate-200 bg-slate-100 lg:col-span-5">
                                            <img
                                                src={heroImage}
                                                alt=""
                                                className="h-full w-full object-cover"
                                                loading="lazy"
                                            />
                                        </div>
                                    ) : null}
                                    <div className={`${heroImage ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-3`}>
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusChipClass(detail?.statusKey)}`}>
                                                {titleCaseStatus(detail?.statusKey)}
                                            </span>
                                            {detail?.releaseDate && (
                                                <span className="rounded-full border border-apple-border bg-apple-bg px-3 py-1 text-[11px] font-medium text-[var(--mx-color-515154)]">
                                                    Released {formatDate(detail.releaseDate)}
                                                </span>
                                            )}
                                        </div>

                                        {detail?.description ? (
                                            <p className="text-[13px] leading-relaxed text-[var(--mx-color-515154)]">{detail.description}</p>
                                        ) : (
                                            <p className="text-[13px] text-apple-subtext">No description available.</p>
                                        )}

                                        <div className="grid gap-2 text-[12px] text-[var(--mx-color-515154)] sm:grid-cols-2">
                                            {detail?.protection ? <p><span className="font-semibold">Protection:</span> {detail.protection}</p> : null}
                                            {detail?.group ? <p><span className="font-semibold">Group:</span> {detail.group}</p> : null}
                                            {detail?.crackDate ? <p><span className="font-semibold">Crack date:</span> {formatDate(detail.crackDate)}</p> : null}
                                            {detail?.crackedInDays != null ? <p><span className="font-semibold">Cracked in:</span> {detail.crackedInDays} days</p> : null}
                                        </div>

                                        {Array.isArray(detail?.genres) && detail.genres.length > 0 && (
                                            <div className="flex flex-wrap items-center gap-2">
                                                {detail.genres.slice(0, 8).map((genre) => (
                                                    <span key={genre} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700">
                                                        {genre}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <section>
                                    <h4 className="text-[14px] font-bold text-apple-text">Available stores</h4>
                                    {stores.length === 0 ? (
                                        <p className="mt-2 text-[13px] text-[var(--mx-color-6e6e73)]">No direct store links available for this game.</p>
                                    ) : (
                                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                            {stores.map((store, idx) => (
                                                <a
                                                    key={`${store.url || store.source || 'store'}-${idx}`}
                                                    href={store.url}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="lifesync-games-glass rounded-lg border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fbfbfd)] px-3 py-2 transition hover:border-[var(--mx-color-0071e3)]/50 hover:bg-[var(--color-surface)]"
                                                >
                                                    <p className="text-[13px] font-semibold text-apple-text line-clamp-1">{store.name || 'Store link'}</p>
                                                    <p className="mt-0.5 text-[11px] uppercase text-[var(--mx-color-4f46e5)]">{store.source || 'store'}</p>
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
