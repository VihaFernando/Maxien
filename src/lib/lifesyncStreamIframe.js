/**
 * Embed iframe policy for LifeSync anime streams across multiple mirrors.
 *
 * - Default: tight sandbox (no allow-popups*) to cut pop-up / pop-under ads from cooperative embeds.
 * - Exceptions: omit `sandbox` only when the mirror host or label is known to refuse sandboxed frames.
 *
 * Cross-origin players cannot be scrubbed of in-page ads from our app; uBlock Origin etc. still helps.
 */

/** Lowercase substrings of embed hostnames that typically break inside a sandboxed iframe */
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

/** Normalized mirror label substrings (whitespace stripped in comparison) */
const UNSANDBOX_LABEL_SNIPPETS = [
  'streamhg',
  'earnvid',
  'streamsb',
  'sbplay',
  'watchsb',
  'vidstreaming',
  'doodstream',
  'mp4upload',
  'filemoon',
  'streamtape',
]

/**
 * Sandboxed embeds: playback for most players, without opening new windows from inside the frame.
 * (Fullscreen still works via the iframe `allow` attribute, not sandbox popups.)
 */
export const STREAM_IFRAME_SANDBOX_TIGHT =
  'allow-same-origin allow-scripts allow-presentation allow-forms'

function normalizeLabel(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/\s+/g, '')
}

/**
 * @param {string|undefined|null} iframeUrl
 * @param {{ provider?: string | null, selectedMirrorLabel?: string | null }} [meta]
 * @returns {{ sandbox: string | undefined }}
 *   `sandbox` undefined → omit attribute (full embed privileges; ads/popups harder to constrain).
 */
export function getAnimeStreamIframeSandbox(iframeUrl, meta = {}) {
  let host = ''
  try {
    if (iframeUrl && /^https?:\/\//i.test(String(iframeUrl))) {
      host = new URL(iframeUrl).hostname.toLowerCase()
    }
  } catch {
    host = ''
  }

  const label = normalizeLabel(meta.selectedMirrorLabel)

  const hostNeedsUnsandbox = UNSANDBOX_HOST_SNIPPETS.some((s) => host.includes(s))
  const labelNeedsUnsandbox = UNSANDBOX_LABEL_SNIPPETS.some((s) => label.includes(s.replace(/\s+/g, '')))

  if (hostNeedsUnsandbox || labelNeedsUnsandbox) {
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
