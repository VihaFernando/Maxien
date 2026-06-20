import { useEffect, useRef, useState } from 'react'
import { assignImagesByResolution, getImageResolution, probeImageResolutions } from './tvHomeImages'

/**
 * TVImageCollage  mosaic of cover/poster images that fills its container.
 *
 * • Layout is chosen deterministically from `seed`, biased toward layouts
 *   whose slot count ≤ the number of real (non-null) images available.
 * • Resolution data already in the module cache is applied synchronously on
 *   the first render so large slots always show the best image immediately.
 * • Any unprobed URLs are probed in the background; when results land the
 *   component re-sorts without a flash.
 * • Blank slots are impossible: every cell gets the best available image by
 *   cycling through the pool after the resolution sort.
 *
 * Parent only needs `relative overflow-hidden`.
 */
export function TVImageCollage({ images = [], seed = 0, className = '' }) {
    const realCount = images.filter(Boolean).length
    if (!realCount) return null

    // Pick a layout that fits the available pool; fall back gracefully
    const layout = pickLayout(seed, realCount)

    // Apply resolution sort synchronously for any URLs already probed,
    // so the very first paint already has the best assignment we know of.
    const initial = sortByResolution(images, layout)

    return (
        <LayoutWithResolution
            key={`${seed}-${layout.name}`}
            images={initial}
            layout={layout}
            className={className}
        />
    )
}

// ─── pick a fitting layout ────────────────────────────────────────────────────
function pickLayout(seed, availableCount) {
    // Prefer layouts whose imageCount ≤ available; if none fit, take the smallest
    const fitting = LAYOUTS.filter(l => l.imageCount <= availableCount)
    const pool = fitting.length ? fitting : [LAYOUTS.reduce((a, b) => a.imageCount < b.imageCount ? a : b)]
    const str = String(seed)
    let h = 2166136261
    for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619)
    return pool[(h >>> 0) % pool.length]
}

// ─── resolution sort ──────────────────────────────────────────────────────────
// Returns an array of exactly `layout.imageCount` URLs, no nulls.
// Uses whatever resolution data is already in the cache (synchronous).
// Unprobed images are treated as area=0 (sorted last, land in small slots).
function sortByResolution(rawImages, layout) {
    // Deduplicate and filter nulls from input
    const valid = [...new Set(rawImages.filter(Boolean))]
    if (!valid.length) return []

    // Assign by resolution (synchronous  uses cache only)
    const count = layout.imageCount
    // Cycle valid images to fill the exact count needed
    const cycled = Array.from({ length: count }, (_, i) => valid[i % valid.length])
    return assignImagesByResolution(cycled, layout.slotSizes)
}

// ─── async resolution refinement ─────────────────────────────────────────────
function LayoutWithResolution({ images, layout, className }) {
    const [sorted, setSorted] = useState(images)
    const prevImagesRef = useRef(images)

    useEffect(() => {
        if (prevImagesRef.current === images) return
        prevImagesRef.current = images

        const urls = [...new Set(images.filter(Boolean))]
        const allCached = urls.every(u => getImageResolution(u) !== null || getImageResolution(u) === null)

        // Only run async path if there are genuinely unprobed URLs
        const unprobed = urls.filter(u => {
            const r = getImageResolution(u)
            return r === undefined  // undefined = not yet in cache; null = failed probe
        })

        if (!unprobed.length) {
            // Everything already in cache  sort synchronously, no state update needed
            return
        }

        let cancelled = false
        probeImageResolutions(unprobed).then(() => {
            if (cancelled) return
            // Re-cycle and re-sort with fresh resolution data
            const valid = [...new Set(images.filter(Boolean))]
            const count = layout.imageCount
            const cycled = Array.from({ length: count }, (_, i) => valid[i % valid.length])
            setSorted(assignImagesByResolution(cycled, layout.slotSizes))
        })
        return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [images, layout])

    return layout({ images: sorted, className })
}

// ─── shared cell ─────────────────────────────────────────────────────────────
function Cell({ src, className = '' }) {
    return (
        <div className={`relative overflow-hidden ${className}`}>
            {src
                ? <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" draggable={false} />
                : <div className="absolute inset-0 bg-white/4" />
            }
        </div>
    )
}

// ─── layouts ──────────────────────────────────────────────────────────────────
// Each layout is a render function ({ images: string[], className: string }).
// Static props:
//   imageCount  exact number of cells (and images needed after cycling)
//   slotSizes   parallel 'large'|'medium'|'small' array for assignImagesByResolution

/** 1  Cinema: tall hero left, varied right column */
function LayoutCinema({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-[2fr_1fr_1fr] grid-rows-3 gap-0.5 ${className}`}>
            <Cell src={i[0]} className="row-span-3" />
            <Cell src={i[1]} />
            <Cell src={i[2]} />
            <Cell src={i[3]} className="col-span-2" />
            <Cell src={i[4]} />
            <Cell src={i[5]} />
        </div>
    )
}
LayoutCinema.imageCount = 6
LayoutCinema.slotSizes = ['large', 'small', 'small', 'medium', 'small', 'small']

/** 2  Quad: large top-left block + small grid */
function LayoutQuad({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-[2fr_1fr_1fr] grid-rows-[2fr_2fr_1fr] gap-0.5 ${className}`}>
            <Cell src={i[0]} className="row-span-2" />
            <Cell src={i[1]} />
            <Cell src={i[2]} />
            <Cell src={i[3]} />
            <Cell src={i[4]} />
            <Cell src={i[5]} />
            <Cell src={i[6]} />
            <Cell src={i[7]} />
        </div>
    )
}
LayoutQuad.imageCount = 8
LayoutQuad.slotSizes = ['large', 'small', 'small', 'small', 'small', 'small', 'small', 'small']

