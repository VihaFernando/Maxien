import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch } from '../../lib/lifesyncApi'
import {
    LifesyncChapterPagesSkeleton,
    LifesyncEpisodeThumbnail,
    LifesyncMangaBrowseGridSkeleton,
    LifesyncMangaChapterListSkeleton,
} from '../../components/lifesync/EpisodeLoadingSkeletons'
import { LifeSyncSectionNav } from '../../components/lifesync/LifeSyncSectionNav'
import {
    AnimatePresence,
    LayoutGroup,
    lifeSyncDetailBackdropFadeTransition,
    lifeSyncBrowseGridStaggerMaxItems,
    lifeSyncDetailBodyRevealTransition,
    lifeSyncDetailOverlayFadeTransition,
    lifeSyncDetailSheetEnterAnimate,
    lifeSyncDetailSheetEnterInitial,
    lifeSyncDetailSheetExitVariant,
    lifeSyncDetailSheetMainTransition,
    lifeSyncDollyPageTransition,
    lifeSyncDollyPageVariants,
    lifeSyncEaseOut,
    lifeSyncPageTransition,
    lifeSyncSectionPresenceTransition,
    lifeSyncSectionPresenceVariants,
    lifeSyncSharedLayoutTransitionProps,
    lifeSyncStaggerContainerDense,
    lifeSyncStaggerItemFade,
    MotionDiv,
} from '../../lib/lifesyncMotion'
import {
    buildDexChapterLangSelectOptions,
    compareChapters,
    DEX_TRANSLATION_LANG_OPTIONS,
    formatChapterLabel,
    mangadexImageProps,
} from '../../lib/mangaChapterUtils'

/** Expand/collapse for filter drawers (MangaDex toolbar, Manga District, DexGenreFilter). */
const mangaFilterExpandTransition = {
    height: { duration: 0.3, ease: lifeSyncEaseOut },
    opacity: { duration: 0.22, ease: lifeSyncEaseOut },
}

function mangaCoverLayoutId(source, id) {
    return `lifesync-manga-cover-${String(source || 'mangadex')}-${String(id)}`
}

/** Serializable list-card fields for instant detail chrome (navigate `state`). */
function mangaDetailPreviewFromCard(manga, source) {
    if (!manga || manga.id == null) return null
    const src = manga.source || source || 'mangadex'
    return {
        id: String(manga.id),
        source: src,
        title: manga.title,
        coverUrl: manga.coverUrl,
        tags: Array.isArray(manga.tags) ? manga.tags : undefined,
        status: manga.status,
        year: manga.year,
        author: manga.author,
        contentRating: manga.contentRating,
        backgroundImageUrl: manga.backgroundImageUrl,
        ratingAverage: manga.ratingAverage,
        ratings: manga.ratings,
    }
}

function clampPage(n) {
    const v = Number.parseInt(String(n || '1'), 10)
    return Number.isFinite(v) && v > 0 ? v : 1
}

function mangaTagLabel(tag) {
    if (tag == null) return ''
    if (typeof tag === 'string') return tag
    if (typeof tag === 'object' && tag.name != null) return String(tag.name)
    return ''
}

function mangaTagKey(tag, index, prefix = '') {
    if (tag != null && typeof tag === 'object' && tag.id != null && String(tag.id) !== '') {
        return `${prefix}${String(tag.id)}`
    }
    const label = mangaTagLabel(tag)
    return `${prefix || 't'}-${index}-${label || 'tag'}`
}

const DEX_PAGE_SIZE = 24
const DEX_MAX_OFFSET = 9900
const STATUS_FILTERS = ['ongoing', 'completed', 'hiatus', 'cancelled']
const DEMOGRAPHIC_FILTERS = ['shounen', 'shoujo', 'josei', 'seinen']
const TAG_GROUP_ORDER = ['genre', 'theme', 'format', 'content']
/** Browse modes for Popular / Recent (maps to MangaDex list `shuffle` or `orderBy`). */
const BROWSE_SORT_TABS = [
    { id: 'random', label: 'Random' },
    { id: 'followedCount', label: 'Follows' },
    { id: 'latestUploadedChapter', label: 'Latest' },
    { id: 'year', label: 'Year' },
    { id: 'title', label: 'Title' },
    { id: 'createdAt', label: 'Added' },
    { id: 'updatedAt', label: 'Updated' },
]
const SEARCH_SORT_OPTIONS = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'latestUploadedChapter', label: 'Latest chapter' },
    { value: 'followedCount', label: 'Follow count' },
    { value: 'year', label: 'Year' },
    { value: 'title', label: 'Title' },
    { value: 'createdAt', label: 'Added' },
    { value: 'updatedAt', label: 'Updated' },
]
const ORIGINAL_LANG_OPTIONS = [
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'zh', label: 'Chinese' },
    { value: 'zh-hk', label: 'Chinese (HK)' },
    { value: 'en', label: 'English' },
]

/** Manga District — `publication-genre/{slug}/` (type row). */
const MD_TYPE_OPTIONS = [
    { slug: 'webtoons', label: 'Webtoons' },
    { slug: 'manhwa', label: 'Manhwa' },
    { slug: 'manhua', label: 'Manhua' },
    { slug: 'uncensored', label: 'Uncensored' },
    { slug: 'doujinshi', label: 'Doujinshi' },
    { slug: 'one-shot', label: 'One shot' },
    { slug: 'full-color', label: 'Full color' },
    { slug: 'based-on-another-work', label: 'Based on another work' },
]

/** Manga District order-by (maps to `orderBy` query → `m_orderby` on the server). */
const MD_ORDER_BY_OPTIONS = [
    { id: 'latest-updates', label: 'Latest' },
    { id: 'name', label: 'A-Z' },
    { id: 'rating', label: 'Rating' },
    { id: 'hot', label: 'Trending' },
    { id: 'all-time-views', label: 'Most views' },
    { id: 'new-releases', label: 'New' },
]

const MD_ORDER_BY_IDS = new Set(MD_ORDER_BY_OPTIONS.map(o => o.id))

const MD_TYPE_SLUG_SET = new Set(MD_TYPE_OPTIONS.map(t => t.slug))

/** Extra genre slugs for `genre[]` (same paths as site; excludes type row to avoid duplicate chips). */
const MD_FILTER_SLUG_LIST = [
    '3d', 'japanese-webtoons', 'comics', 'animation', '3d-anime', 'uncensored-anime', 'adapted-to-anime', 'action', 'comedy', 'mystery',
    'shoujo', 'school-life', 'seinen', 'aliens', 'crime', 'detectives', 'shounen', 'supernatural', 'thriller', 'crossdressing', 'ecchi',
    'fantasy', 'josei', 'light-novels', 'mature-romance', 'monsters', 'music', 'sci-fi', 'zombies', 'gyaru', 'adventure', 'animal-characteristics',
    'cohabitation', 'cooking', 'coworkers', 'delinquents', 'bl', 'bl-uncensored', 'borderline-h', 'fetish', 'ghosts', 'gender-bender', 'gl',
    'explicit-sex', 'harem', 'historical', 'demons', 'horror', 'isekai', 'mafia', 'magic', 'magical-girl', 'ninja', 'nudity', 'martial-arts',
    'reincarnation', 'medical', 'mecha', 'military', 'monster-girls', 'reverse-harem', 'salaryman', 'samurai', 'sexual-abuse', 'sexual-content',
    'shoujo-ai', 'shounen-ai', 'smut', 'siblings', 'incest', 'transfer-students', 'vampires', 'violence', 'virtual-reality', 'web-novels',
    'work-life', 'sports', 'summoned-into-another-world', 'superheroes', 'survival', 'time-travel', 'person-in-a-strange-world', 'police',
    'yaoi', 'yuri', 'slice-of-life', 'psychological', 'drama', 'romance', 'ai-art', 'collection-of-stories', 'hentai-anime', 'parody-anime',
    'western',
].filter(s => !MD_TYPE_SLUG_SET.has(s))

const MD_FILTER_LABEL_OVERRIDES = {
    '3d': '3D',
    'sci-fi': 'Sci Fi',
    bl: 'BL',
    gl: 'GL',
    yaoi: 'Yaoi',
    yuri: 'Yuri',
    'shoujo-ai': 'Shoujo-ai',
    'shounen-ai': 'Shounen-ai',
}

function mdFilterLabel(slug) {
    if (MD_FILTER_LABEL_OVERRIDES[slug]) return MD_FILTER_LABEL_OVERRIDES[slug]
    return slug
        .split('-')
        .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
        .join(' ')
}

const MD_FILTER_OPTIONS = [...MD_FILTER_SLUG_LIST]
    .sort((a, b) => mdFilterLabel(a).localeCompare(mdFilterLabel(b)))
    .map(slug => ({ slug, label: mdFilterLabel(slug) }))

function buildMangaDistrictListQuery(section, genreType, genreFilter, browseId) {
    const q = new URLSearchParams()
    q.set('section', section || 'latest')
    if (genreType) q.set('genre', genreType)
    if (genreFilter) q.set('filterGenre', genreFilter)
    if (browseId && browseId !== 'latest-updates') q.set('orderBy', browseId)
    return q.toString()
}

/** MangaDex personal list — aligned with `client/src/pages/MangaPage.jsx` READING_STATUSES. */
const MANGADEX_READING_STATUSES = [
    { value: 'reading', label: 'Reading' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'plan_to_read', label: 'Plan to Read' },
    { value: 'dropped', label: 'Dropped' },
    { value: 'completed', label: 'Completed' },
    { value: 're_reading', label: 'Re-reading' },
]

/** Status pills under the Library tab (single row, horizontal scroll on narrow viewports). */
const MANGADEX_LIBRARY_STATUS_TABS = [
    { value: 'reading', label: 'Reading' },
    { value: 'on_hold', label: 'On Hold' },
    { value: 'completed', label: 'Completed' },
    { value: 'dropped', label: 'Dropped' },
    { value: 'plan_to_read', label: 'Plan to Read' },
    { value: 're_reading', label: 'Re-reading' },
]

function dexBrowseLastPage(total) {
    if (total <= 0) return 1
    const fromTotal = Math.max(1, Math.ceil(total / DEX_PAGE_SIZE))
    const maxByOffset = Math.floor(DEX_MAX_OFFSET / DEX_PAGE_SIZE) + 1
    return Math.min(fromTotal, maxByOffset)
}

/** MangaDex API `contentRating` — order preserved for stable query strings. */
const MD_CONTENT_RATING_ORDER = ['safe', 'suggestive', 'erotica', 'pornographic']

const MD_CONTENT_RATING_OPTIONS = [
    { id: 'safe', label: 'Safe', description: 'All-ages content.' },
    { id: 'suggestive', label: 'Suggestive', description: 'Ecchi/mildly explicit content.' },
    { id: 'erotica', label: 'Erotica', description: 'Highly explicit.', nsfwOnly: true },
    { id: 'pornographic', label: 'Pornographic', description: 'Explicit content.', nsfwOnly: true },
]

const DEFAULT_DEX_CONTENT_RATINGS = ['safe', 'suggestive']

function sortDexContentRatings(ids) {
    return MD_CONTENT_RATING_ORDER.filter((id) => ids.includes(id))
}

/** Query string for server `parseMangaDexListQuery` (client MangaPage.jsx parity). */
function buildDexListQuery(opts) {
    const {
        limit,
        offset = 0,
        contentRatings = DEFAULT_DEX_CONTENT_RATINGS,
        nsfwEnabled,
        dexTranslatedLang,
        englishOnly = false,
        includedTags = [],
        excludedTags = [],
        statusFilter = [],
        demographicFilter = [],
        includedTagsMode,
        excludedTagsMode,
        originalLangFilter = [],
        searchYear,
        orderBy,
        orderDir = 'desc',
        shuffle = false,
    } = opts
    const q = new URLSearchParams()
    q.set('limit', String(limit))
    if (offset > 0) q.set('offset', String(offset))

    const allowedIds = nsfwEnabled ? MD_CONTENT_RATING_ORDER : ['safe', 'suggestive']
    let picked = sortDexContentRatings(
        (Array.isArray(contentRatings) ? contentRatings : []).filter((r) => allowedIds.includes(r))
    )
    if (!picked.length) picked = [...DEFAULT_DEX_CONTENT_RATINGS]
    for (const cr of picked) {
        q.append('contentRating[]', cr)
    }
    if (englishOnly) {
        q.set('englishOnly', '1')
        q.append('translatedLanguage[]', 'en')
    } else if (dexTranslatedLang === 'all') {
        q.set('anyLanguage', '1')
    } else {
        q.append('translatedLanguage[]', dexTranslatedLang)
    }
    for (const id of includedTags) q.append('includedTags[]', id)
    for (const id of excludedTags) q.append('excludedTags[]', id)
    for (const s of statusFilter) q.append('status[]', s)
    for (const d of demographicFilter) q.append('demographic[]', d)
    if (includedTags.length && includedTagsMode) q.set('includedTagsMode', includedTagsMode)
    if (excludedTags.length && excludedTagsMode) q.set('excludedTagsMode', excludedTagsMode)
    for (const ol of originalLangFilter) q.append('originalLanguage[]', ol)
    if (searchYear != null && String(searchYear).trim() !== '') q.set('year', String(searchYear).trim())
    if (shuffle) q.set('shuffle', '1')
    if (orderBy != null && String(orderBy).trim() !== '') {
        q.set('orderBy', String(orderBy).trim())
        q.set('orderDir', orderDir === 'asc' ? 'asc' : 'desc')
    }
    return q
}

