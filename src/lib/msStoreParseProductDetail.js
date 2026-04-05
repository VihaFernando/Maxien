/**
 * Microsoft Store Display Catalog → rich product detail (aligned with client `parseMsProduct`).
 */
import { pickMicrosoftStoreBigId } from './openXblLifeSyncHelpers.js'

function pickCatalogImage(images, purpose) {
  return images.find((i) => i.ImagePurpose === purpose) || null
}

function absCatalogUri(uri) {
  if (!uri || typeof uri !== 'string') return null
  const t = uri.trim()
  if (!t) return null
  return t.startsWith('//') ? `https:${t}` : t
}

const MS_ATTR_LABELS = {
  BroadcastSupport: 'Broadcast',
  Capability4k: '4K Ultra HD',
  SinglePlayer: 'Single player',
  ConsoleGen9Optimized: 'Optimized for Xbox Series X|S',
  ConsoleKeyboardMouse: 'Keyboard & mouse',
  XblAchievements: 'Achievements',
  XblCloudSaves: 'Cloud saves',
  XPA: 'Xbox Play Anywhere',
  XboxLive: 'Xbox network',
}

function friendlyAttributeLabel(name) {
  if (!name || typeof name !== 'string') return null
  if (MS_ATTR_LABELS[name]) return MS_ATTR_LABELS[name]
  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/^\w/, (c) => c.toUpperCase())
}

function parseContentRatings(marketProps) {
  const ratings = Array.isArray(marketProps?.ContentRatings) ? marketProps.ContentRatings : []
  const preferred = ['ESRB', 'PEGI', 'IARC', 'USK', 'GRB', 'DJCTQ', 'COB-AU']
  const out = []
  const seen = new Set()
  for (const sys of preferred) {
    const r = ratings.find((x) => x.RatingSystem === sys)
    if (!r?.RatingId) continue
    const short = String(r.RatingId).includes(':')
      ? String(r.RatingId).split(':').slice(1).join(':')
      : r.RatingId
    out.push({ system: sys, id: r.RatingId, label: `${sys} ${short}` })
    seen.add(sys)
  }
  for (const r of ratings) {
    if (!r.RatingSystem || !r.RatingId || seen.has(r.RatingSystem)) continue
    if (r.RatingSystem === 'Microsoft') continue
    const short = String(r.RatingId).includes(':')
      ? String(r.RatingId).split(':').pop()
      : r.RatingId
    out.push({ system: r.RatingSystem, id: r.RatingId, label: `${r.RatingSystem} ${short}` })
    if (out.length >= 6) break
  }
  return out
}

function parseUsageRating(marketProps) {
  const rows = Array.isArray(marketProps?.UsageData) ? marketProps.UsageData : []
  const all = rows.find((x) => x.AggregateTimeSpan === 'AllTime') || rows[0]
  if (!all) return null
  const avg = all.AverageRating
  const cnt = all.RatingCount
  if (typeof avg !== 'number' && !(typeof cnt === 'number' && cnt > 0)) return null
  return {
    average: typeof avg === 'number' ? avg : null,
    count: typeof cnt === 'number' ? cnt : 0,
  }
}

function parseTrailer(loc) {
  const videos = Array.isArray(loc?.CMSVideos) ? loc.CMSVideos : []
  if (!videos.length) return null
  const v =
    videos.find((x) => x.VideoPurpose === 'HeroTrailer') || videos.find((x) => x.HLS || x.DASH) || videos[0]
  const hls = absCatalogUri(v.HLS)
  const dash = absCatalogUri(v.DASH)
  const playUrl = hls || dash
  if (!playUrl) return null
  return {
    caption: v.Caption || 'Trailer',
    playUrl,
    hlsUrl: hls,
    dashUrl: dash,
    previewImage: v.PreviewImage?.Uri ? absCatalogUri(v.PreviewImage.Uri) : null,
  }
}