/** 3  Staircase: 2×2 hero + cascading smalls */
function LayoutStaircase({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-4 grid-rows-3 gap-0.5 ${className}`}>
            <Cell src={i[0]} className="col-span-2 row-span-2" />
            <Cell src={i[1]} />
            <Cell src={i[2]} />
            <Cell src={i[3]} className="col-span-2" />
            <Cell src={i[4]} />
            <Cell src={i[5]} />
            <Cell src={i[6]} />
            <Cell src={i[7]} />
        </div>
    )
}
LayoutStaircase.imageCount = 8
LayoutStaircase.slotSizes = ['large', 'small', 'small', 'medium', 'small', 'small', 'small', 'small']

/** 4  Diagonal: wide centre with narrow flanks */
function LayoutDiagonal({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-[1fr_2fr_1fr] grid-rows-3 gap-0.5 ${className}`}>
            <Cell src={i[0]} />
            <Cell src={i[1]} />
            <Cell src={i[2]} />
            <Cell src={i[3]} />
            <Cell src={i[4]} className="col-span-2" />
            <Cell src={i[5]} className="col-span-2" />
            <Cell src={i[6]} />
        </div>
    )
}
LayoutDiagonal.imageCount = 7
LayoutDiagonal.slotSizes = ['small', 'large', 'small', 'small', 'medium', 'medium', 'small']

/** 5  Panorama: thin top/bottom strips, giant centre */
function LayoutPanorama({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-4 grid-rows-[1fr_3fr_1fr] gap-0.5 ${className}`}>
            <Cell src={i[0]} />
            <Cell src={i[1]} />
            <Cell src={i[2]} />
            <Cell src={i[3]} />
            <Cell src={i[4]} className="col-span-3" />
            <Cell src={i[5]} />
            <Cell src={i[6]} />
            <Cell src={i[7]} />
            <Cell src={i[8]} />
            <Cell src={i[9]} />
        </div>
    )
}
LayoutPanorama.imageCount = 10
LayoutPanorama.slotSizes = ['small', 'small', 'small', 'small', 'large', 'medium', 'small', 'small', 'small', 'small']

/** 6  Triptych: two tall pillars, stacked centre */
function LayoutTriptych({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-3 grid-rows-3 gap-0.5 ${className}`}>
            <Cell src={i[0]} className="row-span-3" />
            <Cell src={i[1]} />
            <Cell src={i[2]} className="row-span-3" />
            <Cell src={i[3]} />
            <Cell src={i[4]} />
        </div>
    )
}
LayoutTriptych.imageCount = 5
LayoutTriptych.slotSizes = ['large', 'small', 'large', 'small', 'small']

/** 7  Cross-cut: wide band slicing through a 4-col grid */
function LayoutCrossCut({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-4 grid-rows-3 gap-0.5 ${className}`}>
            <Cell src={i[0]} />
            <Cell src={i[1]} />
            <Cell src={i[2]} />
            <Cell src={i[3]} />
            <Cell src={i[4]} className="col-span-2" />
            <Cell src={i[5]} />
            <Cell src={i[6]} />
            <Cell src={i[7]} />
            <Cell src={i[8]} />
            <Cell src={i[9]} />
            <Cell src={i[10]} />
        </div>
    )
}
LayoutCrossCut.imageCount = 11
LayoutCrossCut.slotSizes = ['small', 'small', 'small', 'small', 'medium', 'small', 'small', 'small', 'small', 'small', 'small']

/** 8  Left stack: wide feature left, varied right */
function LayoutLeftStack({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-[2fr_1fr_1fr_1fr] grid-rows-3 gap-0.5 ${className}`}>
            <Cell src={i[0]} className="row-span-2" />
            <Cell src={i[1]} />
            <Cell src={i[2]} />
            <Cell src={i[3]} />
            <Cell src={i[4]} />
            <Cell src={i[5]} />
            <Cell src={i[6]} />
            <Cell src={i[7]} className="col-span-2" />
            <Cell src={i[8]} />
        </div>
    )
}
LayoutLeftStack.imageCount = 9
LayoutLeftStack.slotSizes = ['large', 'small', 'small', 'small', 'small', 'small', 'small', 'medium', 'small']

