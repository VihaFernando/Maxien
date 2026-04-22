import { useMemo, useState } from 'react'
import { LifesyncEpisodeThumbnail } from './EpisodeLoadingSkeletons'
import { useCheapSharkDeals } from '../../hooks/useCheapSharkDeals'
import { useCheapSharkStores } from '../../hooks/useCheapSharkStores'

const DEFAULT_PAGE_SIZE = 12

function formatMoney(value) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return '--'
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(numeric)
}

function formatSavings(value) {
    const numeric = Number(value)
    if (!Number.isFinite(numeric) || numeric <= 0) return null
    return `${Math.round(numeric)}% off`
}

function DealsCard({ item }) {
    const [imgErr, setImgErr] = useState(false)
    const savings = formatSavings(item.savings)

    return (
        <a
            href={item.dealUrl}
            target="_blank"
            rel="noreferrer"
            className="lifesync-games-glass group rounded-[18px] border border-[var(--mx-color-d2d2d7)]/55 bg-[var(--color-surface)] shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
        >
            <div className="relative aspect-video w-full overflow-hidden rounded-t-[18px] bg-[var(--mx-color-f5f5f7)]">
                {item.thumb && !imgErr ? (
                    <LifesyncEpisodeThumbnail
                        src={item.thumb}
                        className="absolute inset-0 h-full w-full"
                        imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        imgProps={{ onError: () => setImgErr(true) }}
                    />
                ) : (
                    <div className="h-full w-full bg-linear-to-br from-[var(--mx-color-f5f5f7)] to-[var(--mx-color-ececf1)]" />
                )}

                {savings ? (
                    <span className="absolute right-2 top-2 rounded-lg bg-[var(--mx-color-c6ff00)] px-2 py-0.5 text-[11px] font-bold text-[var(--mx-color-1d1d1f)] shadow-sm">
                        {savings}
                    </span>
                ) : null}
            </div>

            <div className="space-y-2 p-3">
                <p className="line-clamp-2 text-[13px] font-semibold text-[var(--mx-color-1d1d1f)]">{item.title || 'Untitled Deal'}</p>
                <p className="text-[11px] text-[var(--mx-color-6e6e73)]">{item.storeName || 'Store unavailable'}</p>

                <div className="flex items-center gap-2 text-[12px]">
                    <span className="font-bold text-[var(--mx-color-1d1d1f)]">{formatMoney(item.salePrice)}</span>
                    <span className="text-[var(--mx-color-8a8a8e)] line-through">{formatMoney(item.normalPrice)}</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[var(--mx-color-6e6e73)]">
                    <span>{item.dealRating != null ? `Deal ${item.dealRating}` : 'Live deal'}</span>
                    <span>{item.steamRatingPercent != null ? `${item.steamRatingPercent}% Steam` : 'N/A'}</span>
                </div>
            </div>
        </a>
    )
}