function DexContentRatingSection({ selectedIds, nsfwEnabled, onToggle }) {
    const visible = MD_CONTENT_RATING_OPTIONS.filter(o => !o.nsfwOnly || nsfwEnabled)
    return (
        <section className="rounded-2xl border border-[#e8e4ef]/80 bg-gradient-to-br from-white/90 to-[#faf8ff]/80 p-3.5 sm:p-4">
            <div className="mb-3">
                <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#5b5670]">Content rating</h3>
                <p className="mt-1 text-[10px] leading-relaxed text-[#86868b]">
                    MangaDex catalog filter (see{' '}
                    <a
                        href="https://api.mangadex.org/docs/swagger.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-[#6d28d9] underline decoration-[#c4b5fd] underline-offset-2 hover:text-[#5b21b6]"
                    >
                        API docs
                    </a>
                    ). Keep at least one option on.
                </p>
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
                {visible.map(opt => {
                    const on = selectedIds.includes(opt.id)
                    return (
                        <li key={opt.id}>
                            <label
                                className={`flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                                    on
                                        ? 'border-[#C6FF00]/70 bg-[#C6FF00]/12 ring-1 ring-[#C6FF00]/35'
                                        : 'border-[#e5e5ea] bg-white/80 hover:border-[#d2d2d7]'
                                }`}
                            >
                                <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => onToggle(opt.id)}
                                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-[#d2d2d7] text-[#1d1d1f] focus:ring-[#C6FF00]"
                                />
                                <span className="min-w-0">
                                    <span className="block text-[12px] font-semibold text-[#1d1d1f]">{opt.label}</span>
                                    <span className="mt-0.5 block text-[10px] leading-snug text-[#86868b]">{opt.description}</span>
                                </span>
                            </label>
                        </li>
                    )
                })}
            </ul>
        </section>
    )
}

function DexTagChip({ tag, selected, excluded, onToggle }) {
    const cls = excluded
        ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
        : selected
          ? 'bg-[#C6FF00]/25 text-[#1d1d1f] ring-1 ring-[#C6FF00]/50'
          : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed] hover:text-[#1d1d1f]'
    return (
        <button
            type="button"
            onClick={() => onToggle(tag.id)}
            onContextMenu={e => {
                e.preventDefault()
                onToggle(tag.id, true)
            }}
            className={`flex min-w-0 max-w-[min(100%,13rem)] items-center gap-0.5 rounded-full px-2.5 py-0.5 text-left text-[10px] font-medium transition-colors ${cls}`}
            title={`${tag.name} — tap include · right-click exclude`}
        >
            <span className="shrink-0">{excluded ? '−' : selected ? '✓' : ''}</span>
            <span className="min-w-0 truncate">{tag.name}</span>
        </button>
    )
}