/** 9  Mosaic: equal 3×3 */
function LayoutMosaic({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-3 grid-rows-3 gap-0.5 ${className}`}>
            {i.map((src, idx) => <Cell key={idx} src={src} />)}
        </div>
    )
}
LayoutMosaic.imageCount = 9
LayoutMosaic.slotSizes = ['medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium', 'medium']

/** 10  Centrepiece: small border ring, large 2×2 centre */
function LayoutCentrepiece({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-[1fr_2fr_2fr_1fr] grid-rows-[1fr_2fr_2fr_1fr] gap-0.5 ${className}`}>
            <Cell src={i[0]} />
            <Cell src={i[1]} />
            <Cell src={i[2]} />
            <Cell src={i[3]} />
            <Cell src={i[4]} />
            <Cell src={i[5]} className="col-span-2 row-span-2" />
            <Cell src={i[6]} />
            <Cell src={i[7]} />
            <Cell src={i[8]} />
            <Cell src={i[9]} />
            <Cell src={i[10]} />
            <Cell src={i[11]} />
        </div>
    )
}
LayoutCentrepiece.imageCount = 12
LayoutCentrepiece.slotSizes = ['small', 'small', 'small', 'small', 'small', 'large', 'small', 'small', 'small', 'small', 'small', 'small']

/** 11  Right tower: tall hero right, small grid left */
function LayoutRightTower({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-[1fr_1fr_2fr] grid-rows-3 gap-0.5 ${className}`}>
            <Cell src={i[0]} />
            <Cell src={i[1]} />
            <Cell src={i[2]} className="row-span-3" />
            <Cell src={i[3]} />
            <Cell src={i[4]} />
            <Cell src={i[5]} className="col-span-2" />
        </div>
    )
}
LayoutRightTower.imageCount = 6
LayoutRightTower.slotSizes = ['small', 'small', 'large', 'small', 'small', 'medium']

/** 12  Spotlight: one massive hero top, strip below */
function LayoutSpotlight({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-4 grid-rows-[3fr_1fr] gap-0.5 ${className}`}>
            <Cell src={i[0]} className="col-span-3" />
            <Cell src={i[1]} className="row-span-2" />
            <Cell src={i[2]} />
            <Cell src={i[3]} />
            <Cell src={i[4]} />
        </div>
    )
}
LayoutSpotlight.imageCount = 5
LayoutSpotlight.slotSizes = ['large', 'medium', 'small', 'small', 'small']

/** 13  Diptych: two equal halves, each split into 3 rows */
function LayoutDiptych({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-2 grid-rows-[2fr_1fr_1fr] gap-0.5 ${className}`}>
            <Cell src={i[0]} className="row-span-1" />
            <Cell src={i[1]} className="row-span-1" />
            <Cell src={i[2]} />
            <Cell src={i[3]} />
            <Cell src={i[4]} />
            <Cell src={i[5]} />
        </div>
    )
}
LayoutDiptych.imageCount = 6
LayoutDiptych.slotSizes = ['large', 'large', 'small', 'small', 'small', 'small']

/** 14  Crown: wide top banner, three equal columns below */
function LayoutCrown({ images: i, className }) {
    return (
        <div className={`absolute inset-0 grid grid-cols-3 grid-rows-[2fr_1fr_1fr] gap-0.5 ${className}`}>
            <Cell src={i[0]} className="col-span-3" />
            <Cell src={i[1]} />
            <Cell src={i[2]} />
            <Cell src={i[3]} />
            <Cell src={i[4]} />
            <Cell src={i[5]} />
            <Cell src={i[6]} />
        </div>
    )
}
LayoutCrown.imageCount = 7
LayoutCrown.slotSizes = ['large', 'small', 'small', 'small', 'small', 'small', 'small']

const LAYOUTS = [
    LayoutCinema,
    LayoutQuad,
    LayoutStaircase,
    LayoutDiagonal,
    LayoutPanorama,
    LayoutTriptych,
    LayoutCrossCut,
    LayoutLeftStack,
    LayoutMosaic,
    LayoutCentrepiece,
    LayoutRightTower,
    LayoutSpotlight,
    LayoutDiptych,
    LayoutCrown,
]
