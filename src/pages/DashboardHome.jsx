import { useAuth } from "../context/AuthContext"
import { useEffect, useState, useMemo } from "react"
import { supabase } from "../lib/supabase"
import { Link } from "react-router-dom"
import { FaFolder, FaChevronRight } from "react-icons/fa"

export default function DashboardHome() {
    const { user } = useAuth()
    const name = user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there"
    const firstName = name.split(" ")[0]

    // Utility: Check if task is overdue (not done and past due time)
    const isOverdueTask = (task) => {
        if (!task.due_at || task.status === "Done" || task.status === "Cancelled") return false
        const now = new Date()
        const dueDate = new Date(task.due_at)
        return dueDate < now
    }

    // Utility: Check if task is due soon (within 2 hours and not overdue)
    const isOverdueSoon = (task) => {
        if (!task.due_at || task.status === "Done" || task.status === "Cancelled") return false
        if (isOverdueTask(task)) return false // already overdue
        const now = new Date()
        const dueDate = new Date(task.due_at)
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
        return dueDate <= twoHoursFromNow && dueDate > now
    }

    const currentDate = new Date().toLocaleDateString("en-US", {
        day: "numeric",
        month: "long",
        year: "numeric"
    })

    const [tasks, setTasks] = useState([])
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!user?.id) return
        const fetchData = async () => {
            try {
                const [tasksRes, projectsRes] = await Promise.all([
                    supabase.from("tasks").select("*").eq("user_id", user.id),
                    supabase.from("projects").select("*").eq("user_id", user.id)
                ])
                setTasks(tasksRes.data || [])
                setProjects(projectsRes.data || [])
            } catch (err) {
                console.error(err)
            } finally {
                setLoading(false)
            }
        }
        fetchData()
    }, [user])

    const stats = useMemo(() => {
        const now = new Date()
        const today = now.toISOString().split("T")[0]
        const total = tasks.length
        const completed = tasks.filter(t => t.status === "Done").length
        const pending = tasks.filter(t => t.status !== "Done").length

        // Overdue: use isOverdueTask for accurate time-based comparison
        const overdue = tasks.filter(t => isOverdueTask(t)).length

        // Due today: due_at is today and not done
        const dueToday = tasks.filter(t => {
            if (!t.due_at || t.status === "Done") return false
            const dueDate = new Date(t.due_at).toISOString().split("T")[0]
            return dueDate === today
        }).length

        // High priority and not done
        const highPriority = tasks.filter(t => (t.priority === "High" || t.priority === "Urgent") && t.status !== "Done").length
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0
        return { total, completed, pending, overdue, dueToday, highPriority, completionRate }
    }, [tasks, isOverdueTask])

    const projectStats = useMemo(() => {
        const total = projects.length
        const active = projects.filter(p => p.status === "Active").length
        const completed = projects.filter(p => p.status === "Completed").length
        const onHold = projects.filter(p => p.status === "On Hold").length
        return { total, active, completed, onHold }
    }, [projects])

    const activeProjects = useMemo(() => {
        return projects
            .filter(p => p.status === "Active")
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .slice(0, 3)
    }, [projects])

    const activityGrid = useMemo(() => {
        const COLS = 40
        const DAYS = 7
        const byDate = {}
        tasks.forEach(t => {
            const dateKey = t.due_at ? t.due_at.split("T")[0] : (t.created_at ? t.created_at.split("T")[0] : null)
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
                if (!a.due_at && !b.due_at) return 0
                if (!a.due_at) return 1
                if (!b.due_at) return -1
                return new Date(a.due_at) - new Date(b.due_at)
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
                                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5 w-full">
                                    {[
                                        { label: "Total", value: stats.total, color: "#3b82f6" },
                                        { label: "Completed", value: stats.completed, color: "#22c55e" },
                                        { label: "Pending", value: stats.pending, color: "#f59e0b" },
                                        { label: "Overdue", value: stats.overdue, color: "#ef4444" },
                                    ].map(s => (
                                        <div key={s.label} className="w-full bg-white/70 backdrop-blur-sm rounded-xl px-3 sm:px-4 py-3 sm:py-2.5 border border-white/80">
                                            <p className="text-[9px] sm:text-[10px] font-semibold text-[#86868b] uppercase tracking-wide mb-0.5">{s.label}</p>
                                            <p className="text-[18px] sm:text-[22px] font-bold leading-tight" style={{ color: s.color }}>{s.value}</p>
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

                        {/* Projects Overview */}
                        <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-5 sm:p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-[14px] font-bold text-[#1d1d1f] flex items-center gap-2">
                                    <FaFolder className="w-4 h-4 text-[#C6FF00]" />
                                    Projects Overview
                                </h2>
                                <Link to="/dashboard/projects" className="text-[11px] font-semibold text-[#86868b] hover:text-[#1d1d1f] transition-colors flex items-center gap-1">
                                    All projects
                                    <FaChevronRight className="w-3 h-3" />
                                </Link>
                            </div>

                            {projects.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-8 gap-2">
                                    <FaFolder className="w-10 h-10 text-[#d2d2d7]" />
                                    <p className="text-[12px] text-[#86868b]">No projects yet</p>
                                    <Link to="/dashboard/projects" className="text-[11px] font-semibold text-[#C6FF00] hover:underline">
                                        Create your first project
                                    </Link>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {/* Project Stats */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                                        {[
                                            { label: "Total", value: projectStats.total, color: "#3b82f6" },
                                            { label: "Active", value: projectStats.active, color: "#22c55e" },
                                            { label: "Completed", value: projectStats.completed, color: "#10b981" },
                                            { label: "On Hold", value: projectStats.onHold, color: "#f59e0b" },
                                        ].map(s => (
                                            <div key={s.label} className="bg-[#f9f9fb] rounded-xl px-3 py-2.5 border border-[#f0f0f0]">
                                                <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wide mb-0.5">{s.label}</p>
                                                <p className="text-[18px] sm:text-[20px] font-bold leading-tight" style={{ color: s.color }}>{s.value}</p>
                                            </div>
                                        ))}
                                    </div>


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
                                    {/* Squares - wrapper maintains ratio based on column count */}
                                    <div className="w-full" style={{ aspectRatio: `${cols.length} / 7` }}>
                                        <div className="flex gap-[2px] h-full">
                                            <div className="flex flex-col gap-[2px] w-5 mr-1 flex-shrink-0 h-full">
                                                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                                                    <div key={i} className="flex items-center justify-center flex-1">
                                                        <span className="text-[9px] text-[#86868b] font-medium">{i % 2 === 0 ? d : ""}</span>
                                                    </div>
                                                ))}
                                            </div>
                                            {cols.map((col, i) => (
                                                <div key={i} className="flex flex-col gap-[2px] flex-1 h-full">
                                                    {col.map((level, j) => (
                                                        <div
                                                            key={`${i}-${j}`}
                                                            className={`w-full flex-1 rounded-[2px] ${level === 0 ? "bg-[#f0f0f0]" :
                                                                level === 1 ? "bg-[#dff5a0]" :
                                                                    level === 2 ? "bg-[#c8ef52]" :
                                                                        level === 3 ? "bg-[#b8e616]" : "bg-[#C6FF00]"
                                                                }`}
                                                        ></div>
                                                    ))}
                                                </div>
                                            ))}
                                        </div>
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

                        {/* Focus Today - Compact & Responsive */}
                        <div className="flex-1 flex flex-col bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-3 sm:p-6">
                            {/* Header + Stats */}
                            <div className="mb-2.5 sm:mb-4 pb-2.5 sm:pb-4 border-b border-[#f0f0f0]">
                                <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                                    <h2 className="text-[12px] sm:text-[14px] font-bold text-[#1d1d1f]">Focus Today</h2>
                                    <Link to="/dashboard/tasks" className="text-[9px] sm:text-[11px] font-semibold text-[#86868b] hover:text-[#1d1d1f] transition-colors">See all</Link>
                                </div>
                                {/* Inline Stats - Responsive */}
                                <div className="flex gap-1.5 sm:gap-3">
                                    <div className="flex-1 flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 rounded-lg bg-[#e0f2ff] border border-[#bfdbfe]/40">
                                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[#3b82f6] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                        <div className="min-w-0">
                                            <p className="text-[7px] sm:text-[10px] font-semibold text-[#3b82f6] uppercase leading-none">Due Today</p>
                                            <p className="text-[12px] sm:text-[15px] font-bold text-[#1d1d1f] leading-none mt-0.5">{stats.dueToday}</p>
                                        </div>
                                    </div>
                                    <div className={`flex-1 flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 rounded-lg border ${stats.overdue > 0 ? "bg-[#fee2e2] border-[#fecaca]/40" : "bg-[#f0fdf4] border-[#bbf7d0]/40"}`}>
                                        {stats.overdue > 0
                                            ? <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[#dc2626] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                            : <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[#16a34a] flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                        }
                                        <div className="min-w-0">
                                            <p className={`text-[7px] sm:text-[10px] font-semibold uppercase leading-none ${stats.overdue > 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>Overdue</p>
                                            <p className={`text-[12px] sm:text-[15px] font-bold leading-none mt-0.5 ${stats.overdue > 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{stats.overdue > 0 ? stats.overdue : "—"}</p>
                                        </div>
                                    </div>
                                    <div className={`flex-1 flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 rounded-lg ${stats.highPriority > 0 ? "bg-[#fff7ed] border border-[#fed7aa]/40" : "bg-[#f5f5f7] border border-[#d1d5db]/50"}`}>
                                        <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[#f97316] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M5 3l14 9-14 9V3z" /></svg>
                                        <div className="min-w-0">
                                            <p className="text-[7px] sm:text-[10px] font-semibold text-[#f97316] uppercase leading-none">Urg/High</p>
                                            <p className="text-[12px] sm:text-[15px] font-bold text-[#1d1d1f] leading-none mt-0.5">{stats.highPriority}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Upcoming Tasks - Scrollable, fills all space */}
                            <div className="flex-1 flex flex-col min-h-0">
                                <p className="text-[9px] sm:text-[11px] font-bold text-[#86868b] uppercase tracking-wide mb-1.5 sm:mb-2.5">Upcoming</p>
                                {upcomingTasks.length === 0 ? (
                                    <div className="flex items-center justify-center flex-1 py-6">
                                        <div className="text-center">
                                            <svg className="w-8 h-8 sm:w-10 sm:h-10 text-[#d2d2d7] mx-auto mb-2 sm:mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <p className="text-[11px] sm:text-[12px] font-semibold text-[#86868b] mb-0.5">All caught up!</p>
                                            <p className="text-[9px] sm:text-[10px] text-[#d2d2d7]">No upcoming tasks</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 overflow-y-auto min-h-0 pr-1 space-y-0.5 sm:space-y-1 scrollbar-thin scrollbar-thumb-[#d2d2d7] scrollbar-track-transparent hover:scrollbar-thumb-[#86868b]">
                                        {upcomingTasks.slice(0, 3).map(task => {
                                            const hasDueDate = !!task.due_at
                                            const d = hasDueDate ? new Date(task.due_at) : null
                                            const mon = d ? d.toLocaleString("en-US", { month: "short" }).toUpperCase() : null
                                            const day = d ? d.getDate() : null
                                            const time = d ? d.toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true }) : null
                                            return (
                                                <div key={task.id} className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2.5 rounded-lg hover:bg-[#f5f5f7] transition-colors duration-200 group border border-[#d2d2d7]/30">
                                                    <div className="bg-[#f5f5f7] group-hover:bg-white rounded-lg flex flex-col items-center justify-center w-8 h-8 sm:w-10 sm:h-10 flex-shrink-0 transition-colors border border-[#d2d2d7]/40 text-[8px] sm:text-[10px]">
                                                        {hasDueDate ? (
                                                            <>
                                                                <span className="font-bold text-[#86868b] leading-none">{mon}</span>
                                                                <span className="font-bold text-[#1d1d1f] leading-none">{day}</span>
                                                            </>
                                                        ) : (
                                                            <svg className="w-3 h-3 sm:w-4 sm:h-4 text-[#86868b]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                                        )}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                                                            <p className="text-[10px] sm:text-[12px] font-semibold text-[#1d1d1f] truncate leading-tight">{task.title}</p>
                                                            {isOverdueTask(task) && <span className="text-[7px] sm:text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 flex-shrink-0 whitespace-nowrap">OVERDUE</span>}
                                                            {!isOverdueTask(task) && isOverdueSoon(task) && <span className="text-[7px] sm:text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 flex-shrink-0 whitespace-nowrap">DUE SOON</span>}
                                                        </div>
                                                        <span className={`inline-block text-[7px] sm:text-[9px] font-bold px-1 py-0.5 rounded ${task.priority === "Urgent" ? "bg-red-50 text-red-600" :
                                                            task.priority === "High" ? "bg-orange-50 text-orange-600" :
                                                                task.priority === "Medium" ? "bg-blue-50 text-blue-600" :
                                                                    "bg-[#f5f5f7] text-[#86868b]"
                                                            }`}>{task.priority || "—"}</span>
                                                    </div>
                                                    {hasDueDate && time && (
                                                        <div className="flex-shrink-0 text-right">
                                                            <p className="text-[8px] sm:text-[10px] font-semibold text-[#86868b]">{time}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}
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


                    </div>
                </div>
            )}

        </div>
    )
}
