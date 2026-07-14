import { useEffect, useMemo, useState } from "react"
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
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
    FaDumbbell,
    FaGithub,
    FaChartPie,
} from "react-icons/fa"
import AIShortcutHint from "../components/AIShortcutHint"

const openAIChat = () => window.dispatchEvent(new CustomEvent("maxien:open-ai-chat"))
const openSpotlight = () => window.dispatchEvent(new CustomEvent("maxien:open-command-palette"))

const NAV_BASE = "flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200"
const NAV_ACTIVE = "bg-[var(--mx-color-c6ff00)] text-black shadow-sm"
const NAV_IDLE = "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"

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
    const navigate = useNavigate()
    const location = useLocation()

    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [workspaceMode, setWorkspaceMode] = useState("personal")
    const [workplaces, setWorkplaces] = useState([])
    const [selectedWorkplaceId, setSelectedWorkplaceId] = useState("")

    const isProfileRoute = location.pathname === "/dashboard/profile"

    /** Profile/Settings needs a flex column + min-h-0 so nested scroll works; other dashboard pages keep the original outlet box so padding/layout stay unchanged. */
    const contentWrapClass = useMemo(
        () => {
            const base = isProfileRoute ? "flex w-full min-h-0 flex-1 flex-col " : "w-full flex-1 "
            return `${base}px-4 sm:px-8 lg:px-10 py-6 sm:py-8`
        },
        [isProfileRoute],
    )

    const workplaceId = location.pathname.match(/\/workplaces\/([^/?]+)/)?.[1] || ""
    const currentTab = new URLSearchParams(location.search).get("tab") || "profile"
    const isWorkplaceRoute = location.pathname.startsWith("/dashboard/workplaces")
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

    const personalLinks = useMemo(() => (
        [
            { to: "/dashboard", icon: FaHome, label: "Overview" },
            { to: "/dashboard/tasks", icon: FaCheckSquare, label: "Tasks" },
            { to: "/dashboard/projects", icon: FaFolder, label: "Projects" },
            { to: "/dashboard/calendar", icon: FaCalendarAlt, label: "Calendar" },
            { to: "/dashboard/notes", icon: FaStickyNote, label: "Notes" },
            { to: "/dashboard/workouts", icon: FaDumbbell, label: "Workouts" },
            { to: "/dashboard/finance", icon: FaChartPie, label: "Finance" },
            { to: "/dashboard/subscriptions", icon: FaWallet, label: "Subscriptions" },
            { to: "/dashboard/github", icon: FaGithub, label: "GitHub" },
            { to: "/dashboard/ai-assistant", icon: FaBrain, label: "AI Assistant" },
        ]
    ), [])

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
        await signOut()
        navigate("/login")
    }

    const handleOpenProfile = () => {
        navigate("/dashboard/profile")
        setSidebarOpen(false)
    }

    const isActive = (path) => location.pathname === path

    const renderWorkspaceSwitcher = () => (
        <div className="mb-4 rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] p-3">
            <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">Workspace</p>
            <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-[var(--color-surface)] p-1 border border-[var(--mx-color-ececf1)]">
                <button
                    type="button"
                    onClick={() => handleWorkspaceModeChange("personal")}
                    className={`px-2.5 py-2 text-[12px] font-semibold rounded-lg transition-colors ${!isWorkplaceMode ? "bg-[var(--mx-color-c6ff00)] text-black" : "text-[var(--color-text-secondary)]"
                        }`}
                >
                    Personal
                </button>
                <button
                    type="button"
                    onClick={() => handleWorkspaceModeChange("workplace")}
                    className={`px-2.5 py-2 text-[12px] font-semibold rounded-lg transition-colors ${isWorkplaceMode ? "bg-[var(--mx-color-c6ff00)] text-black" : "text-[var(--color-text-secondary)] "
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
                        className="w-full bg-[var(--color-surface)] border border-[var(--mx-color-e5e5ea)] rounded-xl px-3 py-2 text-[12px] font-semibold text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50"
                    >
                        {!workplaces.length && <option value="">No workplace yet</option>}
                        {workplaces.map((workplace) => (
                            <option key={workplace.id} value={workplace.id}>{workplace.name}</option>
                        ))}
                    </select>
                    <Link
                        to="/dashboard/workplaces"
                        className="text-[11px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
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
            <div className="min-h-screen bg-[var(--mx-color-f5f5f7)] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[var(--mx-color-c6ff00)] border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    return (
        <div className={`min-h-screen flex font-sans ${isWorkplaceMode || isWorkplaceRoute ? "workplace-theme-surface" : ""}`}>
            <aside className="dashboard-sidebar-surface z-20 w-[240px] hidden lg:flex flex-col border-r sticky top-0 h-screen">
                <div className="px-5 py-6 overflow-y-auto hide-scrollbar">
                    <div className="flex items-center gap-2.5 mb-5">
                        <div className="w-8 h-8 flex-shrink-0">
                            <img src="/logo.svg" alt="Maxien logo" className="w-full h-full" />
                        </div>
                        <span className="text-[var(--color-text-primary)] font-bold text-[16px] tracking-tight">Maxien</span>
                    </div>

                    {renderWorkspaceSwitcher()}

                    <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2 px-2">
                        {isWorkplaceMode ? "Workplace" : "Platform"}
                    </p>
                    {renderPlatformNav()}
                </div>

                <div className="mt-auto px-4 pb-4">
                    <AIShortcutHint onOpen={openAIChat} onOpenSpotlight={openSpotlight} />
                    <div className="flex items-center gap-2 mt-2 px-1 py-1.5 rounded-xl hover:bg-[var(--mx-color-f5f5f7)] transition-colors">
                        <button
                            type="button"
                            onClick={handleOpenProfile}
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        >
                            {user?.user_metadata?.picture ? (
                                <img src={user.user_metadata.picture} alt="Avatar" className="w-7 h-7 rounded-full object-cover ring-1 ring-black/5 flex-shrink-0" />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-primary)] font-bold text-[11px] ring-1 ring-black/5 flex-shrink-0">
                                    {initials}
                                </div>
                            )}
                            <p className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate">{profileName}</p>
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); handleSignOut() }}
                            title="Sign out"
                            className="flex-shrink-0 p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                        </button>
                    </div>
                </div>
            </aside>

            {sidebarOpen && (
                <div className="fixed inset-0 bg-black/30 backdrop-blur-md z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
            )}

            <aside className={`dashboard-sidebar-surface fixed left-0 top-0 h-full w-[240px] border-r z-40 lg:hidden transform transition-transform duration-300 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="px-5 py-6 h-full flex flex-col overflow-y-auto hide-scrollbar">
                    <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8">
                                <img src="/logo.svg" alt="Maxien logo" className="w-full h-full" />
                            </div>
                            <span className="text-[var(--color-text-primary)] font-bold text-[16px] tracking-tight">Maxien</span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-1.5 rounded-lg transition-colors"
                        >
                            <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {renderWorkspaceSwitcher()}

                    <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2 px-2">
                        {isWorkplaceMode ? "Workplace" : "Platform"}
                    </p>
                    <div className="flex-1">{renderPlatformNav(() => setSidebarOpen(false))}</div>

                    <div className="mt-auto pt-3 border-t border-[var(--mx-color-e5e5ea)]">
                        <AIShortcutHint onOpen={openAIChat} onOpenSpotlight={openSpotlight} />
                        <div className="flex items-center gap-2 mt-2 px-1 py-1.5 rounded-xl hover:bg-[var(--mx-color-f5f5f7)] transition-colors">
                            <button
                                type="button"
                                onClick={handleOpenProfile}
                                className="flex items-center gap-2 flex-1 min-w-0 text-left"
                            >
                                {user?.user_metadata?.picture ? (
                                    <img src={user.user_metadata.picture} alt="Avatar" className="w-7 h-7 rounded-full object-cover ring-1 ring-black/5 shrink-0" />
                                ) : (
                                    <div className="w-7 h-7 rounded-full bg-[var(--color-surface)] flex items-center justify-center text-[var(--color-text-primary)] font-bold text-[11px] ring-1 ring-black/5 shrink-0">
                                        {initials}
                                    </div>
                                )}
                                <p className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate">{profileName}</p>
                            </button>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleSignOut() }}
                                title="Sign out"
                                className="shrink-0 p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            <main className="relative isolate flex-1 flex flex-col h-screen overflow-y-auto hide-scrollbar">
                <header className="dashboard-mobile-topbar lg:hidden backdrop-blur-md border-b px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 flex-shrink-0">
                            <img src="/logo.svg" alt="Maxien" className="w-full h-full" />
                        </div>
                        <span className="text-[var(--color-text-primary)] font-bold text-[15px] tracking-tight">Maxien</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={() => setSidebarOpen(true)} className="p-2 rounded-xl transition-colors">
                            {user?.user_metadata?.picture ? (
                                <img src={user.user_metadata.picture} alt="Avatar" className="w-8 h-8 rounded-full object-cover ring-1 ring-black/5" />
                            ) : (
                                <div className="w-8 h-8 rounded-full bg-[var(--mx-color-f5f5f7)] flex items-center justify-center text-[var(--color-text-primary)] font-bold text-xs ring-1 ring-black/5">
                                    {initials}
                                </div>
                            )}
                        </button>
                    </div>
                </header>

                <div className={contentWrapClass}>
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
