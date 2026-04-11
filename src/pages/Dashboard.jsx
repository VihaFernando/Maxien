import { useCallback, useEffect, useMemo, useState } from "react"
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { useLifeSync } from "../context/LifeSyncContext"
import { getLifesyncToken, isLifeSyncAnimeNavVisible } from "../lib/lifesyncApi"
import { isLifeSyncAdmin } from "../lib/lifeSyncRoles"
import { listMyWorkplaces, getWorkplacesByIds } from "../lib/workplaces"
import {
    FaHome,
    FaWallet,
    FaCheckSquare,
    FaCalendarAlt,
    FaFolder,
    FaBrain,
    FaUsers,
    FaStickyNote,
    FaGithub,
    FaGamepad,
    FaFilm,
    FaUserShield,
} from "react-icons/fa"
import AIShortcutHint from "../components/AIShortcutHint"

const openAIChat = () => window.dispatchEvent(new CustomEvent("maxien:open-ai-chat"))
const openSpotlight = () => window.dispatchEvent(new CustomEvent("maxien:open-command-palette"))

const NAV_BASE = "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
const NAV_ACTIVE = "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
const NAV_IDLE = "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"

function SidebarLink({ to, icon: Icon, label, active, onClick }) {
    const iconNode = typeof Icon === "function" ? Icon({ className: "w-4 h-4" }) : null
    return (
        <Link to={to} onClick={onClick} className={`${NAV_BASE} ${active ? NAV_ACTIVE : NAV_IDLE}`}>
            {iconNode}
            {label}
        </Link>
    )
}

