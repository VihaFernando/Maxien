import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch } from '../../lib/lifesyncApi'

function flattenDeals(root) {
    if (!root) return []
    if (Array.isArray(root)) return root
    return root.Products || root.products || root.items || root.Items || root.value || []
}

function normalizeDeal(p) {
    if (p && typeof p === 'object' && typeof p.storeUrl === 'string' && typeof p.title === 'string') {
        return { key: String(p.id || p.title), title: p.title, imageUrl: p.imageUrl || null, href: p.storeUrl, subtitle: p.priceText || 'Xbox deal' }
    }
    const title = p?.LocalizedTitle?.[0]?.value || p?.LocalizedTitle || p?.ProductTitle || p?.title || p?.Title || p?.name || 'Deal'
    return { key: String(p?.ProductId || p?.productId || p?.id || title), title, imageUrl: null, href: `https://www.xbox.com/search?q=${encodeURIComponent(title)}`, subtitle: 'Microsoft Store' }
}

function DealCard({ title, imageUrl, href, subtitle }) {
    return (
        <a href={href} target="_blank" rel="noreferrer" className="group bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden hover:shadow-md transition-all">
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-[#f5f5f7]">
                {imageUrl ? (
                    <img src={imageUrl} alt="" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" loading="lazy" />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>
                    </div>
                )}
            </div>
            <div className="p-3">
                <p className="text-[13px] font-semibold text-[#1d1d1f] line-clamp-2">{title}</p>
                {subtitle && <p className="mt-0.5 text-[11px] text-[#86868b]">{subtitle}</p>}
            </div>
        </a>
    )
}

export default function LifeSyncXbox() {
    const { isLifeSyncConnected } = useLifeSync()
    const [deals, setDeals] = useState([])
    const [error, setError] = useState('')
    const [meta, setMeta] = useState(null)
    const [busy, setBusy] = useState(false)

    const load = useCallback(async () => {
        setBusy(true)
        setError('')
        try {
            const data = await lifesyncFetch('/api/xbox/deals')
            const raw = flattenDeals(data?.deals)
            setDeals(raw.map(normalizeDeal))
            setMeta({ locale: data?.locale, source: data?.source, totalProducts: data?.totalProducts })
        } catch (e) {
            setDeals([])
            setError(e.message || 'Could not load Xbox deals')
        } finally {
            setBusy(false)
        }
    }, [])

    useEffect(() => {
        if (isLifeSyncConnected) load()
    }, [isLifeSyncConnected, load])

    if (!isLifeSyncConnected) {
        return (
            <div className="max-w-4xl mx-auto">
                <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight mb-2">Xbox Deals</h1>
                <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm px-8 py-16 text-center">
                    <p className="text-[15px] font-bold text-[#1d1d1f] mb-2">LifeSync Not Connected</p>
                    <p className="text-[13px] text-[#86868b] mb-4">Connect LifeSync in your profile to access Xbox deals.</p>
                    <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 bg-[#1d1d1f] text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-black transition-colors">
                        Go to Integrations
                    </Link>
                </div>
            </div>
        )
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Games</p>
                    <h1 className="text-[28px] font-bold text-[#1d1d1f] tracking-tight">Xbox Deals</h1>
                    <p className="text-[13px] text-[#86868b] mt-1">Current deals from the Microsoft Store.</p>
                </div>
                <button onClick={load} disabled={busy} className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50 self-start">
                    {busy ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>
            )}

            {meta?.locale && (
                <p className="text-[11px] text-[#86868b]">
                    Store locale: <span className="font-semibold text-[#1d1d1f]">{meta.locale}</span>
                    {meta.totalProducts != null && <span> · {meta.totalProducts} products</span>}
                </p>
            )}

            {deals.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {deals.map(d => <DealCard key={d.key} {...d} />)}
                </div>
            ) : !busy && !error && (
                <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm px-6 py-10 text-center">
                    <p className="text-[13px] text-[#86868b]">No deals returned. The store layout may have changed.</p>
                </div>
            )}
        </div>
    )
}
