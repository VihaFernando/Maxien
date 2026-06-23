import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { FaBell, FaCheck, FaTimes, FaBookOpen, FaFilm, FaTag, FaGamepad } from 'react-icons/fa'
import { useNotifications } from '../../hooks/useNotifications'
import { getRelativeTime } from '../../lib/dateUtils'

const PANEL_WIDTH = 340
const VIEWPORT_MARGIN = 8

const DOMAIN_ICON = {
    manga: FaBookOpen,
    anime: FaFilm,
    wishlist: FaTag,
    game: FaGamepad,
}

// Map a notification to the in-app route it should open when clicked.
function notificationHref(n) {
    const data = n?.data || {}
    if (n?.domain === 'manga') {
        const source = data.source || ''
        const mangaId = data.mangaId || ''
        const chapterId = data.latestChapterId || ''
        if (mangaId && chapterId) return `/dashboard/lifesync/anime/manga/read/${encodeURIComponent(mangaId)}/${encodeURIComponent(chapterId)}`
        if (source) return '/dashboard/lifesync/anime/manga/library'
    }
    if (n?.domain === 'anime') {
        const animeId = data.animeId || ''
        const ep = data.latestEpisode || ''
        if (animeId && ep) return `/dashboard/lifesync/anime/anime/watch/${encodeURIComponent(animeId)}/${encodeURIComponent(ep)}`
        return '/dashboard/lifesync/anime/anime/library'
    }
    if (n?.domain === 'wishlist' || n?.domain === 'game') {
        if (n?.link && /^https?:\/\//.test(n.link)) return n.link
        return '/dashboard/lifesync/games/wishlist'
    }
    return null
}

export default function NotificationBell({ enabled = true }) {
    const navigate = useNavigate()
    const [open, setOpen] = useState(false)
    const [coords, setCoords] = useState({ top: 0, left: 0 })
    const btnRef = useRef(null)
    const panelRef = useRef(null)

    const { entries, unreadCount, loading, error, refresh, markRead, markAllRead, remove } = useNotifications({ enabled })

    // Position the (portaled, fixed) panel just under the bell, clamped to the viewport so
    // it never spills off-screen — needed because the bell lives in a narrow, clipped sidebar.
    const reposition = useCallback(() => {
        const btn = btnRef.current
        if (!btn) return
        const rect = btn.getBoundingClientRect()
        const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_MARGIN * 2)
        let left = rect.right - width // default: right-aligned to the bell
        // If that pushes off the left edge, left-align to the bell instead.
        if (left < VIEWPORT_MARGIN) left = rect.left
        left = Math.min(Math.max(VIEWPORT_MARGIN, left), window.innerWidth - width - VIEWPORT_MARGIN)
        const top = Math.min(rect.bottom + 8, window.innerHeight - VIEWPORT_MARGIN)
        setCoords({ top, left, width })
    }, [])

    useLayoutEffect(() => {
        if (!open) return undefined
        reposition()
        window.addEventListener('resize', reposition)
        window.addEventListener('scroll', reposition, true)
        return () => {
            window.removeEventListener('resize', reposition)
            window.removeEventListener('scroll', reposition, true)
        }
    }, [open, reposition])

    useEffect(() => {
        if (!open) return undefined
        const onClick = (e) => {
            if (btnRef.current?.contains(e.target)) return
            if (panelRef.current?.contains(e.target)) return
            setOpen(false)
        }
        const onKey = (e) => {
            if (e.key === 'Escape') setOpen(false)
        }
        document.addEventListener('mousedown', onClick)
        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('mousedown', onClick)
            document.removeEventListener('keydown', onKey)
        }
    }, [open])

    const toggle = () => {
        const next = !open
        setOpen(next)
        if (next) void refresh()
    }

    const handleOpenNotification = (n) => {
        if (!n?.readAt) void markRead(n._id)
        const href = notificationHref(n)
        setOpen(false)
        if (!href) return
        if (/^https?:\/\//.test(href)) {
            window.open(href, '_blank', 'noopener,noreferrer')
        } else {
            navigate(href)
        }
    }

    if (!enabled) return null

    return (
        <>
            <button
                ref={btnRef}
                type="button"
                onClick={toggle}
                aria-label="Notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-primary)]"
            >
                <FaBell className="h-4 w-4" />
                {unreadCount > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-[16px] text-white">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && createPortal(
                <div
                    ref={panelRef}
                    style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width || PANEL_WIDTH }}
                    className="z-[100] max-h-[80vh] overflow-hidden rounded-2xl border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] shadow-xl"
                >
                    <div className="flex items-center justify-between border-b border-[var(--mx-color-d2d2d7)] px-4 py-3">
                        <p className="text-[13px] font-bold text-[var(--color-text-primary)]">Notifications</p>
                        {unreadCount > 0 && (
                            <button
                                type="button"
                                onClick={() => markAllRead()}
                                className="text-[11px] font-semibold text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
                            >
                                Mark all read
                            </button>
                        )}
                    </div>

                    <div className="max-h-[60vh] overflow-y-auto hide-scrollbar">
                        {loading && entries.length === 0 ? (
                            <p className="px-4 py-8 text-center text-[12px] text-[var(--color-text-secondary)]">Loading…</p>
                        ) : error ? (
                            <p className="px-4 py-8 text-center text-[12px] text-red-500">{error}</p>
                        ) : entries.length === 0 ? (
                            <p className="px-4 py-10 text-center text-[12px] text-[var(--color-text-secondary)]">You're all caught up 🎉</p>
                        ) : (
                            entries.map((n) => {
                                const Icon = DOMAIN_ICON[n.domain] || FaBell
                                return (
                                    <div
                                        key={n._id}
                                        className={`group flex gap-3 border-b border-[var(--mx-color-d2d2d7)]/60 px-4 py-3 transition-colors hover:bg-[var(--mx-color-f5f5f7)] ${n.readAt ? '' : 'bg-[var(--mx-color-c6ff00)]/5'}`}
                                    >
                                        <button
                                            type="button"
                                            onClick={() => handleOpenNotification(n)}
                                            className="flex min-w-0 flex-1 items-start gap-3 text-left"
                                        >
                                            {n.imageUrl ? (
                                                <img src={n.imageUrl} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                                            ) : (
                                                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--mx-color-f5f5f7)] text-[var(--color-text-secondary)]">
                                                    <Icon className="h-4 w-4" />
                                                </span>
                                            )}
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate text-[12px] font-bold text-[var(--color-text-primary)]">{n.title}</span>
                                                {n.body && <span className="mt-0.5 block truncate text-[11px] text-[var(--color-text-secondary)]">{n.body}</span>}
                                                <span className="mt-1 block text-[10px] font-medium text-[var(--color-text-secondary)]">{getRelativeTime(n.createdAt)}</span>
                                            </span>
                                        </button>
                                        <div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                            {!n.readAt && (
                                                <button
                                                    type="button"
                                                    aria-label="Mark read"
                                                    onClick={() => markRead(n._id)}
                                                    className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-green-600"
                                                >
                                                    <FaCheck className="h-3 w-3" />
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                aria-label="Dismiss"
                                                onClick={() => remove(n._id)}
                                                className="flex h-6 w-6 items-center justify-center rounded-md text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] hover:text-red-500"
                                            >
                                                <FaTimes className="h-3 w-3" />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setOpen(false)
                            navigate('/dashboard/feed')
                        }}
                        className="block w-full border-t border-[var(--mx-color-d2d2d7)] px-4 py-3 text-center text-[12px] font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--mx-color-f5f5f7)]"
                    >
                        View activity feed
                    </button>
                </div>,
                document.body,
            )}
        </>
    )
}
