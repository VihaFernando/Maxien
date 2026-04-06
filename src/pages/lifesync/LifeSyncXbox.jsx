import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
    LifesyncAchievementRowsSkeleton,
    LifesyncEpisodeThumbnail,
    LifesyncXboxCatalogGridSkeleton,
    LifesyncXboxLibraryGridSkeleton,
    LifesyncXboxProfileSkeleton,
} from '../../components/lifesync/EpisodeLoadingSkeletons'
import { StoreGameDetailModal } from '../../components/lifesync/StoreGameDetailModal'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch } from '../../lib/lifesyncApi'
import { fetchMsStoreDetailsMap, fetchMsStoreProductDetail } from '../../lib/msStoreCatalogLifeSync'
import { detailFromOpenXblProductSummary } from '../../lib/msStoreParseProductDetail'
import {
    extractMinutesPlayedMapFromStats,
    extractOpenXblItemList,
    extractPlayerTitleAchievements,
    extractTitleHistoryItems,
    formatPlaytimeHours,
    indexV3TitlesByTitleId,
    isAchievementUnlocked,
    mergeLibraryRowWithV3Title,
    normalizeTitleHistoryRow,
    pickAchievementGamerscoreReward,
    pickMicrosoftStoreBigId,
    pickOpenXblItemImage,
    pickOpenXblItemTitle,
    summarizeAchievementList,
    summarizeOpenXblPresence,
} from '../../lib/openXblLifeSyncHelpers'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'

const GAMEPASS_FEEDS = [
    { id: 'all', label: 'All', segments: ['gamepass', 'all'] },
    { id: 'pc', label: 'PC', segments: ['gamepass', 'pc'] },
    { id: 'ea-play', label: 'EA Play', segments: ['gamepass', 'ea-play'] },
    { id: 'no-controller', label: 'Cloud / touch', segments: ['gamepass', 'no-controller'] },
]

const LIBRARY_MAX = 36
const STATS_BATCH = 24
const DEALS_PAGE_SIZE = 24
/** Matches xl:grid-cols-6 — full rows per page */
const GAMEPASS_PAGE_SIZE = 24

/** Game Pass + Store deals: six tiles per row on wide viewports */
const CATALOG_GRID_CLASS =
    'grid gap-2.5 sm:gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6'

function flattenDeals(root) {
    if (!root) return []
    if (Array.isArray(root)) return root
    return root.Products || root.products || root.items || root.Items || root.value || []
}

function normalizeDeal(p) {
    const bigId = p && typeof p === 'object' ? pickMicrosoftStoreBigId(p) : null
    if (p && typeof p === 'object' && typeof p.storeUrl === 'string' && typeof p.title === 'string') {
        return {
            key: String(p.id || p.title),
            bigId,
            title: p.title,
            imageUrl: p.imageUrl || null,
            href: p.storeUrl,
            subtitle: p.priceText || 'Deal',
        }
    }
    const title = p?.LocalizedTitle?.[0]?.value || p?.LocalizedTitle || p?.ProductTitle || p?.title || p?.Title || p?.name || 'Deal'
    const key = String(p?.ProductId || p?.productId || p?.id || title)
    return {
        key,
        bigId,
        title,
        imageUrl: null,
        href: `https://www.xbox.com/search?q=${encodeURIComponent(title)}`,
        subtitle: 'Microsoft Store',
    }
}

/** Minimal store detail when Display Catalog / OpenXBL summary is unavailable */
function buildFallbackStoreDetail({ title, href, imageUrl, subtitle, tagline }) {
    const emptyHw = {
        minProcessor: null,
        recommendedProcessor: null,
        minGraphics: null,
        recommendedGraphics: null,
        approximateDownloadGb: null,
    }
    return {
        productId: null,
        title: title || 'Game',
        shortDescription: tagline || subtitle || null,
        description: null,
        developer: null,
        publisher: null,
        heroImage: imageUrl || null,
        posterImage: imageUrl || null,
        backdropImage: imageUrl || null,
        screenshots: [],
        category: null,
        categories: [],
        priceText: subtitle || null,
        purchasePriceFormatted: null,
        msrpFormatted: null,
        isOnSale: false,
        savingsFormatted: null,
        saleEndsLabel: null,
        listPrice: null,
        msrp: null,
        currency: 'USD',
        gamePassLikely: false,
        gamePassOffers: [],
        esrbFooter: null,
        productType: null,
        productKind: null,
        storeUrl: href || null,
        releaseDateIso: null,
        releaseDateLabel: null,
        minimumUserAge: null,
        contentRatings: [],
        storeRating: null,
        features: [],
        supportedLanguages: [],
        hardware: emptyHw,
        trailer: null,
        xboxTitleId: null,
        supportUri: null,
        privacyPolicyUri: null,
        copyrightNotice: null,
    }
}

function PaginationBar({ page, pageCount, totalLabel, busy, onPrev, onNext }) {
    if (pageCount <= 1) {
        return totalLabel ? (
            <p className="text-[12px] text-[#86868b]">{totalLabel}</p>
        ) : null
    }
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            {totalLabel ? <p className="text-[12px] text-[#86868b]">{totalLabel}</p> : <span />}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={busy || page <= 1}
                    onClick={onPrev}
                    className="rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-1.5 text-[12px] font-semibold text-[#1d1d1f] hover:bg-[#ebebed] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Previous
                </button>
                <span className="text-[12px] font-medium text-[#424245] tabular-nums">
                    Page {page} of {pageCount}
                </span>
                <button
                    type="button"
                    disabled={busy || page >= pageCount}
                    onClick={onNext}
                    className="rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-1.5 text-[12px] font-semibold text-[#1d1d1f] hover:bg-[#ebebed] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                    Next
                </button>
            </div>
        </div>
    )
}

function extractOpenXblPeople(payload) {
    if (!payload || typeof payload !== 'object') return []
    const raw = payload.content?.people ?? payload.people
    return Array.isArray(raw) ? raw : []
}

function pickPersonDisplayName(person) {
    if (!person || typeof person !== 'object') return 'Player'
    return (
        person.uniqueModernGamertag ||
        [person.modernGamertag, person.modernGamertagSuffix].filter(Boolean).join('') ||
        person.gamertag ||
        'Player'
    )
}

