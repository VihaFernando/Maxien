import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGameRantNews } from '../../hooks/useGameRantNews'
import { LifesyncEpisodeThumbnail } from './EpisodeLoadingSkeletons'

function toArticleSlug(item) {
    const raw = String(item?.slug || '').trim()
    if (raw) return raw

    try {
        const path = new URL(String(item?.sourceLink || '')).pathname
        return path.replace(/^\/+|\/+$/g, '')
    } catch {
        return ''
    }
}

function toArticlePath(item) {
    const slug = toArticleSlug(item)
    if (!slug) return '/dashboard/lifesync/games/gamerant'
    return `/dashboard/lifesync/games/gamerant/news/${encodeURIComponent(slug)}`
}

function toAuthorInitials(name) {
    const safe = String(name || 'GameRant').trim()
    const parts = safe.split(/\s+/).filter(Boolean)
    if (!parts.length) return 'GR'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function AuthorAvatar({ name, image }) {
    const [avatarErr, setAvatarErr] = useState(false)
    const initials = toAuthorInitials(name)

    if (image && !avatarErr) {
        return (
            <img
                src={image}
                alt={name || 'Author'}
                loading="lazy"
                decoding="async"
                className="h-6 w-6 rounded-full object-cover ring-1 ring-apple-border/70"
                onError={() => setAvatarErr(true)}
            />
        )
    }

    return (
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--mx-color-0071e3)] text-[10px] font-bold text-white ring-1 ring-[var(--mx-color-0071e3)]/30">
            {initials}
        </span>
    )
}

function NewsCard({ item }) {
    const [imgErr, setImgErr] = useState(false)
    const timeText = String(item.time || '')
    const authorName = item.author || 'GameRant'

    return (
        <Link
            to={toArticlePath(item)}
            className="lifesync-games-glass group bg-[var(--color-surface)] rounded-[18px] border border-apple-border/50 shadow-sm overflow-hidden hover:shadow-md transition-all block"
        >
            <div className="relative aspect-video w-full overflow-hidden bg-apple-bg">
                {item.thumbnail && !imgErr ? (
                    <LifesyncEpisodeThumbnail
                        src={item.thumbnail}
                        className="absolute inset-0 h-full w-full"
                        imgClassName="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                        imgProps={{ onError: () => setImgErr(true) }}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-apple-subtext bg-linear-to-br from-apple-bg to-[var(--mx-color-e8e8ed)]">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v9a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 16.5z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 10.5h.008v.008H8.25V10.5zm7.5 0h.008v.008h-.008V10.5z" />
                        </svg>
                    </div>
                )}
            </div>
            <div className="p-3">
                <p className="text-[13px] font-semibold text-apple-text line-clamp-2">{item.title}</p>
                <div className="mt-2 flex items-center gap-2 text-[11px] text-apple-subtext">
                    <div className="flex min-w-0 items-center gap-2">
                        <AuthorAvatar name={authorName} image={item.authorImage} />
                        <span className="truncate">{authorName}</span>
                    </div>
                    <span>•</span>
                    <span className="truncate">{timeText}</span>
                </div>
            </div>
        </Link>
    )
}

function FeaturedCard({ item }) {
    const [imgErr, setImgErr] = useState(false)
    const authorName = item.author || 'GameRant'

    return (
        <Link
            to={toArticlePath(item)}
            className="lifesync-games-glass group relative overflow-hidden rounded-[22px] border border-apple-border/60 bg-[var(--color-surface)] shadow-sm block"
        >
            <div className="relative aspect-video w-full overflow-hidden bg-apple-bg">
                {item.thumbnail && !imgErr ? (
                    <LifesyncEpisodeThumbnail
                        src={item.thumbnail}
                        className="absolute inset-0 h-full w-full"
                        imgClassName="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        imgProps={{ onError: () => setImgErr(true) }}
                    />
                ) : (
                    <div className="h-full w-full bg-linear-to-br from-apple-bg to-[var(--mx-color-e8e8ed)]" />
                )}
                <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/70 via-black/20 to-black/0" />
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-white/80">Featured</p>
                    <h3 className="mt-1 text-[18px] font-bold leading-tight text-white line-clamp-2">{item.title}</h3>
                    <div className="mt-2 flex items-center gap-2 text-[12px] text-white/90">
                        <AuthorAvatar name={authorName} image={item.authorImage} />
                        <span className="truncate">{authorName}</span>
                        <span>•</span>
                        <span className="truncate">{item.time || 'Recently published'}</span>
                    </div>
                </div>
            </div>
        </Link>
    )
}

export function GameRantGamingNews({ count = 20, page = 1, onPageChange }) {
    const { data, loading, error } = useGameRantNews({ count, page })

    const featured = useMemo(() => {
        const rows = Array.isArray(data?.featured) ? data.featured : []
        return rows.slice(0, 2)
    }, [data?.featured])

    const list = useMemo(() => {
        const rows = Array.isArray(data?.data) ? data.data : []
        return rows
    }, [data?.data])

    if (error) {
        return (
            <div className="rounded-[18px] border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-800">Failed to load GameRant news: {error.message}</p>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="space-y-6">
                {page === 1 ? (
                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                        {Array.from({ length: 2 }).map((_, i) => (
                            <div key={i} className="lifesync-games-glass animate-pulse rounded-[22px] border border-apple-border/50 bg-[var(--color-surface)] overflow-hidden">
                                <div className="aspect-video bg-apple-bg" />
                            </div>
                        ))}
                    </div>
                ) : null}

                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="lifesync-games-glass bg-[var(--color-surface)] rounded-[18px] border border-apple-border/50 overflow-hidden animate-pulse">
                            <div className="aspect-video bg-apple-bg" />
                            <div className="p-3 space-y-2">
                                <div className="h-4 bg-apple-bg rounded w-full" />
                                <div className="h-3 bg-apple-bg rounded w-2/3" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )
    }

    if (!list.length) {
        return (
            <div className="lifesync-games-glass rounded-[18px] border border-apple-border/50 bg-apple-bg p-6 text-center">
                <p className="text-sm text-apple-subtext">No GameRant news available</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {page === 1 && featured.length ? (
                <section>
                    <div className="mb-3 flex items-center justify-between">
                        <h2 className="text-[18px] font-bold text-apple-text">Featured News</h2>
                        <span className="text-[12px] text-apple-subtext">Top stories</span>
                    </div>
                    <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
                        {featured.map((item, idx) => (
                            <FeaturedCard key={item.sourceLink || idx} item={item} />
                        ))}
                    </div>
                </section>
            ) : null}

            <section>
                <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-[18px] font-bold text-apple-text">Latest Articles</h2>
                    <span className="text-[12px] text-apple-subtext">Page {page} of 3</span>
                </div>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {list.map((item, idx) => (
                        <NewsCard key={item.sourceLink || idx} item={item} />
                    ))}
                </div>
            </section>

            <div className="flex items-center justify-center gap-2 pt-1">
                {[1, 2, 3].map((pageNo) => (
                    <button
                        key={pageNo}
                        type="button"
                        onClick={() => onPageChange?.(pageNo)}
                        className={`min-w-10 rounded-lg border px-3 py-2 text-[13px] font-semibold transition ${
                            pageNo === page
                                ? 'border-[var(--mx-color-0071e3)] bg-[var(--mx-color-0071e3)] text-white'
                                : 'border-apple-border bg-[var(--color-surface)] text-apple-text hover:border-[var(--mx-color-0071e3)]'
                        }`}
                    >
                        {pageNo}
                    </button>
                ))}
            </div>
        </div>
    )
}