function DexGenreFilter({
    tags,
    includedTags,
    excludedTags,
    onToggleInclude,
    onToggleExclude,
    statusFilter,
    onStatusChange,
    demographicFilter,
    onDemographicChange,
    includedTagsMode,
    excludedTagsMode,
    onIncludedTagsMode,
    onExcludedTagsMode,
    embedded = false,
}) {
    const [expanded, setExpanded] = useState(false)
    const [tagSearch, setTagSearch] = useState('')

    const grouped = useMemo(() => {
        const groups = {}
        for (const t of tags) {
            const g = t.group || 'other'
            if (!groups[g]) groups[g] = []
            groups[g].push(t)
        }
        for (const g of Object.keys(groups)) {
            groups[g].sort((a, b) => a.name.localeCompare(b.name))
        }
        return groups
    }, [tags])

    const filteredGrouped = useMemo(() => {
        if (!tagSearch.trim()) return grouped
        const q = tagSearch.toLowerCase()
        const result = {}
        for (const [group, tagList] of Object.entries(grouped)) {
            const filtered = tagList.filter(t => t.name.toLowerCase().includes(q))
            if (filtered.length) result[group] = filtered
        }
        return result
    }, [grouped, tagSearch])

    const activeCount = includedTags.length + excludedTags.length + (statusFilter?.length || 0) + (demographicFilter?.length || 0)

    const body = (
        <div className={`${embedded ? '' : 'border-t border-[#f0f0f0]'} min-w-0 max-w-full`}>
            <div className={`${embedded ? 'px-0 py-0' : 'px-4 py-4'} min-w-0 max-w-full space-y-4`}>
                <div className="flex flex-wrap gap-4">
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Status</p>
                        <div className="flex flex-wrap gap-1">
                            {STATUS_FILTERS.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => onStatusChange(s)}
                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize transition-colors ${
                                        statusFilter?.includes(s)
                                            ? 'bg-[#C6FF00]/25 text-[#1d1d1f] ring-1 ring-[#C6FF00]/50'
                                            : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed]'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Demographic</p>
                        <div className="flex flex-wrap gap-1">
                            {DEMOGRAPHIC_FILTERS.map(d => (
                                <button
                                    key={d}
                                    type="button"
                                    onClick={() => onDemographicChange(d)}
                                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize transition-colors ${
                                        demographicFilter?.includes(d)
                                            ? 'bg-[#C6FF00]/25 text-[#1d1d1f] ring-1 ring-[#C6FF00]/50'
                                            : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed]'
                                    }`}
                                >
                                    {d}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex flex-wrap gap-3 border-t border-[#f0f0f0] pt-3">
                    <label className="text-[10px] font-semibold text-[#86868b] flex flex-col gap-1">
                        Include tags
                        <select
                            value={includedTagsMode}
                            onChange={e => onIncludedTagsMode(e.target.value)}
                            className="rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-2 py-1.5 text-[11px] text-[#1d1d1f]"
                        >
                            <option value="AND">All (AND)</option>
                            <option value="OR">Any (OR)</option>
                        </select>
                    </label>
                    <label className="text-[10px] font-semibold text-[#86868b] flex flex-col gap-1">
                        Exclude tags
                        <select
                            value={excludedTagsMode}
                            onChange={e => onExcludedTagsMode(e.target.value)}
                            className="rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-2 py-1.5 text-[11px] text-[#1d1d1f]"
                        >
                            <option value="OR">Any (OR)</option>
                            <option value="AND">All (AND)</option>
                        </select>
                    </label>
                </div>
                <div className="space-y-2">
                    <input
                        type="text"
                        value={tagSearch}
                        onChange={e => setTagSearch(e.target.value)}
                        placeholder="Filter tag list…"
                        className="w-full rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2 text-[12px] text-[#1d1d1f] placeholder:text-[#86868b] focus:border-[#C6FF00]/60 focus:bg-white focus:outline-none"
                    />
                    <p className="text-[10px] text-[#86868b]">Tap = include · right-click = exclude</p>
                </div>
                {TAG_GROUP_ORDER.filter(g => filteredGrouped[g]).map(group => (
                    <div key={group} className="space-y-1.5">
                        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">{group}</h4>
                        <div className="flex min-w-0 max-w-full flex-wrap gap-1">
                            {filteredGrouped[group].map(tag => (
                                <DexTagChip
                                    key={tag.id}
                                    tag={tag}
                                    selected={includedTags.includes(tag.id)}
                                    excluded={excludedTags.includes(tag.id)}
                                    onToggle={(id, isExclude) => {
                                        if (isExclude) onToggleExclude(id)
                                        else onToggleInclude(id)
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )

    return (
        <div
            className={`min-w-0 w-full max-w-full overflow-hidden ${embedded ? '' : 'rounded-[18px] border border-[#d2d2d7]/50 bg-white shadow-sm'}`}
        >
            {embedded ? (
                body
            ) : (
                <>
                    <button
                        type="button"
                        onClick={() => setExpanded(p => !p)}
                        className="flex w-full min-w-0 items-center justify-between gap-2 px-4 py-3 text-left text-[13px] font-semibold text-[#1d1d1f] hover:bg-[#fafafa] transition-colors"
                    >
                        <span className="inline-flex min-w-0 flex-1 items-center gap-2">
                            <span className="min-w-0 truncate">Filters &amp; genres</span>
                            {activeCount > 0 && (
                                <span className="shrink-0 rounded-full bg-[#C6FF00]/30 px-2 py-0.5 text-[10px] font-bold text-[#1d1d1f]">{activeCount}</span>
                            )}
                        </span>
                        <span className="shrink-0 text-[#86868b] text-[11px]">{expanded ? 'Hide' : 'Show'}</span>
                    </button>
                    <AnimatePresence initial={false}>
                        {expanded && (
                            <MotionDiv
                                key="dex-genre-filter-body"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={mangaFilterExpandTransition}
                                className="w-full min-w-0 max-w-full overflow-hidden border-t border-[#f0f0f0]"
                            >
                                {body}
                            </MotionDiv>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    )
}

const MangaCard = memo(function MangaCard({ manga, onClick }) {
    const rating = manga.ratings?.average ?? manga.ratingAverage
    const ratingNum = rating != null ? Number(rating) : null
    const showRating = ratingNum != null && Number.isFinite(ratingNum) && ratingNum > 0
    const overlayBadges = (
        <>
            {manga.status && (
                <span className="absolute left-2 top-2 z-[2] rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-medium capitalize text-[#1d1d1f]">{manga.status}</span>
            )}
            {manga.contentRating && manga.contentRating !== 'safe' && (
                <span className="absolute right-2 top-2 z-[2] rounded-lg bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-700">{manga.contentRating}</span>
            )}
            {manga.source && manga.source !== 'mangadex' && (
                <span className="pointer-events-none absolute bottom-12 left-2 z-[2] rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-medium uppercase text-white backdrop-blur-sm">
                    {manga.source === 'mangadistrict' ? 'District' : manga.source === 'hentaifox' ? 'HF' : manga.source}
                </span>
            )}
        </>
    )
    return (
        <button type="button" onClick={() => onClick?.(manga)} className="group w-full text-left">
            <div className="overflow-hidden rounded-[18px] border border-[#d2d2d7]/50 bg-white shadow-sm transition-all hover:shadow-md">
                <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#f5f5f7]">
                    {manga.id != null ? (
                        <MotionDiv
                            layoutId={mangaCoverLayoutId(manga.source || 'mangadex', manga.id)}
                            transition={lifeSyncSharedLayoutTransitionProps}
                            className="absolute inset-0"
                        >
                            {manga.coverUrl ? (
                                <LifesyncEpisodeThumbnail
                                    src={manga.coverUrl}
                                    className="absolute inset-0 h-full w-full"
                                    imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                                    imgProps={mangadexImageProps(manga.coverUrl)}
                                >
                                    {overlayBadges}
                                </LifesyncEpisodeThumbnail>
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                                    {overlayBadges}
                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                                </div>
                            )}
                        </MotionDiv>
                    ) : manga.coverUrl ? (
                        <LifesyncEpisodeThumbnail
                            src={manga.coverUrl}
                            className="absolute inset-0 h-full w-full"
                            imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                            imgProps={mangadexImageProps(manga.coverUrl)}
                        >
                            {overlayBadges}
                        </LifesyncEpisodeThumbnail>
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                                    {overlayBadges}
                                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                        </div>
                    )}
                    <div className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-black/55 via-transparent to-transparent" aria-hidden />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] p-3">
                        <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">{manga.title}</p>
                        {manga.author ? (
                            <p className="mt-0.5 line-clamp-1 text-[11px] text-white/80 drop-shadow-[0_1px_2px_rgba(0,0,0,0.75)]">{manga.author}</p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {manga.year && <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm">{manga.year}</span>}
                            {showRating && (
                                <span className="flex items-center gap-0.5 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                                    <svg className="h-2.5 w-2.5 fill-amber-300 text-amber-300" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                    {ratingNum.toFixed(1)}
                                </span>
                            )}
                            {manga.tags?.slice(0, 2).map((tag, i) => {
                                const label = mangaTagLabel(tag)
                                if (!label) return null
                                return (
                                    <span key={mangaTagKey(tag, i, `${manga.id}-`)} className="rounded bg-[#C6FF00]/25 px-1.5 py-0.5 text-[10px] font-medium text-[#1d1d1f] ring-1 ring-white/30">
                                        {label}
                                    </span>
                                )
                            })}
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-center gap-1.5 border-t border-[#f0f0f0] bg-[#fafafa] py-2.5 text-[11px] font-semibold text-[#1d1d1f]">
                    <svg className="h-3.5 w-3.5 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 010 .656l-5.603 3.113a.375.375 0 01-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112z" />
                    </svg>
                    View details
                </div>
            </div>
        </button>
    )
})

function MangaDetail({ manga, onClose, source, onStartRead, mangadexConnected, browseTranslatedLang = 'en' }) {
    const [detail, setDetail] = useState(null)
    const [chapters, setChapters] = useState(null)
    const [chapBusy, setChapBusy] = useState(false)
    const [descExpanded, setDescExpanded] = useState(false)
    const [dexStats, setDexStats] = useState(null)
    const [isDexFollowing, setIsDexFollowing] = useState(null)
    const [dexFollowBusy, setDexFollowBusy] = useState(false)
    const [dexReadingStatus, setDexReadingStatus] = useState(null)
    const [dexReadingStatusBusy, setDexReadingStatusBusy] = useState(false)
    const [chapterLang, setChapterLang] = useState(() => (browseTranslatedLang === 'all' ? 'all' : browseTranslatedLang))

    useEffect(() => {
        setChapterLang(browseTranslatedLang === 'all' ? 'all' : browseTranslatedLang)
    }, [manga?.id, browseTranslatedLang])

    useEffect(() => {
        if (!manga?.id) return undefined
        const src = manga.source || source

        if (src === 'hentaifox' || src === 'mangadistrict') {
            const list = Array.isArray(manga.chapters) ? manga.chapters : []
            setChapters({ data: [...list] })
            setDetail(null)
            setDexStats(null)
            setIsDexFollowing(null)
            setDexReadingStatus(null)
            setChapBusy(false)
            return undefined
        }

        setDexStats(null)
        setIsDexFollowing(null)
        setDexReadingStatus(null)

        let cancelled = false
        ;(async () => {
            setChapBusy(true)
            try {
                const d = await lifesyncFetch(`/api/manga/details/${manga.id}`).catch(() => null)
                if (!cancelled) setDetail(d)
                const langParam = chapterLang === 'all' ? 'all' : chapterLang
                const c = await lifesyncFetch(`/api/manga/chapters/${manga.id}?limit=500&lang=${encodeURIComponent(langParam)}&order=asc`).catch(() => ({ data: [] }))
                if (!cancelled) setChapters(c)
                if (src === 'mangadex' && manga.id) {
                    const st = await lifesyncFetch(`/api/manga/statistics/${manga.id}`).catch(() => null)
                    if (!cancelled && st && typeof st === 'object') setDexStats(st)
                }
                if (src === 'mangadex' && mangadexConnected && manga.id) {
                    const fol = await lifesyncFetch(`/api/manga/mangadex/follows?limit=100&offset=0`).catch(() => null)
                    if (!cancelled && fol?.data) {
                        const ids = new Set(fol.data.map(m => m.id))
                        setIsDexFollowing(ids.has(manga.id))
                    } else if (!cancelled) setIsDexFollowing(false)
                    try {
                        const rs = await lifesyncFetch('/api/manga/mangadex/reading-statuses')
                        const mid = String(manga.id)
                        const stVal = rs?.statuses?.[mid] ?? rs?.statuses?.[manga.id] ?? null
                        if (!cancelled) setDexReadingStatus(stVal || null)
                    } catch {
                        if (!cancelled) setDexReadingStatus(null)
                    }
                }
            } catch {
                if (!cancelled) {
                    setChapters({ data: [] })
                }
            } finally {
                if (!cancelled) setChapBusy(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [manga?.id, manga?.source, source, manga?.chapters, mangadexConnected, chapterLang])

    const sortedChapters = useMemo(() => {
        const list = chapters?.data ? [...chapters.data] : []
        list.sort(compareChapters)
        return list
    }, [chapters])

    const chapterLangOptions = useMemo(() => {
        if (!manga) return DEX_TRANSLATION_LANG_OPTIONS
        const dm = detail || manga
        return buildDexChapterLangSelectOptions(dm.availableTranslatedLanguages || manga.availableTranslatedLanguages)
    }, [detail, manga])

    if (!manga) return null

    const coverLayoutId = mangaCoverLayoutId(manga.source || source, manga.id)

    const d = detail || manga
    const src = manga.source || source
    const mergedManga = { ...d, id: d.id || manga.id, source: src }
    const tagList = d.tags?.length ? d.tags : manga.tags
    const coverImg = d.coverUrl || manga.coverUrl
    const heroBannerUrl = d.backgroundImageUrl || manga.backgroundImageUrl || null
    const heroBackdropUrl = heroBannerUrl || coverImg
    const blurDetailHero =
        src !== 'mangadistrict' && !heroBannerUrl && Boolean(coverImg)
    const rating = d.ratings?.average ?? dexStats?.rating?.average ?? d.ratingAverage
    const ratingNum = rating != null ? Number(rating) : null
    const showRating = ratingNum != null && Number.isFinite(ratingNum) && ratingNum > 0
    const cleanDesc = d.description ? String(d.description).replace(/<[^>]*>/g, '') : ''

    return createPortal(
        <MotionDiv
            className="fixed inset-0 z-[9998] flex h-dvh max-h-dvh w-full max-w-[100vw] min-w-0 items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={lifeSyncDetailOverlayFadeTransition}
        >
            <MotionDiv
                className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={lifeSyncDetailBackdropFadeTransition}
            />

            {/* Panel — match anime / hentai detail sheet motion */}
            <MotionDiv
                layout="size"
                layoutRoot
                className="relative flex h-dvh max-h-dvh w-full min-w-0 flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[min(88vh,calc(100dvh-2rem))] sm:max-w-3xl sm:rounded-2xl"
                onClick={e => e.stopPropagation()}
                initial={lifeSyncDetailSheetEnterInitial}
                animate={lifeSyncDetailSheetEnterAnimate}
                exit={lifeSyncDetailSheetExitVariant}
                transition={lifeSyncDetailSheetMainTransition}
            >
                {/* Hero section with blurred background + cover art */}
                <div className="relative shrink-0">
                    {heroBackdropUrl && (
                        <>
                            <div className="absolute inset-0 overflow-hidden">
                                <img
                                    src={heroBackdropUrl}
                                    alt=""
                                    className={
                                        blurDetailHero
                                            ? 'h-full w-full scale-110 object-cover opacity-60 blur-2xl'
                                            : 'h-full min-h-[11rem] w-full object-cover object-center sm:min-h-[13rem]'
                                    }
                                    {...mangadexImageProps(heroBackdropUrl)}
                                />
                            </div>
                            <div
                                className={
                                    blurDetailHero
                                        ? 'absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-white'
                                        : 'absolute inset-0 bg-gradient-to-b from-black/55 via-black/25 to-white'
                                }
                            />
                        </>
                    )}
                    {!heroBackdropUrl && <div className="absolute inset-0 bg-gradient-to-b from-[#ddd6fe]/35 to-white" />}

                    {/* Close button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute z-10 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/90 hover:text-white transition-all"
                        style={{
                            top: '0.75rem',
                            right: '0.75rem',
                        }}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    {/* Cover + title row */}
                    <div className="relative flex gap-4 sm:gap-5 px-5 sm:px-6 pt-5 pb-4">
                        <div className="w-28 shrink-0 sm:w-32">
                            <MotionDiv
                                layoutId={coverLayoutId}
                                transition={lifeSyncSharedLayoutTransitionProps}
                                className="w-full overflow-hidden rounded-xl bg-[#f5f5f7] shadow-lg ring-1 ring-black/10"
                                style={{ aspectRatio: '2/3' }}
                            >
                                {coverImg ? (
                                    <img src={coverImg} alt="" className="h-full w-full object-cover" {...mangadexImageProps(coverImg)} />
                                ) : (
                                    <div className="flex h-full min-h-[7.5rem] w-full items-center justify-center">
                                        <svg className="h-10 w-10 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                                    </div>
                                )}
                            </MotionDiv>
                        </div>
                        <div className="min-w-0 flex-1 flex flex-col justify-end pb-1">
                            <h2 className="text-[18px] sm:text-[22px] font-bold text-[#1d1d1f] leading-tight line-clamp-3">
                                {d.title || manga.title}
                            </h2>
                            {d.author && (
                                <p className="mt-1.5 text-[12px] text-[#86868b] flex items-center gap-1.5">
                                    <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                    {d.author}
                                </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                {d.status && (
                                    <span className="inline-flex items-center gap-1 bg-[#C6FF00]/20 text-[#1d1d1f] text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize">
                                        <span className={`w-1.5 h-1.5 rounded-full ${d.status === 'completed' || d.status === 'cancelled' ? 'bg-[#86868b]' : 'bg-[#C6FF00]'}`} />
                                        {d.status}
                                    </span>
                                )}
                                {d.year && <span className="text-[10px] font-medium text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full">{d.year}</span>}
                                {showRating && (
                                    <span className="inline-flex items-center gap-0.5 bg-amber-50 text-amber-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                                        <svg className="w-2.5 h-2.5 fill-amber-500" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                        {ratingNum.toFixed(1)}
                                    </span>
                                )}
                                {d.contentRating && d.contentRating !== 'safe' && (
                                    <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full uppercase">{d.contentRating}</span>
                                )}
                                {sortedChapters.length > 0 && (
                                    <span className="text-[10px] font-medium text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full">
                                        {sortedChapters.length} ch.
                                    </span>
                                )}
                                {dexStats?.follows != null && dexStats.follows > 0 && (
                                    <span className="text-[10px] font-medium text-[#86868b] bg-[#f5f5f7] px-2 py-0.5 rounded-full">
                                        {dexStats.follows.toLocaleString()} follows
                                    </span>
                                )}
                            </div>
                            {src === 'mangadex' && mangadexConnected && (
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
                                    <div className="flex flex-wrap gap-2 shrink-0">
                                        {isDexFollowing == null ? (
                                            <span className="text-[10px] text-[#86868b]">Checking follow state…</span>
                                        ) : isDexFollowing ? (
                                            <button
                                                type="button"
                                                disabled={dexFollowBusy}
                                                onClick={async () => {
                                                    setDexFollowBusy(true)
                                                    try {
                                                        await lifesyncFetch(`/api/manga/mangadex/follow/${encodeURIComponent(mergedManga.id)}`, { method: 'DELETE' })
                                                        setIsDexFollowing(false)
                                                    } catch { /* ignore */ }
                                                    finally {
                                                        setDexFollowBusy(false)
                                                    }
                                                }}
                                                className="text-[11px] font-semibold text-[#86868b] hover:text-red-600 px-3 py-1.5 rounded-lg border border-[#e5e5ea] hover:border-red-100 hover:bg-red-50 transition-colors disabled:opacity-50"
                                            >
                                                {dexFollowBusy ? '…' : 'Unfollow on MangaDex'}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={dexFollowBusy}
                                                onClick={async () => {
                                                    setDexFollowBusy(true)
                                                    try {
                                                        await lifesyncFetch(`/api/manga/mangadex/follow/${encodeURIComponent(mergedManga.id)}`, { method: 'POST' })
                                                        setIsDexFollowing(true)
                                                    } catch { /* ignore */ }
                                                    finally {
                                                        setDexFollowBusy(false)
                                                    }
                                                }}
                                                className="text-[11px] font-semibold text-white bg-[#FF6740] hover:bg-[#e55a36] px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {dexFollowBusy ? '…' : 'Follow on MangaDex'}
                                            </button>
                                        )}
                                    </div>
                                    <label className="flex min-w-0 flex-col gap-0.5 sm:max-w-[14rem]">
                                        <select
                                            value={dexReadingStatus || ''}
                                            disabled={dexReadingStatusBusy}
                                            onChange={async e => {
                                                const val = e.target.value || null
                                                setDexReadingStatusBusy(true)
                                                try {
                                                    await lifesyncFetch(`/api/manga/mangadex/reading-status/${encodeURIComponent(mergedManga.id)}`, {
                                                        method: 'POST',
                                                        json: { status: val },
                                                    })
                                                    setDexReadingStatus(val)
                                                } catch { /* ignore */ }
                                                finally {
                                                    setDexReadingStatusBusy(false)
                                                }
                                            }}
                                            className="rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-2.5 py-1.5 text-[11px] font-medium text-[#1d1d1f] focus:border-[#C6FF00]/60 focus:bg-white focus:outline-none disabled:opacity-50"
                                        >
                                            <option value="">No status</option>
                                            {MANGADEX_READING_STATUSES.map(s => (
                                                <option key={s.value} value={s.value}>
                                                    {s.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 min-h-0 overflow-y-auto">
                    <MotionDiv
                        key={String(manga.id)}
                        className="px-5 sm:px-6 py-4 space-y-4"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={lifeSyncDetailBodyRevealTransition}
                    >
                        {/* Tags */}
                        {tagList?.length > 0 && (
                            <div className="flex flex-wrap gap-1.5">
                                {tagList.map((t, i) => {
                                    const label = mangaTagLabel(t)
                                    if (!label) return null
                                    return (
                                        <span key={mangaTagKey(t, i, `${mergedManga.id}-`)} className="bg-[#f5f5f7] hover:bg-[#ebebed] text-[#1d1d1f] text-[10px] font-medium px-2.5 py-1 rounded-lg transition-colors cursor-default">{label}</span>
                                    )
                                })}
                            </div>
                        )}

                        {/* Description */}
                        {cleanDesc && (
                            <div>
                                <p className={`text-[13px] text-[#3a3a3c] leading-relaxed ${descExpanded ? '' : 'line-clamp-3'}`}>
                                    {cleanDesc}
                                </p>
                                {cleanDesc.length > 200 && (
                                    <button type="button" onClick={() => setDescExpanded(v => !v)} className="mt-1 text-[11px] font-semibold text-[#C6FF00] hover:underline">
                                        {descExpanded ? 'Show less' : 'Read more'}
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Chapters */}
                        <div>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                    <h3 className="text-[13px] font-bold text-[#1d1d1f]">
                                        {src === 'hentaifox' || src === 'mangadistrict' ? 'Chapters' : 'Chapters'}
                                    </h3>
                                    {src === 'mangadex' && (
                                        <select
                                            value={chapterLang}
                                            onChange={e => setChapterLang(e.target.value)}
                                            className="rounded-lg border border-[#e5e5ea] bg-[#f5f5f7] px-2 py-1 text-[11px] font-medium text-[#1d1d1f] max-w-[200px]"
                                        >
                                            {chapterLangOptions.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    )}
                                    {src === 'mangadex' && mergedManga.id && (
                                        <a
                                            href={`https://mangadex.org/title/${mergedManga.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[11px] font-semibold text-[#FF6740] hover:underline shrink-0"
                                        >
                                            Open on MangaDex
                                        </a>
                                    )}
                                </div>
                                {sortedChapters.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => onStartRead(mergedManga, sortedChapters[0], sortedChapters)}
                                        className="flex items-center gap-1.5 rounded-lg bg-[#C6FF00] px-3 py-1.5 text-[11px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95"
                                    >
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                                        Start reading
                                    </button>
                                )}
                            </div>
                            {chapBusy ? (
                                <LifesyncMangaChapterListSkeleton rows={8} />
                            ) : sortedChapters.length === 0 ? (
                                <div className="bg-[#f5f5f7] rounded-xl px-4 py-6 text-center">
                                    <p className="text-[12px] text-[#86868b]">
                                        {src === 'hentaifox' || src === 'mangadistrict' ? 'No chapters in listing.' : 'No chapters for this language filter.'}
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-xl border border-[#e5e5ea] overflow-hidden">
                                    <ul className="max-h-80 overflow-y-auto divide-y divide-[#f0f0f0]">
                                        {sortedChapters.map((ch, i) => (
                                            <li key={ch.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => onStartRead(mergedManga, ch, sortedChapters)}
                                                    className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-[#f5f5f7] transition-colors group"
                                                >
                                                    <span className="shrink-0 w-7 h-7 rounded-lg bg-[#f5f5f7] group-hover:bg-[#C6FF00]/20 flex items-center justify-center text-[10px] font-bold text-[#86868b] group-hover:text-[#1d1d1f] transition-colors">
                                                        {i + 1}
                                                    </span>
                                                    <span className="flex-1 min-w-0">
                                                        <span className="flex items-center gap-2 min-w-0">
                                                            <span className="block text-[12px] font-medium text-[#1d1d1f] truncate">{formatChapterLabel(ch)}</span>
                                                            {src === 'mangadex' && chapterLang === 'all' && ch.translatedLanguage && (
                                                                <span className="shrink-0 text-[9px] font-semibold uppercase text-[#86868b] bg-[#ebebed] px-1.5 py-0.5 rounded">{ch.translatedLanguage}</span>
                                                            )}
                                                        </span>
                                                        {ch.scanlationGroup && <span className="block text-[10px] text-[#86868b] truncate">{ch.scanlationGroup}</span>}
                                                    </span>
                                                    <svg className="w-3.5 h-3.5 shrink-0 text-[#d2d2d7] group-hover:text-[#C6FF00] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </MotionDiv>
                </div>
            </MotionDiv>
        </MotionDiv>,
        document.body
    )
}

const SOURCES = [
    { id: 'mangadex', label: 'MangaDex' },
    { id: 'hentaifox', label: 'HentaiFox', nsfw: true },
    { id: 'mangadistrict', label: 'Manga District', nsfw: true },
]

const DEX_TABS = [
    { id: 'popular', label: 'Popular' },
    { id: 'recent', label: 'Recent' },
]

export default function LifeSyncManga() {
    const location = useLocation()
    const navigate = useNavigate()
    const resumeKeyDone = useRef(null)

    const basePath = '/dashboard/lifesync/anime/manga'
    const route = useMemo(() => {
        const rel = location.pathname.startsWith(basePath) ? location.pathname.slice(basePath.length) : ''
        const parts = rel.split('/').filter(Boolean)
        const allowedSources = new Set(['mangadex', 'hentaifox', 'mangadistrict'])
        const src = allowedSources.has(parts[0]) ? parts[0] : 'mangadex'

        // Tab is source-specific, but we keep it as a string and validate later.
        const tab = parts[1] || (src === 'mangadex' ? 'popular' : 'latest')

        let page = 1
        const pageIdx = parts.indexOf('page')
        if (pageIdx >= 0 && parts[pageIdx + 1]) page = clampPage(parts[pageIdx + 1])

        const detailIdx = parts.indexOf('manga')
        const detailMangaId = detailIdx >= 0 ? parts[detailIdx + 1] || null : null
        return { src, tab, page, detailMangaId }
    }, [location.pathname])
    const { isLifeSyncConnected, lifeSyncUser, lifeSyncUpdatePreferences } = useLifeSync()
    const prefs = lifeSyncUser?.preferences
    const nsfwEnabled = Boolean(prefs?.nsfwContentEnabled)
    /** Synced from LifeSync viewing preferences (default on when unset). */
    const mangaEnglishReleasesOnly = prefs?.mangaEnglishReleasesOnly !== false

    const [source, setSource] = useState('mangadex')
    const [tab, setTab] = useState('popular')
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [selectedManga, setSelectedManga] = useState(null)

    const listPath = useMemo(() => {
        const src = route.src || 'mangadex'
        const t = route.tab || (src === 'mangadex' ? 'popular' : 'latest')
        const p = clampPage(route.page)
        return `${basePath}/${src}/${t}/page/${p}${location.search || ''}`
    }, [basePath, location.search, route.page, route.src, route.tab])

    const goToList = useCallback(
        (opts = {}) => {
            navigate(listPath, {
                replace: Boolean(opts.replace),
                state: null,
            })
        },
        [navigate, listPath]
    )

    const goToSource = useCallback(
        s => {
            const next = String(s || '').trim()
            const src = next === 'hentaifox' || next === 'mangadistrict' ? next : 'mangadex'
            const t = src === 'mangadex' ? 'popular' : 'latest'
            navigate(`${basePath}/${src}/${t}/page/1${location.search || ''}`)
        },
        [basePath, location.search, navigate]
    )

    const goToTab = useCallback(
        t => {
            const next = String(t || '').trim() || (route.src === 'mangadex' ? 'popular' : 'latest')
            navigate(`${basePath}/${route.src}/${next}/page/1${location.search || ''}`)
        },
        [basePath, location.search, navigate, route.src]
    )

    const goToPage = useCallback(
        p => {
            navigate(`${basePath}/${route.src}/${route.tab}/page/${clampPage(p)}${location.search || ''}`)
        },
        [basePath, location.search, navigate, route.src, route.tab]
    )

    const goToMangaDetail = useCallback(
        (mangaOrId, srcOverride) => {
            const src = srcOverride || route.src
            const id =
                mangaOrId && typeof mangaOrId === 'object' ? mangaOrId.id : mangaOrId
            if (id == null) return
            const preview = mangaDetailPreviewFromCard(
                mangaOrId && typeof mangaOrId === 'object' ? mangaOrId : null,
                src,
            )
            navigate(
                `${basePath}/${src}/${route.tab}/page/${clampPage(route.page)}/manga/${encodeURIComponent(String(id))}${location.search || ''}`,
                preview ? { state: { mangaDetailPreview: preview } } : {},
            )
        },
        [basePath, location.search, navigate, route.page, route.src, route.tab]
    )

    // MangaDex state (needs to exist before `goToRead`)
    const [dexTranslatedLang, setDexTranslatedLang] = useState('en')

    const goToRead = useCallback(
        (mangaId, chapterId, srcOverride) => {
            const src = srcOverride || route.src
            navigate(
                `${basePath}/read/${encodeURIComponent(String(mangaId))}/${encodeURIComponent(String(chapterId))}${location.search || ''}`,
                {
                    state: {
                        from: `${basePath}/${src}/${route.tab}/page/${clampPage(route.page)}${location.search || ''}`,
                        source: src,
                        browseTranslatedLang: mangaEnglishReleasesOnly ? 'en' : dexTranslatedLang,
                    },
                },
            )
        },
        [basePath, dexTranslatedLang, location.search, mangaEnglishReleasesOnly, navigate, route.page, route.src, route.tab]
    )

    // MangaDex state
    const [dexAuthStatus, setDexAuthStatus] = useState(null)
    const [popular, setPopular] = useState([])
    const [recent, setRecent] = useState([])
    const [dexFollows, setDexFollows] = useState([])
    const [dexFollowsTotal, setDexFollowsTotal] = useState(0)
    const [dexFollowsBusy, setDexFollowsBusy] = useState(false)
    const [dexLibraryList, setDexLibraryList] = useState([])
    const [dexLibraryBusy, setDexLibraryBusy] = useState(false)
    const [libraryListStatus, setLibraryListStatus] = useState('reading')
    const [dexContentRatings, setDexContentRatings] = useState(() => [...DEFAULT_DEX_CONTENT_RATINGS])
    const [searchQ, setSearchQ] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [popularLoading, setPopularLoading] = useState(false)
    const [recentLoading, setRecentLoading] = useState(false)
    const [committedSearchQuery, setCommittedSearchQuery] = useState('')
    const [dexTags, setDexTags] = useState([])
    const [dexFiltersOpen, setDexFiltersOpen] = useState(false)
    const [dexTagsPanelOpen, setDexTagsPanelOpen] = useState(false)
    const [includedTags, setIncludedTags] = useState([])
    const [excludedTags, setExcludedTags] = useState([])
    const [includedTagsMode, setIncludedTagsMode] = useState('AND')
    const [excludedTagsMode, setExcludedTagsMode] = useState('OR')
    const [statusFilter, setStatusFilter] = useState([])
    const [demographicFilter, setDemographicFilter] = useState([])
    const [originalLangFilter, setOriginalLangFilter] = useState([])
    const [dexYear, setDexYear] = useState('')
    const [dexBrowseSort, setDexBrowseSort] = useState('random')
    const [dexSearchOrderBy, setDexSearchOrderBy] = useState('relevance')
    const [dexSearchOrderDir, setDexSearchOrderDir] = useState('desc')
    const [dexPopularPage, setDexPopularPage] = useState(1)
    const [dexRecentPage, setDexRecentPage] = useState(1)
    const [dexSearchPage, setDexSearchPage] = useState(1)
    const [popularTotal, setPopularTotal] = useState(0)
    const [recentTotal, setRecentTotal] = useState(0)
    const [searchTotal, setSearchTotal] = useState(0)

    const dexFilterSig = useMemo(
        () =>
            JSON.stringify({
                dexTranslatedLang,
                eo: mangaEnglishReleasesOnly,
                it: [...includedTags].sort(),
                et: [...excludedTags].sort(),
                st: [...statusFilter].sort(),
                dm: [...demographicFilter].sort(),
                ol: [...originalLangFilter].sort(),
                im: includedTagsMode,
                em: excludedTagsMode,
                y: String(dexYear || ''),
                dbs: dexBrowseSort,
                sob: dexSearchOrderBy,
                sod: dexSearchOrderDir,
                cr: sortDexContentRatings(dexContentRatings).join(','),
            }),
        [
            dexTranslatedLang,
            mangaEnglishReleasesOnly,
            includedTags,
            excludedTags,
            statusFilter,
            demographicFilter,
            originalLangFilter,
            includedTagsMode,
            excludedTagsMode,
            dexYear,
            dexBrowseSort,
            dexSearchOrderBy,
            dexSearchOrderDir,
            dexContentRatings,
        ]
    )

    const [dexListSigBound, setDexListSigBound] = useState(dexFilterSig)
    useEffect(() => {
        if (dexFilterSig === dexListSigBound) return
        setDexListSigBound(dexFilterSig)
        setDexPopularPage(1)
        setDexRecentPage(1)
        setDexSearchPage(1)
    }, [dexFilterSig, dexListSigBound])

    // HentaiFox state
    const [hfStatus, setHfStatus] = useState(null)
    const [hfLatest, setHfLatest] = useState(null)
    const [hfPage, setHfPage] = useState(1)
    const [hfFilter, setHfFilter] = useState('')
    const [hfSearchResults, setHfSearchResults] = useState([])
    const [hfSearchBusy, setHfSearchBusy] = useState(false)

    // Manga District state
    const [mdStatus, setMdStatus] = useState(null)
    const [mdLatest, setMdLatest] = useState(null)
    const [mdPage, setMdPage] = useState(1)
    const [mdSection, setMdSection] = useState('latest')
    const [mdFilter, setMdFilter] = useState('')
    const [mdSearchResults, setMdSearchResults] = useState([])
    const [mdSearchBusy, setMdSearchBusy] = useState(false)
    const [mdFiltersOpen, setMdFiltersOpen] = useState(false)
    const [mdTypeSlug, setMdTypeSlug] = useState('')
    const [mdFilterGenre, setMdFilterGenre] = useState('')
    const [mdBrowse, setMdBrowse] = useState('latest-updates')

    useEffect(() => {
        if (location.pathname === basePath || location.pathname === `${basePath}/`) {
            navigate(`${basePath}/mangadex/popular/page/1${location.search || ''}`, { replace: true })
        }
    }, [basePath, location.pathname, location.search, navigate])

    useEffect(() => {
        if (source !== route.src) setSource(route.src)
        const fallbackTab = route.src === 'mangadex' ? 'popular' : 'latest'
        const allowedDex = new Set(['popular', 'recent', 'library', 'following', 'search'])
        const nextTab =
            route.src === 'mangadex'
                ? (allowedDex.has(route.tab) ? route.tab : fallbackTab)
                : 'latest'
        if (tab !== nextTab) setTab(nextTab)

        if (route.src === 'mangadex' && nextTab === 'popular' && dexPopularPage !== route.page) setDexPopularPage(route.page)
        if (route.src === 'mangadex' && nextTab === 'recent' && dexRecentPage !== route.page) setDexRecentPage(route.page)
        if (route.src === 'mangadex' && nextTab === 'search' && dexSearchPage !== route.page) setDexSearchPage(route.page)
        if (route.src === 'hentaifox' && hfPage !== route.page) setHfPage(route.page)
        if (route.src === 'mangadistrict' && mdPage !== route.page) setMdPage(route.page)
    }, [
        dexPopularPage,
        dexRecentPage,
        dexSearchPage,
        hfPage,
        mdPage,
        route.page,
        route.src,
        route.tab,
        source,
        tab,
    ])

    useEffect(() => {
        if (source !== 'mangadistrict') return
        if (!MD_ORDER_BY_IDS.has(mdBrowse)) setMdBrowse('latest-updates')
    }, [source, mdBrowse])

    useEffect(() => {
        if (route.src !== 'mangadex' || route.tab !== 'search') return
        const q = new URLSearchParams(location.search || '').get('q') || ''
        const next = q.trim()
        if (next && next !== committedSearchQuery) {
            setCommittedSearchQuery(next)
            setSearchQ(next)
        }
    }, [committedSearchQuery, location.search, route.src, route.tab])

    const mdFilterBarCount =
        (mdSection !== 'latest' ? 1 : 0) +
        (mdTypeSlug ? 1 : 0) +
        (mdFilterGenre ? 1 : 0) +
        (mdBrowse !== 'latest-updates' ? 1 : 0)

    const resumeFromEntry = useCallback(async entry => {
        setError('')
        try {
            if (
                !nsfwEnabled &&
                (entry.source === 'hentaifox' || entry.source === 'mangadistrict')
            ) {
                setError('Enable NSFW content in LifeSync preferences to open this title.')
                return
            }
            if (
                !nsfwEnabled &&
                entry.source === 'mangadex' &&
                (entry.contentRating === 'erotica' || entry.contentRating === 'pornographic')
            ) {
                setError('Enable NSFW content in LifeSync preferences to open this title.')
                return
            }
            if (entry.source === 'mangadex') {
                await lifesyncFetch(`/api/manga/details/${encodeURIComponent(entry.mangaId)}`)
                const feed = await lifesyncFetch(`/api/manga/chapters/${encodeURIComponent(entry.mangaId)}?limit=500&lang=all&order=asc`)
                const list = [...(feed.data || [])]
                list.sort(compareChapters)
                let ch = list.find(c => c.id === entry.lastChapterId)
                if (!ch && list.length) ch = list[list.length - 1]
                if (!ch) {
                    setError('No chapters available to resume.')
                    return
                }
                setSelectedManga(null)
                setSource('mangadex')
                goToRead(entry.mangaId, ch.id, 'mangadex')
                return
            }
            if (entry.source === 'mangadistrict') {
                const data = await lifesyncFetch(`/api/manga/mangadistrict/info/${encodeURIComponent(entry.mangaId)}`)
                const list = [...(data.chapters || [])]
                list.sort(compareChapters)
                let ch = list.find(c => c.id === entry.lastChapterId)
                if (!ch && list.length) ch = list[list.length - 1]
                if (!ch) {
                    setError('No chapters available to resume.')
                    return
                }
                setSelectedManga(null)
                setSource('mangadistrict')
                goToRead(entry.mangaId, ch.id, 'mangadistrict')
                return
            }
            if (entry.source === 'hentaifox') {
                const data = await lifesyncFetch(`/api/manga/hentaifox/info/${encodeURIComponent(entry.mangaId)}`)
                const list = [...(data.chapters || [])]
                let ch = list.find(c => c.id === entry.lastChapterId)
                if (!ch && list.length) ch = list[0]
                if (!ch) {
                    setError('Could not open this title.')
                    return
                }
                setSelectedManga(null)
                setSource('hentaifox')
                goToRead(entry.mangaId, ch.id, 'hentaifox')
            }
        } catch (e) {
            setError(e.message || 'Could not resume reading')
        }
    }, [goToRead, nsfwEnabled])

    useEffect(() => {
        if (source === 'mangadex' && tab === 'reading') setTab('popular')
    }, [source, tab])

    useEffect(() => {
        const entry = location.state?.resumeEntry
        if (!entry?.mangaId || !entry?.source) return
        const k = `${entry.source}:${entry.mangaId}`
        if (resumeKeyDone.current === k) return
        resumeKeyDone.current = k
        void resumeFromEntry(entry).finally(() => {
            navigate(`${location.pathname}${location.search || ''}`, { replace: true, state: {} })
            resumeKeyDone.current = null
        })
    }, [location.state, location.pathname, location.search, navigate, resumeFromEntry])

    // Check NSFW source availability (only when NSFW is allowed — no UI for those sources otherwise)
    useEffect(() => {
        if (!isLifeSyncConnected) return
        let cancelled = false
        lifesyncFetch('/api/manga/mangadex/auth/status')
            .then(s => { if (!cancelled) setDexAuthStatus(s) })
            .catch(() => { if (!cancelled) setDexAuthStatus({ oauthConfigured: false, connected: false }) })
        return () => { cancelled = true }
    }, [isLifeSyncConnected])

    useEffect(() => {
        if (!isLifeSyncConnected || !nsfwEnabled) return
        lifesyncFetch('/api/manga/hentaifox/status').then(setHfStatus).catch(() => setHfStatus({ configured: false }))
        lifesyncFetch('/api/manga/mangadistrict/status').then(setMdStatus).catch(() => setMdStatus({ configured: false }))
    }, [isLifeSyncConnected, nsfwEnabled])

    useEffect(() => {
        if (source !== 'mangadex' || (tab !== 'following' && tab !== 'library')) return
        if (dexAuthStatus && !dexAuthStatus.connected) setTab('popular')
    }, [source, tab, dexAuthStatus])

    useEffect(() => {
        if (!nsfwEnabled && (source === 'hentaifox' || source === 'mangadistrict')) {
            setSource('mangadex')
            setTab('popular')
        }
    }, [nsfwEnabled, source])

    useEffect(() => {
        if (nsfwEnabled) return
        const nsfwSrc = m => m?.source === 'hentaifox' || m?.source === 'mangadistrict'
        if (selectedManga && nsfwSrc(selectedManga)) setSelectedManga(null)
    }, [nsfwEnabled, selectedManga])

    useEffect(() => {
        if (nsfwEnabled) return
        setDexContentRatings(prev => {
            const next = prev.filter(r => r !== 'erotica' && r !== 'pornographic')
            return next.length ? sortDexContentRatings(next) : [...DEFAULT_DEX_CONTENT_RATINGS]
        })
    }, [nsfwEnabled])

    const browseShuffle = dexBrowseSort === 'random'
    const browseOrderBy = browseShuffle ? '' : dexBrowseSort

    // MangaDex loaders (`shuffle=1` for random browse; otherwise stable order + pagination)
    const loadPopular = useCallback(async () => {
        setPopularLoading(true)
        try {
            const offset = browseShuffle ? 0 : (dexPopularPage - 1) * DEX_PAGE_SIZE
            const q = buildDexListQuery({
                limit: DEX_PAGE_SIZE,
                offset,
                contentRatings: dexContentRatings,
                nsfwEnabled,
                dexTranslatedLang,
                englishOnly: mangaEnglishReleasesOnly,
                includedTags,
                excludedTags,
                statusFilter,
                demographicFilter,
                includedTagsMode,
                excludedTagsMode,
                originalLangFilter,
                searchYear: dexYear,
                orderBy: browseOrderBy,
                orderDir: 'desc',
                shuffle: browseShuffle,
            })
            const d = await lifesyncFetch(`/api/manga/popular?${q}`)
            setPopular(d?.data || [])
            setPopularTotal(typeof d?.total === 'number' ? d.total : (d?.data || []).length)
        } catch { /* ignore */ }
        finally {
            setPopularLoading(false)
        }
    }, [
        dexPopularPage,
        dexTranslatedLang,
        mangaEnglishReleasesOnly,
        includedTags,
        excludedTags,
        statusFilter,
        demographicFilter,
        includedTagsMode,
        excludedTagsMode,
        originalLangFilter,
        dexYear,
        browseOrderBy,
        browseShuffle,
        dexContentRatings,
        nsfwEnabled,
    ])

    const loadRecent = useCallback(async () => {
        setRecentLoading(true)
        try {
            const offset = browseShuffle ? 0 : (dexRecentPage - 1) * DEX_PAGE_SIZE
            const q = buildDexListQuery({
                limit: DEX_PAGE_SIZE,
                offset,
                contentRatings: dexContentRatings,
                nsfwEnabled,
                dexTranslatedLang,
                englishOnly: mangaEnglishReleasesOnly,
                includedTags,
                excludedTags,
                statusFilter,
                demographicFilter,
                includedTagsMode,
                excludedTagsMode,
                originalLangFilter,
                searchYear: dexYear,
                orderBy: browseOrderBy,
                orderDir: 'desc',
                shuffle: browseShuffle,
            })
            const d = await lifesyncFetch(`/api/manga/recent?${q}`)
            setRecent(d?.data || [])
            setRecentTotal(typeof d?.total === 'number' ? d.total : (d?.data || []).length)
        } catch { /* ignore */ }
        finally {
            setRecentLoading(false)
        }
    }, [
        dexRecentPage,
        dexTranslatedLang,
        mangaEnglishReleasesOnly,
        includedTags,
        excludedTags,
        statusFilter,
        demographicFilter,
        includedTagsMode,
        excludedTagsMode,
        originalLangFilter,
        dexYear,
        browseOrderBy,
        browseShuffle,
        dexContentRatings,
        nsfwEnabled,
    ])

    const loadFollows = useCallback(async (offset = 0) => {
        setDexFollowsBusy(true)
        if (offset === 0) setError('')
        try {
            const d = await lifesyncFetch(`/api/manga/mangadex/follows?limit=24&offset=${offset}`)
            const rows = d?.data || []
            if (offset === 0) setDexFollows(rows)
            else setDexFollows(prev => [...prev, ...rows])
            if (typeof d?.total === 'number') setDexFollowsTotal(d.total)
            else if (offset === 0) setDexFollowsTotal(rows.length)
        } catch (e) {
            if (offset === 0) {
                setDexFollows([])
                setDexFollowsTotal(0)
            }
            setError(e.message || 'Could not load MangaDex follows')
        } finally {
            setDexFollowsBusy(false)
        }
    }, [])

    const loadDexLibrary = useCallback(async status => {
        setDexLibraryBusy(true)
        setError('')
        try {
            const d = await lifesyncFetch(
                `/api/manga/mangadex/reading-library?status=${encodeURIComponent(status)}`
            )
            setDexLibraryList(Array.isArray(d?.data) ? d.data : [])
        } catch (e) {
            setDexLibraryList([])
            setError(e.message || 'Could not load MangaDex library')
        } finally {
            setDexLibraryBusy(false)
        }
    }, [])

    useEffect(() => {
        if (!isLifeSyncConnected || source !== 'mangadex' || tab === 'library') return
        void loadPopular()
    }, [isLifeSyncConnected, source, tab, loadPopular])

    useEffect(() => {
        if (!isLifeSyncConnected || source !== 'mangadex' || tab === 'library') return
        void loadRecent()
    }, [isLifeSyncConnected, source, tab, loadRecent])

    useEffect(() => {
        if (!isLifeSyncConnected) return
        let cancelled = false
        lifesyncFetch('/api/manga/tags')
            .then(d => {
                if (!cancelled && Array.isArray(d?.tags)) setDexTags(d.tags)
            })
            .catch(() => {})
        return () => { cancelled = true }
    }, [isLifeSyncConnected])

    useEffect(() => {
        if (!isLifeSyncConnected || source !== 'mangadex' || tab !== 'search' || !committedSearchQuery.trim()) return
        let cancelled = false
        ;(async () => {
            setSearching(true)
            try {
                const offset = (dexSearchPage - 1) * DEX_PAGE_SIZE
                const q = buildDexListQuery({
                    limit: DEX_PAGE_SIZE,
                    offset,
                    contentRatings: dexContentRatings,
                    nsfwEnabled,
                    dexTranslatedLang,
                    englishOnly: mangaEnglishReleasesOnly,
                    includedTags,
                    excludedTags,
                    statusFilter,
                    demographicFilter,
                    includedTagsMode,
                    excludedTagsMode,
                    originalLangFilter,
                    searchYear: dexYear,
                    orderBy: dexSearchOrderBy,
                    orderDir: dexSearchOrderDir,
                })
                q.set('q', committedSearchQuery.trim())
                const d = await lifesyncFetch(`/api/manga/search?${q}`)
                if (!cancelled) {
                    setSearchResults(d?.data || [])
                    setSearchTotal(typeof d?.total === 'number' ? d.total : (d?.data || []).length)
                }
            } catch {
                if (!cancelled) {
                    setSearchResults([])
                    setSearchTotal(0)
                }
            } finally {
                if (!cancelled) setSearching(false)
            }
        })()
        return () => { cancelled = true }
    }, [
        isLifeSyncConnected,
        source,
        tab,
        committedSearchQuery,
        dexSearchPage,
        dexTranslatedLang,
        mangaEnglishReleasesOnly,
        includedTags,
        excludedTags,
        statusFilter,
        demographicFilter,
        includedTagsMode,
        excludedTagsMode,
        originalLangFilter,
        dexYear,
        dexSearchOrderBy,
        dexSearchOrderDir,
        dexContentRatings,
        nsfwEnabled,
    ])

    useEffect(() => {
        if (!isLifeSyncConnected || source !== 'mangadex' || tab !== 'following') return
        if (!dexAuthStatus?.connected) return
        void loadFollows(0)
    }, [isLifeSyncConnected, source, tab, dexAuthStatus?.connected, loadFollows])

    useEffect(() => {
        if (!isLifeSyncConnected || source !== 'mangadex' || tab !== 'library') return
        if (!dexAuthStatus?.connected) return
        setDexLibraryList([])
        void loadDexLibrary(libraryListStatus)
    }, [isLifeSyncConnected, source, tab, dexAuthStatus?.connected, libraryListStatus, loadDexLibrary])

    // HentaiFox loaders
    const loadHfLatest = useCallback(async (page = 1) => {
        setBusy(true)
        setError('')
        try {
            const d = await lifesyncFetch(`/api/manga/hentaifox/latest/${page}`)
            setHfLatest(d)
            setHfPage(page)
        } catch (e) {
            setError(e.message || 'Failed to load HentaiFox')
        } finally {
            setBusy(false)
        }
    }, [])

    useEffect(() => {
        if (source !== 'hentaifox') return
        if (hfFilter.trim()) return
        void loadHfLatest(clampPage(hfPage))
    }, [source, hfFilter, hfPage, loadHfLatest])

    useEffect(() => {
        if (source !== 'hentaifox') return
        const q = hfFilter.trim()
        if (!q) {
            setHfSearchResults([])
            setHfSearchBusy(false)
            return
        }
        setHfSearchBusy(true)
        let cancelled = false
        let fetchStarted = false
        const t = setTimeout(async () => {
            if (cancelled) return
            fetchStarted = true
            try {
                const d = await lifesyncFetch(`/api/manga/hentaifox/search?q=${encodeURIComponent(q)}`)
                if (!cancelled) setHfSearchResults(d?.data || d || [])
            } catch {
                if (!cancelled) setHfSearchResults([])
            } finally {
                if (!cancelled) setHfSearchBusy(false)
            }
        }, 400)
        return () => {
            cancelled = true
            clearTimeout(t)
            if (!fetchStarted) setHfSearchBusy(false)
        }
    }, [source, hfFilter])

    // Manga District loaders
    const loadMdLatest = useCallback(async (page = 1) => {
        setBusy(true)
        setError('')
        try {
            const qs = buildMangaDistrictListQuery(mdSection, mdTypeSlug, mdFilterGenre, mdBrowse)
            const d = await lifesyncFetch(`/api/manga/mangadistrict/latest/${page}?${qs}`)
            setMdLatest(d)
            setMdPage(page)
        } catch (e) {
            setError(e.message || 'Failed to load Manga District')
        } finally {
            setBusy(false)
        }
    }, [mdSection, mdTypeSlug, mdFilterGenre, mdBrowse])

    useEffect(() => {
        setMdLatest(null)
    }, [mdSection, mdTypeSlug, mdFilterGenre, mdBrowse])

    useEffect(() => {
        if (source !== 'mangadistrict') return
        if (mdFilter.trim()) return
        void loadMdLatest(clampPage(mdPage))
    }, [source, mdFilter, mdPage, loadMdLatest])

    useEffect(() => {
        if (source !== 'mangadistrict') return
        const q = mdFilter.trim()
        if (!q) {
            setMdSearchResults([])
            return
        }
        let cancelled = false
        const t = setTimeout(async () => {
            setMdSearchBusy(true)
            try {
                const d = await lifesyncFetch(`/api/manga/mangadistrict/search?q=${encodeURIComponent(q)}`)
                if (!cancelled) setMdSearchResults(d?.data || d || [])
            } catch {
                if (!cancelled) setMdSearchResults([])
            } finally {
                if (!cancelled) setMdSearchBusy(false)
            }
        }, 400)
        return () => {
            cancelled = true
            clearTimeout(t)
        }
    }, [source, mdFilter])

    function handleDexSearch(e) {
        e.preventDefault()
        if (!searchQ.trim()) return
        const q = searchQ.trim()
        setCommittedSearchQuery(q)
        setDexSearchPage(1)
        const qs = new URLSearchParams(location.search || '')
        qs.set('q', q)
        navigate(`${basePath}/${route.src}/search/page/1?${qs.toString()}`)
    }

    const openMangaFromCard = useCallback(
        manga => {
            if (!manga?.id) return
            const src = manga.source || source
            goToMangaDetail(manga, src)
        },
        [goToMangaDetail, source]
    )

    const enrichSelectedManga = useCallback(
        async ({ id, source: srcParam }) => {
            const src = srcParam || source
            if (!id) return
            if (!nsfwEnabled && (src === 'hentaifox' || src === 'mangadistrict')) return
            setError('')
            try {
                if (src === 'hentaifox') {
                    const data = await lifesyncFetch(`/api/manga/hentaifox/info/${encodeURIComponent(id)}`)
                    setSelectedManga(prev => ({
                        ...prev,
                        ...data,
                        id: data.id || id,
                        coverUrl: data.coverUrl || prev?.coverUrl,
                        source: 'hentaifox',
                    }))
                    return
                }
                if (src === 'mangadistrict') {
                    const data = await lifesyncFetch(`/api/manga/mangadistrict/info/${encodeURIComponent(id)}`)
                    setSelectedManga(prev => ({
                        ...prev,
                        ...data,
                        id: data.id || id,
                        coverUrl: data.coverUrl || prev?.coverUrl,
                        source: 'mangadistrict',
                    }))
                    return
                }
                const data = await lifesyncFetch(`/api/manga/details/${id}`)
                setSelectedManga(prev => ({
                    ...prev,
                    ...data,
                    id: data.id || id,
                    source: 'mangadex',
                    coverUrl: data.coverUrl || prev?.coverUrl,
                }))
            } catch (e) {
                setError(e.message || 'Could not open manga')
            }
        },
        [nsfwEnabled, source]
    )

    const routeDetailKey = useRef(null)

    useEffect(() => {
        if (route.detailMangaId) {
            const k = `${route.src}:${route.detailMangaId}`
            if (routeDetailKey.current !== k) {
                routeDetailKey.current = k
                const preview = location.state?.mangaDetailPreview
                const previewOk =
                    preview &&
                    String(preview.id) === String(route.detailMangaId) &&
                    String(preview.source || '') === String(route.src)
                if (previewOk) {
                    setSelectedManga({
                        id: preview.id,
                        source: preview.source || route.src,
                        title: preview.title,
                        coverUrl: preview.coverUrl,
                        tags: preview.tags,
                        status: preview.status,
                        year: preview.year,
                        author: preview.author,
                        contentRating: preview.contentRating,
                        backgroundImageUrl: preview.backgroundImageUrl,
                        ratingAverage: preview.ratingAverage,
                        ratings: preview.ratings,
                    })
                } else {
                    setSelectedManga({ id: route.detailMangaId, source: route.src })
                }
                void enrichSelectedManga({ id: route.detailMangaId, source: route.src })
            }
        } else {
            routeDetailKey.current = null
            setSelectedManga(null)
        }
    }, [enrichSelectedManga, location.state?.mangaDetailPreview, route.detailMangaId, route.src])

    function switchSource(s) {
        goToSource(s)
    }

    function handleStartRead(mergedManga, chapter) {
        if (!mergedManga?.id || !chapter?.id) return
        const src = mergedManga.source || source
        goToRead(mergedManga.id, chapter.id, src)
    }

    const hfLastPage = Math.max(1, parseInt(String(hfLatest?.lastPage ?? '1'), 10) || 1)
    const hfCurPage = Math.min(hfLastPage, Math.max(1, parseInt(String(hfLatest?.currentPage ?? hfPage), 10) || 1))
    const mdLastPage = Math.max(1, parseInt(String(mdLatest?.lastPage ?? '1'), 10) || 1)
    const mdCurPage = Math.min(mdLastPage, Math.max(1, parseInt(String(mdLatest?.currentPage ?? mdPage), 10) || 1))

    const dexPopularLast = dexBrowseLastPage(popularTotal)
    const dexRecentLast = dexBrowseLastPage(recentTotal)
    const dexSearchLast = dexBrowseLastPage(searchTotal)

    const toggleDexIncludeTag = useCallback(id => {
        setExcludedTags(prev => prev.filter(x => x !== id))
        setIncludedTags(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
    }, [])

    const toggleDexExcludeTag = useCallback(id => {
        setIncludedTags(prev => prev.filter(x => x !== id))
        setExcludedTags(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
    }, [])

    const toggleDexStatus = useCallback(s => {
        setStatusFilter(prev => (prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]))
    }, [])

    const toggleDexDemographic = useCallback(d => {
        setDemographicFilter(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]))
    }, [])

    const toggleOriginalLang = useCallback(code => {
        setOriginalLangFilter(prev => (prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]))
    }, [])

    const toggleDexContentRating = useCallback(id => {
        setDexContentRatings(prev => {
            const set = new Set(prev)
            if (set.has(id)) {
                if (set.size <= 1) return prev
                set.delete(id)
            } else {
                set.add(id)
            }
            return sortDexContentRatings([...set])
        })
    }, [])

    const resetDexFilters = useCallback(() => {
        setDexContentRatings([...DEFAULT_DEX_CONTENT_RATINGS])
        setIncludedTags([])
        setExcludedTags([])
        setIncludedTagsMode('AND')
        setExcludedTagsMode('OR')
        setStatusFilter([])
        setDemographicFilter([])
        setOriginalLangFilter([])
        setDexYear('')
        setDexBrowseSort('random')
        setDexSearchOrderBy('relevance')
        setDexSearchOrderDir('desc')
        setDexTagsPanelOpen(false)
    }, [])

    const dexFilterBarCount = useMemo(() => {
        let n =
            includedTags.length +
            excludedTags.length +
            statusFilter.length +
            demographicFilter.length +
            originalLangFilter.length
        if (String(dexYear || '').trim()) n += 1
        if (!mangaEnglishReleasesOnly) n += 1
        const defaultSig = sortDexContentRatings(DEFAULT_DEX_CONTENT_RATINGS).join(',')
        if (sortDexContentRatings(dexContentRatings).join(',') !== defaultSig) n += 1
        return n
    }, [
        includedTags,
        excludedTags,
        statusFilter,
        demographicFilter,
        originalLangFilter,
        dexYear,
        mangaEnglishReleasesOnly,
        dexContentRatings,
    ])

    const sourceChoices = useMemo(() => SOURCES.filter(s => !s.nsfw || nsfwEnabled), [nsfwEnabled])

    const currentItems = useMemo(() => {
        if (source === 'mangadex') {
            if (tab === 'following') return dexFollows
            if (tab === 'library') return dexLibraryList
            if (tab === 'popular') return popular
            if (tab === 'recent') return recent
            if (tab === 'search') return searchResults
        }
        if (source === 'hentaifox') {
            if (hfFilter.trim()) return hfSearchResults
            return hfLatest?.data || []
        }
        if (source === 'mangadistrict') {
            if (mdFilter.trim()) return mdSearchResults
            return mdLatest?.data || []
        }
        return []
    }, [source, tab, popular, recent, searchResults, dexFollows, dexLibraryList, hfLatest, hfFilter, hfSearchResults, mdLatest, mdFilter, mdSearchResults])

    const mangaGridLoading = useMemo(() => {
        if (currentItems.length > 0) return false
        if (busy) return true
        if (source === 'mangadex') {
            if (tab === 'following' && dexFollowsBusy) return true
            if (tab === 'library' && dexLibraryBusy) return true
            if (tab === 'search' && committedSearchQuery.trim() && searching) return true
            if (tab === 'popular' && popularLoading) return true
            if (tab === 'recent' && recentLoading) return true
        }
        if (source === 'mangadistrict' && mdFilter.trim() && mdSearchBusy) return true
        if (source === 'hentaifox' && hfFilter.trim() && hfSearchBusy) return true
        return false
    }, [
        currentItems.length,
        busy,
        source,
        tab,
        dexFollowsBusy,
        dexLibraryBusy,
        committedSearchQuery,
        searching,
        popularLoading,
        recentLoading,
        mdFilter,
        mdSearchBusy,
        hfFilter,
        hfSearchBusy,
    ])

    const dexTabs = useMemo(() => {
        const t = [...DEX_TABS, { id: 'library', label: 'Library' }]
        if (dexAuthStatus?.connected) t.push({ id: 'following', label: 'Following' })
        if (committedSearchQuery.trim()) t.push({ id: 'search', label: 'Search Results' })
        return t
    }, [dexAuthStatus?.connected, committedSearchQuery])

    const tabs = source === 'mangadex' ? dexTabs : []

    const useMangaBrowseCardStagger =
        currentItems.length > 0 &&
        currentItems.length <= lifeSyncBrowseGridStaggerMaxItems

    if (!isLifeSyncConnected) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="mb-1 text-[28px] font-bold tracking-tight text-[#1a1628]">Manga</h1>
                <p className="mb-4 max-w-xl text-[13px] leading-relaxed text-[#5b5670]">
                    Discover titles, read in the built-in chapter reader, and sync MangaDex when your account is linked.
                </p>
                <div className="rounded-[22px] border border-white/90 bg-white/90 px-8 py-16 text-center shadow-sm ring-1 ring-[#e8e4ef]/70">
                    <p className="text-[15px] font-bold text-[#1a1628] mb-2">LifeSync Not Connected</p>
                    <p className="text-[13px] text-[#5b5670] mb-4">Connect LifeSync in your profile to access manga.</p>
                    <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 rounded-xl bg-[#C6FF00] px-5 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95">
                        Go to Integrations
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <LayoutGroup id="lifesync-manga">
        <MotionDiv
            className="min-w-0 w-full max-w-full space-y-6 sm:space-y-8"
            style={{ transformOrigin: '50% 0%' }}
            initial="initial"
            animate="animate"
            variants={lifeSyncDollyPageVariants}
            transition={lifeSyncDollyPageTransition}
        >
            <AnimatePresence mode="sync">
                {selectedManga ? (
                    <MangaDetail
                        key={`${selectedManga.source || source}-${selectedManga.id}`}
                        manga={selectedManga}
                        source={source}
                        onClose={() => goToList({ replace: true })}
                        onStartRead={handleStartRead}
                        mangadexConnected={Boolean(dexAuthStatus?.connected)}
                        browseTranslatedLang={mangaEnglishReleasesOnly ? 'en' : dexTranslatedLang}
                    />
                ) : null}
            </AnimatePresence>

            <div
                className="flex min-w-0 w-full max-w-full flex-col gap-5 sm:gap-6"
                style={{ pointerEvents: selectedManga ? 'none' : undefined }}
            >
            <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Anime</p>
                    <h1 className="text-[24px] sm:text-[28px] font-bold tracking-tight text-[#1a1628]">Manga</h1>
                    <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#5b5670]">
                        Search and browse from MangaDex and other sources, read chapters here, and resume where you left off.
                    </p>
                </div>
                <Link
                    to="/dashboard/profile?tab=integrations"
                    className="shrink-0 self-start whitespace-nowrap rounded-xl bg-[#C6FF00] px-4 py-2 text-center text-[12px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95 sm:pt-0.5"
                >
                    Link / Disconnect
                </Link>
            </div>

            {error && <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>}

            {/* Source selector — NSFW sources omitted entirely when NSFW is disabled in LifeSync preferences */}
            {sourceChoices.length > 1 && (
                <LifeSyncSectionNav
                    ariaLabel="Manga source"
                    layoutId="lifesync-manga-source"
                    items={sourceChoices.map(s => {
                        const disabled =
                            (s.id === 'hentaifox' && hfStatus?.configured === false) ||
                            (s.id === 'mangadistrict' && mdStatus?.configured === false)
                        return { id: s.id, label: s.label, disabled, title: disabled ? 'This source is not available here yet' : undefined }
                    })}
                    activeId={source}
                    onSelect={(id) => switchSource(id)}
                />
            )}

            {/* Search & filters toolbar (shared layout across sources) */}
            {source === 'mangadex' && (
                <div className="min-w-0 w-full max-w-full space-y-3">
                    <form onSubmit={handleDexSearch} className="flex min-w-0 w-full max-w-full flex-col flex-wrap items-stretch gap-2 sm:flex-row">
                        <input
                            type="search"
                            value={searchQ}
                            onChange={e => setSearchQ(e.target.value)}
                            placeholder="Search MangaDex..."
                            className="min-w-[min(100%,12rem)] flex-1 px-4 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setDexFiltersOpen(v => !v)}
                            aria-expanded={dexFiltersOpen}
                            className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2.5 text-[13px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#ebebed]"
                        >
                            Filters
                            {dexFilterBarCount > 0 && (
                                <span className="rounded-full bg-[#C6FF00]/35 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">{dexFilterBarCount}</span>
                            )}
                            <svg className={`h-3.5 w-3.5 text-[#86868b] transition-transform duration-300 ease-out ${dexFiltersOpen ? '-rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        {dexFilterBarCount > 0 && (
                            <button
                                type="button"
                                onClick={() => resetDexFilters()}
                                className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center rounded-xl border border-[#e5e5ea] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#86868b] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                            >
                                Reset
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={searching}
                            className="w-full sm:w-auto shrink-0 rounded-xl bg-[#C6FF00] px-4 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95 disabled:opacity-50"
                        >
                            {searching ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                    {dexFilterBarCount > 0 && !dexFiltersOpen && (
                        <div className="flex flex-wrap items-center gap-2">
                            {sortDexContentRatings(dexContentRatings).map((id) => (
                                <button
                                    key={`cr-${id}`}
                                    type="button"
                                    onClick={() => toggleDexContentRating(id)}
                                    className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-[#e5e5ea] transition hover:bg-[#f5f5f7]"
                                    title="Toggle content rating filter"
                                >
                                    {id}
                                    <span className="text-[#86868b]">×</span>
                                </button>
                            ))}
                            {String(dexYear || '').trim() ? (
                                <button
                                    type="button"
                                    onClick={() => setDexYear('')}
                                    className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-[#e5e5ea] transition hover:bg-[#f5f5f7]"
                                >
                                    Year: {String(dexYear).trim()} <span className="text-[#86868b]">×</span>
                                </button>
                            ) : null}
                            {!mangaEnglishReleasesOnly ? (
                                <button
                                    type="button"
                                    onClick={() => void lifeSyncUpdatePreferences({ mangaEnglishReleasesOnly: true }).then(() => setDexTranslatedLang('en'))}
                                    className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#1d1d1f] shadow-sm ring-1 ring-[#e5e5ea] transition hover:bg-[#f5f5f7]"
                                >
                                    Any translation <span className="text-[#86868b]">×</span>
                                </button>
                            ) : null}
                            {(includedTags.length || excludedTags.length || statusFilter.length || demographicFilter.length || originalLangFilter.length) ? (
                                <button
                                    type="button"
                                    onClick={() => setDexFiltersOpen(true)}
                                    className="inline-flex items-center gap-2 rounded-full bg-[#C6FF00]/25 px-3 py-1.5 text-[11px] font-semibold text-[#1d1d1f] ring-1 ring-[#C6FF00]/35 transition hover:bg-[#C6FF00]/30"
                                >
                                    More filters…
                                </button>
                            ) : null}
                        </div>
                    )}
                    <AnimatePresence initial={false}>
                        {dexFiltersOpen && (
                            <MotionDiv
                                key="manga-dex-toolbar-filters"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={mangaFilterExpandTransition}
                                className="w-full min-w-0 max-w-full overflow-hidden"
                            >
                                <div className="min-w-0 max-w-full border-t border-[#f0f0f0] pt-4">
                                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">MangaDex filters</p>
                                            <p className="text-[12px] text-[#5b5670]">Tune discovery without leaving the page.</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {dexFilterBarCount > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => resetDexFilters()}
                                                    className="inline-flex items-center justify-center rounded-xl border border-[#e5e5ea] bg-white px-3 py-2 text-[12px] font-semibold text-[#86868b] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                                >
                                                    Reset
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={() => setDexFiltersOpen(false)}
                                                className="inline-flex items-center justify-center rounded-xl bg-[#f5f5f7] px-3 py-2 text-[12px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#ebebed]"
                                            >
                                                Close
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid min-w-0 max-w-full grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2">
                                        <div className="md:col-span-2">
                                            <DexContentRatingSection
                                                selectedIds={dexContentRatings}
                                                nsfwEnabled={nsfwEnabled}
                                                onToggle={toggleDexContentRating}
                                            />
                                        </div>

                                        <div className="rounded-2xl border border-[#e8e4ef]/60 bg-white/70 p-3 sm:p-4">
                                            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Releases &amp; translation</p>
                                            <div className="flex flex-wrap gap-x-5 gap-y-2 items-center text-[11px] text-[#86868b]">
                                                <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        checked={mangaEnglishReleasesOnly}
                                                        onChange={e => {
                                                            const on = e.target.checked
                                                            void lifeSyncUpdatePreferences({ mangaEnglishReleasesOnly: on }).then(() => {
                                                                if (on) setDexTranslatedLang('en')
                                                            })
                                                        }}
                                                        className="rounded border-[#d2d2d7] text-[#1d1d1f] focus:ring-[#C6FF00]"
                                                    />
                                                    English releases only
                                                </label>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-3 items-end">
                                                <label
                                                    className={`text-[10px] font-semibold text-[#86868b] flex flex-col gap-1 min-w-[160px] ${mangaEnglishReleasesOnly ? 'opacity-70' : ''}`}
                                                    title={mangaEnglishReleasesOnly ? 'Turn off in filters or under Profile → Integrations → Viewing preferences to pick another translation language.' : undefined}
                                                >
                                                    Translation language
                                                    <select
                                                        value={dexTranslatedLang}
                                                        onChange={e => setDexTranslatedLang(e.target.value)}
                                                        disabled={mangaEnglishReleasesOnly}
                                                        className="rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2 text-[12px] text-[#1d1d1f] focus:border-[#C6FF00]/60 focus:bg-white focus:outline-none disabled:cursor-not-allowed"
                                                    >
                                                        {DEX_TRANSLATION_LANG_OPTIONS.map(o => (
                                                            <option key={o.value} value={o.value}>{o.label}</option>
                                                        ))}
                                                    </select>
                                                </label>
                                                <label className="text-[10px] font-semibold text-[#86868b] flex flex-col gap-1 w-28">
                                                    Year
                                                    <input
                                                        type="text"
                                                        inputMode="numeric"
                                                        value={dexYear}
                                                        onChange={e => setDexYear(e.target.value.replace(/[^\d]/g, ''))}
                                                        placeholder="Any"
                                                        className="rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2 text-[12px] text-[#1d1d1f] placeholder:text-[#86868b] focus:border-[#C6FF00]/60 focus:bg-white focus:outline-none"
                                                    />
                                                </label>
                                            </div>
                                        </div>

                                        <div className="rounded-2xl border border-[#e8e4ef]/60 bg-white/70 p-3 sm:p-4">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Original language</p>
                                            <div className="mt-2 flex flex-wrap gap-1">
                                                {ORIGINAL_LANG_OPTIONS.map(o => (
                                                    <button
                                                        key={o.value}
                                                        type="button"
                                                        onClick={() => toggleOriginalLang(o.value)}
                                                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                                                            originalLangFilter.includes(o.value)
                                                                ? 'bg-[#C6FF00]/25 text-[#1d1d1f] ring-1 ring-[#C6FF00]/50'
                                                                : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed]'
                                                        }`}
                                                    >
                                                        {o.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="md:col-span-2">
                                            <div className="rounded-2xl border border-[#e8e4ef]/60 bg-white/70 p-3 sm:p-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setDexTagsPanelOpen(v => !v)}
                                                    className="flex w-full items-center justify-between gap-2 text-left"
                                                >
                                                    <span className="min-w-0">
                                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Tags &amp; genres</p>
                                                        <p className="text-[12px] text-[#5b5670]">
                                                            {includedTags.length || excludedTags.length || statusFilter.length || demographicFilter.length
                                                                ? `${includedTags.length + excludedTags.length + statusFilter.length + demographicFilter.length} active`
                                                                : 'Optional'}
                                                        </p>
                                                    </span>
                                                    <span className="inline-flex shrink-0 items-center gap-2 text-[12px] font-semibold text-[#1d1d1f]">
                                                        {dexTagsPanelOpen ? 'Hide' : 'Edit'}
                                                        <svg
                                                            className={`h-4 w-4 text-[#86868b] transition-transform ${dexTagsPanelOpen ? '-rotate-180' : ''}`}
                                                            fill="none"
                                                            stroke="currentColor"
                                                            viewBox="0 0 24 24"
                                                            strokeWidth="2"
                                                            aria-hidden
                                                        >
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                                                        </svg>
                                                    </span>
                                                </button>

                                                <AnimatePresence initial={false}>
                                                    {dexTagsPanelOpen && (
                                                        <MotionDiv
                                                            key="dex-tags-panel"
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: 'auto', opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            transition={mangaFilterExpandTransition}
                                                            className="min-w-0 max-w-full overflow-hidden"
                                                        >
                                                            <div className="mt-3">
                                                                <DexGenreFilter
                                                                    embedded
                                                                    tags={dexTags}
                                                                    includedTags={includedTags}
                                                                    excludedTags={excludedTags}
                                                                    onToggleInclude={toggleDexIncludeTag}
                                                                    onToggleExclude={toggleDexExcludeTag}
                                                                    statusFilter={statusFilter}
                                                                    onStatusChange={toggleDexStatus}
                                                                    demographicFilter={demographicFilter}
                                                                    onDemographicChange={toggleDexDemographic}
                                                                    includedTagsMode={includedTagsMode}
                                                                    excludedTagsMode={excludedTagsMode}
                                                                    onIncludedTagsMode={setIncludedTagsMode}
                                                                    onExcludedTagsMode={setExcludedTagsMode}
                                                                />
                                                            </div>
                                                        </MotionDiv>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </MotionDiv>
                        )}
                    </AnimatePresence>
                    {dexAuthStatus && !dexAuthStatus.oauthConfigured && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                            Signing in with MangaDex isn’t set up for this site yet. You can still browse and search public catalogs.
                        </p>
                    )}
                </div>
            )}

            {source === 'hentaifox' && (
                <div className="min-w-0 w-full max-w-full space-y-3">
                    <form
                        className="flex min-w-0 w-full max-w-full flex-wrap items-stretch gap-2"
                        onSubmit={e => {
                            e.preventDefault()
                        }}
                    >
                        <input
                            type="search"
                            value={hfFilter}
                            onChange={e => setHfFilter(e.target.value)}
                            placeholder="Search HentaiFox..."
                            className="min-w-[min(100%,12rem)] flex-1 px-4 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all"
                        />
                        <button
                            type="submit"
                            disabled={hfSearchBusy && Boolean(hfFilter.trim())}
                            className="shrink-0 rounded-xl bg-[#C6FF00] px-4 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95 disabled:opacity-50"
                        >
                            {hfSearchBusy && hfFilter.trim() ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                </div>
            )}

            {source === 'mangadistrict' && (
                <div className="min-w-0 w-full max-w-full space-y-3">
                    <form
                        className="flex min-w-0 w-full max-w-full flex-wrap items-stretch gap-2"
                        onSubmit={e => {
                            e.preventDefault()
                        }}
                    >
                        <input
                            type="search"
                            value={mdFilter}
                            onChange={e => setMdFilter(e.target.value)}
                            placeholder="Search Manga District..."
                            className="min-w-[min(100%,12rem)] flex-1 px-4 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all"
                        />
                        <button
                            type="button"
                            onClick={() => setMdFiltersOpen(v => !v)}
                            aria-expanded={mdFiltersOpen}
                            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2.5 text-[13px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#ebebed]"
                        >
                            Filters
                            {mdFilterBarCount > 0 && (
                                <span className="rounded-full bg-[#C6FF00]/35 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">{mdFilterBarCount}</span>
                            )}
                            <svg className={`h-3.5 w-3.5 text-[#86868b] transition-transform duration-300 ease-out ${mdFiltersOpen ? '-rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <button
                            type="submit"
                            disabled={mdSearchBusy && Boolean(mdFilter.trim())}
                            className="shrink-0 rounded-xl bg-[#C6FF00] px-4 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95 disabled:opacity-50"
                        >
                            {mdSearchBusy && mdFilter.trim() ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                    {!mdFilter.trim() && (
                        <div className="min-w-0 w-full max-w-full space-y-1.5">
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Order by</p>
                            <LifeSyncSectionNav
                                size="dense"
                                ariaLabel="Manga District order"
                                layoutId="lifesync-manga-md-order-by"
                                items={MD_ORDER_BY_OPTIONS.map(o => ({ id: o.id, label: o.label }))}
                                activeId={mdBrowse}
                                onSelect={id => {
                                    setMdBrowse(id)
                                    goToPage(1)
                                }}
                            />
                        </div>
                    )}
                    <AnimatePresence initial={false}>
                        {mdFiltersOpen && (
                            <MotionDiv
                                key="manga-md-toolbar-filters"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={mangaFilterExpandTransition}
                                className="w-full min-w-0 max-w-full overflow-hidden"
                            >
                                <div className="min-w-0 max-w-full space-y-4 border-t border-[#f0f0f0] pt-3">
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Section</p>
                                <div className="flex flex-wrap gap-1">
                                    {['latest', 'censored', 'uncensored'].map(s => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => setMdSection(s)}
                                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize transition-colors ${
                                                mdSection === s
                                                    ? 'bg-[#C6FF00]/25 text-[#1d1d1f] ring-1 ring-[#C6FF00]/50'
                                                    : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed]'
                                            }`}
                                        >
                                            {s === 'latest' ? 'All Latest' : s}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-[#86868b]">Section applies when no type is selected (latest releases feed). Censored still filters out uncensored rows from listings.</p>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Type of manga</p>
                                <div className="flex flex-wrap gap-1">
                                    {MD_TYPE_OPTIONS.map(({ slug, label }) => (
                                        <button
                                            key={slug}
                                            type="button"
                                            onClick={() => setMdTypeSlug(prev => (prev === slug ? '' : slug))}
                                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                                                mdTypeSlug === slug
                                                    ? 'bg-[#C6FF00]/25 text-[#1d1d1f] ring-1 ring-[#C6FF00]/50'
                                                    : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed]'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Order by</p>
                                <div className="flex flex-wrap gap-1">
                                    {MD_ORDER_BY_OPTIONS.map(({ id, label }) => (
                                        <button
                                            key={id}
                                            type="button"
                                            onClick={() => {
                                                setMdBrowse(id)
                                                goToPage(1)
                                            }}
                                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                                                mdBrowse === id
                                                    ? 'bg-[#C6FF00]/25 text-[#1d1d1f] ring-1 ring-[#C6FF00]/50'
                                                    : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed]'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Filters</p>
                                <div className="max-h-48 overflow-y-auto flex flex-wrap gap-1 pr-1">
                                    {MD_FILTER_OPTIONS.map(({ slug, label }) => (
                                        <button
                                            key={slug}
                                            type="button"
                                            onClick={() => setMdFilterGenre(prev => (prev === slug ? '' : slug))}
                                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                                                mdFilterGenre === slug
                                                    ? 'bg-[#C6FF00]/25 text-[#1d1d1f] ring-1 ring-[#C6FF00]/50'
                                                    : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed]'
                                            }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[11px] text-[#86868b]">{"With a type selected, the tag narrows via the site's genre filter. With no type, the tag becomes the main browse path."}</p>
                            </div>
                                </div>
                            </MotionDiv>
                        )}
                    </AnimatePresence>
                </div>
            )}

            {/* Content tabs (MangaDex only; HentaiFox & Manga District use search + filters without tabs) */}
            {tabs.length > 0 && (
                <LifeSyncSectionNav
                    ariaLabel="MangaDex lists"
                    layoutId="lifesync-manga-dex-tab"
                    items={tabs.map(t => ({ id: t.id, label: t.label }))}
                    activeId={tab}
                    onSelect={(id) => goToTab(id)}
                />
            )}

            {source === 'mangadex' && tab === 'library' && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">Library</p>
                    <LifeSyncSectionNav
                        size="dense"
                        ariaLabel="Library status"
                        layoutId="lifesync-manga-library-status"
                        items={MANGADEX_LIBRARY_STATUS_TABS.map(st => ({ id: st.value, label: st.label }))}
                        activeId={libraryListStatus}
                        onSelect={(id) => setLibraryListStatus(id)}
                    />
                    {!dexAuthStatus?.connected && (
                        <p className="text-[11px] text-[#86868b]">
                            Link MangaDex under Profile → Integrations to see titles from your MangaDex reading lists.
                        </p>
                    )}
                </div>
            )}

            {source === 'mangadex' && (tab === 'popular' || tab === 'recent') && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">Browse</p>
                    <LifeSyncSectionNav
                        size="dense"
                        ariaLabel="Browse sort"
                        layoutId="lifesync-manga-browse-sort"
                        items={BROWSE_SORT_TABS.map(st => ({ id: st.id, label: st.label }))}
                        activeId={dexBrowseSort}
                        onSelect={(id) => setDexBrowseSort(id)}
                    />
                    {dexBrowseSort === 'random' && (
                        <p className="text-[11px] text-[#86868b]">Random uses a fresh slice each load — use Refresh or pick another sort to page through the full catalog.</p>
                    )}
                </div>
            )}

            {source === 'mangadex' && tab === 'search' && committedSearchQuery.trim() && (
                <div className="flex flex-wrap items-end gap-3">
                    <label className="text-[10px] font-semibold text-[#86868b] flex flex-col gap-1 min-w-[160px]">
                        Search sort
                        <select
                            value={dexSearchOrderBy}
                            onChange={e => setDexSearchOrderBy(e.target.value)}
                            className="rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2 text-[12px] text-[#1d1d1f] focus:border-[#C6FF00]/60 focus:bg-white focus:outline-none"
                        >
                            {SEARCH_SORT_OPTIONS.map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                        </select>
                    </label>
                    <label className="text-[10px] font-semibold text-[#86868b] flex flex-col gap-1 min-w-[120px]">
                        Direction
                        <select
                            value={dexSearchOrderDir}
                            onChange={e => setDexSearchOrderDir(e.target.value)}
                            className="rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2 text-[12px] text-[#1d1d1f] focus:border-[#C6FF00]/60 focus:bg-white focus:outline-none"
                        >
                            <option value="desc">Descending</option>
                            <option value="asc">Ascending</option>
                        </select>
                    </label>
                </div>
            )}

            {/* Pagination for HentaiFox/MangaDistrict latest */}
            {source === 'hentaifox' && !hfFilter.trim() && hfLatest && (
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-[#86868b]">Page {hfCurPage} of {hfLastPage}</p>
                    <div className="flex gap-2">
                        <button type="button" disabled={busy || hfCurPage <= 1} onClick={() => goToPage(hfCurPage - 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <button type="button" disabled={busy || hfCurPage >= hfLastPage} onClick={() => goToPage(hfCurPage + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {source === 'mangadistrict' && !mdFilter.trim() && mdLatest && (
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-[#86868b]">Page {mdCurPage} of {mdLastPage}</p>
                    <div className="flex gap-2">
                        <button type="button" disabled={busy || mdCurPage <= 1} onClick={() => goToPage(mdCurPage - 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <button type="button" disabled={busy || mdCurPage >= mdLastPage} onClick={() => goToPage(mdCurPage + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {source === 'mangadex' && tab === 'popular' && dexBrowseSort !== 'random' && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[11px] text-[#86868b]">
                        Page {dexPopularPage} of {dexPopularLast}
                        {popularTotal > 0 && <span className="ml-1">({popularTotal.toLocaleString()} titles)</span>}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" disabled={dexPopularPage <= 1} onClick={() => goToPage(dexPopularPage - 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <div className="flex items-center gap-1.5">
                            {(() => {
                                const cur = dexPopularPage
                                const last = dexPopularLast
                                const pages = []
                                const start = Math.max(1, cur - 2)
                                const end = Math.min(last, cur + 2)
                                if (start > 1) pages.push(1, '…')
                                for (let p = start; p <= end; p += 1) pages.push(p)
                                if (end < last) pages.push('…', last)
                                return pages.map((p, idx) =>
                                    typeof p === 'number' ? (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => goToPage(p)}
                                            className={`min-w-8 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                                                p === cur
                                                    ? 'border-[#C6FF00] bg-[#C6FF00] text-[#1a1628] shadow-sm'
                                                    : 'bg-white text-[#1d1d1f] border-[#e5e5ea] hover:bg-[#fafafa]'
                                            }`}
                                            aria-current={p === cur ? 'page' : undefined}
                                        >
                                            {p}
                                        </button>
                                    ) : (
                                        <span key={`dots-pop-${idx}`} className="px-1 text-[11px] text-[#86868b]">
                                            …
                                        </span>
                                    )
                                )
                            })()}
                        </div>
                        <button type="button" disabled={dexPopularPage >= dexPopularLast} onClick={() => goToPage(dexPopularPage + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {source === 'mangadex' && tab === 'popular' && dexBrowseSort === 'random' && popularTotal > 0 && (
                <p className="text-[11px] text-[#86868b]">{popularTotal.toLocaleString()} titles match your filters (showing {DEX_PAGE_SIZE} at random).</p>
            )}

            {source === 'mangadex' && tab === 'recent' && dexBrowseSort !== 'random' && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[11px] text-[#86868b]">
                        Page {dexRecentPage} of {dexRecentLast}
                        {recentTotal > 0 && <span className="ml-1">({recentTotal.toLocaleString()} titles)</span>}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" disabled={dexRecentPage <= 1} onClick={() => goToPage(dexRecentPage - 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <div className="flex items-center gap-1.5">
                            {(() => {
                                const cur = dexRecentPage
                                const last = dexRecentLast
                                const pages = []
                                const start = Math.max(1, cur - 2)
                                const end = Math.min(last, cur + 2)
                                if (start > 1) pages.push(1, '…')
                                for (let p = start; p <= end; p += 1) pages.push(p)
                                if (end < last) pages.push('…', last)
                                return pages.map((p, idx) =>
                                    typeof p === 'number' ? (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => goToPage(p)}
                                            className={`min-w-8 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                                                p === cur
                                                    ? 'border-[#C6FF00] bg-[#C6FF00] text-[#1a1628] shadow-sm'
                                                    : 'bg-white text-[#1d1d1f] border-[#e5e5ea] hover:bg-[#fafafa]'
                                            }`}
                                            aria-current={p === cur ? 'page' : undefined}
                                        >
                                            {p}
                                        </button>
                                    ) : (
                                        <span key={`dots-rec-${idx}`} className="px-1 text-[11px] text-[#86868b]">
                                            …
                                        </span>
                                    )
                                )
                            })()}
                        </div>
                        <button type="button" disabled={dexRecentPage >= dexRecentLast} onClick={() => goToPage(dexRecentPage + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {source === 'mangadex' && tab === 'recent' && dexBrowseSort === 'random' && recentTotal > 0 && (
                <p className="text-[11px] text-[#86868b]">{recentTotal.toLocaleString()} titles match your filters (showing {DEX_PAGE_SIZE} at random).</p>
            )}

            {source === 'mangadex' && tab === 'search' && committedSearchQuery.trim() && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[11px] text-[#86868b]">
                        Page {dexSearchPage} of {dexSearchLast}
                        {searchTotal > 0 && <span className="ml-1">({searchTotal.toLocaleString()} titles)</span>}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                        <button type="button" disabled={searching || dexSearchPage <= 1} onClick={() => goToPage(dexSearchPage - 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <div className="flex items-center gap-1.5">
                            {(() => {
                                const cur = dexSearchPage
                                const last = dexSearchLast
                                const pages = []
                                const start = Math.max(1, cur - 2)
                                const end = Math.min(last, cur + 2)
                                if (start > 1) pages.push(1, '…')
                                for (let p = start; p <= end; p += 1) pages.push(p)
                                if (end < last) pages.push('…', last)
                                return pages.map((p, idx) =>
                                    typeof p === 'number' ? (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => goToPage(p)}
                                            className={`min-w-8 px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors ${
                                                p === cur
                                                    ? 'border-[#C6FF00] bg-[#C6FF00] text-[#1a1628] shadow-sm'
                                                    : 'bg-white text-[#1d1d1f] border-[#e5e5ea] hover:bg-[#fafafa]'
                                            }`}
                                            aria-current={p === cur ? 'page' : undefined}
                                        >
                                            {p}
                                        </button>
                                    ) : (
                                        <span key={`dots-s-${idx}`} className="px-1 text-[11px] text-[#86868b]">
                                            …
                                        </span>
                                    )
                                )
                            })()}
                        </div>
                        <button type="button" disabled={searching || dexSearchPage >= dexSearchLast} onClick={() => goToPage(dexSearchPage + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {/* Content grid — only this block animates on source/tab change */}
            <AnimatePresence mode="wait">
                <MotionDiv
                    key={source === 'mangadex' ? `${source}-${tab}` : source}
                    className="min-w-0 max-w-full space-y-4"
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    variants={lifeSyncSectionPresenceVariants}
                    transition={lifeSyncSectionPresenceTransition}
                >
            {mangaGridLoading ? (
                <LifesyncMangaBrowseGridSkeleton />
            ) : currentItems.length > 0 ? (
                useMangaBrowseCardStagger ? (
                    <MotionDiv
                        className="grid grid-cols-2 gap-4 items-stretch sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
                        variants={lifeSyncStaggerContainerDense}
                        initial="hidden"
                        animate="show"
                    >
                        {currentItems.map((manga, i) => (
                            <MotionDiv
                                key={`${manga.source || source}-${manga.id || i}`}
                                className="min-h-0"
                                variants={lifeSyncStaggerItemFade}
                            >
                                <MangaCard manga={{ ...manga, source: manga.source || source }} onClick={openMangaFromCard} />
                            </MotionDiv>
                        ))}
                    </MotionDiv>
                ) : (
                    <MotionDiv
                        className="grid grid-cols-2 gap-4 items-stretch sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={lifeSyncPageTransition}
                    >
                        {currentItems.map((manga, i) => (
                            <div key={`${manga.source || source}-${manga.id || i}`} className="min-h-0">
                                <MangaCard manga={{ ...manga, source: manga.source || source }} onClick={openMangaFromCard} />
                            </div>
                        ))}
                    </MotionDiv>
                )
            ) : !busy &&
              !(source === 'mangadex' && tab === 'following' && dexFollowsBusy) &&
              !(source === 'mangadex' && tab === 'library' && dexLibraryBusy) ? (
                <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm px-6 py-10 text-center">
                    <p className="text-[13px] text-[#86868b]">
                        {source === 'mangadistrict' && mdFilter.trim() && mdSearchBusy ? 'Searching...'
                            : source === 'mangadistrict' && mdFilter.trim() && !mdSearchBusy && mdSearchResults.length === 0
                              ? 'No titles matched your search.'
                            : source === 'hentaifox' && hfFilter.trim() && hfSearchBusy ? 'Searching...'
                            : source === 'hentaifox' && hfFilter.trim() && !hfSearchBusy && hfSearchResults.length === 0
                              ? 'No titles matched your search.'
                            : source === 'mangadex' && tab === 'search' && committedSearchQuery.trim() && searching ? 'Searching…'
                            : source === 'mangadex' && tab === 'search' && committedSearchQuery.trim() && !searching ? 'No titles matched your search.'
                            : source === 'mangadex' && tab === 'library' && dexAuthStatus?.connected
                              ? 'Nothing in this list on MangaDex yet. Set a status from a title detail panel or read a chapter to sync.'
                              : source === 'mangadex' && tab === 'library'
                                ? 'Link MangaDex under Profile → Integrations to browse your MangaDex reading lists.'
                                : source === 'mangadex' && tab === 'following' && dexAuthStatus?.connected
                              ? 'No titles in your MangaDex follows, or they are past the first page. Use Refresh or follow series from a detail panel.'
                              : source === 'mangadex' && tab === 'following'
                                ? 'Link MangaDex under Profile → Integrations to see titles you follow on MangaDex.'
                                : 'No manga to display.'}
                    </p>
                </div>
            ) : null}

            {source === 'mangadex' && tab === 'following' && dexFollows.length > 0 && dexFollows.length < dexFollowsTotal && (
                <div className="flex justify-center pt-2">
                    <button
                        type="button"
                        disabled={dexFollowsBusy}
                        onClick={() => void loadFollows(dexFollows.length)}
                        className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-4 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50"
                    >
                        {dexFollowsBusy ? 'Loading…' : 'Load more follows'}
                    </button>
                </div>
            )}
                </MotionDiv>
            </AnimatePresence>
            </div>
        </MotionDiv>
        </LayoutGroup>
    )
}
