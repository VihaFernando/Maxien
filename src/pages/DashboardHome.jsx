import { useAuth } from "../context/AuthContext"
import { useEffect, useState, useMemo } from "react"
import { supabase } from "../lib/supabase"
import { Link } from "react-router-dom"

export default function DashboardHome() {
    const { user } = useAuth()
    const name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there"
    const firstName = name.split(" ")[0]

    const currentDate = new Date().toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric"
    })

    const [tasks, setTasks] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user?.id) return
        const fetchTasks = async () => {
            try {
                const { data } = await supabase
                    .from("tasks")
                    .select("*")
                    .eq("user_id", user.id)
                setTasks(data || [])
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        fetchTasks()
    }, [user])

    const stats = useMemo(() => {
        const today = new Date().toISOString().split("T")[0]
        const total = tasks.length
        const completed = tasks.filter(t => t.status === "Done").length
        const pending = tasks.filter(t => t.status !== "Done").length
        const overdue = tasks.filter(t => t.due_date && t.due_date < today && t.status !== "Done").length
        const dueToday = tasks.filter(t => t.due_date === today && t.status !== "Done").length
        const highPriority = tasks.filter(t => (t.priority === "High" || t.priority === "Urgent") && t.status !== "Done").length
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
        return { total, completed, pending, overdue, dueToday, highPriority, completionRate }
    }, [tasks])

    const activityGrid = useMemo(() => {
        const COLS = 40
        const DAYS = 7
        const byDate = {}
        tasks.forEach(t => {
            const dateKey = t.due_date || (t.created_at ? t.created_at.split("T")[0] : null)
            if (dateKey) byDate[dateKey] = (byDate[dateKey] || 0) + 1
        })
        const today = new Date()
        const cols = []
        for (let c = COLS - 1; c >= 0; c--) {
            const colDays = []
            for (let d = 0; d < DAYS; d++) {
                const dayOffset = c * 7 + (DAYS - 1 - d)
                const date = new Date(today)
                date.setDate(today.getDate() - dayOffset)
                const key = date.toISOString().split("T")[0]
                const count = byDate[key] || 0
                const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4
                colDays.push(level)
            }
            cols.push(colDays)
        }
        return cols
    }, [tasks])

    const upcomingTasks = useMemo(() => {
        return tasks
            .filter(t => t.status !== "Done")
            .sort((a, b) => {
                if (!a.due_date && !b.due_date) return 0
                if (!a.due_date) return 1
                if (!b.due_date) return -1
                return new Date(a.due_date) - new Date(b.due_date)
            })
            .slice(0, 6)
    }, [tasks])

    const monthLabels = useMemo(() => {
        const today = new Date()
        const months = []
        const seen = new Set()
        for (let c = 0; c < 40; c++) {
            const d = new Date(today)
            d.setDate(today.getDate() - (39 - c) * 7)
            const m = d.toLocaleString("en-US", { month: "short" })
            if (!seen.has(m)) { seen.add(m); months.push({ label: m, col: c }) }
        }
        return months
    }, [])

    const priorityColor = (p) => p === "Urgent" ? "#ef4444" : p === "High" ? "#f97316" : p === "Medium" ? "#3b82f6" : "#86868b"
    const priorityBg = (p) => p === "Urgent" ? "bg-red-50 text-red-600" : p === "High" ? "bg-orange-50 text-orange-600" : p === "Medium" ? "bg-blue-50 text-blue-600" : "bg-[#f5f5f7] text-[#86868b]"

    return (
        <div className="animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-10">

            {/* Top Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1 mb-6 sm:mb-8 px-0.5">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Overview</p>
                    <h1 className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] tracking-tight leading-tight">
                        Welcome back, {firstName}
                    </h1>
                </div>
                <p className="text-[12px] font-medium text-[#86868b] sm:pb-0.5">{currentDate}</p>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="w-8 h-8 border-4 border-[#C6FF00] border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">

                    {/* LEFT MAIN COLUMN */}
                    <div className="lg:col-span-8 flex flex-col gap-5 sm:gap-6">

                        {/* Hero Banner with progress ring + stats */}
                        <div className="relative rounded-[22px] sm:rounded-[28px] overflow-hidden bg-gradient-to-br from-[#f5faeb] via-[#f0f7e5] to-[#e8f5d0] border border-[#c8e87a]/40 p-5 sm:p-7">
                            <div className="absolute -top-12 -right-12 w-52 h-52 rounded-full bg-[#C6FF00]/15 blur-3xl pointer-events-none"></div>
                            <div className="absolute bottom-0 left-20 w-36 h-36 rounded-full bg-[#C6FF00]/10 blur-2xl pointer-events-none"></div>

                            <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-7">
                                {/* Radial progress ring */}
                                <div className="hidden sm:flex flex-col items-center gap-1.5 flex-shrink-0">
                                    <div className="relative w-[88px] h-[88px]">
                                        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                                            <circle cx="18" cy="18" r="14" fill="none" stroke="#e5efd0" strokeWidth="3.5" />
                                            <circle
                                                cx="18" cy="18" r="14" fill="none"
                                                stroke="#C6FF00" strokeWidth="3.5"
                                                strokeLinecap="round"
                                                strokeDasharray={`${stats.completionRate * 0.879} 87.96`}
                                            />
                                        </svg>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                                            <span className="text-[16px] font-bold text-[#1d1d1f] leading-none">{stats.completionRate}%</span>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wide">Done</span>
                                </div>

                                {/* Stats grid */}
                                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    {[
                                        { label: "Total", value: stats.total, color: "#3b82f6" },
                                        { label: "Completed", value: stats.completed, color: "#22c55e" },
                                        { label: "Pending", value: stats.pending, color: "#f59e0b" },
                                        { label: "Overdue", value: stats.overdue, color: "#ef4444" },
                                    ].map(s => (
                                        <div key={s.label} className="bg-white/70 backdrop-blur-sm rounded-xl px-3 py-2.5 border border-white/80">
                                            <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wide mb-0.5">{s.label}</p>
                                            <p className="text-[20px] sm:text-[22px] font-bold leading-tight" style={{ color: s.color }}>{s.value}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Progress bar */}
                            <div className="relative mt-5">
                                <div className="flex justify-between text-[11px] font-medium text-[#86868b] mb-1.5">
                                    <span>Overall completion</span>
                                    <span>{stats.completed} / {stats.total} tasks</span>
                                </div>
                                <div className="h-1.5 w-full bg-white/80 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-[#C6FF00] to-[#a8db00] rounded-full transition-all duration-700"
                                        style={{ width: `${stats.completionRate}%` }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Priority Breakdown */}
                        <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-5 sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-[14px] font-bold text-[#1d1d1f]">Priority Breakdown</h2>
                                <Link to="/dashboard/tasks" className="text-[11px] font-semibold text-[#86868b] hover:text-[#1d1d1f] transition-colors flex items-center gap-1">
                                    View all
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
                                </Link>
                            </div>
                            {tasks.length === 0 ? (
                                <p className="text-[12px] text-[#86868b] text-center py-4">
                                    No tasks yet.{" "}
                                    <Link to="/dashboard/tasks" className="text-[#86b300] font-semibold hover:underline">Create one</Link>
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {[
                                        { label: "Urgent", color: "#ef4444", bg: "#fef2f2", trackBg: "#fecaca55" },
                                        { label: "High", color: "#f97316", bg: "#fff7ed", trackBg: "#fed7aa55" },
                                        { label: "Medium", color: "#3b82f6", bg: "#eff6ff", trackBg: "#bfdbfe55" },
                                        { label: "Low", color: "#86868b", bg: "#f5f5f7", trackBg: "#d1d5db55" },
                                    ].map(row => {
                                        const total = tasks.filter(t => t.priority === row.label).length
                                        const done = tasks.filter(t => t.priority === row.label && t.status === "Done").length
                                        const pct = total > 0 ? Math.round((done / total) * 100) : 0
                                        return (
                                            <div key={row.label} className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 w-[68px] flex-shrink-0">
                                                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: row.color }}></div>
                                                    <span className="text-[11px] font-semibold text-[#86868b]">{row.label}</span>
                                                </div>
                                                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: row.trackBg }}>
                                                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: row.color + "cc" }}></div>
                                                </div>
                                                <div className="w-[52px] flex-shrink-0 text-right">
                                                    <span className="text-[12px] font-bold text-[#1d1d1f]">{done}</span>
                                                    <span className="text-[11px] text-[#86868b]"> / {total}</span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Activity Graph */}
                        <div className="flex-1 bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-5 sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-[14px] font-bold text-[#1d1d1f]">Activity Graph</h2>
                                <span className="text-[11px] font-medium text-[#86868b]">Task activity</span>
                            </div>

                            {/* Mobile graph: last 16 cols */}
                            {[{ cols: activityGrid.slice(-16), cls: "sm:hidden" }, { cols: activityGrid, cls: "hidden sm:block" }].map(({ cols, cls }, ri) => (
                                <div key={ri} className={`w-full ${cls}`}>
                                    {/* Month label row */}
                                    <div className="flex gap-[2px] mb-1.5">
                                        <div className="w-5 flex-shrink-0 mr-1"></div>
                                        {cols.map((col, i) => {
                                            const srcIdx = ri === 0 ? activityGrid.length - 16 + i : i
                                            const lbl = monthLabels.find(m => m.col === srcIdx)
                                            return (
                                                <div key={i} className="flex-1 relative h-4 min-w-0">
                                                    {lbl && <span className="absolute top-0 left-0 text-[9px] text-[#86868b] font-medium whitespace-nowrap">{lbl.label}</span>}
                                                </div>
                                            )
                                        })}
                                    </div>
                                    {/* Squares */}
                                    <div className="flex gap-[2px] w-full">
                                        <div className="flex flex-col gap-[2px] w-5 mr-1 flex-shrink-0">
                                            {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                                <div key={i} className="flex items-center" style={{ aspectRatio: "1/1" }}>
                                                    <span className="text-[9px] text-[#86868b] font-medium">{i % 2 === 0 ? d : ""}</span>
                                                </div>
                                            ))}
                                        </div>
                                        {cols.map((col, i) => (
                                            <div key={i} className="flex-1 flex flex-col gap-[2px] min-w-0">
                                                {col.map((level, j) => (
                                                    <div
                                                        key={`${i}-${j}`}
                                                        className={`w-full rounded-[2px] ${level === 0 ? "bg-[#f0f0f0]" :
                                                            level === 1 ? "bg-[#dff5a0]" :
                                                                level === 2 ? "bg-[#c8ef52]" :
                                                                    level === 3 ? "bg-[#b8e616]" : "bg-[#C6FF00]"
                                                            }`}
                                                        style={{ aspectRatio: "1/1" }}
                                                    ></div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                    {/* Legend */}
                                    <div className="flex items-center gap-1.5 mt-3">
                                        <span className="text-[10px] text-[#86868b] font-medium mr-0.5">Less</span>
                                        {["bg-[#f0f0f0]", "bg-[#dff5a0]", "bg-[#c8ef52]", "bg-[#b8e616]", "bg-[#C6FF00]"].map((c, i) => (
                                            <div key={i} className={`w-[10px] h-[10px] rounded-[2px] ${c}`}></div>
                                        ))}
                                        <span className="text-[10px] text-[#86868b] font-medium ml-0.5">More</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>

                    {/* RIGHT PANEL */}
                    <div className="lg:col-span-4 flex flex-col gap-5 sm:gap-6">

                        {/* Focus Today */}
                        <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-5 sm:p-6">
                            <h2 className="text-[14px] font-bold text-[#1d1d1f] mb-4">Focus Today</h2>
                            <div className="space-y-2.5">
                                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#fffbeb] border border-[#fde68a]/40">
                                    <div className="w-8 h-8 rounded-lg bg-[#fde68a]/60 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-4 h-4 text-[#d97706]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                            <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wide">Due Today</p>
                                        <p className="text-[15px] font-bold text-[#1d1d1f]">{stats.dueToday} task{stats.dueToday !== 1 ? "s" : ""}</p>
                                    </div>
                                </div>

                                <div className={`flex items-center gap-3 p-3 rounded-xl border ${stats.overdue > 0 ? "bg-[#fef2f2] border-[#fecaca]/40" : "bg-[#f0fdf4] border-[#bbf7d0]/40"}`}>
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${stats.overdue > 0 ? "bg-[#fecaca]/60" : "bg-[#bbf7d0]/60"}`}>
                                        {stats.overdue > 0
                                            ? <svg className="w-4 h-4 text-[#dc2626]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            : <svg className="w-4 h-4 text-[#16a34a]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                        }
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wide">Overdue</p>
                                        <p className={`text-[15px] font-bold ${stats.overdue > 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>
                                            {stats.overdue > 0 ? `${stats.overdue} task${stats.overdue !== 1 ? "s" : ""}` : "All clear"}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 rounded-xl bg-[#fdf4ff] border border-[#e9d5ff]/40">
                                    <div className="w-8 h-8 rounded-lg bg-[#e9d5ff]/60 flex items-center justify-center flex-shrink-0">
                                        <svg className="w-4 h-4 text-[#9333ea]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                            <path d="M5 3l14 9-14 9V3z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wide">High Priority</p>
                                        <p className="text-[15px] font-bold text-[#1d1d1f]">{stats.highPriority} task{stats.highPriority !== 1 ? "s" : ""}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Quick Actions */}
                        <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-5 sm:p-6">
                            <h2 className="text-[14px] font-bold text-[#1d1d1f] mb-4">Quick Actions</h2>
                            <div className="space-y-2">
                                {[
                                    { label: "New Task", to: "/dashboard/tasks", iconColor: "text-[#3b82f6]", bg: "bg-[#eff6ff]", icon: <path d="M12 4v16m8-8H4" /> },
                                    { label: "View Calendar", to: "/dashboard/calendar", iconColor: "text-[#8b5cf6]", bg: "bg-[#f5f3ff]", icon: <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> },
                                    { label: "All Tasks", to: "/dashboard/tasks", iconColor: "text-[#22c55e]", bg: "bg-[#f0fdf4]", icon: <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 12l2 2 4-4" /> },
                                    { label: "Edit Profile", to: "/dashboard/profile", iconColor: "text-[#f59e0b]", bg: "bg-[#fffbeb]", icon: <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /> },
                                ].map(a => (
                                    <Link key={a.label} to={a.to}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl ${a.bg} hover:opacity-80 transition-all duration-200`}
                                    >
                                        <svg className={`w-4 h-4 ${a.iconColor} flex-shrink-0`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">{a.icon}</svg>
                                        <span className="text-[13px] font-semibold text-[#1d1d1f] flex-1">{a.label}</span>
                                        <svg className="w-3.5 h-3.5 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path d="M9 5l7 7-7 7" /></svg>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Upcoming Tasks */}
                        <div className="flex-1 bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-5 sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-[14px] font-bold text-[#1d1d1f]">Upcoming Tasks</h2>
                                <Link to="/dashboard/tasks" className="text-[11px] font-semibold text-[#86868b] hover:text-[#1d1d1f] transition-colors">See all</Link>
                            </div>

                            {upcomingTasks.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-7 gap-2">
                                    <svg className="w-9 h-9 text-[#d2d2d7]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    <p className="text-[12px] text-[#86868b]">No upcoming tasks</p>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {upcomingTasks.map(task => {
                                        const hasDueDate = !!task.due_date
                                        const d = hasDueDate ? new Date(task.due_date) : null
                                        const mon = d ? d.toLocaleString("en-US", { month: "short" }).toUpperCase() : null
                                        const day = d ? d.getDate() : null
                                        return (
                                            <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#f5f5f7] transition-colors duration-200 group">
                                                <div className="bg-[#f5f5f7] group-hover:bg-white rounded-xl flex flex-col items-center justify-center w-[46px] h-[46px] flex-shrink-0 transition-colors border border-[#d2d2d7]/40">
                                                    {hasDueDate ? (
                                                        <>
                                                            <span className="text-[8px] font-bold text-[#86868b] uppercase leading-tight">{mon}</span>
                                                            <span className="text-[14px] font-bold text-[#1d1d1f] leading-tight">{day}</span>
                                                        </>
                                                    ) : (
                                                        <svg className="w-4 h-4 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[12px] sm:text-[13px] font-semibold text-[#1d1d1f] truncate leading-snug">{task.title}</p>
                                                    <span className={`inline-block text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 ${task.priority === "Urgent" ? "bg-red-50 text-red-600" :
                                                        task.priority === "High" ? "bg-orange-50 text-orange-600" :
                                                            task.priority === "Medium" ? "bg-blue-50 text-blue-600" :
                                                                "bg-[#f5f5f7] text-[#86868b]"
                                                        }`}>{task.priority || "None"}</span>
                                                </div>
                                                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: priorityColor(task.priority) }}></div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </div>
    )
}