function WorkplaceTabLink({ to, label, active, onClick }) {
    return (
        <Link
            to={to}
            onClick={onClick}
            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${active ? NAV_ACTIVE : NAV_IDLE
                }`}
        >
            <FaUsers className="w-4 h-4" />
            {label}
        </Link>
    )
}

export default function Dashboard() {
    const { user, loading, signOut } = useAuth()
    const {
        lifeSyncLogout,
        isLifeSyncConnected,
        lifeSyncLoading,
        lifeSyncUser,
        lifeSyncBroadcast,
        dismissLifeSyncBroadcast,
    } = useLifeSync()
    const navigate = useNavigate()
    const location = useLocation()
    const openLifeSyncSettings = useCallback(() => {
        navigate("/dashboard/profile?tab=integrations")
    }, [navigate])

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [workspaceMode, setWorkspaceMode] = useState("personal")
    const [workplaces, setWorkplaces] = useState([])
    const [selectedWorkplaceId, setSelectedWorkplaceId] = useState("")
    const [lifeSyncNotice, setLifeSyncNotice] = useState(() => {
        try {
            const msg = sessionStorage.getItem("maxien_lifesync_link_notice")
            if (msg) {
                sessionStorage.removeItem("maxien_lifesync_link_notice")
                return msg
            }
        } catch {
            /* ignore */
        }
        return ""
    })

    const lifeSyncGamesActive = location.pathname.startsWith("/dashboard/lifesync/games")
    const lifeSyncAnimeActive = location.pathname.startsWith("/dashboard/lifesync/anime")
    const isLifeSyncRoute = location.pathname.startsWith("/dashboard/lifesync")
    const showLifeSyncSidebar = isLifeSyncConnected || (lifeSyncLoading && Boolean(getLifesyncToken()))
    const showLifeSyncAnimeLink = isLifeSyncAnimeNavVisible(lifeSyncUser?.preferences)

    const isProfileRoute = location.pathname === "/dashboard/profile"

    /** Profile/Settings needs a flex column + min-h-0 so nested scroll works; other dashboard pages keep the original outlet box so padding/layout stay unchanged. */
    const contentWrapClass = useMemo(
        () => {
            const padded = isLifeSyncRoute ? "" : "px-4 sm:px-8 lg:px-10 py-6 sm:py-8"
            const base = isProfileRoute ? "flex w-full min-h-0 flex-1 flex-col " : "w-full flex-1 "
            return `${base}${padded}`
        },
        [isLifeSyncRoute, isProfileRoute],
    )

    const workplaceId = location.pathname.match(/\/workplaces\/([^/?]+)/)?.[1] || ""
    const currentTab = new URLSearchParams(location.search).get("tab") || "profile"
    /** URL is source of truth on `/workplaces/:id`; avoid effect-driven setState sync. */
    // `workplaceId` can come from route params; fall back to last selection.
    // Kept inline where needed to avoid unused-var lint failures.
    const isWorkplaceMode = Boolean(workplaceId) || workspaceMode === "workplace"

    useEffect(() => {
        if (!loading && !user) navigate("/login")
    }, [user, loading, navigate])

    useEffect(() => {
        const loadWorkplaces = async () => {
            if (!user?.id) {
                setWorkplaces([])
                setSelectedWorkplaceId("")
                return
            }

            try {
                const memberships = await listMyWorkplaces(user.id)
                const acceptedIds = Array.from(
                    new Set(
                        memberships
                            .filter((row) => row.status === "accepted")
                            .map((row) => row.workplace_id)
                            .filter(Boolean),
                    ),
                )

                if (!acceptedIds.length) {
                    setWorkplaces([])
                    setSelectedWorkplaceId("")
                    return
                }

                const workplaceRows = await getWorkplacesByIds(acceptedIds)
                setWorkplaces(workplaceRows)
                setSelectedWorkplaceId((prev) => {
                    if (prev && workplaceRows.some((item) => item.id === prev)) return prev
                    return workplaceRows[0]?.id || ""
                })
            } catch {
                setWorkplaces([])
                setSelectedWorkplaceId("")
            }
        }

        loadWorkplaces()
    }, [user?.id])

    useEffect(() => {
        const t = setTimeout(() => setSidebarOpen(false), 0)
        return () => clearTimeout(t)
    }, [location])

    const profileName = user?.user_metadata?.display_name
        || user?.user_metadata?.full_name
        || user?.user_metadata?.name
        || user?.email?.split("@")[0]
        || "User"

    const initials = profileName
        ? profileName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
        : user?.email?.[0]?.toUpperCase() || "U"

    /** From LifeSync `/me` roles; also shown in Workplace sidebar (Admin was previously personal-only). */
    const showLifeSyncAdminLink = useMemo(() => isLifeSyncAdmin(lifeSyncUser), [lifeSyncUser])

    const personalLinks = useMemo(() => {
        const base = [
            { to: "/dashboard", icon: FaHome, label: "Overview" },
            { to: "/dashboard/github", icon: FaGithub, label: "GitHub" },
            { to: "/dashboard/subscriptions", icon: FaWallet, label: "Subscriptions" },
            { to: "/dashboard/tasks", icon: FaCheckSquare, label: "Tasks" },
            { to: "/dashboard/projects", icon: FaFolder, label: "Projects" },
            { to: "/dashboard/calendar", icon: FaCalendarAlt, label: "Calendar" },
            { to: "/dashboard/notes", icon: FaStickyNote, label: "Notes" },
            { to: "/dashboard/ai-assistant", icon: FaBrain, label: "AI Assistant" },
        ]
        if (showLifeSyncAdminLink) {
            base.push({ to: "/dashboard/admin", icon: FaUserShield, label: "Admin" })
        }
        return base
    }, [showLifeSyncAdminLink])

    const selectedWorkplace = workplaces.find((item) => item.id === selectedWorkplaceId) || null

    const handleWorkspaceModeChange = (mode) => {
        setWorkspaceMode(mode)

        if (mode === "personal") {
            if (workplaceId) navigate("/dashboard")
            return
        }

        const targetId = selectedWorkplaceId || workplaces[0]?.id
        if (!targetId) {
            navigate("/dashboard/workplaces")
            return
        }

        setSelectedWorkplaceId(targetId)
        navigate(`/dashboard/workplaces/${targetId}?tab=profile`)
    }

    const handleWorkplaceSelection = (nextWorkplaceId) => {
        setSelectedWorkplaceId(nextWorkplaceId)
        if (workspaceMode === "workplace" && nextWorkplaceId) {
            navigate(`/dashboard/workplaces/${nextWorkplaceId}?tab=profile`)
        }
    }

    const handleSignOut = async () => {
        lifeSyncLogout()
        await signOut()
        navigate("/login")
    }

    const handleOpenProfile = () => {
        navigate("/dashboard/profile")
        setSidebarOpen(false)
    }

    const isActive = (path) => location.pathname === path

    const renderWorkspaceSwitcher = () => (
        <div className="mb-4 rounded-2xl border border-[#e5e5ea] bg-[#fafafc] p-3">
            <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest mb-2">Workspace</p>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-white p-1 border border-[#ececf1]">
                <button
                    type="button"
                    onClick={() => handleWorkspaceModeChange("personal")}
                    className={`px-2.5 py-2 text-[12px] font-semibold rounded-lg transition-colors ${!isWorkplaceMode ? "bg-[#C6FF00] text-[#1d1d1f]" : "text-[#86868b] hover:bg-[#f5f5f7]"
                        }`}
                >
                    Personal
                </button>
                <button
                    type="button"
                    onClick={() => handleWorkspaceModeChange("workplace")}
                    className={`px-2.5 py-2 text-[12px] font-semibold rounded-lg transition-colors ${isWorkplaceMode ? "bg-[#C6FF00] text-[#1d1d1f]" : "text-[#86868b] hover:bg-[#f5f5f7]"
                        }`}
                >
                    Workplace
                </button>
            </div>

            {isWorkplaceMode && (
                <div className="mt-2.5 space-y-2">
                    <select
                        value={selectedWorkplaceId}
                        onChange={(e) => handleWorkplaceSelection(e.target.value)}
                        className="w-full bg-white border border-[#e5e5ea] rounded-xl px-3 py-2 text-[12px] font-semibold text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-[#C6FF00]/50"
                    >
                        {!workplaces.length && <option value="">No workplace yet</option>}
                        {workplaces.map((workplace) => (
                            <option key={workplace.id} value={workplace.id}>{workplace.name}</option>
                        ))}
                    </select>
                    <Link
                        to="/dashboard/workplaces"
                        className="text-[11px] font-semibold text-[#5f6368] hover:text-[#1d1d1f]"
                    >
                        Manage workplaces
                    </Link>
                </div>
            )}
        </div>
    )

    const renderPlatformNav = (onItemClick = undefined) => {
        if (isWorkplaceMode) {
            const id = selectedWorkplaceId || workplaceId

            return (
                <nav className="space-y-0.5">
                    <WorkplaceTabLink
                        to={id ? `/dashboard/workplaces/${id}?tab=profile` : "/dashboard/workplaces"}
                        label={selectedWorkplace?.name || "Workplace Home"}
                        active={currentTab === "profile" && Boolean(workplaceId)}
                        onClick={onItemClick}
                    />
                    <WorkplaceTabLink
                        to={id ? `/dashboard/workplaces/${id}?tab=analytics` : "/dashboard/workplaces"}
                        label="Analytics"
                        active={currentTab === "analytics"}
                        onClick={onItemClick}
                    />
                    <WorkplaceTabLink
                        to={id ? `/dashboard/workplaces/${id}?tab=departments` : "/dashboard/workplaces"}
                        label="Departments"
                        active={currentTab === "departments"}
                        onClick={onItemClick}
                    />
                    <WorkplaceTabLink
                        to={id ? `/dashboard/workplaces/${id}?tab=projects` : "/dashboard/workplaces"}
                        label="Projects"
                        active={currentTab === "projects"}
                        onClick={onItemClick}
                    />
                    <WorkplaceTabLink
                        to={id ? `/dashboard/workplaces/${id}?tab=tasks` : "/dashboard/workplaces"}
                        label="Tasks"
                        active={currentTab === "tasks"}
                        onClick={onItemClick}
                    />
                    <WorkplaceTabLink
                        to={id ? `/dashboard/workplaces/${id}?tab=users` : "/dashboard/workplaces"}
                        label="Members"
                        active={currentTab === "users"}
                        onClick={onItemClick}
                    />
                    <WorkplaceTabLink
                        to={id ? `/dashboard/workplaces/${id}?tab=roles` : "/dashboard/workplaces"}
                        label="Roles"
                        active={currentTab === "roles"}
                        onClick={onItemClick}
                    />
                    {showLifeSyncAdminLink ? (
                        <>
                            <div className="my-2 border-t border-[#e5e5ea] pt-2" aria-hidden />
                            <SidebarLink
                                to="/dashboard/admin"
                                icon={FaUserShield}
                                label="Admin"
                                active={isActive("/dashboard/admin")}
                                onClick={onItemClick}
                            />
                        </>
                    ) : null}
                </nav>
            )
        }

        return (
            <nav className="space-y-0.5">
                {personalLinks.map((item) => (
                    <SidebarLink
                        key={item.to}
                        to={item.to}
                        icon={item.icon}
                        label={item.label}
                        active={isActive(item.to)}
                        onClick={onItemClick}
                    />
                ))}
            </nav>
        )
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#C6FF00] border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex font-sans">
            <aside className="w-[240px] hidden lg:flex flex-col bg-white border-r border-[#e5e5ea] sticky top-0 h-screen">
                <div className="px-5 py-6 overflow-y-auto hide-scrollbar">
                    <div className="flex items-center gap-2.5 mb-5">
                        <div className="w-8 h-8 flex-shrink-0">
                            <img src="/logo.svg" alt="Maxien logo" className="w-full h-full" />
                        </div>
                        <span className="text-[#1d1d1f] font-bold text-[16px] tracking-tight">Maxien</span>
                    </div>

                    {renderWorkspaceSwitcher()}

                    <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest mb-2 px-2">
                        {isWorkplaceMode ? "Workplace" : "Platform"}
                    </p>
                    {renderPlatformNav()}

                    {!isWorkplaceMode && showLifeSyncSidebar && (
                        <div className="mt-3">
                            <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest mb-2 px-2">LifeSync</p>
                            <nav className="space-y-0.5">
                                <SidebarLink to="/dashboard/lifesync/games" icon={FaGamepad} label="Games" active={lifeSyncGamesActive} />
                                {showLifeSyncAnimeLink && (
                                    <SidebarLink to="/dashboard/lifesync/anime" icon={FaFilm} label="Anime" active={lifeSyncAnimeActive} />
                                )}
                            </nav>
                        </div>
                    )}
                </div>

                <div className="mt-auto px-5 pb-5">
                    <AIShortcutHint onOpen={openAIChat} onOpenSpotlight={openSpotlight} onOpenLifeSync={openLifeSyncSettings} />
                    <div className="bg-[#f5f5f7] rounded-2xl p-4">
                        <button
                            type="button"
                            onClick={handleOpenProfile}
                            className="mb-3 flex w-full items-center gap-3 rounded-xl p-1 text-left transition-colors hover:bg-white/70"
                        >
                            {user?.user_metadata?.picture ? (
                                <img src={user.user_metadata.picture} alt="Avatar" className="w-9 h-9 rounded-full object-cover ring-1 ring-black/5" />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#1d1d1f] font-bold text-sm ring-1 ring-black/5">
                                    {initials}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-[12px] font-bold text-[#1d1d1f] truncate">{profileName}</p>
                                <p className="text-[10px] font-medium text-[#86868b] truncate">{user?.email}</p>
                            </div>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleSignOut() }}
                            className="w-full bg-white hover:bg-red-50 text-red-500 font-semibold py-2 rounded-lg text-[12px] transition-all border border-[#d2d2d7] active:scale-[0.98]"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/30 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            <aside className={`fixed left-0 top-0 h-full w-[240px] bg-white border-r border-[#e5e5ea] z-40 lg:hidden transform transition-transform duration-300 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="px-5 py-6 h-full flex flex-col overflow-y-auto hide-scrollbar">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8">
                                <img src="/logo.svg" alt="Maxien logo" className="w-full h-full" />
                            </div>
                            <span className="text-[#1d1d1f] font-bold text-[16px] tracking-tight">Maxien</span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-1.5 hover:bg-[#f5f5f7] rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {renderWorkspaceSwitcher()}

                    <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest mb-2 px-2">
                        {isWorkplaceMode ? "Workplace" : "Platform"}
                    </p>
                    <div className="flex-1">{renderPlatformNav(() => setSidebarOpen(false))}</div>

                    {!isWorkplaceMode && showLifeSyncSidebar && (
                        <div className="mt-3">
                            <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest mb-2 px-2">LifeSync</p>
                            <nav className="space-y-0.5">
                                <SidebarLink
                                    to="/dashboard/lifesync/games"
                                    icon={FaGamepad}
                                    label="Games"
                                    active={lifeSyncGamesActive}
                                    onClick={() => setSidebarOpen(false)}
                                />
                                {showLifeSyncAnimeLink && (
                                    <SidebarLink
                                        to="/dashboard/lifesync/anime"
                                        icon={FaFilm}
                                        label="Anime"
                                        active={lifeSyncAnimeActive}
                                        onClick={() => setSidebarOpen(false)}
                                    />
                                )}
                            </nav>
                        </div>
                    )}

                    <div className="mt-auto pt-5 border-t border-[#e5e5ea]">
                        <AIShortcutHint onOpen={openAIChat} onOpenSpotlight={openSpotlight} onOpenLifeSync={openLifeSyncSettings} />
                        <div className="bg-[#f5f5f7] rounded-2xl p-4">
                            <button
                                type="button"
                                onClick={handleOpenProfile}
                                className="mb-3 flex w-full items-center gap-3 rounded-xl p-1 text-left transition-colors hover:bg-white/70"
                            >
                                {user?.user_metadata?.picture ? (
                                    <img src={user.user_metadata.picture} alt="Avatar" className="w-9 h-9 rounded-full object-cover ring-1 ring-black/5" />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#1d1d1f] font-bold text-sm ring-1 ring-black/5">
                                        {initials}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-[12px] font-bold text-[#1d1d1f] truncate">{profileName}</p>
                                    <p className="text-[10px] font-medium text-[#86868b] truncate">{user?.email}</p>
                                </div>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleSignOut() }}
                                className="w-full bg-white hover:bg-red-50 text-red-500 font-semibold py-2 rounded-lg text-[12px] transition-all border border-[#d2d2d7] active:scale-[0.98]"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            <main className="flex-1 flex flex-col h-screen overflow-y-auto hide-scrollbar">
                <header className="lg:hidden bg-white/90 backdrop-blur-md border-b border-[#d2d2d7] px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 flex-shrink-0">
                            <img src="/logo.svg" alt="Maxien" className="w-full h-full" />
                        </div>
                        <span className="text-[#1d1d1f] font-bold text-[15px] tracking-tight">Maxien</span>
                    </div>
                    <button onClick={() => setSidebarOpen(true)} className="p-2 hover:bg-[#f5f5f7] rounded-xl transition-colors">
                        {user?.user_metadata?.picture ? (
                            <img src={user.user_metadata.picture} alt="Avatar" className="w-8 h-8 rounded-full object-cover ring-1 ring-black/5" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#1d1d1f] font-bold text-xs ring-1 ring-black/5">
                                {initials}
                            </div>
                        )}
                    </button>
                </header>

                <div className={contentWrapClass}>
                    {lifeSyncNotice && (
                        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-medium text-amber-950 flex items-start gap-3">
                            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 10-2 0v2a1 1 0 102 0v-2zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <span className="flex-1">{lifeSyncNotice}</span>
                            <button
                                type="button"
                                onClick={() => setLifeSyncNotice("")}
                                className="shrink-0 text-amber-800/80 hover:text-amber-950 font-semibold"
                            >
                                Dismiss
                            </button>
                        </div>
                    )}
                    {lifeSyncBroadcast?.message ? (
                        <div className="mb-4 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-[12px] font-medium text-sky-950 flex items-start gap-3">
                            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                                <path d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 10-2 0v3a1 1 0 002 0V6zm-1 8a1 1 0 100-2 1 1 0 000 2z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800/90">LifeSync message</p>
                                <p className="mt-1 whitespace-pre-wrap break-words">{lifeSyncBroadcast.message}</p>
                            </div>
                            <button
                                type="button"
                                onClick={dismissLifeSyncBroadcast}
                                className="shrink-0 text-sky-800/80 hover:text-sky-950 font-semibold"
                            >
                                Dismiss
                            </button>
                        </div>
                    ) : null}
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
