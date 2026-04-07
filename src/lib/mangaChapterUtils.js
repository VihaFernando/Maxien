/** Chapter ordering and labels for LifeSync manga reader (aligned with client/src/pages/MangaPage.jsx). */

/**
 * Props for <img> when loading MangaDex CDN assets. Deployed sites send a cross-origin Referer;
 * uploads/chapter CDNs often reject that unless Referer is omitted (same pattern as Profile avatars).
 * @param {string|null|undefined} src
 * @returns {{ referrerPolicy?: 'no-referrer' }}
 */
export function mangadexImageProps(src) {
    if (src == null || typeof src !== 'string') return {}
    try {
        const host = new URL(src).hostname.toLowerCase()
        if (host === 'mangadex.org' || host.endsWith('.mangadex.org')) {
            return { referrerPolicy: 'no-referrer' }
        }
        // MangaDex@Home nodes (`*.mangadex.network`) can be sensitive to referrer policy.
        // We intentionally do NOT override it here so browsers send a normal cross-origin Referer.
        // (Some nodes return 404s when Referer is omitted.)
        if (host.endsWith('.mangadex.network')) return {}
    } catch {
        if (/mangadex\.org/i.test(src)) {
            return { referrerPolicy: 'no-referrer' }
        }
    }
    return {}
}

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

/** MangaDex translation locales for browse + chapter feed (aligned with client MangaPage.jsx). */
export const DEX_TRANSLATION_LANG_OPTIONS = [
    { value: 'en', label: 'English' },
    { value: 'ja', label: 'Japanese' },
    { value: 'ko', label: 'Korean' },
    { value: 'zh', label: 'Chinese (Simplified)' },
    { value: 'zh-hk', label: 'Chinese (Traditional)' },
    { value: 'es', label: 'Spanish' },
    { value: 'es-la', label: 'Spanish (Latin America)' },
    { value: 'fr', label: 'French' },
    { value: 'pt-br', label: 'Portuguese (Brazil)' },
    { value: 'pt', label: 'Portuguese' },
    { value: 'ru', label: 'Russian' },
    { value: 'de', label: 'German' },
    { value: 'it', label: 'Italian' },
    { value: 'id', label: 'Indonesian' },
    { value: 'th', label: 'Thai' },
    { value: 'vi', label: 'Vietnamese' },
    { value: 'tr', label: 'Turkish' },
    { value: 'pl', label: 'Polish' },
    { value: 'uk', label: 'Ukrainian' },
    { value: 'ar', label: 'Arabic' },
    { value: 'all', label: 'All languages' },
]

const DEX_LANG_LABEL = Object.fromEntries(DEX_TRANSLATION_LANG_OPTIONS.map(o => [o.value, o.label]))

/** Chapter-language dropdown from API `availableTranslatedLanguages`. */
export function buildDexChapterLangSelectOptions(availableTranslatedLanguages) {
    const avail = [...new Set((availableTranslatedLanguages || []).map(String).filter(Boolean))]
    if (avail.length === 0) return DEX_TRANSLATION_LANG_OPTIONS

    const ordered = []
    const seen = new Set()
    for (const o of DEX_TRANSLATION_LANG_OPTIONS) {
        if (o.value === 'all') continue
        if (avail.includes(o.value)) {
            ordered.push(o)
            seen.add(o.value)
        }
    }
    for (const code of avail) {
        if (!seen.has(code)) {
            ordered.push({ value: code, label: DEX_LANG_LABEL[code] || code.toUpperCase() })
            seen.add(code)
        }
    }
    if (avail.length > 1) {
        ordered.push({ value: 'all', label: 'All languages' })
    }
    return ordered
}
