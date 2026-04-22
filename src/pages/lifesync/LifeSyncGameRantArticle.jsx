import { useMemo, useState } from 'react'
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

function toUrlKey(value) {
    return String(value || '')
        .trim()
        .replace(/[?#].*$/g, '')
        .replace(/\/+$/g, '')
        .toLowerCase()
}

function toEchoKey(value) {
    return String(value || '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/[.:;!?]+$/g, '')
        .toLowerCase()
}

function toEchoLooseKey(value) {
    return toEchoKey(value).replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()
}

function addEchoVariants(set, value) {
    const key = toEchoKey(value)
    const loose = toEchoLooseKey(value)
    if (key) set.add(key)
    if (loose) set.add(loose)
}

function tableEchoKeySet(block) {
    const set = new Set()
    const headers = Array.isArray(block?.headers) ? block.headers : []
    const rows = Array.isArray(block?.rows) ? block.rows : []

    for (const header of headers) addEchoVariants(set, header)
    for (const row of rows) {
        const cells = Array.isArray(row?.cells) ? row.cells : []
        for (const cell of cells) addEchoVariants(set, cell)
    }

    return set
}

function isTableEchoText(echoSet, value) {
    if (!echoSet || !echoSet.size) return false
    const key = toEchoKey(value)
    const loose = toEchoLooseKey(value)
    return Boolean((key && echoSet.has(key)) || (loose && echoSet.has(loose)))
}

function isNoisyArticleImageUrl(value) {
    const safe = toUrlKey(value)
    if (!safe) return true
    if (/\.svg($|\?)/i.test(safe)) return true
    if (/(matchup-logo|start-logo|versus-logo|logo-color-light2x|logo-color-dark2x|gr-db|db-logo|favicon|sprite)/i.test(safe)) return true
    return false
}

function normalizeContentBlocks(value) {
    const blocks = Array.isArray(value) ? value : []
    const out = []
    const referenceThumbKeys = new Set(
        blocks
            .filter((row) => row && typeof row === 'object' && row.type === 'gameReference')
            .map((row) => toUrlKey(row.thumbnail))
            .filter(Boolean)
    )
    const seenImageKeys = new Set()
    let activeTableEchoSet = null
    let tableEchoRowsSkipped = 0
    let prevParagraphKey = ''

    for (const block of blocks) {
        if (!block || typeof block !== 'object') continue

        if (block.type === 'gameReference') {
            activeTableEchoSet = null
            tableEchoRowsSkipped = 0
            prevParagraphKey = ''
            out.push(block)
            continue
        }

        if (block.type === 'table') {
            const prev = out[out.length - 1]
            const isLikelyReferenceTable =
                prev?.type === 'gameReference' &&
                Array.isArray(block?.rows) &&
                block.rows.length > 0 &&
                block.rows.length <= 8 &&
                block.rows.every((row) => Array.isArray(row?.cells) && row.cells.length <= 2)

            if (isLikelyReferenceTable) {
                activeTableEchoSet = null
                tableEchoRowsSkipped = 0
                prevParagraphKey = ''
                continue
            }

            out.push(block)
            activeTableEchoSet = tableEchoKeySet(block)
            tableEchoRowsSkipped = 0
            prevParagraphKey = ''
            continue
        }

        if (block.type === 'image') {
            const imageKey = toUrlKey(block.src)
            if (isNoisyArticleImageUrl(imageKey)) {
                continue
            }
            if (imageKey && seenImageKeys.has(imageKey)) {
                continue
            }
            if (imageKey && referenceThumbKeys.has(imageKey)) {
                continue
            }
            if (imageKey) seenImageKeys.add(imageKey)
            activeTableEchoSet = null
            tableEchoRowsSkipped = 0
            prevParagraphKey = ''
        }

        if (block.type === 'paragraph') {
            const currentParagraphKey = toEchoKey(block.text)
            if (currentParagraphKey && currentParagraphKey === prevParagraphKey) {
                continue
            }
            prevParagraphKey = currentParagraphKey

            if (activeTableEchoSet && isTableEchoText(activeTableEchoSet, block.text)) {
                tableEchoRowsSkipped += 1
                continue
            }

            if (tableEchoRowsSkipped > 0) {
                activeTableEchoSet = null
                tableEchoRowsSkipped = 0
            }
            out.push(block)
            continue
        }

        if (block.type === 'list' && Array.isArray(block.items) && block.items.length) {
            const matches = block.items.filter((item) => isTableEchoText(activeTableEchoSet, item)).length
            if (activeTableEchoSet && matches >= Math.max(2, Math.ceil(block.items.length * 0.7))) {
                tableEchoRowsSkipped += matches
                continue
            }

            if (tableEchoRowsSkipped > 0) {
                activeTableEchoSet = null
                tableEchoRowsSkipped = 0
            }
            prevParagraphKey = ''
            out.push(block)
            continue
        }

        if (block.type === 'heading' || block.type === 'quote') {
            activeTableEchoSet = null
            tableEchoRowsSkipped = 0
        }

        prevParagraphKey = ''
        out.push(block)
    }

    return out
}

function toAuthorInitials(name) {
    const safe = String(name || 'GameRant').trim()
    const parts = safe.split(/\s+/).filter(Boolean)
    if (!parts.length) return 'GR'
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
    return `${parts[0][0] || ''}${parts[1][0] || ''}`.toUpperCase()
}

function AuthorAvatar({ name, image, sizeClass = 'h-8 w-8', textClass = 'text-[11px]' }) {
    const [avatarErr, setAvatarErr] = useState(false)
    const safeName = String(name || 'GameRant')

    if (image && !avatarErr) {
        return (
            <img
                src={image}
                alt={safeName}
                loading="lazy"
                decoding="async"
                className={`${sizeClass} rounded-full object-cover ring-1 ring-apple-border/70`}
                onError={() => setAvatarErr(true)}
            />
        )
    }

    return (
        <span className={`inline-flex ${sizeClass} items-center justify-center rounded-full bg-[var(--mx-color-0071e3)] font-bold text-white ${textClass}`}>
            {toAuthorInitials(safeName)}
        </span>
    )
}

function renderBlockLinks(links, keyPrefix) {
    if (!Array.isArray(links) || links.length === 0) return null
    const rows = normalizeArticleLinks(links).slice(0, 6)
    if (!rows.length) return null

    return (
        <div className="mt-3 space-y-1.5">
            {rows.map((link, idx) => (
                <a
                    key={`${keyPrefix}-${link.href}-${idx}`}
                    href={link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-center justify-between rounded-lg border border-transparent px-2 py-1.5 text-[13px] text-[var(--mx-color-0a58ca)] transition hover:border-[var(--mx-color-c8defd)] hover:bg-[var(--mx-color-f6faff)]"
                >
                    <span className="min-w-0 line-clamp-2 underline-offset-4 group-hover:underline">{link.text}</span>
                    <span className="ml-2 shrink-0 text-[11px] font-semibold text-[var(--mx-color-0071e3)] opacity-70 transition sm:opacity-0 sm:group-hover:opacity-100">
                        Go to page ↗
                    </span>
                </a>
            ))}
        </div>
    )
}

function renderTableBlock(block, index) {
    const headers = Array.isArray(block.headers) ? block.headers.filter(Boolean) : []
    const rawRows = Array.isArray(block.rows) ? block.rows : []
    const rows = rawRows
        .map((row) => (Array.isArray(row?.cells) ? row.cells.map((cell) => String(cell || '')) : []))
        .filter((row) => row.length > 0)
    const columnCount = Math.max(headers.length, ...rows.map((row) => row.length), 1)
    const resolvedHeaders = headers.length ? headers : Array.from({ length: columnCount }, (_, idx) => `Column ${idx + 1}`)

    return (
        <section key={index} className="rounded-2xl border border-apple-border/70 bg-[var(--mx-color-fbfbfd)] p-4 sm:p-5">
            {block.caption ? <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.12em] text-apple-subtext">{block.caption}</p> : null}
            <div className="overflow-x-auto">
                <table className="min-w-full border-separate border-spacing-0 text-left text-[13px] text-[var(--mx-color-2b2b2d)]">
                    <thead>
                        <tr>
                            {resolvedHeaders.map((header, idx) => (
                                <th
                                    key={`${index}-th-${idx}`}
                                    className="border-b border-apple-border/80 bg-[var(--mx-color-f2f6fb)] px-3 py-2 font-semibold text-apple-text first:rounded-tl-lg last:rounded-tr-lg"
                                >
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, rowIdx) => {
                            const cells = [...row]
                            while (cells.length < columnCount) cells.push('')
                            return (
                                <tr key={`${index}-tr-${rowIdx}`} className={rowIdx % 2 ? 'bg-[var(--mx-color-f7f9fc)]/70' : ''}>
                                    {cells.map((cell, cellIdx) => (
                                        <td key={`${index}-td-${rowIdx}-${cellIdx}`} className="border-b border-apple-border/50 px-3 py-2 align-top">
                                            {cell}
                                        </td>
                                    ))}
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
            {renderBlockLinks(block.links, `table-${index}`)}
        </section>
    )
}

function renderGameReferenceBlock(block, index) {
    const title = String(block.title || 'Referenced game')
    const sourceLink = String(block.sourceLink || '').trim()
    const genres = Array.isArray(block.genres) ? block.genres.filter(Boolean).slice(0, 4) : []
    const systems = Array.isArray(block.systems) ? block.systems.filter(Boolean).slice(0, 5) : []
    const fields = Array.isArray(block.fields)
        ? block.fields
            .filter((row) => row && typeof row === 'object')
            .map((row) => ({
                label: String(row.label || '').trim(),
                value: String(row.value || '').trim(),
            }))
            .filter((row) => row.label && row.value)
            .slice(0, 4)
        : []
    const openCritic = block.openCritic && typeof block.openCritic === 'object' ? block.openCritic : null
    const whereToPlay = normalizeArticleLinks(block.whereToPlay)
    const referenceLinks = normalizeArticleLinks([
        ...(sourceLink ? [{ href: sourceLink, text: `${title} page`, host: toHost(sourceLink) }] : []),
        ...(openCritic?.href ? [{ href: openCritic.href, text: openCritic.title || 'OpenCritic Reviews', host: toHost(openCritic.href) }] : []),
        ...whereToPlay,
    ])

    return (
        <section key={index} className="lifesync-games-glass mx-auto w-full max-w-3xl overflow-hidden rounded-[16px] border border-[var(--mx-color-cdd9ea)] bg-[linear-gradient(180deg,var(--mx-color-f8fbff)_0%,var(--mx-color-ffffff)_100%)] p-3 sm:p-3.5">
            <div className="grid gap-3 md:grid-cols-[88px,1fr] md:items-start">
                <div className="overflow-hidden rounded-[10px] border border-apple-border/70 bg-[var(--color-surface)]">
                    {block.thumbnail ? (
                        <LifesyncEpisodeThumbnail
                            src={block.thumbnail}
                            className="aspect-[3/4] w-full"
                            imgClassName="h-full w-full object-cover"
                            alt={title}
                        />
                    ) : (
                        <div className="flex aspect-[3/4] w-full items-center justify-center bg-apple-bg text-[11px] text-apple-subtext">Game</div>
                    )}
                </div>

                <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-apple-subtext">Related Game</p>
                    {sourceLink ? (
                        <a href={sourceLink} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center text-[17px] font-bold leading-tight tracking-tight text-apple-text hover:underline">
                            {title}
                        </a>
                    ) : (
                        <h3 className="mt-0.5 text-[17px] font-bold leading-tight tracking-tight text-apple-text">{title}</h3>
                    )}

                    {fields.length ? (
                        <dl className="mt-2 space-y-1 rounded-lg border border-apple-border/70 bg-[var(--color-surface)] p-2">
                            {fields.map((row, idx) => (
                                <div key={`${index}-field-${idx}`} className="grid gap-1 sm:grid-cols-[110px,1fr] sm:items-start">
                                    <dt className="text-[11px] font-semibold text-apple-text">{row.label}</dt>
                                    <dd className="text-[12px] text-[var(--mx-color-2b2b2d)]">{row.value}</dd>
                                </div>
                            ))}
                        </dl>
                    ) : null}

                    {genres.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {genres.map((genre, idx) => (
                                <span key={`${index}-genre-${idx}`} className="rounded-md border border-apple-border bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-semibold text-apple-text">
                                    {genre}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    {systems.length ? (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                            {systems.map((system, idx) => (
                                <span key={`${index}-system-${idx}`} className="rounded-full border border-[var(--mx-color-c8defd)] bg-[var(--mx-color-f2f7ff)] px-2 py-0.5 text-[10px] font-semibold text-[var(--mx-color-0a58ca)]">
                                    {system}
                                </span>
                            ))}
                        </div>
                    ) : null}

                    {openCritic?.href ? (
                        <div className="mt-1.5 rounded-lg border border-[var(--mx-color-c8defd)] bg-[var(--mx-color-f3f8ff)] p-2">
                            <a href={openCritic.href} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-[var(--mx-color-0a58ca)] hover:underline">
                                {openCritic.title || 'OpenCritic Reviews'}
                            </a>
                        </div>
                    ) : null}

                    {renderBlockLinks(referenceLinks, `game-reference-${index}`)}
                </div>
            </div>
        </section>
    )
}

function renderBlock(block, index) {
    if (!block || typeof block !== 'object') return null

    if (block.type === 'heading') {
        if (block.level === 3) {
            return (
                <h3 key={index} className="mt-8 border-l-4 border-[var(--mx-color-0071e3)] pl-3 text-[23px] font-bold leading-tight text-apple-text">
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
                <p className="text-[17px] leading-[1.9] text-[var(--mx-color-2b2b2d)]">{block.text}</p>
                {renderBlockLinks(block.links, `paragraph-${index}`)}
            </div>
        )
    }

    if (block.type === 'quote') {
        return (
            <div key={index} className="rounded-2xl border border-[var(--mx-color-d6e7ff)] bg-[var(--mx-color-f4f9ff)] px-5 py-4">
                <blockquote className="text-[16px] leading-[1.9] italic text-apple-text">{block.text}</blockquote>
                {renderBlockLinks(block.links, `quote-${index}`)}
            </div>
        )
    }

    if (block.type === 'list' && Array.isArray(block.items) && block.items.length) {
        const Tag = block.ordered ? 'ol' : 'ul'
        return (
            <div key={index} className="rounded-2xl border border-apple-border/70 bg-[var(--mx-color-fbfbfd)] px-4 py-4">
                <Tag className={`space-y-2 pl-6 text-[16px] leading-[1.8] text-[var(--mx-color-2b2b2d)] ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
                    {block.items.map((item, idx) => (
                        <li key={`${index}-${idx}`}>{item}</li>
                    ))}
                </Tag>
                {renderBlockLinks(block.links, `list-${index}`)}
            </div>
        )
    }

    if (block.type === 'table') {
        return renderTableBlock(block, index)
    }

    if (block.type === 'gameReference') {
        return renderGameReferenceBlock(block, index)
    }

    if (block.type === 'image' && block.src) {
        return (
            <figure key={index} className="mx-auto w-full max-w-2xl overflow-hidden rounded-[14px] border border-apple-border/70 bg-[var(--color-surface)] shadow-sm">
                <LifesyncEpisodeThumbnail
                    src={block.src}
                    className="aspect-[16/9] w-full"
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
    const authorName = article?.author || 'GameRant'
    const contentBlocks = useMemo(() => normalizeContentBlocks(article?.content), [article?.content])
    const mainBlocks = useMemo(
        () => contentBlocks.filter((block) => block && typeof block === 'object' && block.type !== 'gameReference'),
        [contentBlocks]
    )
    const gameReferenceBlocks = useMemo(
        () => contentBlocks.filter((block) => block && typeof block === 'object' && block.type === 'gameReference'),
        [contentBlocks]
    )

    return (
        <LifeSyncHubPageShell>
            <div className="mx-auto w-full max-w-6xl space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <Link
                        to="/dashboard/lifesync/games/gamerant"
                        className="inline-flex items-center gap-2 rounded-lg border border-apple-border bg-[var(--color-surface)] px-3 py-2 text-[13px] font-semibold text-apple-text transition hover:border-[var(--mx-color-0071e3)]"
                    >
                        Back to Gaming News
                    </Link>
                    {article?.sourceLink ? (
                        <a
                            href={article.sourceLink}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center rounded-full border border-[var(--mx-color-bfdbfe)] bg-[var(--mx-color-eff6ff)] px-3 py-1 text-[12px] font-semibold text-[var(--mx-color-1d4ed8)] transition hover:bg-[var(--mx-color-dbeafe)]"
                        >
                            Original on GameRant
                        </a>
                    ) : null}
                </div>

                {loading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-10 w-3/4 rounded bg-[var(--mx-color-ececf1)]" />
                        <div className="h-5 w-1/2 rounded bg-[var(--mx-color-ececf1)]" />
                        <div className="aspect-video rounded-[18px] bg-[var(--mx-color-ececf1)]" />
                        <div className="space-y-3">
                            {Array.from({ length: 8 }).map((_, idx) => (
                                <div key={idx} className="h-4 w-full rounded bg-[var(--mx-color-ececf1)]" />
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
                    <article className="space-y-6">
                            <header className="lifesync-games-glass overflow-hidden rounded-3xl border border-apple-border/70 bg-[linear-gradient(145deg,var(--mx-color-f8fbff)_0%,var(--mx-color-ffffff)_42%,var(--mx-color-f7fff0)_100%)] p-6">
                                <p className="text-[12px] font-semibold uppercase tracking-[0.14em] text-apple-subtext">GameRant Feature Story</p>
                                <h1 className="mt-2 text-[36px] font-bold leading-tight tracking-tight text-apple-text">{article.title}</h1>
                                {article.description ? (
                                    <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-[var(--mx-color-515154)]">{article.description}</p>
                                ) : null}
                                <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] text-apple-subtext">
                                    {article.authorProfile ? (
                                        <a
                                            href={article.authorProfile}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 rounded-full border border-apple-border bg-[var(--color-surface)] px-2.5 py-1 transition hover:border-[var(--mx-color-0071e3)]"
                                        >
                                            <AuthorAvatar name={authorName} image={article.authorImage} sizeClass="h-7 w-7" textClass="text-[10px]" />
                                            <span className="font-semibold text-apple-text">{authorName}</span>
                                        </a>
                                    ) : (
                                        <span className="inline-flex items-center gap-2 rounded-full border border-apple-border bg-[var(--color-surface)] px-2.5 py-1">
                                            <AuthorAvatar name={authorName} image={article.authorImage} sizeClass="h-7 w-7" textClass="text-[10px]" />
                                            <span className="font-semibold text-apple-text">{authorName}</span>
                                        </span>
                                    )}
                                    <span>{article.time || 'Recently published'}</span>
                                </div>
                            </header>

                            {article.thumbnail ? (
                                <div className="lifesync-games-glass mx-auto w-full max-w-3xl overflow-hidden rounded-[16px] border border-apple-border/70 bg-[var(--color-surface)]">
                                    <LifesyncEpisodeThumbnail
                                        src={article.thumbnail}
                                        className="aspect-[16/10] w-full"
                                        imgClassName="h-full w-full object-cover"
                                        alt={article.title || 'GameRant article'}
                                    />
                                </div>
                            ) : null}

                            <section className="lifesync-games-glass space-y-5 rounded-3xl border border-apple-border/60 bg-[var(--color-surface)] p-5 sm:p-6">
                                {mainBlocks.length ? (
                                    mainBlocks.map((block, idx) => renderBlock(block, idx))
                                ) : (
                                    <p className="text-[15px] text-apple-subtext">Article content is unavailable.</p>
                                )}
                            </section>

                            {gameReferenceBlocks.length ? (
                                <section className="lifesync-games-glass space-y-3 rounded-3xl border border-apple-border/60 bg-[var(--color-surface)] p-4 sm:p-5">
                                    <h3 className="text-[15px] font-semibold tracking-[0.01em] text-apple-text">Referenced Games</h3>
                                    <div className="space-y-3">
                                        {gameReferenceBlocks.map((block, idx) => renderGameReferenceBlock(block, idx))}
                                    </div>
                                </section>
                            ) : null}
                    </article>
                ) : null}
            </div>
        </LifeSyncHubPageShell>
    )
}
