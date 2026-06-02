/**
 * Embed iframe policy for LifeSync anime streams across multiple mirrors.
 *
 * - Default: tight sandbox (no allow-popups*) to cut pop-up / pop-under ads from cooperative embeds.
 * - Exceptions: omit `sandbox` only for a small host set known to fail in sandbox mode.
 *
 * Cross-origin players cannot be scrubbed of in-page ads from our app; uBlock Origin etc. still helps.
 */

/** Lowercase host snippets with repeat breakage under sandbox restrictions. */
const UNSANDBOX_HOST_SNIPPETS = [
  'streamhg',
  'earnvid',
  'earn-vid',
  'watchsb',
  'streamsb',
  'sbplay',
  'sbchill',
  'sbthe',
  'sbanh',
]

/**
 * Sandboxed embeds: playback + autoplay for most players, without opening new windows.
 */
export const STREAM_IFRAME_SANDBOX_TIGHT =
  'allow-same-origin allow-scripts allow-presentation allow-forms allow-pointer-lock'

/**
 * @param {string|undefined|null} iframeUrl
 * @param {{ provider?: string | null, selectedMirrorLabel?: string | null }} [meta]
 * @returns {{ sandbox: string | undefined }}
 *   `sandbox` undefined → omit attribute (full embed privileges; ads/popups harder to constrain).
 */
export function getAnimeStreamIframeSandbox(iframeUrl, _meta = {}) {
  let host = ''
  try {
    if (iframeUrl && /^https?:\/\//i.test(String(iframeUrl))) {
      host = new URL(iframeUrl).hostname.toLowerCase()
    }
  } catch {
    host = ''
  }

  const hostNeedsUnsandbox = UNSANDBOX_HOST_SNIPPETS.some((s) => host.includes(s))
  if (hostNeedsUnsandbox) {
    return { sandbox: undefined }
  }

  return { sandbox: STREAM_IFRAME_SANDBOX_TIGHT }
}

/**
 * Props to spread onto `<iframe>` (either `{ sandbox: "…" }` or `{}` when unsandboxed).
 * @param {string|undefined|null} iframeUrl
 * @param {{ provider?: string | null, selectedMirrorLabel?: string | null }} [meta]
 */
export function streamIframeSandboxProps(iframeUrl, meta = {}) {
  const { sandbox } = getAnimeStreamIframeSandbox(iframeUrl, meta)
  return sandbox != null ? { sandbox } : {}
}

/**
 * Best-effort autoplay URL normalization for third-party embed players.
 * Adds common autoplay/mute/inline query params when absent.
 *
 * @param {string|undefined|null} iframeUrl
 * @returns {string}
 */
export function withStreamIframeAutoplayUrl(iframeUrl) {
  const raw = String(iframeUrl || '').trim()
  if (!/^https?:\/\//i.test(raw)) return raw
  try {
    const url = new URL(raw)
    const params = url.searchParams

    if (!params.has('autoplay')) params.set('autoplay', '1')
    if (!params.has('autostart')) params.set('autostart', '1')
    if (!params.has('playsinline')) params.set('playsinline', '1')

    // Muted autoplay is broadly allowed by browsers; ignored by players that do not support it.
    if (!params.has('muted')) params.set('muted', '1')
    if (!params.has('mute')) params.set('mute', '1')

    return url.toString()
  } catch {
    return raw
  }
}
