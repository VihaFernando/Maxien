/**
 * Microsoft Store product details via Maxien `/api/xbox/ms-store/products` (same source as the client Xbox hub).
 */
import { parseMsProduct } from './msStoreParseProductDetail.js'

function absUri(uri) {
    if (!uri || typeof uri !== 'string') return null
    const t = uri.trim()
    if (!t) return null
    return t.startsWith('//') ? `https:${t}` : t
}

function pickImg(images, purpose) {
    const i = images.find((x) => x.ImagePurpose === purpose)
    return i?.Uri ? absUri(i.Uri) : null
}

/**
 * @param {unknown} raw - Display Catalog product object
 * @returns {{ productId: string, title: string|null, heroImage: string|null, priceText: string|null, shortDescription: string|null, storeUrl: string|null }|null}
 */
export function parseMsStoreProductSummary(raw) {
    if (!raw || typeof raw !== 'object') return null
    const loc = raw.LocalizedProperties?.[0] || {}
    const images = Array.isArray(loc.Images) ? loc.Images : []
    const hero =
        pickImg(images, 'BrandedKeyArt') ||
        pickImg(images, 'SuperHeroArt') ||
        pickImg(images, 'TitledHeroArt') ||
        pickImg(images, 'Poster') ||
        pickImg(images, 'BoxArt') ||
        null

    const skuWrap = raw.DisplaySkuAvailabilities?.[0]
    const avails = skuWrap?.Availabilities
    let listPrice
    let msrp
    let currency = 'USD'
    if (Array.isArray(avails)) {
        for (const a of avails) {
            if (!Array.isArray(a.Actions) || !a.Actions.includes('Purchase')) continue
            if (a.RemediationRequired) continue
            const pr = a.OrderManagementData?.Price
            if (pr && typeof pr.ListPrice === 'number' && pr.ListPrice > 0) {
                listPrice = pr.ListPrice
                msrp = pr.MSRP
                currency = pr.CurrencyCode || 'USD'
                break
            }
        }
        if (listPrice === undefined) {
            for (const a of avails) {
                if (!Array.isArray(a.Actions) || !a.Actions.includes('Purchase')) continue
                const pr = a.OrderManagementData?.Price
                if (pr && typeof pr.ListPrice === 'number') {
                    listPrice = pr.ListPrice
                    msrp = pr.MSRP
                    currency = pr.CurrencyCode || 'USD'
                    break
                }
            }
        }
    }

    let priceText = null
    if (typeof listPrice === 'number') {
        if (listPrice === 0) priceText = 'Free'
        else {
            const formatted = listPrice.toLocaleString(undefined, { style: 'currency', currency })
            if (typeof msrp === 'number' && msrp > listPrice && msrp > 0) {
                const orig = msrp.toLocaleString(undefined, { style: 'currency', currency })
                const pct = Math.round(((msrp - listPrice) / msrp) * 100)
                priceText = `${formatted} · was ${orig} (−${pct}%)`
            } else {
                priceText = formatted
            }
        }
    }

    const pid = raw.ProductId != null ? String(raw.ProductId).trim() : null
    if (!pid) return null

    const shortDesc =
        typeof loc.ShortDescription === 'string'
            ? loc.ShortDescription.replace(/\s+/g, ' ').trim().slice(0, 220)
            : null

    return {
        productId: pid,
        title: loc.ProductTitle || null,
        heroImage: hero,
        priceText,
        shortDescription: shortDesc || null,
        storeUrl: `https://www.xbox.com/games/store/p/${encodeURIComponent(pid)}`,
    }
}

/**
 * @param {string[]} bigIds
 * @param {(path: string) => Promise<unknown>} fetchJson
 * @returns {Promise<Map<string, ReturnType<typeof parseMsStoreProductSummary>>>}
 */
export async function fetchMsStoreDetailsMap(bigIds, fetchJson) {
    const map = new Map()
    const unique = [...new Set(bigIds.map((id) => String(id).trim()).filter(Boolean))].slice(0, 80)
    const CHUNK = 20
    for (let i = 0; i < unique.length; i += CHUNK) {
        const chunk = unique.slice(i, i + CHUNK)
        try {
            const qs = chunk.map((id) => encodeURIComponent(id)).join(',')
            const data = await fetchJson(`/api/xbox/ms-store/products?bigIds=${qs}`)
            const products = data?.products?.Products ?? data?.Products ?? []
            if (!Array.isArray(products)) continue
            for (const raw of products) {
                const summary = parseMsStoreProductSummary(raw)
                if (summary?.productId) map.set(summary.productId, summary)
            }
        } catch {
            /* best-effort enrichment */
        }
    }
    return map
}

/**
 * @param {string} bigId
 * @param {(path: string) => Promise<unknown>} fetchJson
 * @returns {Promise<ReturnType<typeof parseMsProduct>|null>}
 */
export async function fetchMsStoreProductDetail(bigId, fetchJson) {
    const id = String(bigId || '').trim()
    if (!id) return null
    try {
        const data = await fetchJson(`/api/xbox/ms-store/products?bigIds=${encodeURIComponent(id)}`)
        const products = data?.products?.Products ?? data?.Products ?? []
        const raw = products[0]
        return parseMsProduct(raw)
    } catch {
        return null
    }
}
