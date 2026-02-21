import { useEffect, useState } from "react"
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { FaHome, FaUser, FaCheckSquare, FaCog, FaChevronDown, FaCalendarAlt } from "react-icons/fa"

export default function Dashboard() {
    const { user, loading, signOut } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(false)
    const [systemOpen, setSystemOpen] = useState(false)

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

    const initials = user?.user_metadata?.display_name
        ? user.user_metadata.display_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)
        : user?.email?.[0]?.toUpperCase() || "U"

    return (
        <div className="min-h-screen bg-[#f5f5f7] flex font-sans">
            {/* Sidebar - Desktop */}
            <aside className="w-[240px] hidden lg:flex flex-col bg-white border-r border-[#e5e5ea] sticky top-0 h-screen">
                <div className="px-5 py-6">
                    <div className="flex items-center gap-2.5 mb-8">
                        <div className="w-8 h-8 flex-shrink-0">
                            <img src="/logo.svg" alt="Maxien logo" className="w-full h-full" />
                        </div>
                        <span className="text-[#1d1d1f] font-bold text-[16px] tracking-tight">Maxien</span>
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
                            to="/dashboard/calendar"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard/calendar")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaCalendarAlt className="w-4 h-4" />
                            Calendar
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
                                    {user?.user_metadata?.full_name || "User"}
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
                            to="/dashboard/calendar"
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 ${isActive("/dashboard/calendar")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-sm"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <FaCalendarAlt className="w-4 h-4" />
                            Calendar
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
                                        {user?.user_metadata?.full_name || "User"}
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
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 flex-shrink-0">
                            <img src="/logo.svg" alt="Maxien" className="w-full h-full" />
                        </div>
                        <span className="text-[#1d1d1f] font-bold text-[15px] tracking-tight">Maxien</span>
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

                <div className="w-full flex-1 px-4 sm:px-8 lg:px-10 py-6 sm:py-8">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}