export function CheapSharkGameDeals() {
    const [storeId, setStoreId] = useState('')
    const [pageNumber, setPageNumber] = useState(0)
    const [searchInput, setSearchInput] = useState('')
    const [search, setSearch] = useState('')

    const {
        data: storesData,
        loading: storesLoading,
        error: storesError,
    } = useCheapSharkStores({ view: 'standard' })

    const {
        data: dealsData,
        loading: dealsLoading,
        error: dealsError,
        refetch: refetchDeals,
    } = useCheapSharkDeals({
        storeId: storeId || undefined,
        pageNumber,
        pageSize: DEFAULT_PAGE_SIZE,
        title: search || undefined,
        sortBy: 'Deal Rating',
        desc: true,
        onSale: true,
        view: 'standard',
    })

    const stores = useMemo(() => {
        const rows = Array.isArray(storesData?.data) ? storesData.data : []
        return rows.filter((row) => row?.storeId && row?.storeName)
    }, [storesData?.data])

    const deals = useMemo(() => {
        const rows = Array.isArray(dealsData?.data) ? dealsData.data : []
        return rows
    }, [dealsData?.data])

    const hasMore = Boolean(dealsData?.pageInfo?.hasMore)

    const onSubmitSearch = (event) => {
        event.preventDefault()
        setPageNumber(0)
        setSearch(searchInput.trim())
    }

    const onChangeStore = (event) => {
        setStoreId(event.target.value)
        setPageNumber(0)
    }

    return (
        <section className="lifesync-games-glass space-y-4 rounded-[20px] border border-[var(--mx-color-d2d2d7)]/55 bg-[var(--color-surface)]/95 p-4 shadow-sm sm:p-5">
            <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-[var(--mx-color-6e6e73)]">CheapShark • Game Deals</p>
                    <h2 className="mt-0.5 text-[24px] font-bold tracking-tight text-[var(--mx-color-1d1d1f)]">Live Deals</h2>
                    <p className="mt-1 text-[13px] text-[var(--mx-color-515154)]">
                        Store prices and discounts from CheapShark, saved in LifeSync MongoDB for fast fallback.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => refetchDeals()}
                    className="inline-flex h-[38px] items-center justify-center rounded-xl border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] px-3 text-[12px] font-semibold text-[var(--mx-color-1d1d1f)] transition hover:bg-[var(--mx-color-f5f5f7)]"
                >
                    Refresh deals
                </button>
            </header>

            <div className="grid gap-3 md:grid-cols-3">
                <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--mx-color-6e6e73)]" htmlFor="cheapshark-store-filter">
                        Store
                    </label>
                    <select
                        id="cheapshark-store-filter"
                        value={storeId}
                        onChange={onChangeStore}
                        disabled={storesLoading}
                        className="h-[40px] w-full rounded-xl border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--mx-color-1d1d1f)] outline-none focus:border-[var(--mx-color-0071e3)]"
                    >
                        <option value="">All stores</option>
                        {stores.map((store) => (
                            <option key={store.storeId} value={store.storeId}>
                                {store.storeName}
                            </option>
                        ))}
                    </select>
                </div>

                <form onSubmit={onSubmitSearch} className="md:col-span-2">
                    <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-[var(--mx-color-6e6e73)]" htmlFor="cheapshark-search">
                        Search deals
                    </label>
                    <div className="flex gap-2">
                        <input
                            id="cheapshark-search"
                            type="search"
                            value={searchInput}
                            onChange={(event) => setSearchInput(event.target.value)}
                            placeholder="E.g. Cyberpunk, Elden Ring"
                            className="h-[40px] min-w-0 flex-1 rounded-xl border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] px-3 text-[13px] text-[var(--mx-color-1d1d1f)] outline-none focus:border-[var(--mx-color-0071e3)]"
                        />
                        <button
                            type="submit"
                            className="h-[40px] rounded-xl bg-[var(--mx-color-0071e3)] px-4 text-[12px] font-semibold text-white transition hover:brightness-95"
                        >
                            Search
                        </button>
                    </div>
                </form>
            </div>

            {storesError ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                    Stores failed to refresh: {storesError.message}
                </div>
            ) : null}

            {dealsError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
                    Deals failed to load: {dealsError.message}
                </div>
            ) : null}

            {dealsLoading ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, idx) => (
                        <div key={idx} className="lifesync-games-glass animate-pulse overflow-hidden rounded-[18px] border border-[var(--mx-color-d2d2d7)]/55 bg-[var(--color-surface)]">
                            <div className="aspect-video bg-[var(--mx-color-f5f5f7)]" />
                            <div className="space-y-2 p-3">
                                <div className="h-4 rounded bg-[var(--mx-color-f1f1f4)]" />
                                <div className="h-3 w-2/3 rounded bg-[var(--mx-color-f1f1f4)]" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : deals.length ? (
                <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {deals.map((item) => (
                            <DealsCard key={item.dealId || `${item.storeId}-${item.title}`} item={item} />
                        ))}
                    </div>

                    <div className="flex items-center justify-center gap-2 pt-1">
                        <button
                            type="button"
                            onClick={() => setPageNumber((prev) => Math.max(0, prev - 1))}
                            disabled={pageNumber <= 0}
                            className="rounded-lg border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--mx-color-1d1d1f)] transition hover:bg-[var(--mx-color-f5f5f7)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="min-w-[88px] text-center text-[12px] font-semibold text-[var(--mx-color-6e6e73)]">
                            Page {pageNumber + 1}
                        </span>
                        <button
                            type="button"
                            onClick={() => setPageNumber((prev) => prev + 1)}
                            disabled={!hasMore}
                            className="rounded-lg border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] px-3 py-2 text-[12px] font-semibold text-[var(--mx-color-1d1d1f)] transition hover:bg-[var(--mx-color-f5f5f7)] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </>
            ) : (
                <div className="lifesync-games-glass rounded-xl border border-[var(--mx-color-d2d2d7)]/55 bg-[var(--mx-color-f5f5f7)] px-4 py-6 text-center text-[13px] text-[var(--mx-color-6e6e73)]">
                    No deals found for this filter.
                </div>
            )}
        </section>
    )
}