function pickBestGamertagMatch(people, query) {
    if (!Array.isArray(people) || people.length === 0) return null
    const q = String(query || '').trim().toLowerCase()
    if (!q) return people[0]
    return (
        people.find((p) => {
            const values = [
                p?.uniqueModernGamertag,
                p?.gamertag,
                p?.modernGamertag,
                [p?.modernGamertag, p?.modernGamertagSuffix].filter(Boolean).join(''),
            ].filter(Boolean)
            return values.some((v) => String(v).trim().toLowerCase() === q)
        }) || people[0]
    )
}

function formatTier(tier) {
    if (tier == null || tier === '') return null
    const s = String(tier)
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

function mergeRowsWithMinutesMap(rows, map) {
    if (!map || map.size === 0) return rows
    return rows.map((r) => {
        if (!r.titleId || r.minutesPlayed != null) return r
        const m = map.get(String(r.titleId))
        if (m == null || !Number.isFinite(m)) return r
        return {
            ...r,
            minutesPlayed: m,
            playtimeLabel: formatPlaytimeHours(m),
        }
    })
}

function DealTile({ title, imageUrl, subtitle, tagline, onOpen }) {
    const hasArt = Boolean(imageUrl)
    return (
        <button
            type="button"
            onClick={onOpen}
            className="group relative aspect-[2/3] w-full overflow-hidden rounded-[12px] sm:rounded-[14px] border border-[#d2d2d7]/50 bg-[#f5f5f7] text-left shadow-sm transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#107C10]/40 focus-visible:ring-offset-2"
        >
            {hasArt ? (
                <LifesyncEpisodeThumbnail
                    src={imageUrl}
                    className="absolute inset-0 h-full w-full"
                    imgClassName="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#f5f5f7] to-[#e8e8ed]">
                    <svg className="h-9 w-9 text-[#c7c7cc]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                    </svg>
                    <span className="mt-2 text-[10px] font-medium text-[#86868b]">No art</span>
                </div>
            )}
            <div
                className={`pointer-events-none absolute inset-0 ${hasArt ? 'bg-gradient-to-t from-black/88 via-black/35 to-black/5' : ''}`}
                aria-hidden
            />
            <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-2.5 pt-14 sm:p-3 sm:pt-16">
                <p
                    className={`line-clamp-2 text-[11px] font-bold leading-snug sm:text-[12px] ${hasArt ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]' : 'text-[#1d1d1f]'}`}
                >
                    {title}
                </p>
                {subtitle ? (
                    <p
                        className={`mt-0.5 line-clamp-1 text-[10px] font-medium sm:text-[11px] ${hasArt ? 'text-white/85' : 'text-[#424245]'}`}
                    >
                        {subtitle}
                    </p>
                ) : null}
                {tagline ? (
                    <p
                        className={`mt-1 line-clamp-2 text-[9px] leading-snug sm:text-[10px] ${hasArt ? 'text-white/70' : 'text-[#86868b]'}`}
                    >
                        {tagline}
                    </p>
                ) : null}
                <p
                    className={`mt-1.5 text-[9px] font-semibold sm:text-[10px] ${hasArt ? 'text-[#6ecf6e]' : 'text-[#107C10]'}`}
                >
                    View details
                </p>
            </div>
        </button>
    )
}

function ProfileCard({ person, presenceBusy, presence }) {
    const d = person?.detail || {}
    const accent = person?.preferredColor?.primaryColor ? `#${String(person.preferredColor.primaryColor).replace(/^#/, '')}` : null
    const display = pickPersonDisplayName(person)
    const platforms = Array.isArray(person?.preferredPlatforms) ? person.preferredPlatforms : []
    const gamerScore = Number(person?.gamerScore)
    const showGamerScore = Number.isFinite(gamerScore) && person?.gamerScore !== ''
    const xboxSearch = `https://www.xbox.com/search?q=${encodeURIComponent(person?.gamertag || display)}`

    return (
        <article
            className="rounded-[18px] border border-[#d2d2d7]/50 bg-white p-4 shadow-sm sm:flex sm:gap-4"
            style={accent ? { borderLeftWidth: 4, borderLeftColor: accent, borderLeftStyle: 'solid' } : undefined}
        >
            <div className="mx-auto shrink-0 sm:mx-0">
                {person?.displayPicRaw ? (
                    <img src={person.displayPicRaw} alt="" className="h-24 w-24 rounded-xl object-cover ring-1 ring-[#e5e5ea]" loading="lazy" />
                ) : (
                    <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-[#f5f5f7] ring-1 ring-[#e5e5ea] text-[#86868b]">
                        <svg className="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                    </div>
                )}
            </div>
            <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
                <div>
                    <h3 className="flex flex-wrap items-center justify-center gap-2 text-[17px] font-bold text-[#1d1d1f] sm:justify-start">
                        <span className="truncate">{display}</span>
                        {d.isVerified ? (
                            <span className="rounded-md bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700">Verified</span>
                        ) : null}
                    </h3>
                    {person?.gamertag && person.gamertag !== display ? (
                        <p className="text-[12px] text-[#86868b]">Classic gamertag: {person.gamertag}</p>
                    ) : null}
                    <p className="mt-0.5 font-mono text-[11px] text-[#aeaeb2]">Player ID {person?.xuid ?? '—'}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                    {showGamerScore ? (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-2 py-1 text-[11px] font-medium text-[#1d1d1f]">
                            {gamerScore.toLocaleString()} GS
                        </span>
                    ) : null}
                    {formatTier(d.accountTier) ? (
                        <span className="rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-2 py-1 text-[11px] text-[#1d1d1f]">{formatTier(d.accountTier)}</span>
                    ) : null}
                    {person?.xboxOneRep ? (
                        <span className="rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-2 py-1 text-[11px] text-[#1d1d1f]">{person.xboxOneRep}</span>
                    ) : null}
                    {typeof d.followerCount === 'number' ? (
                        <span className="rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-2 py-1 text-[11px] text-[#1d1d1f]">{d.followerCount.toLocaleString()} followers</span>
                    ) : null}
                    {d.hasGamePass === true ? (
                        <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800">Game Pass</span>
                    ) : null}
                    {presenceBusy ? (
                        <span className="rounded-lg border border-[#e5e5ea] bg-[#fafafa] px-2 py-1 text-[11px] text-[#86868b]">Checking activity…</span>
                    ) : presence ? (
                        <span className="rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-900">{presence.status}</span>
                    ) : null}
                </div>
                {!presenceBusy && presence?.game ? (
                    <p className="text-[12px] text-[#424245]">
                        <span className="font-semibold text-[#1d1d1f]">{presence.game}</span>
                        {presence.detail ? <span className="text-[#86868b]"> · {presence.detail}</span> : null}
                    </p>
                ) : null}
                {platforms.length > 0 ? (
                    <p className="text-[11px] text-[#86868b]">
                        Plays on{' '}
                        {platforms.map((platform) => (
                            <span key={platform} className="mr-1 inline-block rounded-md bg-[#f5f5f7] px-1.5 py-0.5 text-[#424245]">
                                {platform}
                            </span>
                        ))}
                    </p>
                ) : null}
                {(person?.realName || d.bio || d.location) ? (
                    <div className="space-y-0.5 text-[13px] text-[#424245]">
                        {person.realName ? <p className="font-semibold text-[#1d1d1f]">{person.realName}</p> : null}
                        {d.location ? <p>{d.location}</p> : null}
                        {d.bio ? <p className="text-[#86868b]">{d.bio}</p> : null}
                    </div>
                ) : null}
                <a href={xboxSearch} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#0071e3] hover:underline">
                    View on Xbox.com
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                </a>
            </div>
        </article>
    )
}

function GamePassTile({ item, catalog, onOpenDetail }) {
    const bigId = pickMicrosoftStoreBigId(item)
    const cat = bigId && catalog instanceof Map ? catalog.get(bigId) : null
    const title = cat?.title || pickOpenXblItemTitle(item)
    const img = cat?.heroImage || pickOpenXblItemImage(item)
    const href = cat?.storeUrl || (bigId ? `https://www.xbox.com/games/store/p/${encodeURIComponent(bigId)}` : `https://www.xbox.com/search?q=${encodeURIComponent(title)}`)
    const priceLine = cat?.priceText || null
    const blurb = cat?.shortDescription || null
    const hasArt = Boolean(img)

    return (
        <button
            type="button"
            onClick={() =>
                onOpenDetail({
                    bigId,
                    openXblItem: item,
                    fallback: { title, href, imageUrl: img, subtitle: priceLine, tagline: blurb },
                })
            }
            className="group relative aspect-[2/3] w-full overflow-hidden rounded-[12px] sm:rounded-[14px] border border-[#d2d2d7]/50 bg-[#f5f5f7] text-left shadow-sm transition-all hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#107C10]/40 focus-visible:ring-offset-2"
        >
            {hasArt ? (
                <LifesyncEpisodeThumbnail
                    src={img}
                    className="absolute inset-0 h-full w-full"
                    imgClassName="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#f5f5f7] to-[#e8e8ed]">
                    <span className="text-[10px] font-medium text-[#aeaeb2]">No art</span>
                </div>
            )}
            <div
                className={`pointer-events-none absolute inset-0 ${hasArt ? 'bg-gradient-to-t from-black/88 via-black/35 to-black/5' : ''}`}
                aria-hidden
            />
            <div className="absolute right-2 top-2 z-10">
                <span className="rounded-md bg-[#107C10]/95 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white shadow-sm backdrop-blur-[2px]">
                    Pass
                </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-2.5 pt-14 sm:p-3 sm:pt-16">
                <p
                    className={`line-clamp-2 text-[11px] font-bold leading-snug sm:text-[12px] ${hasArt ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]' : 'text-[#1d1d1f]'}`}
                >
                    {title}
                </p>
                {priceLine ? (
                    <p
                        className={`mt-0.5 line-clamp-1 text-[9px] font-semibold sm:text-[10px] ${hasArt ? 'text-[#6ecf6e]' : 'text-[#107C10]'}`}
                    >
                        {priceLine}
                    </p>
                ) : null}
                {blurb ? (
                    <p
                        className={`mt-1 line-clamp-2 text-[9px] leading-snug sm:text-[10px] ${hasArt ? 'text-white/75' : 'text-[#86868b]'}`}
                    >
                        {blurb}
                    </p>
                ) : null}
                <p
                    className={`mt-1.5 text-[9px] font-semibold sm:text-[10px] ${hasArt ? 'text-[#6ecf6e]' : 'text-[#107C10]'}`}
                >
                    View details
                </p>
            </div>
        </button>
    )
}

function LibraryGameTile({ row, selected, onSelect, disabled }) {
    const hasArt = Boolean(row.imageUrl)
    return (
        <button
            type="button"
            onClick={onSelect}
            disabled={disabled}
            className={`group relative aspect-[2/3] w-full overflow-hidden rounded-[14px] border text-left shadow-sm transition-all ${
                selected ? 'border-[#107C10] ring-2 ring-[#107C10]/30 ring-offset-2 ring-offset-[#fafafa]' : 'border-[#d2d2d7]/50 hover:shadow-md'
            } ${disabled ? 'cursor-not-allowed opacity-60 hover:shadow-sm' : ''} bg-[#f5f5f7]`}
        >
            {hasArt ? (
                <LifesyncEpisodeThumbnail
                    src={row.imageUrl}
                    className="absolute inset-0 h-full w-full"
                    imgClassName="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.04] group-disabled:scale-100"
                />
            ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-[#f5f5f7] to-[#e8e8ed]">
                    <span className="text-[10px] font-medium text-[#aeaeb2]">No art</span>
                </div>
            )}
            <div
                className={`pointer-events-none absolute inset-0 ${hasArt ? 'bg-gradient-to-t from-black/88 via-black/40 to-black/5' : ''}`}
                aria-hidden
            />
            <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col justify-end p-2.5 pt-12 sm:pt-14">
                <p
                    className={`line-clamp-2 text-[11px] font-bold leading-snug sm:text-[12px] ${hasArt ? 'text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.85)]' : 'text-[#1d1d1f]'}`}
                >
                    {row.name}
                </p>
                <p className={`mt-0.5 text-[9px] sm:text-[10px] ${hasArt ? 'text-white/80' : 'text-[#86868b]'}`}>
                    {row.lastPlayedLabel ? `Last played ${row.lastPlayedLabel}` : 'Last played —'}
                </p>
                <p className={`text-[9px] font-medium sm:text-[10px] ${hasArt ? 'text-white/90' : 'text-[#424245]'}`}>
                    {row.playtimeLabel ?? 'Playtime unknown'}
                </p>
                {row.achHint ? (
                    <p
                        className={`mt-1 line-clamp-2 text-[9px] sm:text-[10px] ${hasArt ? 'text-emerald-300' : 'text-emerald-800'}`}
                    >
                        {row.achHint}
                    </p>
                ) : null}
            </div>
        </button>
    )
}

function AchievementDetailPanel({ gameTitle, busy, err, payload }) {
    const list = useMemo(() => extractPlayerTitleAchievements(payload), [payload])
    const summary = useMemo(() => summarizeAchievementList(list), [list])
    const pct =
        summary.total > 0 ? Math.round((summary.unlocked / summary.total) * 100) : 0

    return (
        <div className="rounded-[18px] border border-[#d2d2d7]/50 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-[#e5e5ea] px-4 py-3 bg-[#fafafa]">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b]">Achievements</p>
                <h3 className="text-[15px] font-bold text-[#1d1d1f] truncate">{gameTitle || 'Selected game'}</h3>
                {busy ? (
                    <div className="mt-2 h-2 w-full max-w-xs rounded-full bg-[#e5e5ea] overflow-hidden">
                        <div className="h-full w-[38%] rounded-full lifesync-skeleton-shimmer-light" />
                    </div>
                ) : null}
                {err ? (
                    <p className="text-[12px] text-red-600 mt-1">We couldn&apos;t load achievements for this game. Try again in a moment.</p>
                ) : null}
                {!busy && !err && list.length > 0 ? (
                    <div className="mt-2 space-y-1">
                        <div className="h-2 rounded-full bg-[#e5e5ea] overflow-hidden">
                            <div className="h-full bg-[#107C10] transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[11px] text-[#424245]">
                            {summary.unlocked}/{summary.total} unlocked
                            {summary.gsPossible > 0 ? (
                                <span>
                                    {' '}
                                    · {summary.gsEarned.toLocaleString()}/{summary.gsPossible.toLocaleString()} GS
                                </span>
                            ) : null}
                        </p>
                    </div>
                ) : null}
            </div>
            {busy ? <LifesyncAchievementRowsSkeleton rows={8} /> : null}
            {!busy && !err && list.length === 0 ? (
                <p className="text-[13px] text-[#86868b] px-4 py-6 text-center">No achievement list is available for this title.</p>
            ) : null}
            {!busy && list.length > 0 ? (
                <ul className="max-h-[22rem] overflow-y-auto divide-y divide-[#e5e5ea]">
                    {list.map((a, i) => {
                        const unlocked = isAchievementUnlocked(a)
                        const name = a.name ?? a.achievementName ?? a.title ?? `Achievement ${i + 1}`
                        const desc = a.description ?? a.achievementDescription ?? ''
                        const gs = pickAchievementGamerscoreReward(a)
                        const icon =
                            (Array.isArray(a.mediaAssets) &&
                                a.mediaAssets.find((m) => m && String(m.type || m.Type || '').toLowerCase() === 'icon')?.url) ||
                            (Array.isArray(a.mediaAssets) && a.mediaAssets[0]?.url) ||
                            null
                        return (
                            <li key={String(a.achievementId ?? a.id ?? i)} className="flex gap-3 px-3 py-2">
                                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#f5f5f7]">
                                    {icon ? (
                                        <img
                                            src={icon}
                                            alt=""
                                            className={`h-full w-full object-cover ${unlocked ? '' : 'opacity-35 grayscale'}`}
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="flex h-full w-full items-center justify-center text-[#aeaeb2] text-[10px] font-bold">A</div>
                                    )}
                                    {!unlocked ? (
                                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[8px] font-bold text-white uppercase">
                                            Locked
                                        </span>
                                    ) : null}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[12px] font-semibold text-[#1d1d1f] line-clamp-2">{name}</p>
                                    {gs != null ? <span className="text-[10px] text-amber-800">{gs} GS</span> : null}
                                    {desc ? <p className="text-[11px] text-[#86868b] line-clamp-2 mt-0.5">{desc}</p> : null}
                                </div>
                            </li>
                        )
                    })}
                </ul>
            ) : null}
        </div>
    )
}

export default function LifeSyncXbox() {
    const { isLifeSyncConnected, lifeSyncUser } = useLifeSync()
    const linkedGamertag = String(lifeSyncUser?.preferences?.xboxGamertag || '').trim()

    const [mainTab, setMainTab] = useState('library')
    const [gpFeedId, setGpFeedId] = useState('all')

    const [deals, setDeals] = useState([])
    const [dealsError, setDealsError] = useState('')
    const [meta, setMeta] = useState(null)
    const [dealsBusy, setDealsBusy] = useState(false)

    const [openXbl, setOpenXbl] = useState(null)
    const [dashBusy, setDashBusy] = useState(false)
    const [dashErr, setDashErr] = useState('')

    const [profileBusy, setProfileBusy] = useState(false)
    const [profileErr, setProfileErr] = useState('')
    const [profilePayload, setProfilePayload] = useState(null)

    const [libraryRows, setLibraryRows] = useState([])
    const [libraryBusy, setLibraryBusy] = useState(false)
    const [libraryErr, setLibraryErr] = useState('')

    const [gpItems, setGpItems] = useState([])
    const [gpBusy, setGpBusy] = useState(false)
    const [gpErr, setGpErr] = useState('')

    const [selectedLibraryTitleId, setSelectedLibraryTitleId] = useState(null)
    const [achPayload, setAchPayload] = useState(null)
    const [achBusy, setAchBusy] = useState(false)
    const [achErr, setAchErr] = useState('')

    const [dealCatalogMap, setDealCatalogMap] = useState(() => new Map())
    const [gpCatalogMap, setGpCatalogMap] = useState(() => new Map())

    const [dealsPage, setDealsPage] = useState(1)
    const [gpPage, setGpPage] = useState(1)

    const [storeModalOpen, setStoreModalOpen] = useState(false)
    const [storeModalReq, setStoreModalReq] = useState(null)
    const [storeModalDetail, setStoreModalDetail] = useState(null)
    const [storeModalBusy, setStoreModalBusy] = useState(false)

    const [presencePayload, setPresencePayload] = useState(null)
    const [presenceBusy, setPresenceBusy] = useState(false)
    const [v3AchievementsPayload, setV3AchievementsPayload] = useState(null)

    const openStoreDetail = useCallback((req) => {
        setStoreModalReq(req)
        setStoreModalOpen(true)
    }, [])

    const closeStoreDetail = useCallback(() => {
        setStoreModalOpen(false)
        setStoreModalReq(null)
        setStoreModalDetail(null)
        setStoreModalBusy(false)
    }, [])

    const loadDeals = useCallback(async () => {
        setDealsBusy(true)
        setDealsError('')
        try {
            const data = await lifesyncFetch('/api/xbox/deals')
            const raw = flattenDeals(data?.deals)
            setDeals(raw.map(normalizeDeal))
            setDealsPage(1)
            setMeta({ locale: data?.locale, source: data?.source, totalProducts: data?.totalProducts })
        } catch {
            setDeals([])
            setDealsError('We couldn’t load deals right now. Try again shortly.')
        } finally {
            setDealsBusy(false)
        }
    }, [])

    const loadLinkedProfile = useCallback(async (statusPack, preferredGamertag) => {
        setProfileErr('')
        const preferred = String(preferredGamertag || '').trim()
        if (!preferred) {
            setProfilePayload(null)
            return
        }
        if (!statusPack?.configured) {
            setProfilePayload(null)
            setProfileErr('Your host hasn’t finished Xbox setup yet, so profiles and game data can’t load here. Store deals still work.')
            return
        }
        setProfileBusy(true)
        try {
            const data = await lifesyncFetch(`/api/xbox/openxbl/proxy/search/${encodeURIComponent(preferred)}`)
            const people = extractOpenXblPeople(data)
            const person = pickBestGamertagMatch(people, preferred)
            if (!person) {
                setProfilePayload(null)
                setProfileErr(`We couldn’t find an Xbox profile for “${preferred}”. Check the spelling or try another gamertag in Integrations.`)
                return
            }
            setProfilePayload({
                code: data?.code ?? 200,
                content: { people: [person] },
            })
        } catch {
            setProfilePayload(null)
            setProfileErr('We couldn’t load your Xbox profile. Try Refresh profile, or check Integrations.')
        } finally {
            setProfileBusy(false)
        }
    }, [])

    const loadXboxDashboard = useCallback(async () => {
        setDashBusy(true)
        setDashErr('')
        let statusPack = null
        try {
            const data = await lifesyncFetch('/api/xbox/openxbl/status')
            statusPack = data || null
            setOpenXbl(statusPack)
        } catch {
            setOpenXbl(null)
            setDashErr('We couldn’t reach Xbox services. Try again in a moment.')
        }

        await loadLinkedProfile(statusPack, linkedGamertag)
        setDashBusy(false)
    }, [loadLinkedProfile, linkedGamertag])

    useEffect(() => {
        if (isLifeSyncConnected) {
            void loadDeals()
            void loadXboxDashboard()
        }
    }, [isLifeSyncConnected, loadDeals, loadXboxDashboard])

    useEffect(() => {
        let cancelled = false
        const ids = [...new Set(deals.map((d) => d.bigId).filter(Boolean))]
        if (!ids.length) {
            setDealCatalogMap(new Map())
            return () => {
                cancelled = true
            }
        }
        ;(async () => {
            const m = await fetchMsStoreDetailsMap(ids, (path) => lifesyncFetch(path))
            if (!cancelled) setDealCatalogMap(m)
        })()
        return () => {
            cancelled = true
        }
    }, [deals])

    const people = useMemo(() => extractOpenXblPeople(profilePayload), [profilePayload])
    const activeXuid = people[0]?.xuid ?? null
    const openXblReady = Boolean(openXbl?.configured)

    const presenceSummary = useMemo(() => summarizeOpenXblPresence(presencePayload), [presencePayload])
    const v3ByTitleId = useMemo(() => indexV3TitlesByTitleId(v3AchievementsPayload), [v3AchievementsPayload])
    const libraryRowsMerged = useMemo(
        () =>
            libraryRows.map((r) =>
                r.titleId ? mergeLibraryRowWithV3Title(r, v3ByTitleId.get(String(r.titleId))) : r,
            ),
        [libraryRows, v3ByTitleId],
    )
    const selectedLibraryRow = useMemo(
        () => libraryRowsMerged.find((r) => r.titleId && r.titleId === selectedLibraryTitleId) ?? null,
        [libraryRowsMerged, selectedLibraryTitleId],
    )

    useEffect(() => {
        setSelectedLibraryTitleId(null)
        setAchPayload(null)
        setAchErr('')
    }, [activeXuid])

    useEffect(() => {
        if (!openXblReady || !activeXuid) {
            setPresencePayload(null)
            setPresenceBusy(false)
            return
        }
        let cancelled = false
        setPresenceBusy(true)
        ;(async () => {
            try {
                const data = await lifesyncFetch(`/api/xbox/openxbl/proxy/presence/${encodeURIComponent(String(activeXuid))}`)
                if (!cancelled) setPresencePayload(data)
            } catch {
                if (!cancelled) setPresencePayload(null)
            } finally {
                if (!cancelled) setPresenceBusy(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [openXblReady, activeXuid])

    useEffect(() => {
        if (!openXblReady || !activeXuid) {
            setV3AchievementsPayload(null)
            return
        }
        let cancelled = false
        ;(async () => {
            try {
                const data = await lifesyncFetch(
                    `/api/xbox/openxbl/proxy/v3/achievements/player/${encodeURIComponent(String(activeXuid))}`,
                )
                if (!cancelled) setV3AchievementsPayload(data)
            } catch {
                if (!cancelled) setV3AchievementsPayload(null)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [openXblReady, activeXuid])

    useEffect(() => {
        if (!openXblReady || !activeXuid) {
            setLibraryRows([])
            setLibraryErr('')
            return
        }
        let cancelled = false
        setLibraryBusy(true)
        setLibraryErr('')
        ;(async () => {
            try {
                const data = await lifesyncFetch(`/api/xbox/openxbl/proxy/player/titleHistory/${encodeURIComponent(activeXuid)}`)
                if (cancelled) return
                const raw = extractTitleHistoryItems(data)
                let rows = raw.map((item) => normalizeTitleHistoryRow(item)).filter(Boolean)
                rows.sort((a, b) => {
                    const ra = a.lastPlayedIso ? Date.parse(a.lastPlayedIso) : 0
                    const rb = b.lastPlayedIso ? Date.parse(b.lastPlayedIso) : 0
                    return rb - ra
                })
                rows = rows.slice(0, LIBRARY_MAX)

                const needStats = rows
                    .filter((r) => r.titleId && r.minutesPlayed == null)
                    .map((r) => String(r.titleId))
                    .filter((id) => /^\d+$/.test(id))
                const unique = [...new Set(needStats)].slice(0, STATS_BATCH)

                if (unique.length > 0) {
                    const statsBody = {
                        xuids: [{ xuid: String(activeXuid) }],
                        stats: unique.map((titleId) => ({ name: 'MinutesPlayed', titleId })),
                    }
                    try {
                        const statsData = await lifesyncFetch('/api/xbox/openxbl/proxy/player/stats', {
                            method: 'POST',
                            json: statsBody,
                        })
                        if (!cancelled) {
                            const map = extractMinutesPlayedMapFromStats(statsData)
                            rows = mergeRowsWithMinutesMap(rows, map)
                        }
                    } catch {
                        try {
                            const statsData2 = await lifesyncFetch('/api/xbox/openxbl/proxy/player/stats', {
                                method: 'POST',
                                json: {
                                    xuids: [String(activeXuid)],
                                    stats: unique.map((titleId) => ({ name: 'MinutesPlayed', titleId })),
                                },
                            })
                            if (!cancelled) {
                                const map = extractMinutesPlayedMapFromStats(statsData2)
                                rows = mergeRowsWithMinutesMap(rows, map)
                            }
                        } catch {
                            /* playtime stays unknown */
                        }
                    }
                }

                if (!cancelled) setLibraryRows(rows)
            } catch {
                if (!cancelled) {
                    setLibraryRows([])
                    setLibraryErr('We couldn’t load your games. Try Refresh profile, or check back later.')
                }
            } finally {
                if (!cancelled) setLibraryBusy(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [openXblReady, activeXuid])

    useEffect(() => {
        if (!openXblReady || mainTab !== 'gamepass') {
            return
        }
        const feed = GAMEPASS_FEEDS.find((f) => f.id === gpFeedId) || GAMEPASS_FEEDS[0]
        const path = feed.segments.map((s) => encodeURIComponent(s)).join('/')
        let cancelled = false
        setGpBusy(true)
        setGpErr('')
        ;(async () => {
            try {
                const data = await lifesyncFetch(`/api/xbox/openxbl/proxy/${path}`)
                if (cancelled) return
                const items = extractOpenXblItemList(data)
                setGpCatalogMap(new Map())
                setGpItems(items)
            } catch {
                if (!cancelled) {
                    setGpItems([])
                    setGpErr('We couldn’t load this Game Pass list. Try another tab or refresh.')
                }
            } finally {
                if (!cancelled) setGpBusy(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [openXblReady, mainTab, gpFeedId])

    const gpPageCount = Math.max(1, Math.ceil(gpItems.length / GAMEPASS_PAGE_SIZE))
    const gpPageSafe = Math.min(gpPage, gpPageCount)
    const gpVisibleItems = useMemo(() => {
        const start = (gpPageSafe - 1) * GAMEPASS_PAGE_SIZE
        return gpItems.slice(start, start + GAMEPASS_PAGE_SIZE)
    }, [gpItems, gpPageSafe])

    const dealsPageCount = Math.max(1, Math.ceil(deals.length / DEALS_PAGE_SIZE))
    const dealsPageSafe = Math.min(dealsPage, dealsPageCount)
    const dealsVisible = useMemo(() => {
        const start = (dealsPageSafe - 1) * DEALS_PAGE_SIZE
        return deals.slice(start, start + DEALS_PAGE_SIZE)
    }, [deals, dealsPageSafe])

    useEffect(() => {
        setGpPage(1)
    }, [gpFeedId])

    useEffect(() => {
        setDealsPage((p) => Math.min(p, Math.max(1, Math.ceil(deals.length / DEALS_PAGE_SIZE) || 1)))
    }, [deals.length])

    useEffect(() => {
        if (!storeModalOpen || !storeModalReq) return
        let cancelled = false
        ;(async () => {
            setStoreModalBusy(true)
            setStoreModalDetail(null)
            const { bigId, openXblItem, fallback } = storeModalReq
            try {
                if (bigId) {
                    const d = await fetchMsStoreProductDetail(bigId, (path) => lifesyncFetch(path))
                    if (cancelled) return
                    if (d) {
                        setStoreModalDetail(d)
                        return
                    }
                }
                if (!cancelled && openXblItem) {
                    const d2 = detailFromOpenXblProductSummary(openXblItem)
                    if (d2) {
                        setStoreModalDetail(d2)
                        return
                    }
                }
                if (!cancelled && fallback) {
                    setStoreModalDetail(buildFallbackStoreDetail(fallback))
                }
            } finally {
                if (!cancelled) setStoreModalBusy(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [storeModalOpen, storeModalReq])

    useEffect(() => {
        let cancelled = false
        const ids = gpVisibleItems.map((it) => pickMicrosoftStoreBigId(it)).filter(Boolean)
        const unique = [...new Set(ids)]
        if (!unique.length) {
            return () => {
                cancelled = true
            }
        }
        ;(async () => {
            const m = await fetchMsStoreDetailsMap(unique, (path) => lifesyncFetch(path))
            if (!cancelled) {
                setGpCatalogMap((prev) => {
                    const next = new Map(prev)
                    for (const [k, v] of m) next.set(k, v)
                    return next
                })
            }
        })()
        return () => {
            cancelled = true
        }
    }, [gpVisibleItems])

    useEffect(() => {
        if (!openXblReady || !activeXuid || !selectedLibraryTitleId) {
            setAchPayload(null)
            setAchErr('')
            setAchBusy(false)
            return
        }
        let cancelled = false
        setAchBusy(true)
        setAchErr('')
        setAchPayload(null)
        ;(async () => {
            try {
                const path = ['achievements', 'player', String(activeXuid), String(selectedLibraryTitleId)]
                    .map((s) => encodeURIComponent(s))
                    .join('/')
                const data = await lifesyncFetch(`/api/xbox/openxbl/proxy/${path}`)
                if (!cancelled) setAchPayload(data)
            } catch {
                if (!cancelled) {
                    setAchPayload(null)
                    setAchErr('unavailable')
                }
            } finally {
                if (!cancelled) setAchBusy(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [openXblReady, activeXuid, selectedLibraryTitleId])

    function tabClass(active) {
        return `rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors ${
            active ? 'bg-[#C6FF00] text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10' : 'bg-[#f5f5f7] text-[#424245] border border-[#e5e5ea] hover:bg-[#ebebed]'
        }`
    }

    if (!isLifeSyncConnected) {
        return (
            <LifeSyncHubPageShell>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-[28px] font-bold text-[#1a1628] tracking-tight mb-2">Xbox</h1>
                    <div className="rounded-[22px] border border-white/90 bg-white/90 px-8 py-16 text-center shadow-sm ring-1 ring-[#e8e4ef]/70">
                        <p className="text-[15px] font-bold text-[#1a1628] mb-2">LifeSync Not Connected</p>
                        <p className="text-[13px] text-[#5b5670] mb-4">Connect LifeSync, then link your Xbox gamertag under Profile → Integrations to use this hub.</p>
                        <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 rounded-xl bg-[#C6FF00] px-5 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95">
                            Go to Integrations
                        </Link>
                    </div>
                </div>
            </LifeSyncHubPageShell>
        )
    }

    return (
        <LifeSyncHubPageShell>
        <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Games</p>
                    <h1 className="text-[28px] font-bold text-[#1a1628] tracking-tight">Xbox</h1>
                    <p className="text-[13px] text-[#86868b] mt-1">
                        Your games, playtime, achievements, Game Pass picks, and current Store deals in one place.
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 self-start">
                    <button
                        type="button"
                        onClick={() => void loadXboxDashboard()}
                        disabled={dashBusy}
                        className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50"
                    >
                        {dashBusy ? 'Refreshing…' : 'Refresh profile'}
                    </button>
                    <button
                        type="button"
                        onClick={() => void loadDeals()}
                        disabled={dealsBusy}
                        className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50"
                    >
                        {dealsBusy ? 'Loading…' : 'Refresh deals'}
                    </button>
                </div>
            </div>

            <section className="rounded-[20px] border border-[#d2d2d7]/50 bg-white p-5 shadow-sm space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                        <h2 className="text-[17px] font-bold text-[#1d1d1f]">Xbox profile</h2>
                        <p className="text-[12px] text-[#86868b] mt-0.5 max-w-xl">
                            Link or change your gamertag under{' '}
                            <Link to="/dashboard/profile?tab=integrations" className="font-semibold text-[#107C10] hover:underline">
                                Profile → Integrations
                            </Link>
                            {' '}→ Service connections → Xbox.
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[11px]">
                        <span className={`rounded-lg px-2.5 py-1 font-semibold ${openXblReady ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-900 border border-amber-200'}`}>
                            {openXblReady ? 'Xbox data: connected' : 'Xbox data: unavailable'}
                        </span>
                    </div>
                </div>

                {dashErr ? <p className="text-[12px] font-medium text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{dashErr}</p> : null}

                {!openXblReady ? (
                    <p className="text-[12px] text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                        Your host still needs to enable Xbox lookups. Until then, you can browse Store deals below; library and Game Pass need that setup.
                    </p>
                ) : null}

                {profileBusy ? <LifesyncXboxProfileSkeleton /> : null}
                {!profileBusy && profileErr ? <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{profileErr}</p> : null}
                {!profileBusy && !profileErr && people.length > 0 ? (
                    <ul className="space-y-3">
                        {people.map((person, idx) => {
                            const isActive = String(person.xuid ?? '') === String(activeXuid ?? '')
                            return (
                                <li key={String(person.xuid ?? person.gamertag ?? idx)}>
                                    <ProfileCard
                                        person={person}
                                        presenceBusy={isActive && presenceBusy}
                                        presence={isActive ? presenceSummary : null}
                                    />
                                </li>
                            )
                        })}
                    </ul>
                ) : null}
                {!profileBusy && !profileErr && people.length === 0 ? (
                    <div className="rounded-xl border border-[#e5e5ea] bg-[#fafafa] px-4 py-3 text-[13px] text-[#86868b]">
                        {linkedGamertag ? (
                            <p>We couldn’t load a profile for your linked gamertag. It may be private, or Xbox data isn’t available from your host yet.</p>
                        ) : (
                            <p>
                                No gamertag linked yet. Add one in{' '}
                                <Link to="/dashboard/profile?tab=integrations" className="font-semibold text-[#107C10] hover:underline">
                                    Integrations → Xbox
                                </Link>
                                .
                            </p>
                        )}
                    </div>
                ) : null}
            </section>

            <div className="flex flex-wrap gap-2">
                <button type="button" className={tabClass(mainTab === 'library')} onClick={() => setMainTab('library')}>
                    My games
                </button>
                <button type="button" className={tabClass(mainTab === 'gamepass')} onClick={() => setMainTab('gamepass')}>
                    Game Pass
                </button>
                <button type="button" className={tabClass(mainTab === 'deals')} onClick={() => setMainTab('deals')}>
                    Store deals
                </button>
            </div>

            {mainTab === 'library' ? (
                <section className="space-y-4">
                    {!openXblReady || !activeXuid ? (
                        <p className="text-[13px] text-[#86868b] rounded-xl border border-[#e5e5ea] bg-[#fafafa] px-4 py-3">
                            Link your gamertag in{' '}
                            <Link to="/dashboard/profile?tab=integrations" className="font-semibold text-[#107C10] hover:underline">
                                Integrations
                            </Link>
                            . Once Xbox data is enabled for your account, you’ll see recent games, playtime, and achievements here.
                        </p>
                    ) : (
                        <>
                            <div className="flex flex-wrap items-end justify-between gap-3">
                                <div>
                                    <h2 className="text-[17px] font-bold text-[#1d1d1f]">Library &amp; achievements</h2>
                                    <p className="text-[12px] text-[#86868b] mt-0.5 max-w-2xl">
                                        Sorted by last played, with hours and progress filled in from your history when available. Tap a game for the full achievement list.
                                    </p>
                                </div>
                                {libraryBusy ? <span className="text-[11px] font-medium text-[#86868b]">Loading…</span> : null}
                            </div>
                            {libraryErr ? (
                                <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{libraryErr}</p>
                            ) : null}
                            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
                                <div>
                                    {libraryRows.length > 0 ? (
                                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                            {libraryRowsMerged.map((row) => (
                                                <LibraryGameTile
                                                    key={row.key}
                                                    row={row}
                                                    selected={selectedLibraryTitleId === row.titleId}
                                                    disabled={!row.titleId}
                                                    onSelect={() => {
                                                        if (row.titleId) setSelectedLibraryTitleId(row.titleId)
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    ) : libraryBusy ? (
                                        <LifesyncXboxLibraryGridSkeleton count={9} />
                                    ) : (
                                        <p className="text-[12px] text-[#86868b] rounded-xl border border-[#e5e5ea] bg-[#fafafa] px-3 py-2">
                                            No titles returned (history may be private or empty).
                                        </p>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    {selectedLibraryTitleId ? (
                                        <AchievementDetailPanel
                                            gameTitle={selectedLibraryRow?.name}
                                            busy={achBusy}
                                            err={achErr}
                                            payload={achPayload}
                                        />
                                    ) : (
                                        <div className="rounded-[18px] border border-dashed border-[#d2d2d7] bg-[#fafafa] px-4 py-8 text-center text-[13px] text-[#86868b]">
                                            Select a game to load achievement progress.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </section>
            ) : null}

            {mainTab === 'gamepass' ? (
                <section className="space-y-4">
                    {!openXblReady ? (
                        <p className="text-[13px] text-[#86868b] rounded-xl border border-[#e5e5ea] bg-[#fafafa] px-4 py-3">Game Pass browsing needs Xbox data to be enabled for your host.</p>
                    ) : (
                        <>
                            <div>
                                <h2 className="text-[17px] font-bold text-[#1d1d1f]">Game Pass catalog</h2>
                                <p className="text-[12px] text-[#86868b] mt-0.5">Browse what’s included by platform or plan. Titles show Store details when available.</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {GAMEPASS_FEEDS.map((f) => (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setGpFeedId(f.id)}
                                        className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                                            gpFeedId === f.id ? 'bg-[#107C10] text-white' : 'bg-[#f5f5f7] text-[#424245] border border-[#e5e5ea] hover:bg-[#ebebed]'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                            {gpErr ? <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">{gpErr}</p> : null}
                            {gpBusy && gpItems.length === 0 ? (
                                <LifesyncXboxCatalogGridSkeleton gridClass={CATALOG_GRID_CLASS} count={12} />
                            ) : null}
                            {gpItems.length > 0 ? (
                                <>
                                    <PaginationBar
                                        page={gpPageSafe}
                                        pageCount={gpPageCount}
                                        totalLabel={`${gpItems.length} games in this feed`}
                                        busy={gpBusy}
                                        onPrev={() => setGpPage((p) => Math.max(1, p - 1))}
                                        onNext={() =>
                                            setGpPage((p) =>
                                                Math.min(
                                                    Math.max(1, Math.ceil(gpItems.length / GAMEPASS_PAGE_SIZE)),
                                                    p + 1,
                                                ),
                                            )
                                        }
                                    />
                                    <div className={CATALOG_GRID_CLASS}>
                                        {gpVisibleItems.map((item, i) => (
                                            <GamePassTile
                                                key={`${pickMicrosoftStoreBigId(item) || 'gp'}-${gpPageSafe}-${i}`}
                                                item={item}
                                                catalog={gpCatalogMap}
                                                onOpenDetail={openStoreDetail}
                                            />
                                        ))}
                                    </div>
                                </>
                            ) : !gpBusy && !gpErr ? (
                                <p className="text-[12px] text-[#86868b]">No items in this feed.</p>
                            ) : null}
                        </>
                    )}
                </section>
            ) : null}

            {mainTab === 'deals' ? (
                <section className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <h2 className="text-[17px] font-bold text-[#1d1d1f]">Microsoft Store deals</h2>
                        {meta?.locale ? (
                            <p className="text-[11px] text-[#86868b]">
                                Region <span className="font-semibold text-[#1d1d1f]">{meta.locale}</span>
                                {meta.totalProducts != null && <span> · {meta.totalProducts} titles</span>}
                            </p>
                        ) : null}
                    </div>

                    {dealsError && (
                        <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">{dealsError}</div>
                    )}

                    {dealsBusy && deals.length === 0 && !dealsError ? (
                        <LifesyncXboxCatalogGridSkeleton gridClass={CATALOG_GRID_CLASS} count={12} />
                    ) : null}

                    {deals.length > 0 ? (
                        <>
                            <PaginationBar
                                page={dealsPageSafe}
                                pageCount={dealsPageCount}
                                totalLabel={`${deals.length} deals`}
                                busy={dealsBusy}
                                onPrev={() => setDealsPage((p) => Math.max(1, p - 1))}
                                onNext={() =>
                                    setDealsPage((p) =>
                                        Math.min(Math.max(1, Math.ceil(deals.length / DEALS_PAGE_SIZE)), p + 1),
                                    )
                                }
                            />
                            <div className={CATALOG_GRID_CLASS}>
                                {dealsVisible.map((d) => {
                                    const cat = d.bigId ? dealCatalogMap.get(d.bigId) : null
                                    return (
                                        <DealTile
                                            key={d.key}
                                            title={cat?.title || d.title}
                                            imageUrl={cat?.heroImage || d.imageUrl}
                                            subtitle={cat?.priceText || d.subtitle}
                                            tagline={cat?.shortDescription || null}
                                            onOpen={() =>
                                                openStoreDetail({
                                                    bigId: d.bigId || null,
                                                    openXblItem: null,
                                                    fallback: {
                                                        title: cat?.title || d.title,
                                                        href: cat?.storeUrl || d.href,
                                                        imageUrl: cat?.heroImage || d.imageUrl,
                                                        subtitle: cat?.priceText || d.subtitle,
                                                        tagline: cat?.shortDescription || null,
                                                    },
                                                })
                                            }
                                        />
                                    )
                                })}
                            </div>
                        </>
                    ) : !dealsBusy && !dealsError && (
                        <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm px-6 py-10 text-center">
                            <p className="text-[13px] text-[#86868b]">No deals returned. The store layout may have changed.</p>
                        </div>
                    )}
                </section>
            ) : null}

            <StoreGameDetailModal
                open={storeModalOpen}
                detail={storeModalDetail}
                busy={storeModalBusy}
                onClose={closeStoreDetail}
            />
        </div>
        </LifeSyncHubPageShell>
    )
}
