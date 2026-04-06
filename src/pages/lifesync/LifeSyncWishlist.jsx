import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { LifesyncEpisodeThumbnail, LifesyncWishlistListSkeleton } from '../../components/lifesync/EpisodeLoadingSkeletons'
import { useLifeSync } from '../../context/LifeSyncContext'
import { lifesyncFetch } from '../../lib/lifesyncApi'
import { LifeSyncHubPageShell } from '../../components/lifesync/LifeSyncHubPageShell'
import { lifeSyncStaggerContainer, lifeSyncStaggerItem, MotionDiv } from '../../lib/lifesyncMotion'

function steamHeader(appId) {
    if (!appId) return null
    return `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/header.jpg`
}

function parseSteamAppId(w) {
    if (w.steamAppId != null) return Number(w.steamAppId)
    const ref = w.externalRef != null ? String(w.externalRef).trim() : ''
    if (/^\d+$/.test(ref)) return Number(ref)
    const m = typeof w.storeUrl === 'string' ? w.storeUrl.match(/\/app\/(\d+)/i) : null
    return m ? Number(m[1]) : null
}

function WishlistCard({ item, onRemove }) {
    const steamId = item.platform === 'steam' ? parseSteamAppId(item) : null
    const img = item.live?.ok && item.live.headerImage ? item.live.headerImage : item.platform === 'steam' ? steamHeader(steamId) : null
    const live = item.live
    const price = live?.ok && live.price ? live.price : null
    const discount = price?.discountPercent > 0 ? price.discountPercent : 0
    const href = item.storeUrl?.trim() || (steamId ? `https://store.steampowered.com/app/${steamId}/` : '#')

    return (
        <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden flex flex-col sm:flex-row">
            <div className="relative aspect-video w-full flex-shrink-0 overflow-hidden bg-[#f5f5f7] sm:aspect-auto sm:min-h-[120px] sm:w-[200px]">
                {discount > 0 && (
                    <span className="absolute right-2 top-2 z-[3] bg-[#C6FF00] text-[#1d1d1f] text-[11px] font-bold px-2 py-0.5 rounded-lg">−{discount}%</span>
                )}
                {img ? (
                    <LifesyncEpisodeThumbnail
                        src={img}
                        className="absolute inset-0 h-full w-full"
                        imgClassName="h-full w-full object-cover"
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-[#86868b]">
                        <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>
                    </div>
                )}
            </div>
            <div className="flex-1 p-4 flex flex-col justify-center gap-1.5">
                <div className="flex items-start justify-between gap-2">
                    <div>
                        <a href={href} target="_blank" rel="noreferrer" className="text-[14px] font-semibold text-[#1d1d1f] hover:text-[#C6FF00] transition-colors">{item.title}</a>
                        <p className="text-[11px] text-[#86868b] mt-0.5">
                            <span className="capitalize">{item.platform}</span>
                            {item.source && <span> · {item.source.replace(/_/g, ' ')}</span>}
                        </p>
                    </div>
                    <button onClick={() => onRemove(item._id)} className="shrink-0 p-2 text-[#86868b] hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" aria-label="Remove">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" /></svg>
                    </button>
                </div>
                {price && (
                    <div className="flex items-center gap-2 mt-1">
                        {price.initial !== price.final && <span className="text-[12px] text-[#86868b] line-through">{price.currency} {(price.initial / 100).toFixed(2)}</span>}
                        <span className="text-[13px] font-bold text-[#1d1d1f]">{price.currency} {(price.final / 100).toFixed(2)}</span>
                    </div>
                )}
                {item.targetPrice != null && (
                    <p className="text-[11px] text-[#86868b]">Target: {item.currency} {Number(item.targetPrice).toFixed(2)}</p>
                )}
            </div>
        </div>
    )
}

export default function LifeSyncWishlist() {
    const { isLifeSyncConnected } = useLifeSync()
    const [items, setItems] = useState([])
    const [error, setError] = useState('')
    const [busy, setBusy] = useState(false)
    const [filter, setFilter] = useState('')

    const [addForm, setAddForm] = useState({ platform: 'steam', title: '', steamAppId: '', storeUrl: '', targetPrice: '' })
    const [addBusy, setAddBusy] = useState(false)
    const [importBusy, setImportBusy] = useState(false)
    const [importMsg, setImportMsg] = useState('')
    const [steamStatus, setSteamStatus] = useState(null)

    const load = useCallback(async () => {
        setBusy(true)
        setError('')
        try {
            const data = await lifesyncFetch('/api/wishlist')
            setItems(Array.isArray(data) ? data : data?.items || [])
        } catch (e) {
            setError(e.message || 'Failed to load wishlist')
        } finally {
            setBusy(false)
        }
    }, [])

    useEffect(() => {
        if (isLifeSyncConnected) load()
    }, [isLifeSyncConnected, load])

    useEffect(() => {
        if (!isLifeSyncConnected) return
        let cancelled = false
        lifesyncFetch('/api/steam/status')
            .then((data) => { if (!cancelled) setSteamStatus(data || null) })
            .catch(() => { if (!cancelled) setSteamStatus(null) })
        return () => { cancelled = true }
    }, [isLifeSyncConnected])

    async function removeItem(id) {
        try {
            await lifesyncFetch(`/api/wishlist/${id}`, { method: 'DELETE' })
            setItems(prev => prev.filter(i => i._id !== id))
        } catch (e) {
            setError(e.message || 'Failed to remove item')
        }
    }

    async function addItem(e) {
        e.preventDefault()
        setAddBusy(true)
        try {
            const body = { platform: addForm.platform, title: addForm.title }
            if (addForm.steamAppId) body.steamAppId = addForm.steamAppId
            if (addForm.storeUrl) body.storeUrl = addForm.storeUrl
            if (addForm.targetPrice) body.targetPrice = Number(addForm.targetPrice)
            await lifesyncFetch('/api/wishlist', { method: 'POST', json: body })
            setAddForm({ platform: 'steam', title: '', steamAppId: '', storeUrl: '', targetPrice: '' })
            await load()
        } catch (e) {
            setError(e.message || 'Failed to add item')
        } finally {
            setAddBusy(false)
        }
    }

    async function importSteam() {
        setImportBusy(true)
        setImportMsg('')
        try {
            const data = await lifesyncFetch('/api/wishlist/import/steam', { method: 'POST' })
            setImportMsg(`Imported ${data.imported || 0}, skipped ${data.skipped || 0}`)
            await load()
        } catch (e) {
            setImportMsg(e.message || 'Import failed')
        } finally {
            setImportBusy(false)
        }
    }

    const filtered = useMemo(() => {
        const q = filter.trim().toLowerCase()
        return q ? items.filter(i => i.title?.toLowerCase().includes(q)) : items
    }, [items, filter])

    if (!isLifeSyncConnected) {
        return (
            <LifeSyncHubPageShell>
                <div className="max-w-4xl mx-auto">
                    <h1 className="text-[28px] font-bold text-[#1a1628] tracking-tight mb-2">Wishlist</h1>
                    <div className="rounded-[22px] border border-white/90 bg-white/90 px-8 py-16 text-center shadow-sm ring-1 ring-[#e8e4ef]/70">
                        <p className="text-[15px] font-bold text-[#1a1628] mb-2">LifeSync Not Connected</p>
                        <p className="text-[13px] text-[#5b5670] mb-4">Connect LifeSync in your profile to access your wishlist.</p>
                        <Link to="/dashboard/profile?tab=integrations" className="inline-flex items-center gap-2 rounded-xl bg-[#C6FF00] px-5 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95">
                            Go to Integrations
                        </Link>
                    </div>
                </div>
            </LifeSyncHubPageShell>
        )
    }

    return (
        <LifeSyncHubPageShell>
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest">LifeSync / Games</p>
                    <h1 className="text-[28px] font-bold text-[#1a1628] tracking-tight">Wishlist</h1>
                    <p className="text-[13px] text-[#86868b] mt-1">Track game prices and get notified when they drop.</p>
                </div>
                <button onClick={load} disabled={busy} className="text-[12px] font-semibold text-[#1d1d1f] bg-[#f5f5f7] hover:bg-[#ebebed] px-3 py-2 rounded-xl border border-[#e5e5ea] transition-colors disabled:opacity-50 self-start">
                    {busy ? 'Loading...' : 'Refresh'}
                </button>
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100">{error}</div>
            )}

            <div className="bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm p-5 space-y-4">
                <h3 className="text-[13px] font-bold text-[#1d1d1f]">Add to Wishlist</h3>
                <form onSubmit={addItem} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <select value={addForm.platform} onChange={e => setAddForm(f => ({ ...f, platform: e.target.value }))} className="px-3 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#C6FF00]/60">
                        <option value="steam">Steam</option>
                        <option value="xbox">Xbox</option>
                    </select>
                    <input type="text" required placeholder="Game title" value={addForm.title} onChange={e => setAddForm(f => ({ ...f, title: e.target.value }))} className="px-3 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#C6FF00]/60" />
                    <input type="text" placeholder="Steam App ID (optional)" value={addForm.steamAppId} onChange={e => setAddForm(f => ({ ...f, steamAppId: e.target.value }))} className="px-3 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#C6FF00]/60" />
                    <input type="text" placeholder="Store URL (optional)" value={addForm.storeUrl} onChange={e => setAddForm(f => ({ ...f, storeUrl: e.target.value }))} className="px-3 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#C6FF00]/60" />
                    <input type="number" step="0.01" placeholder="Target price (optional)" value={addForm.targetPrice} onChange={e => setAddForm(f => ({ ...f, targetPrice: e.target.value }))} className="px-3 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none focus:border-[#C6FF00]/60" />
                    <button type="submit" disabled={addBusy} className="rounded-xl bg-[#C6FF00] px-4 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95 disabled:opacity-50">
                        {addBusy ? 'Adding...' : 'Add'}
                    </button>
                </form>

                <div className="border-t border-[#f0f0f0] pt-4">
                    <h3 className="text-[13px] font-bold text-[#1d1d1f] mb-2">Import from Steam</h3>
                    {steamStatus?.steamLinked ? (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[12px] text-[#1d1d1f] font-semibold">
                                    Connected{steamStatus?.profile?.personaName ? ` as ${steamStatus.profile.personaName}` : ''}
                                </p>
                                <p className="text-[11px] text-[#86868b]">
                                    We'll fetch your wishlist from{' '}
                                    <span className="font-mono">
                                        {steamStatus?.profile?.steamId ? `profiles/${steamStatus.profile.steamId}` : 'your linked Steam profile'}
                                    </span>
                                    .
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={importSteam}
                                disabled={importBusy}
                                className="self-start whitespace-nowrap rounded-xl bg-[#C6FF00] px-4 py-2.5 text-[13px] font-semibold text-[#1a1628] shadow-sm ring-1 ring-[#1a1628]/10 transition-all hover:brightness-95 disabled:opacity-50"
                            >
                                {importBusy ? 'Syncing...' : 'Sync Steam wishlist'}
                            </button>
                        </div>
                    ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <p className="text-[12px] text-[#86868b]">
                                Link your Steam account to auto-import your wishlist.
                            </p>
                            <Link
                                to="/dashboard/profile?tab=integrations"
                                className="inline-flex items-center justify-center bg-[#f5f5f7] hover:bg-[#ebebed] text-[#1d1d1f] text-[12px] font-semibold px-4 py-2.5 rounded-xl border border-[#e5e5ea] transition-colors self-start whitespace-nowrap"
                            >
                                Go to Integrations
                            </Link>
                        </div>
                    )}
                    {importMsg && <p className="text-[12px] text-[#86868b] mt-2">{importMsg}</p>}
                </div>
            </div>

            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <h3 className="text-[15px] font-bold text-[#1d1d1f]">Your Wishlist {filtered.length > 0 && <span className="text-[13px] font-medium text-[#86868b]">({filtered.length})</span>}</h3>
                    <input type="search" value={filter} onChange={e => setFilter(e.target.value)} placeholder="Filter..." className="w-full sm:max-w-xs px-4 py-2.5 bg-[#f5f5f7] border border-[#e5e5ea] focus:border-[#C6FF00]/60 focus:bg-white rounded-xl text-[13px] text-[#1d1d1f] focus:outline-none transition-all" />
                </div>
                {filtered.length > 0 ? (
                    <MotionDiv
                        className="space-y-3"
                        variants={lifeSyncStaggerContainer}
                        initial="hidden"
                        animate="show"
                    >
                        {filtered.map((item) => (
                            <MotionDiv key={item._id} variants={lifeSyncStaggerItem}>
                                <WishlistCard item={item} onRemove={removeItem} />
                            </MotionDiv>
                        ))}
                    </MotionDiv>
                ) : busy && items.length === 0 ? (
                    <LifesyncWishlistListSkeleton />
                ) : !busy && (
                    <div className="bg-white rounded-[18px] border border-[#d2d2d7]/50 shadow-sm px-6 py-10 text-center">
                        <p className="text-[13px] text-[#86868b]">{filter.trim() ? 'No items match your filter.' : 'Your wishlist is empty. Add games above.'}</p>
                    </div>
                )}
            </div>
        </div>
        </LifeSyncHubPageShell>
    )
}
