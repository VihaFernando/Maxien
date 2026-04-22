import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { FaCirclePlay, FaStore, FaXmark } from 'react-icons/fa6'

const XBOX_GAME_PASS_URL = 'https://www.xbox.com/xbox-game-pass'

function stripHtml(html) {
    if (!html || typeof html !== 'string') return ''
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()
}

function StoreStarText({ value }) {
    if (value == null || typeof value !== 'number') return null
    return <span className="text-amber-200 tabular-nums">{value.toFixed(1)}★</span>
}

function StoreGameDetailPanel({ detail }) {
    const [descOpen, setDescOpen] = useState(false)

    if (!detail) return null

    const hw = detail.hardware || {}
    const hasHardware =
        hw.minProcessor ||
        hw.recommendedProcessor ||
        hw.minGraphics ||
        hw.recommendedGraphics ||
        typeof hw.approximateDownloadGb === 'number'

    const categoryPills =
        Array.isArray(detail.categories) && detail.categories.length > 0
            ? detail.categories
            : detail.category
              ? [detail.category]
              : []
    const primaryGenre = categoryPills[0] || null

    const backdrop = detail.backdropImage || detail.heroImage
    const poster = detail.posterImage || detail.heroImage
    const storeHref = detail.storeUrl || 'https://www.xbox.com'
    const ratingCount = typeof detail.storeRating?.count === 'number' ? detail.storeRating.count : 0
    const esrb = detail.esrbFooter

    const saleLine =
        detail.isOnSale && detail.savingsFormatted
            ? `On sale: save ${detail.savingsFormatted}${detail.saleEndsLabel ? `, ends ${detail.saleEndsLabel}` : ''}`
            : null

    const langCount = detail.supportedLanguages?.length ?? 0
    const gamePassLine =
        Array.isArray(detail.gamePassOffers) && detail.gamePassOffers.length > 0
            ? `Needs ${detail.gamePassOffers.join(' / ')}`
            : detail.gamePassLikely
              ? 'Included with Xbox Game Pass (plan varies by region)'
              : 'See membership plans on Xbox.com'

    const fullDesc = detail.description ? stripHtml(detail.description) : ''

    return (
        <div className="overflow-hidden rounded-2xl border border-[var(--color-border-strong)]/10 bg-black shadow-2xl ring-1 ring-black/40">
            <div className="relative isolate min-h-[240px] sm:min-h-[280px]">
                {backdrop ? (
                    <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <img
                            src={backdrop}
                            alt=""
                            className="h-full w-full scale-110 object-cover opacity-55 blur-3xl saturate-125"
                            loading="lazy"
                        />
                    </div>
                ) : null}
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[var(--mx-color-2a0a12)]/95 via-slate-950/92 to-black" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-[var(--mx-color-1f0508)]/50" />

                <div className="relative z-10 p-5 sm:p-7 lg:p-10">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:gap-10">
                        {poster ? (
                            <div className="mx-auto flex w-full max-w-[11rem] shrink-0 justify-center lg:mx-0 lg:max-w-[12.5rem]">
                                <img
                                    src={poster}
                                    alt=""
                                    className="aspect-[2/3] w-full rounded-md object-cover shadow-2xl ring-1 ring-[var(--color-border-strong)]/15"
                                    loading="lazy"
                                />
                            </div>
                        ) : null}

                        <div className="min-w-0 flex-1 space-y-4">
                            <div className="space-y-1">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">Xbox · Microsoft Store</p>
                                <h4 className="text-balance text-2xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
                                    {detail.title || 'Unknown title'}
                                </h4>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-white/65">
                                {detail.developer ? <span className="font-medium text-white/85">{detail.developer}</span> : null}
                                {detail.developer && primaryGenre ? <span className="text-white/35">·</span> : null}
                                {primaryGenre ? <span>{primaryGenre}</span> : null}
                                {(detail.developer || primaryGenre) && detail.storeRating?.average != null ? (
                                    <span className="text-white/35">·</span>
                                ) : null}
                                {detail.storeRating?.average != null ? (
                                    <span className="inline-flex items-center gap-2 text-white/90">
                                        <StoreStarText value={detail.storeRating.average} />
                                        {ratingCount > 0 ? (
                                            <span className="text-sm text-white/70">
                                                ({ratingCount > 999 ? `${Math.round(ratingCount / 1000)}k+` : ratingCount})
                                            </span>
                                        ) : null}
                                    </span>
                                ) : null}
                            </div>

                            <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                                {saleLine ? (
                                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-400/35 bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-100">
                                        {saleLine}
                                    </span>
                                ) : null}
                                {detail.features?.map((f) => (
                                    <span
                                        key={f}
                                        className="inline-flex shrink-0 rounded-full border border-[var(--color-border-strong)]/18 bg-black/35 px-2.5 py-1 text-[11px] font-medium text-slate-100"
                                    >
                                        {f}
                                    </span>
                                ))}
                                {langCount > 0 ? (
                                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--color-border-strong)]/18 bg-black/35 px-2.5 py-1 text-[11px] font-medium text-slate-100">
                                        {langCount} supported languages
                                    </span>
                                ) : null}
                            </div>

                            <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-center">
                                <a
                                    href={XBOX_GAME_PASS_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex min-w-[12rem] flex-col items-center justify-center rounded-sm bg-[var(--mx-color-107c10)] px-5 py-3 text-center font-bold uppercase tracking-wide text-white shadow-lg transition-colors hover:bg-[var(--mx-color-0e6b0e)]"
                                >
                                    <span className="text-sm sm:text-base">Get Game Pass</span>
                                    <span className="mt-0.5 text-[11px] font-normal normal-case text-white/90">{gamePassLine}</span>
                                </a>

                                {detail.storeUrl ? (
                                    <a
                                        href={detail.storeUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex min-w-[11rem] flex-col items-stretch justify-center rounded-sm border border-[var(--color-border-strong)]/18 bg-[var(--color-surface)]/[0.08] px-5 py-2.5 text-left shadow-inner backdrop-blur-sm transition-colors hover:bg-[var(--color-surface)]/[0.12]"
                                    >
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/55">
                                            {detail.listPrice === 0 ? 'Get' : 'Buy'}
                                        </span>
                                        <span className="mt-1 flex flex-wrap items-baseline gap-2">
                                            {detail.isOnSale && detail.msrpFormatted ? (
                                                <span className="text-sm text-white/40 line-through">{detail.msrpFormatted}</span>
                                            ) : null}
                                            <span className="text-xl font-bold tabular-nums text-white">
                                                {detail.listPrice === 0
                                                    ? 'Free'
                                                    : detail.purchasePriceFormatted || detail.priceText || 'See store'}
                                            </span>
                                        </span>
                                    </a>
                                ) : null}
                            </div>

                            {detail.shortDescription ? (
                                <p className="max-w-3xl text-sm leading-relaxed text-white/70">{detail.shortDescription}</p>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            <div className="space-y-4 border-t border-[var(--color-border-strong)]/10 bg-black/55 px-5 py-5 sm:px-8 lg:px-10">
                <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
                    {detail.releaseDateLabel ? (
                        <span className="inline-flex items-center gap-1">Released {detail.releaseDateLabel}</span>
                    ) : null}
                    {typeof detail.minimumUserAge === 'number' ? (
                        <span className="inline-flex items-center gap-1">Min. age {detail.minimumUserAge}+</span>
                    ) : null}
                    <a
                        href={storeHref}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-emerald-400/90 hover:text-emerald-300"
                    >
                        <FaStore className="h-3.5 w-3.5" aria-hidden />
                        Open full store page
                    </a>
                </div>

                {langCount > 0 ? (
                    <div>
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-600">Supported languages</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">{detail.supportedLanguages.join(', ')}</p>
                    </div>
                ) : null}

                {hasHardware ? (
                    <div className="space-y-2 rounded-xl border border-[var(--color-border-strong)]/[0.08] bg-[var(--color-surface)]/[0.03] p-4">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">System requirements (PC)</p>
                        <dl className="grid gap-x-4 gap-y-2 text-xs text-slate-400 sm:grid-cols-2 lg:grid-cols-3">
                            {hw.minProcessor ? (
                                <>
                                    <dt className="text-slate-600">Min. CPU</dt>
                                    <dd>{hw.minProcessor}</dd>
                                </>
                            ) : null}
                            {hw.recommendedProcessor ? (
                                <>
                                    <dt className="text-slate-600">Rec. CPU</dt>
                                    <dd>{hw.recommendedProcessor}</dd>
                                </>
                            ) : null}
                            {hw.minGraphics ? (
                                <>
                                    <dt className="text-slate-600">Min. GPU</dt>
                                    <dd>{hw.minGraphics}</dd>
                                </>
                            ) : null}
                            {hw.recommendedGraphics ? (
                                <>
                                    <dt className="text-slate-600">Rec. GPU</dt>
                                    <dd>{hw.recommendedGraphics}</dd>
                                </>
                            ) : null}
                            {typeof hw.approximateDownloadGb === 'number' ? (
                                <>
                                    <dt className="text-slate-600">Approx. download</dt>
                                    <dd>~{hw.approximateDownloadGb} GB</dd>
                                </>
                            ) : null}
                        </dl>
                    </div>
                ) : null}

                {detail.trailer?.playUrl ? (
                    <div className="flex flex-wrap items-center gap-3">
                        {detail.trailer.previewImage ? (
                            <a
                                href={detail.trailer.playUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="group relative block shrink-0 overflow-hidden rounded-lg ring-1 ring-[var(--color-border-strong)]/10"
                            >
                                <img
                                    src={detail.trailer.previewImage}
                                    alt=""
                                    className="h-24 w-40 object-cover transition-opacity group-hover:opacity-90"
                                    loading="lazy"
                                />
                                <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                                    <FaCirclePlay className="h-8 w-8 text-white drop-shadow" aria-hidden />
                                </span>
                            </a>
                        ) : null}
                        <a
                            href={detail.trailer.playUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-1.5 text-xs font-medium text-sky-200 hover:bg-sky-500/20"
                        >
                            <FaCirclePlay className="h-3.5 w-3.5" aria-hidden />
                            {detail.trailer.caption || 'Watch trailer'}
                        </a>
                        <span className="text-[10px] text-slate-600">Stream may require a compatible player (HLS/DASH).</span>
                    </div>
                ) : null}

                {fullDesc ? (
                    <div className="space-y-2">
                        <button
                            type="button"
                            onClick={() => setDescOpen((o) => !o)}
                            className="text-left text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90 hover:text-emerald-300"
                        >
                            {descOpen ? 'Hide full description' : 'Show full description'}
                        </button>
                        {descOpen ? (
                            <p className="max-h-72 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-slate-400">{fullDesc}</p>
                        ) : null}
                    </div>
                ) : null}

                {detail.screenshots?.length > 0 ? (
                    <div className="space-y-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-600">Screenshots</p>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                            {detail.screenshots.slice(0, 18).map((src, i) => (
                                <div
                                    key={i}
                                    className="aspect-video overflow-hidden rounded-lg ring-1 ring-[var(--color-border-strong)]/10"
                                >
                                    <img
                                        src={src}
                                        alt=""
                                        className="h-full w-full object-cover"
                                        loading="lazy"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>
                ) : null}

                {detail.copyrightNotice ? (
                    <p className="text-[10px] leading-relaxed text-slate-600">{detail.copyrightNotice}</p>
                ) : null}
            </div>

            <div className="flex flex-col gap-4 border-t border-[var(--color-border-strong)]/10 bg-[var(--mx-color-0a0a0a)] px-5 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-8 lg:px-10">
                {esrb?.letter ? (
                    <div className="flex max-w-xl items-start gap-3">
                        <div
                            className="flex h-14 w-14 shrink-0 items-center justify-center rounded border-2 border-[var(--color-border-strong)] text-lg font-black text-white"
                            aria-hidden
                        >
                            {esrb.letter}
                        </div>
                        <div className="min-w-0 space-y-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">ESRB</p>
                            {esrb.descriptors?.length > 0 ? (
                                <p className="text-xs leading-snug text-slate-400">{esrb.descriptors.join(', ')}</p>
                            ) : (
                                <p className="text-xs text-slate-500">Content rating from Microsoft Store catalog.</p>
                            )}
                        </div>
                    </div>
                ) : (
                    <p className="max-w-md text-[11px] leading-relaxed text-slate-600">
                        Ratings and offers vary by region. Open the store page for the latest price, bundles, and parental controls.
                    </p>
                )}
            </div>
        </div>
    )
}

/**
 * Full-screen game detail overlay (LifeSync client OpenXBL explorer parity).
 */
export function StoreGameDetailModal({ open, detail, busy, onClose }) {
    useEffect(() => {
        if (!open) return
        const prevOverflow = document.body.style.overflow
        const onKeyDown = (event) => {
            if (event.key === 'Escape') onClose()
        }
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', onKeyDown)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            document.body.style.overflow = prevOverflow
        }
    }, [open, onClose])

    if (!open) return null

    return createPortal(
        <div
            className="fixed inset-0 z-[80] flex flex-col bg-slate-950/95 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Game details"
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose()
            }}
        >
            <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border-strong)]/10 bg-black/55 px-4 py-3 sm:px-6">
                <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/80">Game details</p>
                    <p className="truncate text-sm font-semibold text-slate-100">{detail?.title || 'Selected game'}</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-border-strong)]/15 bg-[var(--color-surface)]/[0.06] px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-[var(--color-surface)]/[0.1]"
                >
                    <FaXmark className="h-3.5 w-3.5" aria-hidden />
                    Close
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8">
                <div className="mx-auto w-full max-w-[90rem]">
                    {busy ? (
                        <div className="rounded-2xl border border-[var(--color-border-strong)]/10 bg-black/40 px-6 py-16 text-center text-sm text-slate-400">
                            Loading game details…
                        </div>
                    ) : detail ? (
                        <StoreGameDetailPanel key={detail.productId || detail.title || 'detail'} detail={detail} />
                    ) : (
                        <div className="rounded-2xl border border-[var(--color-border-strong)]/10 bg-black/40 px-6 py-16 text-center text-sm text-slate-400">
                            No extra details are available for this title.
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body,
    )
}
