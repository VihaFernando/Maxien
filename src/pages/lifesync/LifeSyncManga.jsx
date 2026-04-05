import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { MangaReadingShelf } from '../../components/lifesync/MangaReadingRail'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch } from '../../lib/lifesyncApi'
import {
    buildDexChapterLangSelectOptions,
    compareChapters,
    DEX_TRANSLATION_LANG_OPTIONS,
    formatChapterLabel,
    mangadexImageProps,
} from '../../lib/mangaChapterUtils'

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

/** Manga District browse / sort (maps to `m_orderby` on the server). */
const MD_BROWSE_OPTIONS = [
    { id: 'latest-updates', label: 'Latest updates' },
    { id: 'hot', label: 'Hot' },
    { id: 'new-releases', label: 'New releases' },
    { id: 'all-time-views', label: 'All time views' },
    { id: 'name', label: 'Name' },
    { id: 'random', label: 'Random' },
    { id: 'ongoing', label: 'Ongoing' },
    { id: 'completed', label: 'Completed' },
]

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

/** Query string for server `parseMangaDexListQuery` (client MangaPage.jsx parity). */
function buildDexListQuery(opts) {
    const {
        limit,
        offset = 0,
        includeMature,
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
    if (includeMature && nsfwEnabled) {
        for (const cr of ['safe', 'suggestive', 'erotica', 'pornographic']) {
            q.append('contentRating[]', cr)
        }
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
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${cls}`}
            title="Tap include · right-click exclude"
        >
            {excluded ? '−' : selected ? '✓' : ''} {tag.name}
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

    return (
        <div className="rounded-[18px] border border-[#d2d2d7]/50 bg-white shadow-sm overflow-hidden">
            <button
                type="button"
                onClick={() => setExpanded(p => !p)}
                className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-semibold text-[#1d1d1f] hover:bg-[#fafafa] transition-colors"
            >
                <span className="inline-flex items-center gap-2">
                    Filters &amp; genres
                    {activeCount > 0 && (
                        <span className="rounded-full bg-[#C6FF00]/30 px-2 py-0.5 text-[10px] font-bold text-[#1d1d1f]">{activeCount}</span>
                    )}
                </span>
                <span className="text-[#86868b] text-[11px]">{expanded ? 'Hide' : 'Show'}</span>
            </button>
            {expanded && (
                <div className="space-y-4 border-t border-[#f0f0f0] px-4 py-4">
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
                            <div className="flex flex-wrap gap-1">
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
            )}
        </div>
    )
}

function MangaCard({ manga, onClick }) {
    const rating = manga.ratings?.average ?? manga.ratingAverage
    const ratingNum = rating != null ? Number(rating) : null
    const showRating = ratingNum != null && Number.isFinite(ratingNum) && ratingNum > 0
    return (
        <button type="button" onClick={() => onClick?.(manga)} className="group flex h-full min-h-0 w-full text-left">
            <div className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[18px] border border-[#d2d2d7]/50 bg-white shadow-sm transition-all hover:shadow-md">
                <div className="relative aspect-[2/3] w-full shrink-0 overflow-hidden bg-[#f5f5f7]">
                    {manga.coverUrl ? (
                        <img src={manga.coverUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" {...mangadexImageProps(manga.coverUrl)} />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                        </div>
                    )}
                    {manga.status && (
                        <span className="absolute left-2 top-2 bg-white/90 text-[#1d1d1f] text-[10px] font-medium px-2 py-0.5 rounded-lg capitalize">{manga.status}</span>
                    )}
                    {manga.contentRating && manga.contentRating !== 'safe' && (
                        <span className="absolute right-2 top-2 bg-amber-100 text-amber-700 text-[10px] font-medium px-1.5 py-0.5 rounded-lg uppercase">{manga.contentRating}</span>
                    )}
                    {manga.source && manga.source !== 'mangadex' && (
                        <span className="absolute left-2 bottom-2 bg-black/60 text-white text-[9px] font-medium px-1.5 py-0.5 rounded uppercase backdrop-blur-sm">
                            {manga.source === 'mangadistrict' ? 'District' : manga.source === 'hentaifox' ? 'HF' : manga.source}
                        </span>
                    )}
                </div>
                <div className="flex min-h-0 flex-1 flex-col p-3">
                    <p className="line-clamp-2 min-h-[2.5rem] text-[13px] font-semibold leading-snug text-[#1d1d1f]">{manga.title}</p>
                    <div className="mt-0.5 min-h-[1.125rem]">
                        {manga.author ? <p className="line-clamp-1 text-[11px] leading-tight text-[#86868b]">{manga.author}</p> : null}
                    </div>
                    <div className="mt-auto flex flex-wrap gap-1 pt-1.5">
                        {manga.year && <span className="bg-[#f5f5f7] text-[#86868b] text-[10px] px-1.5 py-0.5 rounded">{manga.year}</span>}
                        {showRating && (
                            <span className="bg-amber-50 text-amber-700 text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                <svg className="w-2.5 h-2.5 fill-amber-500 text-amber-500" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                {ratingNum.toFixed(1)}
                            </span>
                        )}
                        {manga.tags?.slice(0, 2).map((tag, i) => {
                            const label = mangaTagLabel(tag)
                            if (!label) return null
                            return (
                                <span key={mangaTagKey(tag, i, `${manga.id}-`)} className="bg-[#C6FF00]/10 text-[#1d1d1f] text-[10px] px-1.5 py-0.5 rounded">{label}</span>
                            )
                        })}
                    </div>
                </div>
            </div>
        </button>
    )
}

function MangaReader({ manga, chapter, sortedChapters, chapterIndex, onClose, onChangeChapter, onReportProgress }) {
    const [pack, setPack] = useState(null)
    const [loadErr, setLoadErr] = useState('')
    const [loading, setLoading] = useState(true)
    const [chapterReadProgress, setChapterReadProgress] = useState(0)
    const scrollRef = useRef(null)
    const pagesInnerRef = useRef(null)
    const scrollRafRef = useRef(null)

    useEffect(() => {
        if (!onReportProgress || !manga?.id || !chapter?.id) return undefined
        onReportProgress(manga, chapter)
        return undefined
    }, [manga, chapter, onReportProgress])

    useEffect(() => {
        let cancelled = false
        ;(async () => {
            setLoading(true)
            setLoadErr('')
            setPack(null)
            const path =
                manga.source === 'hentaifox'
                    ? `/api/manga/hentaifox/chapter/${encodeURIComponent(chapter.id)}`
                    : manga.source === 'mangadistrict'
                        ? `/api/manga/mangadistrict/chapter/${encodeURIComponent(manga.id)}/${encodeURIComponent(chapter.id)}`
                        : `/api/manga/pages/${chapter.id}`
            try {
                const data = await lifesyncFetch(path)
                if (!cancelled) setPack(data)
            } catch (e) {
                if (!cancelled) setLoadErr(e.message || 'Could not load chapter pages')
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => {
            cancelled = true
        }
    }, [chapter.id, manga.id, manga.source])

    useLayoutEffect(() => {
        const el = scrollRef.current
        if (el) el.scrollTop = 0
        setChapterReadProgress(0)
    }, [chapter.id])

    const updateScrollProgress = useCallback(() => {
        const el = scrollRef.current
        if (!el) return
        const { scrollTop, scrollHeight, clientHeight } = el
        const max = scrollHeight - clientHeight
        const p = max <= 0 ? 1 : Math.min(1, Math.max(0, scrollTop / max))
        setChapterReadProgress(p)
    }, [])

    const onReaderScroll = useCallback(() => {
        if (scrollRafRef.current != null) return
        scrollRafRef.current = requestAnimationFrame(() => {
            scrollRafRef.current = null
            updateScrollProgress()
        })
    }, [updateScrollProgress])

    useEffect(
        () => () => {
            if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current)
        },
        []
    )

    const urls = useMemo(() => (pack?.pages?.length ? pack.pages : []), [pack])

    useEffect(() => {
        if (loading) return
        const t = requestAnimationFrame(() => updateScrollProgress())
        return () => cancelAnimationFrame(t)
    }, [loading, urls.length, chapter.id, updateScrollProgress])

    useEffect(() => {
        const inner = pagesInnerRef.current
        if (!inner || loading) return
        const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => updateScrollProgress()) : null
        ro?.observe(inner)
        return () => ro?.disconnect()
    }, [loading, urls.length, chapter.id, updateScrollProgress])

    const idx =
        typeof chapterIndex === 'number' && chapterIndex >= 0
            ? chapterIndex
            : sortedChapters.findIndex(c => c.id === chapter.id)
    const safeIdx = idx >= 0 ? idx : -1

    const prevCh = safeIdx > 0 ? sortedChapters[safeIdx - 1] : null
    const nextCh =
        safeIdx >= 0 && safeIdx < sortedChapters.length - 1 ? sortedChapters[safeIdx + 1] : null

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex flex-col bg-[#0a0a0a]">
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-black/70 px-3 py-2 backdrop-blur-xl">
                <div className="min-w-0 flex-1">
                    <button type="button" onClick={onClose} className="text-left text-[12px] font-semibold text-[#C6FF00] hover:underline">
                        ← Back to list
                    </button>
                    <p className="truncate text-[11px] text-[#86868b]">{manga.title}</p>
                    <p className="truncate text-[10px] text-[#a1a1a6]">{formatChapterLabel(chapter)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <button
                        type="button"
                        disabled={!prevCh}
                        onClick={() => prevCh && onChangeChapter(prevCh)}
                        className="inline-flex items-center gap-0.5 rounded-lg border border-[#3a3a3c] bg-[#1c1c1e] px-2 py-1.5 text-[11px] text-[#f5f5f7] hover:bg-[#2c2c2e] disabled:opacity-40"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                        Prev
                    </button>
                    <button
                        type="button"
                        disabled={!nextCh}
                        onClick={() => nextCh && onChangeChapter(nextCh)}
                        className="inline-flex items-center gap-0.5 rounded-lg border border-[#3a3a3c] bg-[#1c1c1e] px-2 py-1.5 text-[11px] text-[#f5f5f7] hover:bg-[#2c2c2e] disabled:opacity-40"
                    >
                        Next
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                    </button>
                </div>
            </header>

            <div
                ref={scrollRef}
                onScroll={onReaderScroll}
                className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
                {loading && <p className="p-8 text-center text-[13px] text-[#86868b]">Loading pages…</p>}
                {loadErr && !loading && <p className="p-8 text-center text-[13px] text-red-400">{loadErr}</p>}
                {!loading && !loadErr && urls.length === 0 && (
                    <p className="p-8 text-center text-[13px] text-[#86868b]">No page images returned for this chapter.</p>
                )}
                <div ref={pagesInnerRef} className="mx-auto max-w-3xl pb-8 pt-2">
                    {urls.map((src, i) => (
                        <img
                            key={`${chapter.id}-${i}`}
                            src={src}
                            alt={`Page ${i + 1}`}
                            className="w-full bg-black"
                            loading={i < 3 ? 'eager' : 'lazy'}
                            decoding="async"
                            onLoad={() => {
                                requestAnimationFrame(() => updateScrollProgress())
                            }}
                            {...mangadexImageProps(src)}
                        />
                    ))}
                </div>
            </div>

            <footer className="shrink-0 border-t border-white/10 bg-black/85 px-3 py-2 backdrop-blur-xl">
                <div className="mx-auto max-w-3xl">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                            className="h-full rounded-full bg-[#C6FF00] transition-[width] duration-100 ease-out"
                            style={{ width: `${Math.round(chapterReadProgress * 1000) / 10}%` }}
                            role="progressbar"
                            aria-valuenow={Math.round(chapterReadProgress * 100)}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label="Scroll position in this chapter"
                        />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-[#86868b]">
                        <span>
                            {urls.length > 0 ? `${urls.length} page${urls.length === 1 ? '' : 's'}` : loading ? '…' : '—'}
                        </span>
                        <span className="tabular-nums text-[#a1a1a6]">
                            {Math.round(chapterReadProgress * 100)}% through chapter
                        </span>
                    </div>
                </div>
            </footer>
        </div>,
        document.body
    )
}

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
        <div className="fixed inset-0 z-[9998] flex items-end sm:items-center justify-center" onClick={onClose}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />

            {/* Panel */}
            <div
                className="relative w-full max-w-3xl max-h-[92vh] sm:max-h-[88vh] flex flex-col bg-white sm:rounded-2xl overflow-hidden shadow-2xl animate-[slideUp_0.3s_ease-out]"
                onClick={e => e.stopPropagation()}
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
                    {!heroBackdropUrl && <div className="absolute inset-0 bg-gradient-to-b from-[#1d1d1f] to-white" />}

                    {/* Close button */}
                    <button
                        type="button"
                        onClick={onClose}
                        className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/90 hover:text-white transition-all"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>

                    {/* Cover + title row */}
                    <div className="relative flex gap-4 sm:gap-5 px-5 sm:px-6 pt-5 pb-4">
                        <div className="shrink-0 w-28 sm:w-32">
                            {coverImg ? (
                                <img src={coverImg} alt="" className="w-full aspect-[2/3] object-cover rounded-xl shadow-lg ring-1 ring-black/10" {...mangadexImageProps(coverImg)} />
                            ) : (
                                <div className="w-full aspect-[2/3] rounded-xl bg-[#f5f5f7] flex items-center justify-center">
                                    <svg className="w-10 h-10 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" /></svg>
                                </div>
                            )}
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
                    <div className="px-5 sm:px-6 py-4 space-y-4">
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
                                        className="text-[11px] font-semibold text-white bg-[#1d1d1f] hover:bg-black px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                                    >
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                                        Start reading
                                    </button>
                                )}
                            </div>
                            {chapBusy ? (
                                <div className="flex items-center gap-2 py-6 justify-center">
                                    <div className="w-4 h-4 border-2 border-[#C6FF00] border-t-transparent rounded-full animate-spin" />
                                    <p className="text-[12px] text-[#86868b]">Loading chapters…</p>
                                </div>
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
                    </div>
                </div>
            </div>
        </div>,
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
    const mdReadSyncTimer = useRef(null)
    const mdReadingStatusSent = useRef(new Set())
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
    const [reader, setReader] = useState(null)

    const [readingLoadBusy, setReadingLoadBusy] = useState(false)
    const [readingSyncBusy, setReadingSyncBusy] = useState(false)
    const [resumeBusy, setResumeBusy] = useState(false)

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
    const [dexIncludeMature, setDexIncludeMature] = useState(false)
    const [reading, setReading] = useState([])
    const [searchQ, setSearchQ] = useState('')
    const [searchResults, setSearchResults] = useState([])
    const [searching, setSearching] = useState(false)
    const [committedSearchQuery, setCommittedSearchQuery] = useState('')
    const [dexTags, setDexTags] = useState([])
    const [dexFiltersOpen, setDexFiltersOpen] = useState(false)
    const [dexTranslatedLang, setDexTranslatedLang] = useState('en')
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
                m: Boolean(dexIncludeMature && nsfwEnabled),
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
            dexIncludeMature,
            nsfwEnabled,
        ]
    )

    const [dexListSigBound, setDexListSigBound] = useState(dexFilterSig)
    if (dexFilterSig !== dexListSigBound) {
        setDexListSigBound(dexFilterSig)
        setDexPopularPage(1)
        setDexRecentPage(1)
        setDexSearchPage(1)
    }

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

    const mdFilterBarCount =
        (mdSection !== 'latest' ? 1 : 0) +
        (mdTypeSlug ? 1 : 0) +
        (mdFilterGenre ? 1 : 0) +
        (mdBrowse !== 'latest-updates' ? 1 : 0)

    const loadReading = useCallback(async () => {
        setReadingLoadBusy(true)
        try {
            const d = await lifesyncFetch('/api/manga/reading')
            setReading(Array.isArray(d) ? d : d?.entries || [])
        } catch {
            setReading([])
        } finally {
            setReadingLoadBusy(false)
        }
    }, [])

    const syncReading = useCallback(async () => {
        setReadingSyncBusy(true)
        try {
            const d = await lifesyncFetch('/api/manga/reading/sync', { method: 'POST', json: {} })
            setReading(Array.isArray(d?.entries) ? d.entries : [])
        } catch {
            /* keep list */
        } finally {
            setReadingSyncBusy(false)
        }
    }, [])

    const saveProgress = useCallback(async (manga, chapter) => {
        if (!manga?.id || !chapter?.id) return
        const src =
            manga.source === 'mangadistrict' || manga.source === 'hentaifox'
                ? manga.source
                : 'mangadex'
        try {
            await lifesyncFetch('/api/manga/reading', {
                method: 'PUT',
                json: {
                    source: src,
                    mangaId: String(manga.id),
                    title: manga.title || '',
                    coverUrl: manga.coverUrl || '',
                    lastChapterId: String(chapter.id),
                    lastChapterLabel: formatChapterLabel(chapter),
                    lastVolume: chapter.volume != null && chapter.volume !== '' ? String(chapter.volume) : '',
                    lastChapterNum: chapter.chapter != null && chapter.chapter !== '' ? String(chapter.chapter) : '',
                },
            })
        } catch {
            /* offline */
        }

        if (src !== 'mangadex' || !dexAuthStatus?.connected) return
        if (mdReadSyncTimer.current) clearTimeout(mdReadSyncTimer.current)
        mdReadSyncTimer.current = setTimeout(() => {
            mdReadSyncTimer.current = null
            void (async () => {
                try {
                    await lifesyncFetch(`/api/manga/mangadex/read-chapters/${encodeURIComponent(String(manga.id))}`, {
                        method: 'POST',
                        json: { read: [String(chapter.id)], unread: [] },
                    })
                } catch {
                    /* token / network */
                }
                const k = String(manga.id)
                if (mdReadingStatusSent.current.has(k)) return
                try {
                    await lifesyncFetch(`/api/manga/mangadex/reading-status/${encodeURIComponent(k)}`, {
                        method: 'POST',
                        json: { status: 'reading' },
                    })
                    mdReadingStatusSent.current.add(k)
                } catch {
                    /* ignore */
                }
            })()
        }, 450)
    }, [dexAuthStatus?.connected])

    useEffect(
        () => () => {
            if (mdReadSyncTimer.current) clearTimeout(mdReadSyncTimer.current)
        },
        []
    )

    const resumeFromEntry = useCallback(async entry => {
        setResumeBusy(true)
        setError('')
        try {
            if (
                !nsfwEnabled &&
                (entry.source === 'hentaifox' || entry.source === 'mangadistrict')
            ) {
                setError('Enable NSFW content in LifeSync preferences to open this title.')
                return
            }
            if (entry.source === 'mangadex') {
                const detail = await lifesyncFetch(`/api/manga/details/${encodeURIComponent(entry.mangaId)}`)
                const feed = await lifesyncFetch(`/api/manga/chapters/${encodeURIComponent(entry.mangaId)}?limit=500&lang=all&order=asc`)
                const list = [...(feed.data || [])]
                list.sort(compareChapters)
                let ch = list.find(c => c.id === entry.lastChapterId)
                if (!ch && list.length) ch = list[list.length - 1]
                if (!ch) {
                    setError('No chapters available to resume.')
                    return
                }
                const m = { ...detail, source: 'mangadex' }
                const idx = list.findIndex(c => c.id === ch.id)
                setSelectedManga(null)
                setSource('mangadex')
                setReader({ manga: m, chapter: ch, sortedChapters: list, chapterIndex: idx })
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
                const idx = list.findIndex(c => c.id === ch.id)
                setSelectedManga(null)
                setSource('mangadistrict')
                setReader({ manga: data, chapter: ch, sortedChapters: list, chapterIndex: idx })
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
                const idx = list.findIndex(c => c.id === ch.id)
                setSelectedManga(null)
                setSource('hentaifox')
                setReader({ manga: data, chapter: ch, sortedChapters: list, chapterIndex: idx >= 0 ? idx : 0 })
            }
        } catch (e) {
            setError(e.message || 'Could not resume reading')
        } finally {
            setResumeBusy(false)
        }
    }, [nsfwEnabled])

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
        if (reader?.manga && nsfwSrc(reader.manga)) setReader(null)
        if (selectedManga && nsfwSrc(selectedManga)) setSelectedManga(null)
    }, [nsfwEnabled, reader, selectedManga])

    const browseShuffle = dexBrowseSort === 'random'
    const browseOrderBy = browseShuffle ? '' : dexBrowseSort

    // MangaDex loaders (`shuffle=1` for random browse; otherwise stable order + pagination)
    const loadPopular = useCallback(async () => {
        try {
            const offset = browseShuffle ? 0 : (dexPopularPage - 1) * DEX_PAGE_SIZE
            const q = buildDexListQuery({
                limit: DEX_PAGE_SIZE,
                offset,
                includeMature: dexIncludeMature && nsfwEnabled,
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
        dexIncludeMature,
        nsfwEnabled,
    ])

    const loadRecent = useCallback(async () => {
        try {
            const offset = browseShuffle ? 0 : (dexRecentPage - 1) * DEX_PAGE_SIZE
            const q = buildDexListQuery({
                limit: DEX_PAGE_SIZE,
                offset,
                includeMature: dexIncludeMature && nsfwEnabled,
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
        dexIncludeMature,
        nsfwEnabled,
    ])

    const loadDex = useCallback(async () => {
        setBusy(true)
        setError('')
        try {
            await Promise.all([loadPopular(), loadRecent()])
        } catch (e) {
            setError(e.message || 'Failed')
        } finally {
            setBusy(false)
        }
    }, [loadPopular, loadRecent])

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
        if (!isLifeSyncConnected) return
        void loadReading()
    }, [isLifeSyncConnected, loadReading])

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
                    includeMature: dexIncludeMature && nsfwEnabled,
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
        dexIncludeMature,
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
        if (!hfLatest) loadHfLatest(1)
    }, [source, hfLatest, loadHfLatest])

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

    const refreshMangaDistrict = useCallback(async () => {
        const q = mdFilter.trim()
        if (q) {
            setMdSearchBusy(true)
            try {
                const d = await lifesyncFetch(`/api/manga/mangadistrict/search?q=${encodeURIComponent(q)}`)
                setMdSearchResults(d?.data || d || [])
            } catch {
                setMdSearchResults([])
            } finally {
                setMdSearchBusy(false)
            }
        } else {
            const p = Math.max(1, parseInt(String(mdLatest?.currentPage ?? mdPage), 10) || 1)
            await loadMdLatest(p)
        }
    }, [mdFilter, mdLatest?.currentPage, mdPage, loadMdLatest])

    useEffect(() => {
        setMdLatest(null)
    }, [mdSection, mdTypeSlug, mdFilterGenre, mdBrowse])

    useEffect(() => {
        if (source !== 'mangadistrict') return
        if (!mdFilter.trim() && !mdLatest) loadMdLatest(1)
    }, [source, mdFilter, mdLatest, loadMdLatest])

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
        setCommittedSearchQuery(searchQ.trim())
        setDexSearchPage(1)
        setTab('search')
    }

    async function handleSelectManga(manga) {
        const src = manga.source || source
        if (!nsfwEnabled && (src === 'hentaifox' || src === 'mangadistrict')) return
        setError('')
        try {
            if (src === 'hentaifox') {
                const data = await lifesyncFetch(`/api/manga/hentaifox/info/${encodeURIComponent(manga.id)}`)
                setSelectedManga({
                    ...data,
                    id: data.id || manga.id,
                    coverUrl: manga.coverUrl || data.coverUrl,
                    source: 'hentaifox',
                })
                return
            }
            if (src === 'mangadistrict') {
                const data = await lifesyncFetch(`/api/manga/mangadistrict/info/${encodeURIComponent(manga.id)}`)
                setSelectedManga({
                    ...data,
                    id: data.id || manga.id,
                    coverUrl: manga.coverUrl || data.coverUrl,
                    source: 'mangadistrict',
                })
                return
            }
            const data = await lifesyncFetch(`/api/manga/details/${manga.id}`)
            setSelectedManga({ ...data, source: 'mangadex' })
        } catch (e) {
            setError(e.message || 'Could not open manga')
        }
    }

    async function removeReadingEntry(entry) {
        try {
            await lifesyncFetch(`/api/manga/reading/${entry.source}/${entry.mangaId}`, { method: 'DELETE' })
            setReading(prev => prev.filter(r => !(r.source === entry.source && r.mangaId === entry.mangaId)))
        } catch (e) {
            setError(e.message || 'Failed to remove')
        }
    }

    function switchSource(s) {
        setSource(s)
        setSelectedManga(null)
        setReader(null)
        setTab(s === 'mangadex' ? 'popular' : 'latest')
        setError('')
        setDexFiltersOpen(false)
        setMdFiltersOpen(false)
        if (s !== 'mangadex') {
            setCommittedSearchQuery('')
            setSearchResults([])
            setSearchTotal(0)
        }
    }

    function handleStartRead(mergedManga, chapter, sortedChapters) {
        const chapterIndex = sortedChapters.findIndex(c => c.id === chapter.id)
        setSelectedManga(null)
        setReader({
            manga: mergedManga,
            chapter,
            sortedChapters,
            chapterIndex: chapterIndex >= 0 ? chapterIndex : 0,
        })
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

    const dexFilterBarCount = useMemo(() => {
        let n =
            includedTags.length +
            excludedTags.length +
            statusFilter.length +
            demographicFilter.length +
            originalLangFilter.length
        if (String(dexYear || '').trim()) n += 1
        if (!mangaEnglishReleasesOnly) n += 1
        if (dexIncludeMature && nsfwEnabled) n += 1
        return n
    }, [
        includedTags,
        excludedTags,
        statusFilter,
        demographicFilter,
        originalLangFilter,
        dexYear,
        mangaEnglishReleasesOnly,
        dexIncludeMature,
        nsfwEnabled,
    ])

    const visibleReadingEntries = useMemo(() => {
        if (nsfwEnabled) return reading
        return reading.filter(e => e.source === 'mangadex')
    }, [reading, nsfwEnabled])

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

    const dexTabs = useMemo(() => {
        const t = [...DEX_TABS, { id: 'library', label: 'Library' }]
        if (dexAuthStatus?.connected) t.push({ id: 'following', label: 'Following' })
        if (committedSearchQuery.trim()) t.push({ id: 'search', label: 'Search Results' })
        return t
    }, [dexAuthStatus?.connected, committedSearchQuery])

    const tabs = source === 'mangadex' ? dexTabs : []

    if (!isLifeSyncConnected) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight mb-2">Manga</h1>
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-16 text-center">
                    <p className="text-[15px] font-bold text-[#1d1d1f] mb-2">LifeSync Not Connected</p>
                    <p className="text-[13px] text-[#86868b] mb-4">Connect LifeSync in your profile to access manga.</p>
                    <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors">
                        Go to Integrations
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {reader?.manga && reader?.chapter && (
                <MangaReader
                    manga={reader.manga}
                    chapter={reader.chapter}
                    sortedChapters={reader.sortedChapters}
                    chapterIndex={reader.chapterIndex}
                    onClose={() => setReader(null)}
                    onChangeChapter={ch => {
                        const idx = reader.sortedChapters.findIndex(c => c.id === ch.id)
                        setReader(r => (r ? { ...r, chapter: ch, chapterIndex: idx >= 0 ? idx : r.chapterIndex } : r))
                    }}
                    onReportProgress={saveProgress}
                />
            )}

            {selectedManga && (
                <MangaDetail
                    manga={selectedManga}
                    source={source}
                    onClose={() => setSelectedManga(null)}
                    onStartRead={handleStartRead}
                    mangadexConnected={Boolean(dexAuthStatus?.connected)}
                    browseTranslatedLang={mangaEnglishReleasesOnly ? 'en' : dexTranslatedLang}
                />
            )}

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Anime</p>
                    <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">Manga</h1>
                </div>
                <button
                    type="button"
                    onClick={() =>
                        source === 'mangadex'
                            ? tab === 'following'
                                ? void loadFollows(0)
                                : tab === 'library'
                                  ? void loadDexLibrary(libraryListStatus)
                                  : loadDex()
                            : source === 'hentaifox'
                              ? loadHfLatest(hfCurPage)
                              : void refreshMangaDistrict()
                    }
                    disabled={
                        busy ||
                        (source === 'mangadex' && tab === 'following' && dexFollowsBusy) ||
                        (source === 'mangadex' && tab === 'library' && dexLibraryBusy)
                    }
                    className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50 self-start"
                >
                    {busy ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {error && <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>}

            <MangaReadingShelf
                entries={visibleReadingEntries}
                loading={readingLoadBusy}
                syncBusy={readingSyncBusy}
                nsfwHiddenCount={nsfwEnabled ? 0 : Math.max(0, reading.length - visibleReadingEntries.length)}
                onRefresh={() => loadReading()}
                onSync={() => syncReading()}
                onContinue={resumeFromEntry}
                onRemove={removeReadingEntry}
                continueDisabled={resumeBusy}
            />

            {/* Source selector — NSFW sources omitted entirely when NSFW is disabled in LifeSync preferences */}
            {sourceChoices.length > 1 && (
                <div className="flex flex-wrap gap-2">
                    {sourceChoices.map(s => {
                        const isNsfwNotConfigured =
                            (s.id === 'hentaifox' && hfStatus?.configured === false) ||
                            (s.id === 'mangadistrict' && mdStatus?.configured === false)
                        return (
                            <button
                                key={s.id}
                                type="button"
                                disabled={isNsfwNotConfigured}
                                onClick={() => switchSource(s.id)}
                                className={`rounded-xl px-4 py-2 text-[13px] font-semibold transition-all ${
                                    source === s.id
                                        ? 'bg-[#1d1d1f] text-white shadow-sm'
                                        : isNsfwNotConfigured
                                          ? 'cursor-not-allowed bg-[#f5f5f7] text-[#d2d2d7]'
                                          : 'bg-[#f5f5f7] text-[#86868b] hover:bg-[#ebebed] hover:text-[#1d1d1f]'
                                }`}
                                title={isNsfwNotConfigured ? 'This source is not available here yet' : ''}
                            >
                                {s.label}
                                {s.nsfw && <span className="ml-1.5 text-[10px] opacity-60">NSFW</span>}
                            </button>
                        )
                    })}
                </div>
            )}

            {/* Search & filters toolbar (shared layout across sources) */}
            {source === 'mangadex' && (
                <div className="space-y-3">
                    <form onSubmit={handleDexSearch} className="flex flex-wrap gap-2 items-stretch">
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
                            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#e5e5ea] bg-[#f5f5f7] px-3 py-2.5 text-[13px] font-semibold text-[#1d1d1f] transition-colors hover:bg-[#ebebed]"
                        >
                            Filters
                            {dexFilterBarCount > 0 && (
                                <span className="rounded-full bg-[#C6FF00]/35 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">{dexFilterBarCount}</span>
                            )}
                            <svg className={`h-3.5 w-3.5 text-[#86868b] transition-transform ${dexFiltersOpen ? '-rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <button
                            type="submit"
                            disabled={searching}
                            className="shrink-0 bg-[#1d1d1f] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-black transition-colors disabled:opacity-50"
                        >
                            {searching ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                    {dexFiltersOpen && (
                        <div className="space-y-3 border-t border-[#f0f0f0] pt-3">
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
                            {nsfwEnabled && (
                                <div className="flex flex-wrap gap-x-5 gap-y-2 items-center text-[11px] text-[#86868b]">
                                    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                                        <input type="checkbox" checked={dexIncludeMature} onChange={e => setDexIncludeMature(e.target.checked)} className="rounded border-[#d2d2d7] text-[#1d1d1f] focus:ring-[#C6FF00]" />
                                        Include mature MangaDex ratings
                                    </label>
                                </div>
                            )}
                            <div className="flex flex-wrap gap-3 items-end">
                                <label
                                    className={`text-[10px] font-semibold text-[#86868b] flex flex-col gap-1 min-w-[140px] ${mangaEnglishReleasesOnly ? 'opacity-70' : ''}`}
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
                                <label className="text-[10px] font-semibold text-[#86868b] flex flex-col gap-1 w-24">
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
                            <div className="space-y-1.5">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Original language</p>
                                <div className="flex flex-wrap gap-1">
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
                            <DexGenreFilter
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
                    )}
                    {dexAuthStatus && !dexAuthStatus.oauthConfigured && (
                        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                            Signing in with MangaDex isn’t set up for this site yet. You can still browse and search public catalogs.
                        </p>
                    )}
                </div>
            )}

            {source === 'hentaifox' && (
                <div className="space-y-3">
                    <form
                        className="flex flex-wrap gap-2 items-stretch"
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
                            className="shrink-0 bg-[#1d1d1f] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-black transition-colors disabled:opacity-50"
                        >
                            {hfSearchBusy && hfFilter.trim() ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                </div>
            )}

            {source === 'mangadistrict' && (
                <div className="space-y-3">
                    <form
                        className="flex flex-wrap gap-2 items-stretch"
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
                            <svg className={`h-3.5 w-3.5 text-[#86868b] transition-transform ${mdFiltersOpen ? '-rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                        <button
                            type="submit"
                            disabled={mdSearchBusy && Boolean(mdFilter.trim())}
                            className="shrink-0 bg-[#1d1d1f] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl hover:bg-black transition-colors disabled:opacity-50"
                        >
                            {mdSearchBusy && mdFilter.trim() ? 'Searching...' : 'Search'}
                        </button>
                    </form>
                    {mdFiltersOpen && (
                        <div className="space-y-4 border-t border-[#f0f0f0] pt-3">
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
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-[#86868b]">Browse</p>
                                <div className="flex flex-wrap gap-1">
                                    {MD_BROWSE_OPTIONS.map(({ id, label }) => (
                                        <button
                                            key={id}
                                            type="button"
                                            onClick={() => setMdBrowse(id)}
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
                                {mdBrowse === 'random' && (
                                    <p className="text-[11px] text-[#86868b]">Random shuffles the current page (Latest) or merged batch (Directory). Refresh for a new mix.</p>
                                )}
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
                    )}
                </div>
            )}

            {/* Content tabs (MangaDex only; HentaiFox & Manga District use search + filters without tabs) */}
            {tabs.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {tabs.map(t => (
                        <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all ${tab === t.id ? 'bg-[#C6FF00] text-[#1d1d1f] shadow-sm' : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'}`}>
                            {t.label}
                        </button>
                    ))}
                </div>
            )}

            {source === 'mangadex' && tab === 'library' && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">Library</p>
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {MANGADEX_LIBRARY_STATUS_TABS.map(st => (
                            <button
                                key={st.value}
                                type="button"
                                onClick={() => setLibraryListStatus(st.value)}
                                className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all shrink-0 ${
                                    libraryListStatus === st.value
                                        ? 'bg-[#1d1d1f] text-white shadow-sm'
                                        : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'
                                }`}
                            >
                                {st.label}
                            </button>
                        ))}
                    </div>
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
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                        {BROWSE_SORT_TABS.map(st => (
                            <button
                                key={st.id}
                                type="button"
                                onClick={() => setDexBrowseSort(st.id)}
                                className={`px-3.5 py-2 rounded-xl text-[12px] font-semibold whitespace-nowrap transition-all ${dexBrowseSort === st.id ? 'bg-[#1d1d1f] text-white shadow-sm' : 'bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f]'}`}
                            >
                                {st.label}
                            </button>
                        ))}
                    </div>
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
                        <button type="button" disabled={busy || hfCurPage <= 1} onClick={() => loadHfLatest(hfCurPage - 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <button type="button" disabled={busy || hfCurPage >= hfLastPage} onClick={() => loadHfLatest(hfCurPage + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {source === 'mangadistrict' && !mdFilter.trim() && mdLatest && (
                <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-[#86868b]">Page {mdCurPage} of {mdLastPage}</p>
                    <div className="flex gap-2">
                        <button type="button" disabled={busy || mdCurPage <= 1} onClick={() => loadMdLatest(mdCurPage - 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <button type="button" disabled={busy || mdCurPage >= mdLastPage} onClick={() => loadMdLatest(mdCurPage + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {source === 'mangadex' && tab === 'popular' && dexBrowseSort !== 'random' && (
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <p className="text-[11px] text-[#86868b]">
                        Page {dexPopularPage} of {dexPopularLast}
                        {popularTotal > 0 && <span className="ml-1">({popularTotal.toLocaleString()} titles)</span>}
                    </p>
                    <div className="flex gap-2">
                        <button type="button" disabled={dexPopularPage <= 1} onClick={() => setDexPopularPage(p => Math.max(1, p - 1))} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <button type="button" disabled={dexPopularPage >= dexPopularLast} onClick={() => setDexPopularPage(p => p + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
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
                    <div className="flex gap-2">
                        <button type="button" disabled={dexRecentPage <= 1} onClick={() => setDexRecentPage(p => Math.max(1, p - 1))} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <button type="button" disabled={dexRecentPage >= dexRecentLast} onClick={() => setDexRecentPage(p => p + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
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
                    <div className="flex gap-2">
                        <button type="button" disabled={searching || dexSearchPage <= 1} onClick={() => setDexSearchPage(p => Math.max(1, p - 1))} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Previous</button>
                        <button type="button" disabled={searching || dexSearchPage >= dexSearchLast} onClick={() => setDexSearchPage(p => p + 1)} className="text-[11px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-1.5 rounded-lg border border-[#e5e5ea] disabled:opacity-40">Next</button>
                    </div>
                </div>
            )}

            {/* Content grid */}
            {currentItems.length > 0 ? (
                <div className="grid grid-cols-2 gap-4 items-stretch sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {currentItems.map((manga, i) => (
                        <MangaCard key={`${manga.source || source}-${manga.id || i}`} manga={{ ...manga, source: manga.source || source }} onClick={handleSelectManga} />
                    ))}
                </div>
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
        </div>
    )
}
