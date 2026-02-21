import { useEffect, useState, useMemo } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { Link } from "react-router-dom"
import { FaSearch, FaEllipsisH, FaTimes, FaCalendar, FaFilter, FaPlus, FaFolder } from "react-icons/fa"
import { formatTimestamp } from "../lib/dateUtils"

export default function Tasks() {
    const { user } = useAuth()

    // Utility: get current local time in HH:MM format
    const getCurrentTime = () => {
        const now = new Date()
        const hh = String(now.getHours()).padStart(2, '0')
        const mm = String(now.getMinutes()).padStart(2, '0')
        return `${hh}:${mm}`
    }

    const [tasks, setTasks] = useState([])
    const [types, setTypes] = useState([])
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        title: "",
        description: "",
        type_id: "",
        project_id: "",
        due_date: "",
        due_time: getCurrentTime(),
        priority: "Medium",
        status: "To Do"
    })
    const [editing, setEditing] = useState(null)
    const [error, setError] = useState("")
    const [message, setMessage] = useState("")
    const [searchTerm, setSearchTerm] = useState("")
    const [filterStatus, setFilterStatus] = useState("")
    const [filterType, setFilterType] = useState("")
    const [filterPriority, setFilterPriority] = useState("")
    const [sortBy, setSortBy] = useState("due_at") // due_at, created_at, priority
    const [selectedTask, setSelectedTask] = useState(null) // for details modal
    const [actionMenu, setActionMenu] = useState(null) // for task actions menu
    const [showFilters, setShowFilters] = useState(false)
    const [showTaskModal, setShowTaskModal] = useState(false)

    const statusOptions = ["To Do", "In Progress", "Done", "Cancelled"]
    const priorityOptions = ["Low", "Medium", "High", "Urgent"]
    const priorityColors = {
        "Low": "#86868b",
        "Medium": "#3b82f6",
        "High": "#f97316",
        "Urgent": "#ef4444"
    }

    // Utility: Convert local date/time to ISO UTC timestamp
    const buildDueAt = (date, time) => {
        if (!date) return null
        const timeValue = time || getCurrentTime()
        const localDate = new Date(`${date}T${timeValue}:00`)
        return localDate.toISOString()
    }

    // Utility: Extract local date and time from ISO UTC timestamp
    const extractDateAndTime = (dueAt) => {
        if (!dueAt) return { date: "", time: getCurrentTime() }
        const utcDate = new Date(dueAt)
        const year = utcDate.getFullYear()
        const month = String(utcDate.getMonth() + 1).padStart(2, '0')
        const day = String(utcDate.getDate()).padStart(2, '0')
        const date = `${year}-${month}-${day}`
        const hours = String(utcDate.getHours()).padStart(2, '0')
        const minutes = String(utcDate.getMinutes()).padStart(2, '0')
        const time = `${hours}:${minutes}`
        return { date, time }
    }

    // Utility: Format ISO timestamp to readable local date+time
    const formatDueDateTime = (dueAt) => {
        if (!dueAt) return "No due date"
        const date = new Date(dueAt)
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined })
        const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        return `${dateStr} at ${timeStr}`
    }

    // Utility: Get default reminders based on due_at timestamp
    // Utility: Check if task is overdue (local comparison)
    const isOverdueTask = (task) => {
        if (!task.due_at || task.status === "Done" || task.status === "Cancelled") return false
        const now = new Date()
        const dueDate = new Date(task.due_at)
        return dueDate < now
    }

    // Utility: Check if due_at is today
    const isTodayTask = (dueAt) => {
        if (!dueAt) return false
        const today = new Date()
        const due = new Date(dueAt)
        return today.getFullYear() === due.getFullYear() &&
            today.getMonth() === due.getMonth() &&
            today.getDate() === due.getDate()
    }

    // Utility: Check if due_at is within next 7 days
    const isUpcomingTask = (dueAt) => {
        if (!dueAt) return false
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        const due = new Date(dueAt)
        due.setHours(0, 0, 0, 0)
        const upcoming = new Date(today)
        upcoming.setDate(upcoming.getDate() + 7)
        return due > today && due <= upcoming
    }

    useEffect(() => {
        if (!user) return
        fetchTypes()
        fetchProjects()
        fetchTasks()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    const fetchProjects = async () => {
        try {
            const { data, error } = await supabase
                .from("projects")
                .select("*")
                .eq("user_id", user.id)
                .eq("status", "Active")
                .order("created_at", { ascending: false })
            if (error) setProjects([])
            else setProjects(data || [])
        } catch {
            setProjects([])
        }
    }

    const fetchTypes = async () => {
        try {
            const { data, error } = await supabase
                .from("task_types")
                .select("*, tasks(id)")
                .eq("user_id", user.id)
                .eq("status", "Active")
                .order("created_at", { ascending: false })
            if (error) setTypes([])
            else setTypes(data || [])
        } catch {
            setTypes([])
        }
    }

    const fetchTasks = async () => {
        setLoading(true)
        try {
            // PRIMARY: Fetch from Supabase (source of truth for cross-device sync)
            const { data, error } = await supabase
                .from("tasks")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
            if (error) {
                // FALLBACK: Use local cache if Supabase unavailable
                const cached = localStorage.getItem(`tasks_${user.id}`)
                if (cached) setTasks(JSON.parse(cached))
                else setTasks([])
            } else {
                setTasks(data || [])
                // Cache locally for offline fallback only
                localStorage.setItem(`tasks_${user.id}`, JSON.stringify(data || []))
            }
        } catch {
            // Network error - use cached data
            const cached = localStorage.getItem(`tasks_${user.id}`)
            setTasks(cached ? JSON.parse(cached) : [])
        } finally {
            setLoading(false)
        }
    }

    const createTask = async (e) => {
        e.preventDefault()
        setError("")
        if (!form.title.trim()) return setError("Please enter a task title.")
        if (!form.type_id) return setError("Please select a task type.")
        setLoading(true)

        const due_at = buildDueAt(form.due_date, form.due_time)

        const payload = {
            user_id: user.id,
            title: form.title.trim(),
            description: (form.description || "").trim() || null,
            type_id: form.type_id,
            project_id: form.project_id || null,
            status: form.status || "To Do",
            priority: form.priority || "Medium",
            due_at: due_at,
            updated_at: new Date().toISOString(),
        }

        try {
            if (editing) {
                // update existing task
                await updateTask(editing, payload)
                setMessage("Task updated.")
            } else {
                // create new task
                payload.created_at = new Date().toISOString()
                const { data, error } = await supabase.from("tasks").insert([payload]).select().single()
                if (error) {
                    setTasks(prev => [{ ...payload, id: Date.now() }, ...prev])
                    setMessage("Saved locally â€” server insert failed.")
                } else {
                    setTasks(prev => [data, ...prev])
                    setMessage("Task created.")
                }
            }

            setForm({ title: "", description: "", type_id: "", project_id: "", due_date: "", due_time: getCurrentTime(), priority: "Medium", status: "To Do" })
            setEditing(null)
            setShowTaskModal(false)
            setTimeout(() => setMessage(""), 2000)
        } catch {
            setError(editing ? "Failed to update task." : "Failed to create task.")
        } finally {
            setLoading(false)
        }
    }

    const updateTask = async (taskId, updates) => {
        try {
            await supabase
                .from("tasks")
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq("id", taskId)
                .eq("user_id", user.id)

            setTasks(prev => prev.map(t =>
                t.id === taskId ? { ...t, ...updates, updated_at: new Date().toISOString() } : t
            ))
            setMessage("Task updated.")
            setTimeout(() => setMessage(""), 2000)
        } catch {
            setError("Failed to update task.")
        }
    }

    const toggleComplete = async (task) => {
        const newStatus = task.status === "Done" ? "To Do" : "Done"
        const completed_at = newStatus === "Done" ? new Date().toISOString() : null
        await updateTask(task.id, { status: newStatus, completed_at })
    }

    const duplicateTask = async (task) => {
        const newTask = {
            user_id: user.id,
            title: `${task.title} (copy)`,
            description: task.description,
            type_id: task.type_id,
            project_id: task.project_id,
            status: "To Do",
            priority: task.priority,
            due_at: task.due_at,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }

        try {
            const { data, error } = await supabase.from("tasks").insert([newTask]).select().single()
            if (!error && data) {
                setTasks(prev => [data, ...prev])
                setMessage("Task duplicated.")
                setTimeout(() => setMessage(""), 2000)
            }
        } catch {
            setError("Failed to duplicate task.")
        }
    }

    const deleteTask = async (taskId) => {
        setTasks(prev => prev.filter(t => t.id !== taskId))
        setActionMenu(null)
        try {
            await supabase.from("tasks").delete().eq("id", taskId).eq("user_id", user.id)
        } catch {
            setError("Failed to delete task.")
        }
    }

    const filterAndSortTasks = () => {
        let filtered = tasks.filter(task => {
            const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesStatus = !filterStatus || task.status === filterStatus
            const matchesType = !filterType || task.type_id === filterType
            const matchesPriority = !filterPriority || task.priority === filterPriority
            return matchesSearch && matchesStatus && matchesType && matchesPriority
        })
        filtered.sort((a, b) => {
            if (sortBy === "due_at") {
                const da = a.due_at ? new Date(a.due_at) : new Date(9999, 0, 0)
                const db = b.due_at ? new Date(b.due_at) : new Date(9999, 0, 0)
                return da - db
            } else if (sortBy === "priority") {
                const o = { "Urgent": 0, "High": 1, "Medium": 2, "Low": 3 }
                return (o[a.priority] || 2) - (o[b.priority] || 2)
            }
            return new Date(b.created_at) - new Date(a.created_at)
        })
        return filtered
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const sections = useMemo(() => {
        const filtered = filterAndSortTasks()
        const s = { overdue: [], today: [], upcoming: [], other: [], completed: [] }
        filtered.forEach(task => {
            if (task.status === "Done" || task.status === "Cancelled") s.completed.push(task)
            else if (isOverdueTask(task)) s.overdue.push(task)
            else if (isTodayTask(task.due_at)) s.today.push(task)
            else if (isUpcomingTask(task.due_at)) s.upcoming.push(task)
            else s.other.push(task)
        })
        return s
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tasks, searchTerm, filterStatus, filterType, filterPriority, sortBy])

    const taskStats = useMemo(() => ({
        total: tasks.length,
        todo: tasks.filter(t => t.status === "To Do").length,
        inProgress: tasks.filter(t => t.status === "In Progress").length,
        done: tasks.filter(t => t.status === "Done").length,
        overdue: tasks.filter(t => isOverdueTask(t)).length,
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [tasks])

    const priorityBgs = { "Low": "#f5f5f7", "Medium": "#eff6ff", "High": "#fff7ed", "Urgent": "#fef2f2" }
    const statusColors = {
        "To Do": { bg: "#f5f5f7", text: "#86868b" },
        "In Progress": { bg: "#eff6ff", text: "#3b82f6" },
        "Done": { bg: "#f0fdf4", text: "#16a34a" },
        "Cancelled": { bg: "#fef2f2", text: "#dc2626" }
    }

    const openCreate = () => {
        setEditing(null)
        setForm({ title: "", description: "", type_id: "", project_id: "", due_date: "", due_time: getCurrentTime(), priority: "Medium", status: "To Do" })
        setShowTaskModal(true)
    }

    const openEdit = (task) => {
        const { date, time } = extractDateAndTime(task.due_at)
        setForm({ title: task.title || "", description: task.description || "", type_id: task.type_id || "", project_id: task.project_id || "", due_date: date, due_time: time, priority: task.priority || "Medium", status: task.status || "To Do" })
        setEditing(task.id)
        setSelectedTask(null)
        setActionMenu(null)
        setShowTaskModal(true)
    }

    const resetForm = () => {
        setForm({ title: "", description: "", type_id: "", project_id: "", due_date: "", due_time: getCurrentTime(), priority: "Medium", status: "To Do" })
        setEditing(null)
        setShowTaskModal(false)
    }

    const TaskCard = ({ task }) => {
        const taskType = types.find(t => t.id === task.type_id)
        const overdue = isOverdueTask(task)
        const isDone = task.status === "Done" || task.status === "Cancelled"
        const project = projects.find(p => p.id === task.project_id)

        return (
            <div className={`group relative flex items-start gap-3 p-3.5 sm:p-4 rounded-[16px] sm:rounded-[18px] transition-all duration-200 ${isDone ? "bg-[#f9f9f9] opacity-70" :
                overdue ? "bg-red-50 border border-red-200/60" :
                    "bg-white border border-[#d2d2d7]/50 hover:border-[#d2d2d7] hover:shadow-sm"
                }`}>
                {/* Checkbox */}
                <button
                    onClick={() => toggleComplete(task)}
                    className={`mt-0.5 w-5 h-5 sm:w-[22px] sm:h-[22px] rounded-full flex items-center justify-center flex-shrink-0 transition-all ${task.status === "Done" ? "bg-[#22c55e]" : "border-2 border-[#d2d2d7] hover:border-[#C6FF00] bg-white"
                        }`}
                >
                    {task.status === "Done" && (
                        <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M5 13l4 4L19 7" />
                        </svg>
                    )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                            <p className={`text-[13px] sm:text-[14px] font-semibold leading-snug ${isDone ? "line-through text-[#86868b]" : "text-[#1d1d1f]"}`}>
                                {task.title}
                            </p>
                            {task.description && (
                                <p className="text-[11px] sm:text-[12px] text-[#86868b] mt-0.5 line-clamp-1">{task.description}</p>
                            )}
                        </div>
                        {/* Three-dot menu */}
                        <div className="relative flex-shrink-0">
                            <button
                                onClick={(e) => { e.stopPropagation(); setActionMenu(actionMenu === task.id ? null : task.id) }}
                                className="p-1.5 rounded-lg hover:bg-[#f5f5f7] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                            >
                                <FaEllipsisH className="w-3.5 h-3.5 text-[#86868b]" />
                            </button>
                            {actionMenu === task.id && (
                                <div className="absolute right-0 mt-1 bg-white rounded-[12px] border border-[#d2d2d7]/80 shadow-xl z-50 min-w-[150px] overflow-hidden" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => { setSelectedTask(task); setActionMenu(null) }} className="w-full text-left px-3.5 py-2.5 hover:bg-[#f5f5f7] text-[12px] font-medium text-[#1d1d1f]">View Details</button>
                                    <button onClick={() => openEdit(task)} className="w-full text-left px-3.5 py-2.5 hover:bg-[#f5f5f7] text-[12px] font-medium text-[#1d1d1f]">Edit</button>
                                    <button onClick={() => { duplicateTask(task); setActionMenu(null) }} className="w-full text-left px-3.5 py-2.5 hover:bg-[#f5f5f7] text-[12px] font-medium text-[#1d1d1f]">Duplicate</button>
                                    <div className="border-t border-[#f0f0f0]" />
                                    <button onClick={() => deleteTask(task.id)} className="w-full text-left px-3.5 py-2.5 hover:bg-red-50 text-[12px] font-medium text-red-600">Delete</button>
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Tags */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        {overdue && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">OVERDUE</span>}
                        {task.status && <span className="text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full" style={{ backgroundColor: statusColors[task.status]?.bg, color: statusColors[task.status]?.text }}>{task.status}</span>}
                        {taskType && (
                            <span className="text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-white"
                                style={{ backgroundColor: taskType.color || "#C6FF00", color: "#1d1d1f" }}>
                                {taskType.name}
                            </span>
                        )}
                        <span className="text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
                            style={{ backgroundColor: priorityBgs[task.priority], color: priorityColors[task.priority] }}>
                            {task.priority}
                        </span>
                        {task.due_at && (
                            <span className={`text-[10px] sm:text-[11px] font-medium flex items-center gap-1 ${overdue ? "text-red-500" : "text-[#86868b]"}`}>
                                <FaCalendar className="w-2.5 h-2.5" />
                                {formatDueDateTime(task.due_at)}
                            </span>
                        )}
                        {project && (
                            <span className="text-[10px] sm:text-[11px] font-medium flex items-center gap-1 text-[#86868b]">
                                <FaFolder className="w-2.5 h-2.5" />
                                {project.name}
                            </span>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    const TaskSection = ({ title, tasks: taskList, accentColor, dotColor }) => {
        if (taskList.length === 0) return null
        return (
            <div>
                <div className="flex items-center gap-2 mb-3 px-0.5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor || "#d2d2d7" }}></div>
                    <h3 className="text-[11px] sm:text-[12px] font-bold uppercase tracking-widest" style={{ color: accentColor || "#86868b" }}>{title}</h3>
                    <span className="text-[10px] font-semibold text-[#86868b] bg-[#f5f5f7] rounded-full px-2 py-0.5">{taskList.length}</span>
                </div>
                <div className="space-y-2 sm:space-y-2.5">
                    {taskList.map(task => <TaskCard key={task.id} task={task} />)}
                </div>
            </div>
        )
    }

    const totalVisible = filterAndSortTasks().length

    return (
        <div className="animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-10" onClick={() => setActionMenu(null)}>

            {/* Page Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6 sm:mb-8 px-0.5">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Workspace</p>
                    <h1 className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] tracking-tight leading-tight">Tasks</h1>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); openCreate() }}
                    className="flex items-center gap-2 px-4 sm:px-5 py-2.5 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-bold rounded-[11px] sm:rounded-[12px] text-[13px] sm:text-[14px] transition-colors self-start sm:self-auto"
                >
                    <FaPlus className="w-3 h-3" />
                    New Task
                </button>
            </div>

            {/* Stats Banner */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3 mb-5 sm:mb-6">
                {[
                    { label: "Total", value: taskStats.total, color: "#3b82f6" },
                    { label: "To Do", value: taskStats.todo, color: "#86868b" },
                    { label: "In Progress", value: taskStats.inProgress, color: "#f59e0b" },
                    { label: "Completed", value: taskStats.done, color: "#22c55e" },
                    { label: "Overdue", value: taskStats.overdue, color: "#ef4444" },
                ].map(s => (
                    <div key={s.label} className="bg-white rounded-[16px] sm:rounded-[18px] border border-[#d2d2d7]/50 px-3.5 sm:px-4 py-3 sm:py-3.5 shadow-sm">
                        <p className="text-[10px] sm:text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1">{s.label}</p>
                        <p className="text-[20px] sm:text-[22px] font-bold leading-tight" style={{ color: s.color }}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Search + Filter Bar */}
            <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-4 sm:p-5 mb-5 sm:mb-6">
                <div className="flex gap-2.5 sm:gap-3">
                    <div className="flex-1 relative">
                        <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b] w-3.5 h-3.5" />
                        <input
                            type="text"
                            placeholder="Search tasks..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-[#f5f5f7] rounded-[11px] border border-transparent focus:border-[#C6FF00]/50 focus:bg-white text-[13px] sm:text-[14px] transition-all outline-none"
                            onClick={e => e.stopPropagation()}
                        />
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowFilters(!showFilters) }}
                        className={`flex items-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-[11px] border text-[12px] sm:text-[13px] font-semibold transition-all ${showFilters ? "bg-[#C6FF00] border-[#C6FF00] text-[#1d1d1f]" : "bg-[#f5f5f7] border-[#d2d2d7] text-[#1d1d1f] hover:bg-white"}`}
                    >
                        <FaFilter className="w-3 h-3" />
                        <span className="hidden sm:inline">Filters</span>
                        {(filterStatus || filterType || filterPriority) && <span className="w-1.5 h-1.5 rounded-full bg-[#1d1d1f]"></span>}
                    </button>
                </div>
                {showFilters && (
                    <div className="mt-4 pt-4 border-t border-[#f0f0f0]">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5" onClick={e => e.stopPropagation()}>
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-3 py-2.5 bg-[#f5f5f7] rounded-[10px] text-[12px] sm:text-[13px] border border-transparent focus:border-[#C6FF00]/50 focus:bg-white outline-none transition-all">
                                <option value="">All Statuses</option>
                                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                                className="px-3 py-2.5 bg-[#f5f5f7] rounded-[10px] text-[12px] sm:text-[13px] border border-transparent focus:border-[#C6FF00]/50 focus:bg-white outline-none transition-all">
                                <option value="">All Types</option>
                                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
                                className="px-3 py-2.5 bg-[#f5f5f7] rounded-[10px] text-[12px] sm:text-[13px] border border-transparent focus:border-[#C6FF00]/50 focus:bg-white outline-none transition-all">
                                <option value="">All Priorities</option>
                                {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
                                className="px-3 py-2.5 bg-[#f5f5f7] rounded-[10px] text-[12px] sm:text-[13px] border border-transparent focus:border-[#C6FF00]/50 focus:bg-white outline-none transition-all">
                                <option value="due_at">Sort: Due Date</option>
                                <option value="priority">Sort: Priority</option>
                                <option value="created_at">Sort: Created</option>
                            </select>
                        </div>
                        {(filterStatus || filterType || filterPriority || searchTerm) && (
                            <button onClick={() => { setFilterStatus(""); setFilterType(""); setFilterPriority(""); setSearchTerm("") }}
                                className="mt-3 text-[11px] font-semibold text-[#86868b] hover:text-[#1d1d1f] transition-colors flex items-center gap-1">
                                <FaTimes className="w-2.5 h-2.5" /> Clear all filters
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Task List */}
            <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-4 sm:p-5 md:p-6">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="w-7 h-7 border-4 border-[#C6FF00] border-t-transparent rounded-full animate-spin"></div>
                    </div>
                ) : totalVisible === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <div className="w-14 h-14 rounded-full bg-[#f5f5f7] flex items-center justify-center">
                            <svg className="w-7 h-7 text-[#d2d2d7]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-[14px] font-semibold text-[#1d1d1f]">No tasks found</p>
                            <p className="text-[12px] text-[#86868b] mt-0.5">{tasks.length === 0 ? "Create your first task to get started." : "Try adjusting your filters."}</p>
                        </div>
                        {tasks.length === 0 && (
                            <button onClick={openCreate} className="mt-1 px-4 py-2 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-bold rounded-[10px] text-[13px] transition-colors">
                                Create a Task
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-6 sm:space-y-8">
                        <TaskSection title="Overdue" tasks={sections.overdue} accentColor="#ef4444" dotColor="#ef4444" />
                        <TaskSection title="Today" tasks={sections.today} accentColor="#f59e0b" dotColor="#f59e0b" />
                        <TaskSection title="Upcoming" tasks={sections.upcoming} accentColor="#3b82f6" dotColor="#3b82f6" />
                        <TaskSection title="Other" tasks={sections.other} accentColor="#86868b" dotColor="#d2d2d7" />
                        <TaskSection title="Completed" tasks={sections.completed} accentColor="#22c55e" dotColor="#22c55e" />
                    </div>
                )}
            </div>

            {/* â”€â”€ Create / Edit Modal â”€â”€ */}
            {showTaskModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] overflow-y-auto z-50" onClick={() => { setShowTaskModal(false); setEditing(null) }}>
                    <div className="flex min-h-full items-start sm:items-center pt-[80px] sm:pt-0 justify-center p-0 sm:p-4">
                        <div className="bg-white w-full sm:max-w-lg rounded-t-[24px] sm:rounded-[24px] shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-[#f0f0f0]">
                                <div>
                                    <h3 className="text-[16px] sm:text-[18px] font-bold text-[#1d1d1f]">{editing ? "Edit Task" : "New Task"}</h3>
                                    <p className="text-[12px] text-[#86868b] mt-0.5">{editing ? "Update task details" : "Add a new task to your workspace"}</p>
                                </div>
                                <button onClick={() => { setShowTaskModal(false); setEditing(null) }} className="p-2 hover:bg-[#f5f5f7] rounded-full transition-colors">
                                    <FaTimes className="w-4 h-4 text-[#86868b]" />
                                </button>
                            </div>
                            <form onSubmit={createTask} className="px-5 sm:px-6 py-4 sm:py-5 space-y-4 overflow-y-auto max-h-[75vh] sm:max-h-[80vh]">
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Title *</label>
                                    <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Finish report"
                                        className="w-full px-4 py-2.5 sm:py-3 bg-[#f5f5f7] rounded-[11px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white text-[14px] outline-none transition-all" />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Type *</label>
                                    <select value={form.type_id} onChange={(e) => setForm(f => ({ ...f, type_id: e.target.value }))}
                                        className="w-full px-4 py-2.5 sm:py-3 bg-[#f5f5f7] rounded-[11px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white text-[14px] outline-none transition-all">
                                        <option value="">Select a type</option>
                                        {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    {types.length === 0 && (
                                        <p className="text-[11px] text-[#86868b] mt-1.5">No active types. <Link to="/dashboard/task-types" className="text-[#86b300] font-semibold hover:underline">Create types</Link></p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Project</label>
                                    <select value={form.project_id} onChange={(e) => setForm(f => ({ ...f, project_id: e.target.value }))}
                                        className="w-full px-4 py-2.5 sm:py-3 bg-[#f5f5f7] rounded-[11px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white text-[14px] outline-none transition-all">
                                        <option value="">No Project</option>
                                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Priority</label>
                                        <select value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                                            className="w-full px-4 py-2.5 sm:py-3 bg-[#f5f5f7] rounded-[11px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white text-[14px] outline-none transition-all">
                                            {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Status</label>
                                        <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
                                            className="w-full px-4 py-2.5 sm:py-3 bg-[#f5f5f7] rounded-[11px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white text-[14px] outline-none transition-all">
                                            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Due Date</label>
                                        <input type="date" value={form.due_date} onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                                            className="w-full px-4 py-2.5 sm:py-3 bg-[#f5f5f7] rounded-[11px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white text-[14px] outline-none transition-all" />
                                    </div>
                                    <div>
                                        <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Time</label>
                                        <input type="time" value={form.due_time} onChange={(e) => setForm(f => ({ ...f, due_time: e.target.value }))}
                                            className="w-full px-4 py-2.5 sm:py-3 bg-[#f5f5f7] rounded-[11px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white text-[14px] outline-none transition-all" />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Notes</label>
                                    <textarea value={form.description || ""} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Add details or notes..."
                                        className="w-full px-4 py-2.5 sm:py-3 bg-[#f5f5f7] rounded-[11px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white text-[14px] resize-none outline-none transition-all" />
                                </div>
                                {error && <p className="text-[12px] text-red-600 font-medium bg-red-50 px-3 py-2 rounded-[8px]">{error}</p>}
                                {message && <p className="text-[12px] text-green-700 font-medium bg-green-50 px-3 py-2 rounded-[8px]">{message}</p>}
                                <div className="flex gap-2.5 pt-1 pb-1 sm:pb-0">
                                    <button type="submit" disabled={loading}
                                        className="flex-1 bg-[#C6FF00] hover:bg-[#b8f000] disabled:opacity-60 text-[#1d1d1f] font-bold py-2.5 sm:py-3 rounded-[11px] text-[14px] transition-colors">
                                        {loading ? (editing ? "Saving..." : "Creating...") : (editing ? "Update Task" : "Create Task")}
                                    </button>
                                    <button type="button" onClick={resetForm}
                                        className="px-5 py-2.5 sm:py-3 rounded-[11px] bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] font-semibold text-[14px] hover:bg-white transition-colors">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* â”€â”€ Task Details Modal â”€â”€ */}
            {selectedTask && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] overflow-y-auto z-50" onClick={() => setSelectedTask(null)}>
                    <div className="flex min-h-full items-start sm:items-center pt-[80px] sm:pt-0 justify-center p-0 sm:p-4">
                        <div className="bg-white w-full sm:max-w-lg rounded-t-[24px] sm:rounded-[24px] shadow-xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-[#f0f0f0]">
                                <h3 className="text-[16px] sm:text-[18px] font-bold text-[#1d1d1f]">Task Details</h3>
                                <button onClick={() => setSelectedTask(null)} className="p-2 hover:bg-[#f5f5f7] rounded-full transition-colors">
                                    <FaTimes className="w-4 h-4 text-[#86868b]" />
                                </button>
                            </div>
                            <div className="px-5 sm:px-6 py-4 sm:py-5 space-y-4 overflow-y-auto max-h-[70vh] sm:max-h-[75vh]">
                                <div>
                                    <div className="flex items-start justify-between gap-3 mb-1">
                                        <h4 className={`text-[16px] sm:text-[18px] font-bold leading-snug ${selectedTask.status === "Done" ? "line-through text-[#86868b]" : "text-[#1d1d1f]"}`}>
                                            {selectedTask.title}
                                        </h4>
                                        <span className="flex-shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full"
                                            style={{ backgroundColor: statusColors[selectedTask.status]?.bg, color: statusColors[selectedTask.status]?.text }}>
                                            {selectedTask.status}
                                        </span>
                                    </div>
                                    {selectedTask.description && (
                                        <p className="text-[13px] text-[#86868b] mt-2 whitespace-pre-wrap leading-relaxed">{selectedTask.description}</p>
                                    )}
                                </div>
                                <div className="space-y-0">
                                    <div className="flex items-center justify-between py-2.5 border-b border-[#f5f5f7]">
                                        <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Priority</span>
                                        <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full"
                                            style={{ backgroundColor: priorityBgs[selectedTask.priority], color: priorityColors[selectedTask.priority] }}>
                                            {selectedTask.priority}
                                        </span>
                                    </div>
                                    {selectedTask.type_id && (
                                        <div className="flex items-center justify-between py-2.5 border-b border-[#f5f5f7]">
                                            <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Type</span>
                                            {(() => { const t = types.find(x => x.id === selectedTask.type_id); return t ? <span className="text-[12px] font-bold px-2.5 py-0.5 rounded-full" style={{ backgroundColor: t.color || "#C6FF00", color: "#1d1d1f" }}>{t.name}</span> : <span className="text-[13px] font-semibold text-[#1d1d1f]">â€”</span> })()}
                                        </div>
                                    )}
                                    {selectedTask.project_id && (
                                        <div className="flex items-center justify-between py-2.5 border-b border-[#f5f5f7]">
                                            <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Project</span>
                                            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1d1d1f]">
                                                <FaFolder className="w-3.5 h-3.5 text-[#C6FF00]" />
                                                {projects.find(p => p.id === selectedTask.project_id)?.name || "â€”"}
                                            </span>
                                        </div>
                                    )}
                                    {selectedTask.due_at && (
                                        <div className="flex items-center justify-between py-2.5 border-b border-[#f5f5f7]">
                                            <span className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider">Due Date</span>
                                            <span className="flex items-center gap-1.5 text-[13px] font-semibold text-[#1d1d1f]">
                                                <FaCalendar className="w-3.5 h-3.5 text-[#86868b]" />
                                                {formatDueDateTime(selectedTask.due_at)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="bg-[#f9f9f9] rounded-[12px] p-3.5 space-y-2">
                                    <div className="flex justify-between"><span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">Created</span><span className="text-[11px] text-[#1d1d1f]">{formatTimestamp(selectedTask.created_at)}</span></div>
                                    <div className="flex justify-between"><span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">Updated</span><span className="text-[11px] text-[#1d1d1f]">{formatTimestamp(selectedTask.updated_at)}</span></div>
                                    {selectedTask.completed_at && <div className="flex justify-between"><span className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider">Completed</span><span className="text-[11px] text-[#1d1d1f]">{formatTimestamp(selectedTask.completed_at)}</span></div>}
                                </div>
                            </div>
                            <div className="flex gap-2.5 px-5 sm:px-6 pb-5 sm:pb-6 pt-3 border-t border-[#f0f0f0]">
                                <button onClick={() => openEdit(selectedTask)}
                                    className="flex-1 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-bold py-2.5 sm:py-3 rounded-[11px] text-[14px] transition-colors">
                                    Edit Task
                                </button>
                                <button onClick={() => setSelectedTask(null)}
                                    className="px-5 py-2.5 sm:py-3 rounded-[11px] bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] font-semibold text-[14px] hover:bg-white transition-colors">
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}
