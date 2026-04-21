import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { LifesyncEpisodeThumbnail } from '../../components/lifesync/EpisodeLoadingSkeletons'
import { useGameRantArticle } from '../../hooks/useGameRantArticle'

function toHost(url) {
    try {
        return new URL(String(url || '')).hostname.replace(/^www\./i, '')
    } catch {
        return ''
    }
}

function normalizeArticleLinks(value) {
    if (!Array.isArray(value)) return []
    const seen = new Set()
    const out = []

    for (const row of value) {
        const href = String(row?.href || '').trim()
        if (!href) continue

        const key = href.replace(/#.*$/g, '').replace(/\/+$/g, '').toLowerCase()
        if (!key || seen.has(key)) continue
        seen.add(key)

        out.push({
            href,
            text: String(row?.text || row?.host || toHost(href) || href).trim(),
            host: String(row?.host || toHost(href)).trim(),
        })
    }

    return out
}

function renderBlockLinks(links, keyPrefix) {
    if (!Array.isArray(links) || links.length === 0) return null
    const rows = normalizeArticleLinks(links).slice(0, 4)
    if (!rows.length) return null

    return (
        <div className="mt-3 flex flex-wrap items-center gap-2">
            {rows.map((link, idx) => (
                <a
                    key={`${keyPrefix}-${link.href}-${idx}`}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-full border border-apple-border/70 bg-white px-3 py-1 text-[11px] font-semibold text-apple-text transition hover:border-[#0071e3]"
                >
                    {link.text}
                </a>
            ))}
        </div>
    )
}

function renderBlock(block, index) {
    if (!block || typeof block !== 'object') return null

    if (block.type === 'heading') {
        if (block.level === 3) {
            return (
                <h3 key={index} className="mt-8 border-l-4 border-[#0071e3] pl-3 text-[23px] font-bold leading-tight text-apple-text">
                    {block.text}
                </h3>
            )
        }
        if (block.level === 4) {
            return (
                <h4 key={index} className="mt-7 text-[19px] font-semibold leading-tight text-apple-text">
                    {block.text}
                </h4>
            )
        }
        return (
            <h2 key={index} className="mt-9 text-[27px] font-bold leading-tight tracking-tight text-apple-text">
                {block.text}
            </h2>
        )
    }

    if (block.type === 'paragraph') {
        return (
            <div key={index}>
                <p className="text-[17px] leading-[1.9] text-[#2b2b2d]">{block.text}</p>
                {renderBlockLinks(block.links, `paragraph-${index}`)}
            </div>
        )
    }

    if (block.type === 'quote') {
        return (
            <div key={index} className="rounded-2xl border border-[#d6e7ff] bg-[#f4f9ff] px-5 py-4">
                <blockquote className="text-[16px] leading-[1.9] italic text-apple-text">{block.text}</blockquote>
                {renderBlockLinks(block.links, `quote-${index}`)}
            </div>
        )
    }

    if (block.type === 'list' && Array.isArray(block.items) && block.items.length) {
        const Tag = block.ordered ? 'ol' : 'ul'
        return (
            <div key={index} className="rounded-2xl border border-apple-border/70 bg-[#fbfbfd] px-4 py-4">
                <Tag className={`space-y-2 pl-6 text-[16px] leading-[1.8] text-[#2b2b2d] ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
                    {block.items.map((item, idx) => (
                        <li key={`${index}-${idx}`}>{item}</li>
                    ))}
                </Tag>
                {renderBlockLinks(block.links, `list-${index}`)}
            </div>
        )
    }

    if (block.type === 'image' && block.src) {
        return (
            <figure key={index} className="overflow-hidden rounded-[18px] border border-apple-border/70 bg-white shadow-sm">
                <LifesyncEpisodeThumbnail
                    src={block.src}
                    className="aspect-video w-full"
                    imgClassName="h-full w-full object-cover"
                    alt={block.alt || 'GameRant article image'}
                />
                {block.caption ? <figcaption className="px-4 py-2 text-[12px] text-apple-subtext">{block.caption}</figcaption> : null}
            </figure>
        )
    }

    return null
}

export default function LifeSyncGameRantArticle() {
    const { slug = '' } = useParams()
    const { data, loading, error } = useGameRantArticle(slug)
    const article = data?.article

    const articleLinks = useMemo(() => normalizeArticleLinks(article?.links), [article?.links])

    return (
        <LifeSyncHubPageShell>
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                        to="/dashboard/lifesync/games/gamerant"
                        className="inline-flex items-center gap-2 rounded-lg border border-apple-border bg-white px-3 py-2 text-[13px] font-semibold text-apple-text transition hover:border-[#0071e3]"
                    >
                        Back to Gaming News
                    </Link>
                    {article?.sourceLink ? (
                        <a
                            href={article.sourceLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 py-1 text-[12px] font-semibold text-[#1d4ed8] transition hover:bg-[#dbeafe]"
                        >
                            Original on GameRant
                        </a>
                    ) : null}
                </div>

                {loading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-10 w-3/4 rounded bg-[#ececf1]" />
                        <div className="h-5 w-1/2 rounded bg-[#ececf1]" />
                        <div className="aspect-video rounded-[18px] bg-[#ececf1]" />
                        <div className="space-y-3">
                            {Array.from({ length: 8 }).map((_, idx) => (
                                <div key={idx} className="h-4 w-full rounded bg-[#ececf1]" />
                            ))}
                        </div>
                    </div>
                ) : null}

                {error ? (
                    <div className="rounded-[18px] border border-red-200 bg-red-50 p-5">
                        <p className="text-[14px] text-red-800">Failed to load article: {error.message}</p>
                    </div>
                ) : null}

                {!loading && !error && article ? (
                    <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
                        <article className="space-y-6 lg:col-span-8">
                            <header className="lifesync-games-glass overflow-hidden rounded-3xl border border-apple-border/70 bg-[linear-gradient(145deg,#f8fbff_0%,#ffffff_42%,#f7fff0_100%)] p-6">
                                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-apple-subtext">GameRant Feature Story</p>
                                <h1 className="mt-2 text-[36px] font-bold leading-tight tracking-tight text-apple-text">{article.title}</h1>
                                {article.description ? (
                                    <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-[#515154]">{article.description}</p>
                                ) : null}
                                <div className="mt-4 flex flex-wrap items-center gap-2 text-[12px] text-apple-subtext">
                                    <span className="rounded-full border border-apple-border bg-white px-2.5 py-1 font-semibold text-apple-text">
                                        {article.author || 'GameRant'}
                                    </span>
                                    <span>{article.time || 'Recently published'}</span>
                                    {articleLinks.length > 0 ? (
                                        <span className="rounded-full border border-[#d6e7ff] bg-[#f4f9ff] px-2.5 py-1 font-semibold text-[#1d4ed8]">
                                            {articleLinks.length} links extracted
                                        </span>
                                    ) : null}
                                </div>
                            </header>

                            {article.thumbnail ? (
                                <div className="lifesync-games-glass overflow-hidden rounded-[20px] border border-apple-border/70 bg-white">
                                    <LifesyncEpisodeThumbnail
                                        src={article.thumbnail}
                                        className="aspect-video w-full"
                                        imgClassName="h-full w-full object-cover"
                                        alt={article.title || 'GameRant article'}
                                    />
                                </div>
                            ) : null}

                            <section className="lifesync-games-glass space-y-5 rounded-3xl border border-apple-border/60 bg-white p-5 sm:p-6">
                                {Array.isArray(article.content) && article.content.length ? (
                                    article.content.map((block, idx) => renderBlock(block, idx))
                                ) : (
                                    <p className="text-[15px] text-apple-subtext">Article content is unavailable.</p>
                                )}
                            </section>
                        </article>

                        <aside className="space-y-4 lg:sticky lg:top-20 lg:col-span-4">
                            <section className="lifesync-games-glass rounded-2xl border border-apple-border/70 bg-white p-4">
                                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-apple-subtext">Story Navigator</p>
                                <p className="mt-2 text-[13px] text-[#515154]">
                                    All links found in this article are collected here for quick browsing.
                                </p>

                                {articleLinks.length === 0 ? (
                                    <p className="mt-3 text-[12px] text-apple-subtext">No outbound links detected in this story.</p>
                                ) : (
                                    <div className="mt-3 space-y-2">
                                        {articleLinks.map((item, idx) => (
                                            <a
                                                key={`${item.href}-${idx}`}
                                                href={item.href}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="block rounded-xl border border-apple-border/70 bg-apple-bg px-3 py-2 transition hover:border-[#0071e3] hover:bg-white"
                                            >
                                                <p className="line-clamp-2 text-[12px] font-semibold text-apple-text">{item.text}</p>
                                                <p className="mt-1 text-[11px] text-apple-subtext">{item.host || item.href}</p>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </section>
                        </aside>
                    </div>
                ) : null}
            </div>
        </LifeSyncHubPageShell>
    )
}
