import { useEffect, useState } from "react"
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { FaHome, FaUser, FaCheckSquare, FaCog, FaChevronDown, FaCalendarAlt, FaFolder, FaBrain, FaUsers } from "react-icons/fa"
import AIShortcutHint from "../components/AIShortcutHint"
import { useWorkplace } from "../context/WorkplaceContext"

const openAIChat = () => window.dispatchEvent(new CustomEvent("maxien:open-ai-chat"))

export default function Dashboard() {
    const { user, loading, signOut } = useAuth()
    const { workplaces, pendingInvites, selectedWorkplace, selectedWorkplaceId, selectWorkplace, shouldPromptCreateWorkplace } = useWorkplace()
    const navigate = useNavigate()
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [systemOpen, setSystemOpen] = useState(false)
    const [workplaceOpen, setWorkplaceOpen] = useState(false)

    useEffect(() => {
        if (!loading && !user) navigate("/login")
    }, [user, loading, navigate])

    const handleSignOut = async () => {
        await signOut()
        navigate("/login")
    }

    const isActive = (path) => location.pathname === path

    // Close sidebar when route changes
    useEffect(() => {
        setSidebarOpen(false)
    }, [location])

    if (loading) {
        return (
            <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-[#C6FF00] border-t-transparent rounded-full animate-spin"></div>
            </div>
        )
    }

    const profileName = user?.user_metadata?.display_name
        || user?.user_metadata?.full_name
        || user?.user_metadata?.name
        || user?.email?.split("@")[0]
        || "User"

    const initials = profileName
        ? profileName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
        : user?.email?.[0]?.toUpperCase() || "U"

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex font-sans" onClick={() => setWorkplaceOpen(false)}>
            {/* Sidebar - Desktop */}
            <aside className="w-[240px] hidden lg:flex flex-col bg-white border-r border-[#e5e5ea] sticky top-0 h-screen">
                <div className="px-5 py-6">
                    <div className="flex items-center gap-2.5 mb-8">
                        <div className="w-8 h-8 flex-shrink-0">
                            <img src="/logo.svg" alt="Maxien logo" className="w-full h-full" />
                        </div>
                        <span className="text-[#1d1d1f] font-bold text-[16px] tracking-tight">Maxien</span>
                    </div>

                    {/* Workplace selector */}
                    <div className="relative mb-5" onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setWorkplaceOpen(!workplaceOpen)}
                            className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7]/70 hover:bg-white transition-colors"
                        >
                            <div className="min-w-0 text-left">
                                <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest leading-none">Workspace</p>
                                <p className="text-[13px] font-bold text-[#1d1d1f] truncate mt-1">
                                    {selectedWorkplaceId ? (selectedWorkplace?.name || "Workplace") : "Personal"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                                {pendingInvites.length > 0 && (
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                                        {pendingInvites.length}
                                    </span>
                                )}
                                <FaChevronDown className={`w-3.5 h-3.5 text-[#86868b] transition-transform ${workplaceOpen ? "rotate-180" : ""}`} />
                            </div>
                        </button>

                        {workplaceOpen && (
                            <div className="absolute left-0 right-0 mt-2 bg-white rounded-[16px] border border-[#d2d2d7]/80 shadow-xl overflow-hidden z-50">
                                <button
                                    onClick={() => { selectWorkplace(null); setWorkplaceOpen(false) }}
                                    className={`w-full text-left px-4 py-2.5 text-[12px] font-semibold transition-colors ${selectedWorkplaceId ? "hover:bg-[#f5f5f7] text-[#1d1d1f]" : "bg-[#C6FF00]/20 text-[#1d1d1f]"}`}
                                >
                                    Personal
                                </button>
                                {workplaces.length > 0 && (
                                    <div className="border-t border-[#f0f0f0]" />
                                )}
                                {workplaces.map((m) => (
                                    <button
                                        key={m.workplace.id}
                                        onClick={() => { selectWorkplace(m.workplace.id); setWorkplaceOpen(false) }}
                                        className={`w-full text-left px-4 py-2.5 text-[12px] font-semibold hover:bg-[#f5f5f7] transition-colors ${selectedWorkplaceId === m.workplace.id ? "bg-[#C6FF00]/20 text-[#1d1d1f]" : "text-[#1d1d1f]"}`}
                                    >
                                        {m.workplace.name}
                                    </button>
                                ))}
                                <div className="border-t border-[#f0f0f0]" />
                                <Link
                                    to="/dashboard/workplaces"
                                    onClick={() => setWorkplaceOpen(false)}
                                    className="block px-4 py-2.5 text-[12px] font-semibold text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
                                >
                                    Manage workplaces
                                </Link>
                            </div>
                        )}
                    </div>

                    <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest mb-2 px-2">Platform</p>
                    <nav className="space-y-0.5">
                        <Link
                            to="/dashboard"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaHome className="w-4 h-4" />
                            Overview
                        </Link>
                        <Link
                            to="/dashboard/profile"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard/profile")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaUser className="w-4 h-4" />
                            Profile
                        </Link>

                        <Link
                            to="/dashboard/tasks"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard/tasks")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaCheckSquare className="w-4 h-4" />
                            Tasks
                        </Link>

                        <Link
                            to="/dashboard/projects"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard/projects")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaFolder className="w-4 h-4" />
                            Projects
                        </Link>

                        <Link
                            to="/dashboard/calendar"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard/calendar")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaCalendarAlt className="w-4 h-4" />
                            Calendar
                        </Link>

                        <Link
                            to="/dashboard/ai-assistant"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard/ai-assistant")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaBrain className="w-4 h-4" />
                            AI Assistant
                        </Link>

                        <Link
                            to="/dashboard/workplaces"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard/workplaces")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaUsers className="w-4 h-4" />
                            Workplaces
                            {pendingInvites.length > 0 && (
                                <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                                    {pendingInvites.length}
                                </span>
                            )}
                        </Link>

                        <div>
                            <button
                                onClick={() => setSystemOpen(!systemOpen)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${systemOpen
                                    ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                    : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                    }`}
                            >
                                <FaCog className="w-4 h-4" />
                                <span className="flex-1 text-left">Components</span>
                                <FaChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${systemOpen ? "rotate-180" : ""}`} />
                            </button>
                            {systemOpen && (
                                <Link
                                    to="/dashboard/task-types"
                                    className={`flex items-center gap-2.5 px-3 py-2 ml-4 mt-0.5 rounded-xl text-[12px] font-semibold transition-all duration-200 ${isActive("/dashboard/task-types")
                                        ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                        : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                        }`}
                                >
                                    <FaCheckSquare className="w-3.5 h-3.5" />
                                    Task Types
                                </Link>
                            )}
                        </div>
                    </nav>
                </div>

                <div className="mt-auto px-5 pb-5">
                    <AIShortcutHint onOpen={openAIChat} />
                    <div className="bg-[#f5f5f7] rounded-2xl p-4">
                        <div className="flex items-center gap-3 mb-3">
                            {user?.user_metadata?.picture ? (
                                <img
                                    src={user.user_metadata.picture}
                                    alt="Avatar"
                                    className="w-9 h-9 rounded-full object-cover ring-1 ring-black/5"
                                />
                            ) : (
                                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#1d1d1f] font-bold text-sm ring-1 ring-black/5">
                                    {initials}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-[12px] font-bold text-[#1d1d1f] truncate">
                                    {profileName}
                                </p>
                                <p className="text-[10px] font-medium text-[#86868b] truncate">
                                    {user?.email}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="w-full bg-white hover:bg-red-50 text-red-500 font-semibold py-2 rounded-lg text-[12px] transition-all border border-[#d2d2d7] active:scale-[0.98]"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Sidebar - Mobile/Tablet */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/30 z-30 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            <aside className={`fixed left-0 top-0 h-full w-[240px] bg-white border-r border-[#e5e5ea] z-40 lg:hidden transform transition-transform duration-300 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="px-5 py-6 h-full flex flex-col overflow-y-auto">
                    <div className="flex items-center justify-between mb-8">
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

                    <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-widest mb-2 px-2">Platform</p>
                    <nav className="space-y-0.5 flex-1">
                        <Link
                            to="/dashboard"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaHome className="w-4 h-4" />
                            Overview
                        </Link>
                        <Link
                            to="/dashboard/profile"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard/profile")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaUser className="w-4 h-4" />
                            Profile
                        </Link>

                        <Link
                            to="/dashboard/tasks"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard/tasks")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaCheckSquare className="w-4 h-4" />
                            Tasks
                        </Link>

                        <Link
                            to="/dashboard/projects"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard/projects")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaFolder className="w-4 h-4" />
                            Projects
                        </Link>

                        <Link
                            to="/dashboard/calendar"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard/calendar")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaCalendarAlt className="w-4 h-4" />
                            Calendar
                        </Link>

                        <Link
                            to="/dashboard/ai-assistant"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard/ai-assistant")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaBrain className="w-4 h-4" />
                            AI Assistant
                        </Link>

                        <div>
                            <button
                                onClick={() => setSystemOpen(!systemOpen)}
                                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${systemOpen
                                    ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                    : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                    }`}
                            >
                                <FaCog className="w-4 h-4" />
                                <span className="flex-1 text-left">System</span>
                                <FaChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${systemOpen ? "rotate-180" : ""}`} />
                            </button>
                            {systemOpen && (
                                <Link
                                    to="/dashboard/task-types"
                                    className={`flex items-center gap-2.5 px-3 py-2 ml-4 mt-0.5 rounded-xl text-[12px] font-semibold transition-all duration-200 ${isActive("/dashboard/task-types")
                                        ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                        : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                        }`}
                                >
                                    <FaCheckSquare className="w-3.5 h-3.5" />
                                    Task Types
                                </Link>
                            )}
                        </div>
                    </nav>

                    <div className="mt-auto pt-5 border-t border-[#e5e5ea]">
                        <AIShortcutHint onOpen={openAIChat} />
                        <div className="bg-[#f5f5f7] rounded-2xl p-4">
                            <div className="flex items-center gap-3 mb-3">
                                {user?.user_metadata?.picture ? (
                                    <img
                                        src={user.user_metadata.picture}
                                        alt="Avatar"
                                        className="w-9 h-9 rounded-full object-cover ring-1 ring-black/5"
                                    />
                                ) : (
                                    <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center text-[#1d1d1f] font-bold text-sm ring-1 ring-black/5">
                                        {initials}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-[12px] font-bold text-[#1d1d1f] truncate">
                                        {profileName}
                                    </p>
                                    <p className="text-[10px] font-medium text-[#86868b] truncate">
                                        {user?.email}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleSignOut}
                                className="w-full bg-white hover:bg-red-50 text-red-500 font-semibold py-2 rounded-lg text-[12px] transition-all border border-[#d2d2d7] active:scale-[0.98]"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-y-auto">
                <header className="lg:hidden bg-white/90 backdrop-blur-md border-b border-[#d2d2d7] px-4 sm:px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-8 h-8 flex-shrink-0">
                            <img src="/logo.svg" alt="Maxien" className="w-full h-full" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[#1d1d1f] font-bold text-[15px] tracking-tight leading-none">Maxien</p>
                            <button
                                onClick={(e) => { e.stopPropagation(); setWorkplaceOpen(!workplaceOpen) }}
                                className="flex items-center gap-1 text-[11px] font-semibold text-[#86868b] hover:text-[#1d1d1f] transition-colors mt-0.5"
                            >
                                <span className="truncate max-w-[150px]">
                                    {selectedWorkplaceId ? (selectedWorkplace?.name || "Workplace") : "Personal"}
                                </span>
                                {pendingInvites.length > 0 && (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200">
                                        {pendingInvites.length}
                                    </span>
                                )}
                                <FaChevronDown className={`w-3 h-3 transition-transform ${workplaceOpen ? "rotate-180" : ""}`} />
                            </button>
                        </div>
                    </div>
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="p-2 hover:bg-[#f5f5f7] rounded-xl transition-colors"
                    >
                        {user?.user_metadata?.picture ? (
                            <img
                                src={user.user_metadata.picture}
                                alt="Avatar"
                                className="w-8 h-8 rounded-full object-cover ring-1 ring-black/5"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-[#f5f5f7] flex items-center justify-center text-[#1d1d1f] font-bold text-xs ring-1 ring-black/5">
                                {initials}
                            </div>
                        )}
                    </button>
                </header>

                {/* Mobile workplace dropdown */}
                {workplaceOpen && (
                    <div className="lg:hidden sticky top-[57px] z-20 px-4 sm:px-6" onClick={(e) => e.stopPropagation()}>
                        <div className="mt-2 bg-white rounded-[18px] border border-[#d2d2d7]/80 shadow-xl overflow-hidden">
                            <button
                                onClick={() => { selectWorkplace(null); setWorkplaceOpen(false) }}
                                className={`w-full text-left px-4 py-3 text-[13px] font-semibold transition-colors ${selectedWorkplaceId ? "hover:bg-[#f5f5f7] text-[#1d1d1f]" : "bg-[#C6FF00]/20 text-[#1d1d1f]"}`}
                            >
                                Personal
                            </button>
                            {workplaces.length > 0 && <div className="border-t border-[#f0f0f0]" />}
                            {workplaces.map((m) => (
                                <button
                                    key={m.workplace.id}
                                    onClick={() => { selectWorkplace(m.workplace.id); setWorkplaceOpen(false) }}
                                    className={`w-full text-left px-4 py-3 text-[13px] font-semibold hover:bg-[#f5f5f7] transition-colors ${selectedWorkplaceId === m.workplace.id ? "bg-[#C6FF00]/20 text-[#1d1d1f]" : "text-[#1d1d1f]"}`}
                                >
                                    {m.workplace.name}
                                </button>
                            ))}
                            <div className="border-t border-[#f0f0f0]" />
                            <Link
                                to="/dashboard/workplaces"
                                onClick={() => setWorkplaceOpen(false)}
                                className="block px-4 py-3 text-[13px] font-semibold text-[#86868b] hover:text-[#1d1d1f] hover:bg-[#f5f5f7] transition-colors"
                            >
                                Manage workplaces
                            </Link>
                        </div>
                    </div>
                )}

                <div className="w-full flex-1 px-4 sm:px-8 lg:px-10 py-6 sm:py-8">
                    {shouldPromptCreateWorkplace && (
                        <div className="mb-5 bg-white rounded-[18px] border border-[#d2d2d7]/60 shadow-sm p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-[13px] font-bold text-[#1d1d1f]">Create a workplace to collaborate</p>
                                <p className="text-[12px] text-[#86868b] mt-0.5">You don’t have any workplaces yet. Personal mode is available, but teams require a workplace.</p>
                            </div>
                            <Link
                                to="/dashboard/workplaces"
                                className="px-4 py-2.5 rounded-[12px] bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-bold text-[13px] transition-colors w-fit"
                            >
                                Go to Workplaces
                            </Link>
                        </div>
                    )}
                    <Outlet />
                </div>
            </main>
        </div>
    )
}