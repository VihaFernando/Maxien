/** Chapter ordering and labels for LifeSync manga reader (aligned with client/src/pages/MangaPage.jsx). */

export function chapterSortKey(ch) {
    const v = parseFloat(String(ch.volume ?? '')) || 0
    const raw = String(ch.chapter ?? '').trim()
    const n = parseFloat(raw)
    const num = Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
    return { v, num, raw }
}

export function compareChapters(a, b) {
    const ka = chapterSortKey(a)
    const kb = chapterSortKey(b)
    if (ka.v !== kb.v) return ka.v - kb.v
    if (ka.num !== kb.num) return ka.num - kb.num
    return ka.raw.localeCompare(kb.raw)
}

export function formatChapterLabel(ch) {
    const vol = ch.volume ? `Vol. ${ch.volume} ` : ''
    const num = ch.chapter != null && ch.chapter !== '' ? ch.chapter : '?'
    const title = ch.title ? ` — ${ch.title}` : ''
    return `${vol}Ch. ${num}${title}`
}