function maxDownloadSizeGbFromPackages(packages) {
  if (!Array.isArray(packages)) return null
  let max = 0
  for (const p of packages) {
    const b = p.MaxDownloadSizeInBytes
    if (typeof b === 'number' && b > max) max = b
  }
  if (!max) return null
  return Math.round((max / (1024 * 1024 * 1024)) * 10) / 10
}

function pickAlternateId(raw, idType) {
  const ids = Array.isArray(raw?.AlternateIds) ? raw.AlternateIds : []
  const hit = ids.find((x) => x.IdType === idType)
  return hit?.Value != null ? String(hit.Value) : null
}

function formatReleaseLabel(iso) {
  if (!iso || typeof iso !== 'string') return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatPriceAmount(amount, currency) {
  if (typeof amount !== 'number') return null
  return amount.toLocaleString(undefined, { style: 'currency', currency: currency || 'USD' })
}

/** Prefer a real retail purchase row (not Game Pass / remediation upsell). */
function pickRetailPurchaseAvailability(skuWrap) {
  const avails = skuWrap?.Availabilities
  if (!Array.isArray(avails)) return null
  for (const a of avails) {
    if (!Array.isArray(a.Actions) || !a.Actions.includes('Purchase')) continue
    if (a.RemediationRequired) continue
    const p = a.OrderManagementData?.Price
    if (!p || typeof p.ListPrice !== 'number') continue
    if (p.ListPrice <= 0) continue
    return a
  }
  return null
}

function saleEndsLabelFromAvailability(avail) {
  const end = avail?.Conditions?.EndDate
  if (!end || typeof end !== 'string') return null
  const d = new Date(end)
  if (Number.isNaN(d.getTime())) return null
  if (d.getTime() < Date.now()) return null
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const ESRB_DESCRIPTOR_MAP = {
  Vio: 'Violence',
  Blo: 'Blood',
  StrLan: 'Strong Language',
  StrVio: 'Strong Violence',
  Sex: 'Sexual Content',
  SexCon: 'Sexual Content',
  Hor: 'Horror',
  Dru: 'Drug Reference',
  AlcTobDru: 'Alcohol / Tobacco / Drugs',
  Lan: 'Language',
  InaLan: 'Intense Language',
  Fea: 'Fear',
  LegDru: 'Legal Drugs',
  TobAndAlc: 'Tobacco / Alcohol',
}

function parseEsrbFooter(productMarket) {
  const ratings = Array.isArray(productMarket?.ContentRatings) ? productMarket.ContentRatings : []
  const esrb = ratings.find((r) => r.RatingSystem === 'ESRB')
  if (!esrb?.RatingId) return null
  const letter = String(esrb.RatingId).split(':').pop()?.trim() || null
  const descriptors = Array.isArray(esrb.RatingDescriptors)
    ? esrb.RatingDescriptors.map((d) => {
        const code = String(d).includes(':') ? String(d).split(':').pop() : String(d)
        return ESRB_DESCRIPTOR_MAP[code] || code
      })
    : []
  return {
    letter,
    descriptors,
    ratingId: esrb.RatingId,
  }
}

function gamePassUpsellLikely(skuWrap) {
  const avails = skuWrap?.Availabilities
  if (!Array.isArray(avails)) return false
  return avails.some(
    (a) =>
      a.RemediationRequired &&
      Array.isArray(a.Actions) &&
      a.Actions.includes('Purchase') &&
      a.OrderManagementData?.Price?.ListPrice === 0,
  )
}

const GAME_PASS_LABEL_ORDER = [
  'Game Pass Ultimate',
  'PC Game Pass',
  'Game Pass Core',
  'Game Pass Standard',
  'EA Play',
  'Xbox Game Pass',
]

function normalizeGamePassOfferLabel(raw) {
  if (typeof raw !== 'string') return null
  const text = raw.trim()
  if (!text) return null
  const lower = text.toLowerCase()
  if (!/(game\s*pass|gamepass|xgp|xgpu|ea\s*play|xbox\s+live\s+gold|ultimate|core|standard)/i.test(lower)) {
    return null
  }
  if (/\bea\s*play\b/i.test(text)) return 'EA Play'
  if (/\bxgpu\b|\bultimate\b/i.test(lower)) return 'Game Pass Ultimate'
  if ((/\bpc\b/i.test(text) && /game\s*pass|gamepass|xgp/i.test(text)) || /\bxgppc\b/i.test(lower)) {
    return 'PC Game Pass'
  }
  if (/\bcore\b/i.test(text) || /xbox\s+live\s+gold/i.test(lower)) {
    return 'Game Pass Core'
  }
  if (/\bstandard\b/i.test(text)) return 'Game Pass Standard'
  return 'Xbox Game Pass'
}

function collectGamePassOfferLabels(value, out, depth = 0) {
  if (depth > 5 || value == null) return
  if (typeof value === 'string') {
    const label = normalizeGamePassOfferLabel(value)
    if (label) out.add(label)
    return
  }
  if (Array.isArray(value)) {
    for (const row of value) collectGamePassOfferLabels(row, out, depth + 1)
    return
  }
  if (typeof value !== 'object') return

  const likelyNameKeys = [
    'name',
    'Name',
    'title',
    'Title',
    'label',
    'Label',
    'tier',
    'Tier',
    'membership',
    'Membership',
    'passName',
    'PassName',
    'displayName',
    'DisplayName',
    'type',
    'Type',
  ]
  for (const key of likelyNameKeys) {
    collectGamePassOfferLabels(value[key], out, depth + 1)
  }

  for (const v of Object.values(value)) {
    if (typeof v === 'string' || Array.isArray(v) || (v && typeof v === 'object')) {
      collectGamePassOfferLabels(v, out, depth + 1)
    }
  }
}

function sortGamePassOfferLabels(labels) {
  const rank = new Map(GAME_PASS_LABEL_ORDER.map((l, i) => [l, i]))
  return [...labels].sort((a, b) => {
    const ra = rank.has(a) ? rank.get(a) : 999
    const rb = rank.has(b) ? rank.get(b) : 999
    if (ra !== rb) return ra - rb
    return a.localeCompare(b)
  })
}

/** Best-effort extraction of which Game Pass membership labels appear in a payload. */
export function extractGamePassOfferLabels(value) {
  const out = new Set()
  collectGamePassOfferLabels(value, out)
  return sortGamePassOfferLabels(out)
}

/** Parse a single Display Catalog `Products[]` item into a friendly shape. */
export function parseMsProduct(raw) {
  if (!raw || typeof raw !== 'object') return null
  const loc = raw.LocalizedProperties?.[0] || {}
  const images = Array.isArray(loc.Images) ? loc.Images : []
  const heroRaw =
    pickCatalogImage(images, 'BrandedKeyArt') ||
    pickCatalogImage(images, 'SuperHeroArt') ||
    pickCatalogImage(images, 'TitledHeroArt') ||
    pickCatalogImage(images, 'Poster') ||
    pickCatalogImage(images, 'BoxArt') ||
    pickCatalogImage(images, 'Logo') ||
    images[0]
  const heroUri = absCatalogUri(heroRaw?.Uri)
  const posterRaw =
    pickCatalogImage(images, 'BoxArt') ||
    pickCatalogImage(images, 'Poster') ||
    pickCatalogImage(images, 'TitledHeroArt') ||
    heroRaw
  const posterImage = absCatalogUri(posterRaw?.Uri) || heroUri
  const backdropRaw =
    pickCatalogImage(images, 'SuperHeroArt') ||
    pickCatalogImage(images, 'TitledHeroArt') ||
    pickCatalogImage(images, 'BrandedKeyArt') ||
    posterRaw ||
    heroRaw
  const backdropImage = absCatalogUri(backdropRaw?.Uri) || heroUri

  const screenshotUrls = images
    .filter((i) => i.ImagePurpose === 'Screenshot' && i.Uri)
    .map((i) => absCatalogUri(i.Uri))
    .filter(Boolean)
  const screenshots = [...new Set(screenshotUrls)]

  const skuWrap = raw.DisplaySkuAvailabilities?.[0]
  const sku = skuWrap?.Sku || {}
  const retailAvail = pickRetailPurchaseAvailability(skuWrap)
  const avail = retailAvail || skuWrap?.Availabilities?.[0]
  const priceObj = avail?.OrderManagementData?.Price
  const listPrice = priceObj?.ListPrice
  const msrp = priceObj?.MSRP
  const currency = priceObj?.CurrencyCode || 'USD'
  const saleEndsLabel = retailAvail ? saleEndsLabelFromAvailability(retailAvail) : null
  const isOnSale =
    typeof listPrice === 'number' &&
    typeof msrp === 'number' &&
    msrp > listPrice &&
    listPrice > 0
  const savingsAmount =
    isOnSale && typeof listPrice === 'number' && typeof msrp === 'number' ? msrp - listPrice : null

  let priceText = null
  if (typeof listPrice === 'number' && listPrice === 0) {
    priceText = 'Free'
  } else if (typeof listPrice === 'number') {
    const formatted = listPrice.toLocaleString(undefined, {
      style: 'currency',
      currency,
    })
    if (typeof msrp === 'number' && msrp > listPrice) {
      const orig = msrp.toLocaleString(undefined, {
        style: 'currency',
        currency,
      })
      const pct = Math.round(((msrp - listPrice) / msrp) * 100)
      priceText = `${formatted} (was ${orig}, −${pct}%)`
    } else {
      priceText = formatted
    }
  }

  const purchasePriceFormatted = formatPriceAmount(
    typeof listPrice === 'number' ? listPrice : null,
    currency,
  )
  const msrpFormatted = formatPriceAmount(typeof msrp === 'number' ? msrp : null, currency)
  const savingsFormatted = formatPriceAmount(savingsAmount, currency)

  const productMarket = raw.MarketProperties?.[0] || {}
  const skuMarket = sku.MarketProperties?.[0] || {}
  const skuLoc = sku.LocalizedProperties?.[0] || {}
  const releaseIso = productMarket.OriginalReleaseDate || skuMarket.FirstAvailableDate || null
  const props = raw.Properties || {}
  const skuProps = sku.Properties || {}
  const hp = skuProps.HardwareProperties || {}
  const attrs = Array.isArray(props.Attributes) ? props.Attributes : []
  const features = attrs.map((a) => friendlyAttributeLabel(a.Name)).filter(Boolean)

  const supportedLanguages = Array.isArray(skuMarket.SupportedLanguages)
    ? [...skuMarket.SupportedLanguages]
    : []

  const legal = skuLoc.LegalText || {}
  const privacyUri = legal.PrivacyPolicyUri ? String(legal.PrivacyPolicyUri).trim() : null
  const supportUri = loc.SupportUri ? String(loc.SupportUri).trim() : null

  const categories = Array.isArray(props.Categories)
    ? props.Categories.filter(Boolean)
    : props.Category
      ? [props.Category]
      : []

  const esrbFooter = parseEsrbFooter(productMarket)
  const gamePassOffers = extractGamePassOfferLabels({
    skuWrap,
    gamePass: raw.GamePass ?? raw.gamePass ?? null,
    subscriptions: raw.Subscriptions ?? raw.subscriptions ?? null,
  })
  const gamePassLikely = gamePassUpsellLikely(skuWrap) || gamePassOffers.length > 0

  return {
    productId: raw.ProductId || null,
    title: loc.ProductTitle || null,
    shortDescription: loc.ShortDescription || null,
    description: loc.ProductDescription || null,
    developer: loc.DeveloperName || null,
    publisher: loc.PublisherName || null,
    heroImage: heroUri,
    posterImage,
    backdropImage,
    screenshots,
    category: props.Category || null,
    categories,
    priceText,
    purchasePriceFormatted,
    msrpFormatted,
    isOnSale: Boolean(isOnSale),
    savingsFormatted,
    saleEndsLabel,
    listPrice: typeof listPrice === 'number' ? listPrice : null,
    msrp: typeof msrp === 'number' ? msrp : null,
    currency,
    gamePassLikely,
    gamePassOffers,
    esrbFooter,
    productType: raw.ProductType || null,
    productKind: raw.ProductKind || null,
    storeUrl: raw.ProductId ? `https://www.xbox.com/games/store/p/${raw.ProductId}` : null,
    releaseDateIso: releaseIso,
    releaseDateLabel: formatReleaseLabel(releaseIso),
    minimumUserAge:
      typeof productMarket.MinimumUserAge === 'number' ? productMarket.MinimumUserAge : null,
    contentRatings: parseContentRatings(productMarket),
    storeRating: parseUsageRating(productMarket),
    features,
    supportedLanguages,
    hardware: {
      minProcessor: hp.MinimumProcessor || null,
      recommendedProcessor: hp.RecommendedProcessor || null,
      minGraphics: hp.MinimumGraphics || null,
      recommendedGraphics: hp.RecommendedGraphics || null,
      approximateDownloadGb: maxDownloadSizeGbFromPackages(skuProps.Packages),
    },
    trailer: parseTrailer(loc),
    xboxTitleId: pickAlternateId(raw, 'XboxTitleId'),
    supportUri: supportUri?.startsWith('mailto:') || supportUri?.startsWith('http') ? supportUri : null,
    privacyPolicyUri: privacyUri?.startsWith('http') ? privacyUri : null,
    copyrightNotice: legal.Copyright ? String(legal.Copyright).trim() : null,
  }
}

function openXblEndDateToLabel(endDateUtc) {
  if (!endDateUtc || typeof endDateUtc !== 'string') return null
  const m = endDateUtc.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (!m) return null
  const month = Number(m[1])
  const day = Number(m[2])
  const year = Number(m[3])
  const d = new Date(year, month - 1, day)
  if (Number.isNaN(d.getTime())) return null
  if (d.getTime() < Date.now() - 86400000) return null
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function openXblIsoToReleaseLabel(iso) {
  if (!iso || typeof iso !== 'string') return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** OpenXBL marketplace `content.productSummaries[]` row — enough to render cards + a basic detail panel. */
export function isOpenXblProductSummary(item) {
  return Boolean(
    item &&
      typeof item === 'object' &&
      typeof item.productId === 'string' &&
      item.productId.trim() &&
      item.images &&
      typeof item.images === 'object' &&
      item.specificPrices &&
      typeof item.specificPrices === 'object',
  )
}

/**
 * Map OpenXBL `productSummaries[]` entry to the shape expected by Store detail UI
 * (until Display Catalog enrichment returns full `parseMsProduct` data).
 */
export function detailFromOpenXblProductSummary(s) {
  if (!isOpenXblProductSummary(s)) return null
  const pid = pickMicrosoftStoreBigId(s)
  if (!pid) return null

  const img = s.images || {}
  const posterUrl = img.poster?.url || img.boxArt?.url || null
  const heroUrl = img.superHeroArt?.url || posterUrl

  const p = Array.isArray(s.specificPrices?.purchaseable) ? s.specificPrices.purchaseable[0] : null
  const listPrice = typeof p?.listPrice === 'number' ? p.listPrice : null
  const msrp = typeof p?.msrp === 'number' ? p.msrp : null
  const currency = p?.currency || 'USD'
  const saleEndsLabel = p?.endDateUtc ? openXblEndDateToLabel(p.endDateUtc) : null

  const isOnSale =
    typeof listPrice === 'number' &&
    typeof msrp === 'number' &&
    msrp > listPrice &&
    listPrice > 0

  const savingsAmount =
    isOnSale && typeof listPrice === 'number' && typeof msrp === 'number' ? msrp - listPrice : null

  let priceText = null
  if (typeof listPrice === 'number' && listPrice === 0 && (msrp == null || msrp === 0)) {
    priceText = 'Free'
  } else if (typeof listPrice === 'number') {
    const formatted = listPrice.toLocaleString(undefined, { style: 'currency', currency })
    if (typeof msrp === 'number' && msrp > listPrice) {
      const orig = msrp.toLocaleString(undefined, { style: 'currency', currency })
      const pct =
        p?.discountPercentage != null && typeof p.discountPercentage === 'number'
          ? Math.round(p.discountPercentage)
          : Math.round(((msrp - listPrice) / msrp) * 100)
      priceText = `${formatted} (was ${orig}, −${pct}%)`
    } else {
      priceText = formatted
    }
  }

  const purchasePriceFormatted = formatPriceAmount(
    typeof listPrice === 'number' ? listPrice : null,
    currency,
  )
  const msrpFormatted = formatPriceAmount(typeof msrp === 'number' ? msrp : null, currency)
  const savingsFormatted = formatPriceAmount(savingsAmount, currency)

  const releaseIso = s.releaseDate || null
  const cr = s.contentRating || {}
  const cms = Array.isArray(s.cmsVideos) ? s.cmsVideos : []
  const heroVid =
    cms.find((v) => v.purpose === 'HeroTrailer') || cms.find((v) => v.url) || null
  const trailer = heroVid?.url
    ? {
        caption: heroVid.title || 'Trailer',
        playUrl: heroVid.url,
        previewImage: heroVid.previewImage?.url || null,
      }
    : null

  const categories = Array.isArray(s.categories) ? s.categories.filter(Boolean) : []

  const storeRating =
    typeof s.averageRating === 'number' && s.averageRating > 0
      ? { average: s.averageRating, count: typeof s.ratingCount === 'number' ? s.ratingCount : 0 }
      : typeof s.ratingCount === 'number' && s.ratingCount > 0
        ? { average: null, count: s.ratingCount }
        : null

  const contentRatings =
    cr.boardName && cr.rating
      ? [{ system: cr.boardName, id: cr.rating, label: `${cr.boardName} ${cr.rating}` }]
      : []

  const gamePassOffers = extractGamePassOfferLabels({
    specificPrices: s.specificPrices,
    gamePass: s.gamePass ?? s.GamePass ?? null,
    subscriptions: s.subscriptions ?? s.Subscriptions ?? null,
    tags: s.tags ?? s.Tags ?? null,
  })

  return {
    productId: pid,
    title: s.title || null,
    shortDescription: s.shortDescription || null,
    description: s.description || null,
    developer: s.developerName || null,
    publisher: s.publisherName || null,
    heroImage: heroUrl,
    posterImage: posterUrl || heroUrl,
    backdropImage: heroUrl || posterUrl,
    screenshots: [],
    category: categories[0] || null,
    categories,
    priceText,
    purchasePriceFormatted,
    msrpFormatted,
    isOnSale: Boolean(isOnSale),
    savingsFormatted,
    saleEndsLabel,
    listPrice: typeof listPrice === 'number' ? listPrice : null,
    msrp: typeof msrp === 'number' ? msrp : null,
    currency,
    gamePassLikely: gamePassOffers.length > 0,
    gamePassOffers,
    esrbFooter: null,
    productType: null,
    productKind: s.productKind || null,
    storeUrl: `https://www.xbox.com/games/store/p/${pid}`,
    releaseDateIso: releaseIso,
    releaseDateLabel: openXblIsoToReleaseLabel(releaseIso),
    minimumUserAge: typeof cr.ratingAge === 'number' ? cr.ratingAge : null,
    contentRatings,
    storeRating,
    features: [],
    supportedLanguages: [],
    hardware: {
      minProcessor: null,
      recommendedProcessor: null,
      minGraphics: null,
      recommendedGraphics: null,
      approximateDownloadGb: null,
    },
    trailer,
    xboxTitleId: null,
    supportUri: null,
    privacyPolicyUri: null,
    copyrightNotice: null,
  }
}
