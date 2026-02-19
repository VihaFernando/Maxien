import { useEffect, useState } from "react"
import { useNavigate, Outlet, Link, useLocation } from "react-router-dom"
import { useAuth } from "../context/AuthContext"

export default function Dashboard() {
    const { user, loading, signOut } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()
    const [sidebarOpen, setSidebarOpen] = useState(false)

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
            <aside className="w-[260px] hidden lg:flex flex-col bg-white border-r border-[#d2d2d7] sticky top-0 h-screen">
                <div className="p-8">
                    <div className="flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C6FF00] to-[#a8db00] flex items-center justify-center shadow-lg shadow-[#C6FF00]/20">
                            <span className="text-[#1d1d1f] font-bold text-xl tracking-tighter">M</span>
                        </div>
                        <span className="text-[#1d1d1f] font-bold text-xl tracking-tight">Maxien</span>
                    </div>

                    <nav className="space-y-1">
                        <Link
                            to="/dashboard"
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-semibold transition-all duration-300 ${isActive("/dashboard")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-lg shadow-[#C6FF00]/25"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Overview
                        </Link>
                        <Link
                            to="/dashboard/profile"
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-semibold transition-all duration-300 ${isActive("/dashboard/profile")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-lg shadow-[#C6FF00]/25"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Profile
                        </Link>
                    </nav>
                </div>

                <div className="mt-auto p-8 pt-0">
                    <div className="bg-[#f5f5f7] rounded-[24px] p-5">
                        <div className="flex items-center gap-3 mb-4">
                            {user?.user_metadata?.picture ? (
                                <img
                                    src={user.user_metadata.picture}
                                    alt="Avatar"
                                    className="w-10 h-10 rounded-full object-cover shadow-sm ring-1 ring-black/5"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#1d1d1f] font-bold text-sm shadow-sm ring-1 ring-black/5">
                                    {initials}
                                </div>
                            )}
                            <div className="min-w-0">
                                <p className="text-[13px] font-bold text-[#1d1d1f] truncate">
                                    {user?.user_metadata?.full_name || "User"}
                                </p>
                                <p className="text-[11px] font-medium text-[#86868b] truncate">
                                    {user?.email}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="w-full bg-white hover:bg-red-50 text-red-500 font-bold py-2.5 rounded-xl text-[13px] transition-all border border-[#d2d2d7] shadow-sm active:scale-[0.98]"
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

            <aside className={`fixed left-0 top-0 h-full w-[260px] bg-white border-r border-[#d2d2d7] z-40 lg:hidden transform transition-transform duration-300 ease-out ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
                <div className="p-8 h-full flex flex-col overflow-y-auto">
                    <div className="flex items-center justify-between gap-3 mb-10">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C6FF00] to-[#a8db00] flex items-center justify-center shadow-lg shadow-[#C6FF00]/20">
                                <span className="text-[#1d1d1f] font-bold text-xl tracking-tighter">M</span>
                            </div>
                            <span className="text-[#1d1d1f] font-bold text-xl tracking-tight">Maxien</span>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="p-2 hover:bg-[#f5f5f7] rounded-xl transition-colors lg:hidden"
                        >
                            <svg className="w-6 h-6 text-[#1d1d1f]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <nav className="space-y-1 flex-1">
                        <Link
                            to="/dashboard"
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-semibold transition-all duration-300 ${isActive("/dashboard")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-lg shadow-[#C6FF00]/25"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            Overview
                        </Link>
                        <Link
                            to="/dashboard/profile"
                            className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-[15px] font-semibold transition-all duration-300 ${isActive("/dashboard/profile")
                                ? "bg-[#C6FF00] text-[#1d1d1f] shadow-lg shadow-[#C6FF00]/25"
                                : "text-[#86868b] hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
                                }`}
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            Profile
                        </Link>
                    </nav>

                    <div className="mt-auto pt-8 border-t border-[#d2d2d7]">
                        <div className="bg-[#f5f5f7] rounded-[24px] p-5">
                            <div className="flex items-center gap-3 mb-4">
                                {user?.user_metadata?.picture ? (
                                    <img
                                        src={user.user_metadata.picture}
                                        alt="Avatar"
                                        className="w-10 h-10 rounded-full object-cover shadow-sm ring-1 ring-black/5"
                                    />
                                ) : (
                                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[#1d1d1f] font-bold text-sm shadow-sm ring-1 ring-black/5">
                                        {initials}
                                    </div>
                                )}
                                <div className="min-w-0">
                                    <p className="text-[13px] font-bold text-[#1d1d1f] truncate">
                                        {user?.user_metadata?.full_name || "User"}
                                    </p>
                                    <p className="text-[11px] font-medium text-[#86868b] truncate">
                                        {user?.email}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handleSignOut}
                                className="w-full bg-white hover:bg-red-50 text-red-500 font-bold py-2.5 rounded-xl text-[13px] transition-all border border-[#d2d2d7] shadow-sm active:scale-[0.98]"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-y-auto">
                <header className="lg:hidden bg-white/80 backdrop-blur-md border-b border-[#d2d2d7] px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-20">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-[#C6FF00] flex items-center justify-center font-bold text-[#1d1d1f] text-sm">M</div>
                        <span className="text-[#1d1d1f] font-bold">Maxien</span>
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

                <div className="max-w-5xl w-full mx-auto px-6 py-10 md:px-12 md:py-16">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}