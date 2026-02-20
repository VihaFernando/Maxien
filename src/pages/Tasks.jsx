import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { Link } from "react-router-dom"
import { FaSearch, FaEllipsisH, FaChevronDown, FaTimes, FaClock, FaCalendar, FaFlag } from "react-icons/fa"

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
    const [loading, setLoading] = useState(false)
    const [form, setForm] = useState({
        title: "",
        description: "",
        type_id: "",
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
        fetchTasks()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

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
                    setMessage("Saved locally — server insert failed.")
                } else {
                    setTasks(prev => [data, ...prev])
                    setMessage("Task created.")
                }
            }

            setForm({ title: "", description: "", type_id: "", due_date: "", due_time: getCurrentTime(), priority: "Medium", status: "To Do" })
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
                const dateA = a.due_at ? new Date(a.due_at) : new Date(9999, 0, 0)
                const dateB = b.due_at ? new Date(b.due_at) : new Date(9999, 0, 0)
                return dateA - dateB
            } else if (sortBy === "priority") {
                const priorityOrder = { "Urgent": 0, "High": 1, "Medium": 2, "Low": 3 }
                return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
            } else {
                return new Date(b.created_at) - new Date(a.created_at)
            }
        })

        return filtered
    }

    const groupTasksBySection = () => {
        const filtered = filterAndSortTasks()
        const sections = {
            overdue: [],
            today: [],
            upcoming: [],
            completed: [],
            other: []
        }

        filtered.forEach(task => {
            if (task.status === "Done") {
                sections.completed.push(task)
            } else if (isOverdueTask(task)) {
                sections.overdue.push(task)
            } else if (isTodayTask(task.due_at)) {
                sections.today.push(task)
            } else if (isUpcomingTask(task.due_at)) {
                sections.upcoming.push(task)
            } else {
                sections.other.push(task)
            }
        })

        return sections
    }

    const TaskCard = ({ task }) => {
        const taskType = types.find(t => t.id === task.type_id)
        const overdue = isOverdueTask(task)

        return (
            <div
                key={task.id}
                className={`p-4 rounded-[16px] flex items-start justify-between gap-4 transition-all duration-300 ${task.status === "Done"
                    ? "bg-[#f5f5f7] opacity-75"
                    : overdue
                        ? "bg-red-50 border border-red-200/50"
                        : "bg-white border border-[#d2d2d7]/50"
                    }`}
            >
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <button
                            onClick={() => toggleComplete(task)}
                            className={`w-6 h-6 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${task.status === "Done"
                                ? "bg-[#22c55e] text-white"
                                : "bg-white ring-2 ring-[#C6FF00] hover:ring-[#b8f000]"
                                }`}
                        >
                            {task.status === "Done" && (
                                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                            )}
                        </button>
                        <h4 className={`font-bold text-[15px] truncate ${task.status === "Done" ? "line-through text-[#86868b]" : "text-[#1d1d1f]"
                            }`}>
                            {task.title}
                        </h4>
                        {overdue && (
                            <span className="text-[11px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full flex-shrink-0">
                                OVERDUE
                            </span>
                        )}
                    </div>
                    {task.description && (
                        <p className="text-[13px] text-[#86868b] mb-2 truncate">{task.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2">
                        {taskType && (
                            <span
                                className="text-[12px] font-bold px-3 py-1.5 rounded-full text-white"
                                style={{ backgroundColor: taskType.color || "#C6FF00", color: "#1d1d1f" }}
                            >
                                {taskType.name}
                            </span>
                        )}
                        <span
                            className="text-[12px] font-bold px-3 py-1.5 rounded-full"
                            style={{ backgroundColor: `${priorityColors[task.priority]}20`, color: priorityColors[task.priority] }}
                        >
                            <FaFlag className="inline mr-1 w-3 h-3" />
                            {task.priority}
                        </span>
                        {task.due_at && (
                            <span className="text-[12px] text-[#86868b] flex items-center gap-1">
                                <FaCalendar className="w-3 h-3" />
                                {formatDueDateTime(task.due_at)}
                            </span>
                        )}
                    </div>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setActionMenu(actionMenu === task.id ? null : task.id)}
                        className="p-2 rounded-lg hover:bg-[#f5f5f7] transition-colors flex-shrink-0"
                    >
                        <FaEllipsisH className="w-4 h-4 text-[#86868b]" />
                    </button>

                    {actionMenu === task.id && (
                        <div className="absolute right-0 mt-2 bg-white rounded-[12px] border border-[#d2d2d7] shadow-lg z-50 min-w-[150px]">
                            <button
                                onClick={() => { setSelectedTask(task); setActionMenu(null); }}
                                className="w-full text-left px-4 py-2 hover:bg-[#f5f5f7] rounded-t-[12px] text-[13px] font-medium text-[#1d1d1f]"
                            >
                                View Details
                            </button>
                            <button
                                onClick={() => {
                                    const { date, time } = extractDateAndTime(task.due_at)
                                    setForm({
                                        title: task.title || "",
                                        description: task.description || "",
                                        type_id: task.type_id || "",
                                        due_date: date,
                                        due_time: time,
                                        priority: task.priority || "Medium",
                                        status: task.status || "To Do"
                                    })
                                    setEditing(task.id)
                                    setShowTaskModal(true)
                                    setActionMenu(null)
                                }}
                                className="w-full text-left px-4 py-2 hover:bg-[#f5f5f7] text-[13px] font-medium text-[#1d1d1f]"
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => { duplicateTask(task); setActionMenu(null); }}
                                className="w-full text-left px-4 py-2 hover:bg-[#f5f5f7] text-[13px] font-medium text-[#1d1d1f]"
                            >
                                Duplicate
                            </button>
                            <button
                                onClick={() => { deleteTask(task.id); }}
                                className="w-full text-left px-4 py-2 hover:bg-red-50 rounded-b-[12px] text-[13px] font-medium text-red-600"
                            >
                                Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    const TaskSection = ({ title, tasks: taskList, icon }) => {
        if (taskList.length === 0) return null
        return (
            <div className="space-y-3">
                <h3 className="text-[14px] font-bold text-[#1d1d1f] uppercase tracking-wider flex items-center gap-2 px-1">
                    {icon && <span className="text-[#C6FF00]">{icon}</span>}
                    {title}
                </h3>
                {taskList.map(task => <TaskCard key={task.id} task={task} />)}
            </div>
        )
    }

    const sections = groupTasksBySection()

    return (
        <div className="space-y-8 sm:space-y-10 lg:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <header className="space-y-2 px-1">
                {showTaskModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-[28px] p-6 shadow-sm w-full max-w-lg relative">
                            <button
                                onClick={() => setShowTaskModal(false)}
                                className="absolute top-4 right-4 p-2 hover:bg-[#f5f5f7] rounded-full"
                            >
                                <FaTimes className="w-5 h-5 text-[#86868b]" />
                            </button>
                            {/* Reuse existing form markup by copying inner contents here */}
                            <h3 className="text-[16px] font-bold mb-4">{editing ? "Edit Task" : "New Task"}</h3>
                            <form onSubmit={createTask} className="space-y-4">
                                <div>
                                    <label className="text-[12px] font-bold text-[#1d1d1f] ml-1 uppercase tracking-wider">Title</label>
                                    <input
                                        value={form.title}
                                        onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                                        placeholder="e.g. Finish report"
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/50 focus:bg-white text-[14px]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[12px] font-bold text-[#1d1d1f] ml-1 uppercase tracking-wider">Type</label>
                                    <select
                                        value={form.type_id}
                                        onChange={(e) => setForm(f => ({ ...f, type_id: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent text-[14px]"
                                    >
                                        <option value="">Select a type</option>
                                        {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                    {types.length === 0 && (
                                        <p className="text-[12px] text-[#86868b] mt-2">No active types. <Link to="/dashboard/task-types" className="text-[#86b300] font-medium">Create types</Link></p>
                                    )}
                                </div>
                                <div>
                                    <label className="text-[12px] font-bold text-[#1d1d1f] ml-1 uppercase tracking-wider">Priority</label>
                                    <select
                                        value={form.priority}
                                        onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent text-[14px]"
                                    >
                                        {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[12px] font-bold text-[#1d1d1f] ml-1 uppercase tracking-wider">Status</label>
                                    <select
                                        value={form.status}
                                        onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent text-[14px]"
                                    >
                                        {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[12px] font-bold text-[#1d1d1f] ml-1 uppercase tracking-wider">Due Date</label>
                                        <input
                                            type="date"
                                            value={form.due_date}
                                            onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                                            className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent text-[14px]"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[12px] font-bold text-[#1d1d1f] ml-1 uppercase tracking-wider">Time</label>
                                        <input
                                            type="time"
                                            value={form.due_time}
                                            onChange={(e) => setForm(f => ({ ...f, due_time: e.target.value }))}
                                            className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent text-[14px]"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[12px] font-bold text-[#1d1d1f] ml-1 uppercase tracking-wider">Notes</label>
                                    <textarea
                                        value={form.description || ""}
                                        onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                                        rows={3}
                                        placeholder="Add details..."
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent text-[14px] resize-none"
                                    />
                                </div>

                                {error && <div className="text-red-600 text-[13px] font-medium">{error}</div>}
                                {message && <div className="text-green-700 text-[13px] font-medium">{message}</div>}
                                <div className="flex gap-2">
                                    <button
                                        disabled={loading}
                                        className="flex-1 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-semibold py-3 rounded-xl"
                                    >
                                        {loading ? (editing ? "Saving..." : "Creating...") : (editing ? "Update Task" : "Create Task")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setEditing(null); setForm({ title: "", description: "", type_id: "", due_date: "", due_time: getCurrentTime(), priority: "Medium", status: "To Do" }); setShowTaskModal(false) }}
                                        className="px-4 py-3 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f]"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
                <h2 className="text-[28px] sm:text-[32px] lg:text-[36px] font-bold text-[#1d1d1f] tracking-tight leading-tight">Tasks</h2>
                <p className="text-[#86868b] text-[15px] sm:text-[17px] lg:text-[19px] font-medium">Create and manage your tasks with priority and status tracking.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Add New Task Button */}
                <div className="lg:col-span-3">
                    {!showTaskModal && (
                    <button
                        onClick={() => { setEditing(null); setForm({ title: "", description: "", type_id: "", due_date: "", due_time: getCurrentTime(), priority: "Medium", status: "To Do" }); setShowTaskModal(true); }}
                        className="px-6 py-3 bg-[#C6FF00] text-[#1d1d1f] rounded-xl font-semibold hover:bg-[#b8f000] transition-colors"
                    >
                        + Add Task
                    </button>
                    )}
                </div>
                {/** the creation form is rendered in overlay below **/}

                {/* Task List */}
                <div className="lg:col-span-3 space-y-6">
                    {/* Search and Filters */}
                    <div className="bg-white rounded-[28px] p-6 shadow-sm border border-[#d2d2d7]/50 space-y-4">
                        <div className="flex gap-3">
                            <div className="flex-1 relative">
                                <FaSearch className="absolute left-4 top-3.5 text-[#86868b] w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Search tasks..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/50 text-[14px]"
                                />
                            </div>
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-[#d2d2d7] font-semibold text-[14px] text-[#1d1d1f] hover:bg-white transition-colors"
                            >
                                <FaChevronDown className={`inline w-4 h-4 mr-2 transition-transform ${showFilters ? "rotate-180" : ""}`} />
                                Filters
                            </button>
                        </div>

                        {showFilters && (
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-[#d2d2d7]">
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="px-3 py-2 bg-[#f5f5f7] rounded-[10px] text-[13px] border border-[#d2d2d7]"
                                >
                                    <option value="">All Statuses</option>
                                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <select
                                    value={filterType}
                                    onChange={(e) => setFilterType(e.target.value)}
                                    className="px-3 py-2 bg-[#f5f5f7] rounded-[10px] text-[13px] border border-[#d2d2d7]"
                                >
                                    <option value="">All Types</option>
                                    {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                                <select
                                    value={filterPriority}
                                    onChange={(e) => setFilterPriority(e.target.value)}
                                    className="px-3 py-2 bg-[#f5f5f7] rounded-[10px] text-[13px] border border-[#d2d2d7]"
                                >
                                    <option value="">All Priorities</option>
                                    {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="px-3 py-2 bg-[#f5f5f7] rounded-[10px] text-[13px] border border-[#d2d2d7]"
                                >
                                    <option value="due_at">Sort: Due Date</option>
                                    <option value="priority">Sort: Priority</option>
                                    <option value="created_at">Sort: Created</option>
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Tasks by Section */}
                    <div className="space-y-8">
                        {loading ? (
                            <div className="bg-white rounded-[28px] p-12 text-center text-[#86868b]">Loading…</div>
                        ) : filterAndSortTasks().length === 0 ? (
                            <div className="bg-white rounded-[28px] p-12 text-center text-[#86868b]">No tasks found. Create one to get started.</div>
                        ) : (
                            <>
                                {sections.overdue.length > 0 && <TaskSection title="Overdue" tasks={sections.overdue} icon="⚠️" />}
                                {sections.today.length > 0 && <TaskSection title="Today" tasks={sections.today} icon="📌" />}
                                {sections.upcoming.length > 0 && <TaskSection title="Upcoming" tasks={sections.upcoming} icon="📅" />}
                                {sections.completed.length > 0 && <TaskSection title="Completed" tasks={sections.completed} icon="✅" />}
                                {sections.other.length > 0 && <TaskSection title="Other" tasks={sections.other} />}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Task Details Modal */}
            {selectedTask && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-[28px] p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-xl">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-[24px] font-bold text-[#1d1d1f]">Task Details</h2>
                            <button
                                onClick={() => setSelectedTask(null)}
                                className="p-2 hover:bg-[#f5f5f7] rounded-lg transition-colors"
                            >
                                <FaTimes className="w-5 h-5 text-[#86868b]" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Title</label>
                                <p className="text-[18px] font-bold text-[#1d1d1f] mt-2">{selectedTask.title}</p>
                            </div>

                            {selectedTask.description && (
                                <div>
                                    <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Notes</label>
                                    <p className="text-[15px] text-[#1d1d1f] mt-2 whitespace-pre-wrap">{selectedTask.description}</p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Status</label>
                                    <p className="text-[15px] font-bold text-[#1d1d1f] mt-2">{selectedTask.status}</p>
                                </div>
                                <div>
                                    <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Priority</label>
                                    <span
                                        className="inline-block text-[13px] font-bold px-3 py-1 mt-2 rounded-full"
                                        style={{ backgroundColor: `${priorityColors[selectedTask.priority]}20`, color: priorityColors[selectedTask.priority] }}
                                    >
                                        {selectedTask.priority}
                                    </span>
                                </div>
                            </div>

                            {selectedTask.type_id && (
                                <div>
                                    <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Type</label>
                                    <p className="text-[15px] font-bold text-[#1d1d1f] mt-2">
                                        {types.find(t => t.id === selectedTask.type_id)?.name || "—"}
                                    </p>
                                </div>
                            )}

                            {selectedTask.due_at && (
                                <div>
                                    <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Due Date & Time</label>
                                    <p className="text-[15px] font-bold text-[#1d1d1f] mt-2 flex items-center gap-2">
                                        <FaCalendar className="w-4 h-4" />
                                        {formatDueDateTime(selectedTask.due_at)}
                                    </p>
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Created</label>
                                    <p className="text-[13px] text-[#1d1d1f] mt-2">{new Date(selectedTask.created_at).toLocaleDateString()}</p>
                                </div>
                                <div>
                                    <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Last Updated</label>
                                    <p className="text-[13px] text-[#1d1d1f] mt-2">{new Date(selectedTask.updated_at).toLocaleDateString()}</p>
                                </div>
                            </div>

                            {selectedTask.completed_at && (
                                <div>
                                    <label className="text-[12px] font-bold text-[#86868b] uppercase tracking-wider">Completed</label>
                                    <p className="text-[13px] text-[#1d1d1f] mt-2">{new Date(selectedTask.completed_at).toLocaleDateString()}</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-3 mt-8 pt-6 border-t border-[#d2d2d7]">
                            <button
                                onClick={() => {
                                    const { date, time } = extractDateAndTime(selectedTask.due_at)
                                    setForm({
                                        title: selectedTask.title || "",
                                        description: selectedTask.description || "",
                                        type_id: selectedTask.type_id || "",
                                        due_date: date,
                                        due_time: time,
                                        priority: selectedTask.priority || "Medium",
                                        status: selectedTask.status || "To Do"
                                    })
                                    setEditing(selectedTask.id)
                                    setSelectedTask(null)
                                }}
                                className="flex-1 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-semibold py-3 rounded-xl transition-colors"
                            >
                                Edit
                            </button>
                            <button
                                onClick={() => { setSelectedTask(null); }}
                                className="px-6 py-3 bg-[#f5f5f7] hover:bg-white border border-[#d2d2d7] text-[#1d1d1f] font-semibold rounded-xl transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    )
}