import { useEffect, useState, useMemo, useRef } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { Link, useLocation } from "react-router-dom"
import { FaSearch, FaEllipsisH, FaTimes, FaCalendar, FaFilter, FaPlus, FaFolder, FaListUl, FaColumns, FaBorderAll, FaTags } from "react-icons/fa"
import { formatTimestamp } from "../lib/dateUtils"
import useTimeoutRegistry from "../hooks/useTimeoutRegistry"

export default function Tasks() {
    const { user } = useAuth()

    const getCurrentTime = () => {
        const now = new Date()
        const hh = String(now.getHours()).padStart(2, "0")
        const mm = String(now.getMinutes()).padStart(2, "0")
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
        status: "To Do",
    })
    const [editing, setEditing] = useState(null)
    const [error, setError] = useState("")
    const [message, setMessage] = useState("")
    const [searchTerm, setSearchTerm] = useState("")
    const [filterStatus, setFilterStatus] = useState("")
    const [filterType, setFilterType] = useState("")
    const [filterPriority, setFilterPriority] = useState("")
    const [sortBy, setSortBy] = useState("due_at")
    const [selectedTask, setSelectedTask] = useState(null)
    const [actionMenu, setActionMenu] = useState(null)
    const [showFilters, setShowFilters] = useState(false)
    const [showTaskModal, setShowTaskModal] = useState(false)
    const [viewMode, setViewMode] = useState("grid")
    const sectionRetryTimeoutRef = useRef(null)
    const { registerTimeout, clearTimeoutById } = useTimeoutRegistry()

    const statusOptions = ["To Do", "In Progress", "Done", "Cancelled"]
    const priorityOptions = ["Low", "Medium", "High", "Urgent"]
    const priorityColors = {
        Low: "var(--mx-color-86868b)",
        Medium: "var(--mx-color-3b82f6)",
        High: "var(--mx-color-f97316)",
        Urgent: "var(--mx-color-ef4444)",
    }

    const buildDueAt = (date, time) => {
        if (!date) return null
        const timeValue = time || getCurrentTime()
        const localDate = new Date(`${date}T${timeValue}:00`)
        return localDate.toISOString()
    }

    const extractDateAndTime = (dueAt) => {
        if (!dueAt) return { date: "", time: getCurrentTime() }
        const utcDate = new Date(dueAt)
        const year = utcDate.getFullYear()
        const month = String(utcDate.getMonth() + 1).padStart(2, "0")
        const day = String(utcDate.getDate()).padStart(2, "0")
        const date = `${year}-${month}-${day}`
        const hours = String(utcDate.getHours()).padStart(2, "0")
        const minutes = String(utcDate.getMinutes()).padStart(2, "0")
        const time = `${hours}:${minutes}`
        return { date, time }
    }

    const formatDueDateTime = (dueAt) => {
        if (!dueAt) return "No due date"
        const date = new Date(dueAt)
        const dateStr = date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
        })
        const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
        return `${dateStr} at ${timeStr}`
    }

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

    const location = useLocation()

    useEffect(() => {
        if (!user) return
        fetchTypes()
        fetchProjects()
        fetchTasks()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    // Handle task selection from AI Assistant query parameter
    useEffect(() => {
        const params = new URLSearchParams(location.search)
        const taskId = params.get("task")
        if (taskId && tasks.length > 0) {
            const task = tasks.find(t => t.id === taskId)
            if (task) {
                setSelectedTask(task)
            }
        }
    }, [location.search, tasks])

    useEffect(() => {
        const params = new URLSearchParams(location.search)
        if (params.get("action") === "create") {
            setSelectedTask(null)
            setActionMenu(null)
            setEditing(null)
            setForm({ title: "", description: "", type_id: "", project_id: "", due_date: "", due_time: getCurrentTime(), priority: "Medium", status: "To Do" })
            setShowTaskModal(true)
        }
    }, [location.search])

    // Scroll to section based on ?section= URL param after tasks load
    useEffect(() => {
        if (loading) return
        const params = new URLSearchParams(location.search)
        const section = params.get("section")
        if (!section) return
        if (sectionRetryTimeoutRef.current != null) {
            clearTimeoutById(sectionRetryTimeoutRef.current)
            sectionRetryTimeoutRef.current = null
        }
        const attempt = (tries = 0) => {
            const el = document.getElementById(`section-${section}`)
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "start" })
            } else if (tries < 8) {
                sectionRetryTimeoutRef.current = registerTimeout(() => {
                    sectionRetryTimeoutRef.current = null
                    attempt(tries + 1)
                }, 150)
            }
        }
        attempt()
        return () => {
            if (sectionRetryTimeoutRef.current != null) {
                clearTimeoutById(sectionRetryTimeoutRef.current)
                sectionRetryTimeoutRef.current = null
            }
        }
    }, [clearTimeoutById, loading, location.search, registerTimeout])

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
            // Only fetch personal tasks (where workplace_id is null)
            const { data, error } = await supabase
                .from("tasks")
                .select("*")
                .eq("user_id", user.id)
                .is("workplace_id", null)
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
                    setMessage("Saved locally — server insert failed.")
                } else {
                    setTasks(prev => [data, ...prev])
                    setMessage("Task created.")
                }
            }

            setForm({ title: "", description: "", type_id: "", project_id: "", due_date: "", due_time: getCurrentTime(), priority: "Medium", status: "To Do" })
            setEditing(null)
            setShowTaskModal(false)
            registerTimeout(() => setMessage(""), 2000)
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
            registerTimeout(() => setMessage(""), 2000)
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
                registerTimeout(() => setMessage(""), 2000)
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

    const priorityBgs = { "Low": "var(--mx-color-f5f5f7)", "Medium": "var(--mx-color-eff6ff)", "High": "var(--mx-color-fff7ed)", "Urgent": "var(--mx-color-fef2f2)" }
    const statusColors = {
        "To Do": { bg: "var(--mx-color-f5f5f7)", text: "var(--mx-color-86868b)" },
        "In Progress": { bg: "var(--mx-color-eff6ff)", text: "var(--mx-color-3b82f6)" },
        "Done": { bg: "var(--mx-color-f0fdf4)", text: "var(--mx-color-16a34a)" },
        "Cancelled": { bg: "var(--mx-color-fef2f2)", text: "var(--mx-color-dc2626)" }
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

    const filteredTasks = useMemo(() => filterAndSortTasks(), [tasks, searchTerm, filterStatus, filterType, filterPriority, sortBy])

    const boardColumns = useMemo(() => {
        return [
            { key: "To Do", color: "var(--mx-color-94a3b8)" },
            { key: "In Progress", color: "var(--mx-color-3b82f6)" },
            { key: "Done", color: "var(--mx-color-22c55e)" },
            { key: "Cancelled", color: "var(--mx-color-ef4444)" },
        ].map((column) => ({
            ...column,
            items: filteredTasks.filter((task) => task.status === column.key),
        }))
    }, [filteredTasks])

    const TaskActionsMenu = ({ task }) => (
        <div className="relative shrink-0">
            <button
                onClick={(e) => {
                    e.stopPropagation()
                    setActionMenu(actionMenu === task.id ? null : task.id)
                }}
                className="rounded-md p-1.5 transition-colors hover:bg-[var(--mx-color-f3f4f6)]"
            >
                <FaEllipsisH className="h-3.5 w-3.5 text-[var(--mx-color-6b7280)]" />
            </button>

            {actionMenu === task.id && (
                <div className="absolute right-0 top-8 z-50 min-w-[152px] overflow-hidden rounded-xl border border-[var(--mx-color-d2d2d7)]/80 bg-[var(--color-surface)] shadow-xl" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setSelectedTask(task); setActionMenu(null) }} className="w-full px-3 py-2 text-left text-[12px] font-medium text-[var(--mx-color-1d1d1f)] hover:bg-[var(--mx-color-f5f5f7)]">View Details</button>
                    <button onClick={() => openEdit(task)} className="w-full px-3 py-2 text-left text-[12px] font-medium text-[var(--mx-color-1d1d1f)] hover:bg-[var(--mx-color-f5f5f7)]">Edit</button>
                    <button onClick={() => { duplicateTask(task); setActionMenu(null) }} className="w-full px-3 py-2 text-left text-[12px] font-medium text-[var(--mx-color-1d1d1f)] hover:bg-[var(--mx-color-f5f5f7)]">Duplicate</button>
                    <div className="border-t border-[var(--mx-color-f0f0f0)]" />
                    <button onClick={() => deleteTask(task.id)} className="w-full px-3 py-2 text-left text-[12px] font-medium text-red-600 hover:bg-red-50">Delete</button>
                </div>
            )}
        </div>
    )

    const StatusBadge = ({ task }) => (
        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold sm:px-2 sm:text-[10px]" style={{ backgroundColor: statusColors[task.status]?.bg, color: statusColors[task.status]?.text }}>
            {task.status}
        </span>
    )

    const PriorityBadge = ({ task }) => (
        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold sm:px-2 sm:text-[10px]" style={{ backgroundColor: priorityBgs[task.priority], color: priorityColors[task.priority] }}>
            {task.priority}
        </span>
    )

    const TaskCard = ({ task }) => {
        const taskType = types.find(t => t.id === task.type_id)
        const overdue = isOverdueTask(task)
        const project = projects.find(p => p.id === task.project_id)

        return (
            <div className={`rounded-xl border p-2.5 transition-all sm:p-3 ${overdue ? "border-red-200/70 bg-red-50/40" : "border-[var(--mx-color-e5e7eb)] bg-[var(--color-surface)] hover:border-[var(--mx-color-d1d5db)]"}`}>
                <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                        <p className="truncate text-[12px] font-semibold text-[var(--mx-color-111827)] sm:text-[13px]">{task.title}</p>
                        {task.description && (
                            <p className="mt-0.5 line-clamp-1 text-[10px] text-[var(--mx-color-6b7280)] sm:text-[11px]">{task.description}</p>
                        )}
                    </div>
                    <TaskActionsMenu task={task} />
                </div>

                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <StatusBadge task={task} />
                    <PriorityBadge task={task} />
                    {taskType && (
                        <span className="rounded-full px-1.5 py-0.5 text-[9px] font-semibold sm:px-2 sm:text-[10px]" style={{ backgroundColor: taskType.color || "var(--mx-color-c6ff00)", color: "var(--mx-color-1d1d1f)" }}>
                            {taskType.name}
                        </span>
                    )}
                    {overdue && (
                        <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[9px] font-bold text-red-600">Overdue</span>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t border-[var(--mx-color-f1f5f9)] pt-2">
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-1 text-[9px] text-[var(--mx-color-6b7280)] sm:text-[10px]">
                            <FaCalendar className="h-2.5 w-2.5" />
                            <span className="truncate">{formatDueDateTime(task.due_at)}</span>
                        </div>
                        {project && (
                            <div className="flex items-center gap-1 text-[9px] text-[var(--mx-color-6b7280)] sm:text-[10px]">
                                <FaFolder className="h-2.5 w-2.5" />
                                <span className="truncate">{project.name}</span>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => toggleComplete(task)}
                        className={`rounded-md border px-2 py-1 text-[9px] font-semibold transition-colors sm:text-[10px] ${task.status === "Done" ? "border-[var(--mx-color-22c55e)] bg-[var(--mx-color-22c55e)] text-white" : "border-[var(--mx-color-d1d5db)] bg-[var(--color-surface)] text-[var(--mx-color-374151)]"}`}
                    >
                        {task.status === "Done" ? "Completed" : "Mark done"}
                    </button>
                </div>
            </div>
        )
    }

    const TaskListRow = ({ task }) => {
        const taskType = types.find(t => t.id === task.type_id)
        const project = projects.find(p => p.id === task.project_id)
        const overdue = isOverdueTask(task)
        const isDone = task.status === "Done"

        return (
            <tr className="border-b border-[var(--mx-color-eef2f7)] transition-colors hover:bg-[var(--mx-color-f8fafc)]">
                <td className="px-2 py-2.5 sm:px-3">
                    <button
                        onClick={() => toggleComplete(task)}
                        className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${isDone ? "border-[var(--mx-color-22c55e)] bg-[var(--mx-color-22c55e)] text-white" : "border-[var(--mx-color-cbd5e1)] bg-[var(--mx-color-f8fafc)] text-transparent hover:border-[var(--mx-color-94a3b8)]"}`}
                        aria-label={isDone ? "Mark task as not done" : "Mark task as done"}
                    >
                        <svg className={`h-2.5 w-2.5 transition-opacity ${isDone ? "opacity-100" : "opacity-0"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 13l4 4L19 7" />
                        </svg>
                    </button>
                </td>
                <td className="px-2 py-2.5 text-[11px] font-semibold text-[var(--mx-color-111827)] sm:px-3 sm:text-[12px]">
                    <div className="flex max-w-[260px] items-center gap-1.5">
                        <div className="truncate">{task.title}</div>
                        {overdue && (
                            <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-medium text-red-600">
                                Overdue
                            </span>
                        )}
                    </div>
                </td>
                <td className="px-2 py-2.5 text-[10px] text-[var(--mx-color-6b7280)] sm:px-3 sm:text-[11px]">{project?.name || "-"}</td>
                <td className="px-2 py-2.5 sm:px-3"><StatusBadge task={task} /></td>
                <td className="px-2 py-2.5 sm:px-3"><PriorityBadge task={task} /></td>
                <td className="px-2 py-2.5 text-[10px] text-[var(--mx-color-6b7280)] sm:px-3 sm:text-[11px]">{formatDueDateTime(task.due_at)}</td>
                <td className="px-2 py-2.5 text-[10px] text-[var(--mx-color-6b7280)] sm:px-3 sm:text-[11px]">{taskType?.name || "-"}</td>
                <td className="px-2 py-2.5 sm:px-3">
                    <div className="flex justify-end">
                        <TaskActionsMenu task={task} />
                    </div>
                </td>
            </tr>
        )
    }

    const TaskGridSection = ({ title, tasks: taskList, sectionId }) => {
        if (taskList.length === 0) return null

        return (
            <section id={sectionId}>
                <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">{title}</h3>
                    <span className="rounded-full bg-[var(--mx-color-f1f5f9)] px-2 py-0.5 text-[10px] font-semibold text-[var(--mx-color-64748b)]">{taskList.length}</span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                    {taskList.map((task) => <TaskCard key={task.id} task={task} />)}
                </div>
            </section>
        )
    }

    const totalVisible = filteredTasks.length

    return (
        <div className="lifesync-soft-borders mx-auto max-w-[1320px] animate-in fade-in pb-8 duration-500" onClick={() => setActionMenu(null)}>

            <div className="mb-4 flex flex-col gap-2.5 px-0.5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--mx-color-6b7280)]">Workspace</p>
                    <h1 className="text-[20px] font-bold tracking-tight text-[var(--mx-color-111827)] sm:text-[24px]">Tasks</h1>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    <Link
                        to="/dashboard/task-types"
                        className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] px-3.5 py-2 text-[12px] font-bold text-[var(--mx-color-111827)] transition-colors hover:bg-[var(--mx-color-f8fafc)] sm:text-[13px]"
                    >
                        <FaTags className="h-3 w-3" />
                        Task Types
                    </Link>
                    <button
                        onClick={(e) => { e.stopPropagation(); openCreate() }}
                        className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--mx-color-c6ff00)] px-3.5 py-2 text-[12px] font-bold text-[var(--mx-color-111827)] transition-colors sm:text-[13px]"
                    >
                        <FaPlus className="h-3 w-3" />
                        New Task
                    </button>
                </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-2.5">
                {[
                    { label: "Total", value: taskStats.total, color: "var(--mx-color-3b82f6)" },
                    { label: "To Do", value: taskStats.todo, color: "var(--mx-color-64748b)" },
                    { label: "In Progress", value: taskStats.inProgress, color: "var(--mx-color-f59e0b)" },
                    { label: "Completed", value: taskStats.done, color: "var(--mx-color-22c55e)" },
                    { label: "Overdue", value: taskStats.overdue, color: "var(--mx-color-ef4444)" },
                ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-[var(--mx-color-e2e8f0)] bg-[var(--color-surface)] px-3 py-2.5 shadow-sm">
                        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--mx-color-6b7280)]">{s.label}</p>
                        <p className="text-[18px] font-bold leading-tight sm:text-[20px]" style={{ color: s.color }}>{s.value}</p>
                    </div>
                ))}
            </div>

            <div className="mb-4 rounded-2xl border border-[var(--mx-color-e2e8f0)] bg-[var(--color-surface)] p-3 shadow-sm sm:p-4">
                <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex gap-2 sm:flex-1">
                        <div className="relative flex-1">
                            <FaSearch className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--mx-color-6b7280)]" />
                            <input
                                type="text"
                                placeholder="Search tasks..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full rounded-lg border border-transparent bg-[var(--mx-color-f5f7fa)] py-2 pl-8.5 pr-3 text-[12px] text-[var(--mx-color-111827)] outline-none transition-all focus:bg-[var(--color-surface)] sm:text-[13px]"
                                onClick={e => e.stopPropagation()}
                            />
                        </div>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowFilters(!showFilters) }}
                            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-semibold transition-all sm:text-[12px] ${showFilters ? "border-[var(--mx-color-c6ff00)] bg-[var(--mx-color-c6ff00)] text-[var(--mx-color-111827)]" : "border-[var(--mx-color-d2d2d7)] bg-[var(--mx-color-f5f7fa)] text-[var(--mx-color-111827)] hover:bg-[var(--color-surface)]"}`}
                        >
                            <FaFilter className="h-3 w-3" />
                            Filters
                        </button>
                    </div>

                    <div className="inline-flex w-full rounded-lg border border-[var(--mx-color-d2d2d7)] bg-[var(--mx-color-f8fafc)] p-1 sm:w-auto">
                        {[
                            { key: "grid", label: "Grid", icon: FaBorderAll },
                            { key: "list", label: "List", icon: FaListUl },
                            { key: "board", label: "Board", icon: FaColumns },
                        ].map((mode) => {
                            const Icon = mode.icon
                            return (
                                <button
                                    key={mode.key}
                                    type="button"
                                    onClick={() => setViewMode(mode.key)}
                                    className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-all sm:flex-none ${viewMode === mode.key ? "bg-[var(--color-surface)] text-[var(--mx-color-111827)] shadow-sm" : "text-[var(--mx-color-64748b)]"}`}
                                >
                                    <Icon className="h-3 w-3" />
                                    {mode.label}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {showFilters && (
                    <div className="mt-3 border-t border-[var(--mx-color-f1f5f9)] pt-3">
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border border-transparent bg-[var(--mx-color-f5f7fa)] px-3 py-2 text-[11px] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/50 focus:bg-[var(--color-surface)] sm:text-[12px]">
                                <option value="">All Statuses</option>
                                {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="rounded-lg border border-transparent bg-[var(--mx-color-f5f7fa)] px-3 py-2 text-[11px] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/50 focus:bg-[var(--color-surface)] sm:text-[12px]">
                                <option value="">All Types</option>
                                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="rounded-lg border border-transparent bg-[var(--mx-color-f5f7fa)] px-3 py-2 text-[11px] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/50 focus:bg-[var(--color-surface)] sm:text-[12px]">
                                <option value="">All Priorities</option>
                                {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-lg border border-transparent bg-[var(--mx-color-f5f7fa)] px-3 py-2 text-[11px] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/50 focus:bg-[var(--color-surface)] sm:text-[12px]">
                                <option value="due_at">Sort: Due Date</option>
                                <option value="priority">Sort: Priority</option>
                                <option value="created_at">Sort: Created</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            <div className="rounded-2xl border border-[var(--mx-color-e2e8f0)] bg-[var(--color-surface)] p-3 shadow-sm sm:p-4">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="h-7 w-7 animate-spin rounded-full border-4 border-[var(--mx-color-c6ff00)] border-t-transparent"></div>
                    </div>
                ) : totalVisible === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-14">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--mx-color-f5f7fa)]">
                            <svg className="h-6 w-6 text-[var(--mx-color-cbd5e1)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
                                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <div className="text-center">
                            <p className="text-[14px] font-semibold text-[var(--mx-color-111827)]">No tasks found</p>
                            <p className="mt-0.5 text-[12px] text-[var(--mx-color-6b7280)]">{tasks.length === 0 ? "Create your first task to get started." : "Try adjusting your filters."}</p>
                        </div>
                    </div>
                ) : viewMode === "list" ? (
                    <div className="overflow-x-auto">
                        <table className="min-w-[900px] w-full table-auto">
                            <thead>
                                <tr className="border-b border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] text-left">
                                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--mx-color-64748b)] sm:px-3">Done</th>
                                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--mx-color-64748b)] sm:px-3">Task name</th>
                                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--mx-color-64748b)] sm:px-3">Project</th>
                                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--mx-color-64748b)] sm:px-3">Status</th>
                                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--mx-color-64748b)] sm:px-3">Priority</th>
                                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--mx-color-64748b)] sm:px-3">Date time</th>
                                    <th className="px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--mx-color-64748b)] sm:px-3">Type</th>
                                    <th className="px-2 py-2 text-right text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--mx-color-64748b)] sm:px-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredTasks.map((task) => (
                                    <TaskListRow key={task.id} task={task} />
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : viewMode === "board" ? (
                    <div className="overflow-x-auto pb-1">
                        <div className="flex min-w-[1040px] gap-3">
                            {boardColumns.map((column) => (
                                <div key={column.key} className="w-[250px] shrink-0 rounded-xl border border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] p-2.5 sm:w-[260px]">
                                    <div className="mb-2 flex items-center justify-between px-0.5">
                                        <div className="flex items-center gap-2">
                                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: column.color }}></span>
                                            <h3 className="text-[11px] font-semibold text-[var(--mx-color-334155)]">{column.key}</h3>
                                        </div>
                                        <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[10px] font-semibold text-[var(--mx-color-64748b)]">{column.items.length}</span>
                                    </div>

                                    <div className="space-y-2">
                                        {column.items.length === 0 ? (
                                            <div className="rounded-lg border border-dashed border-[var(--mx-color-dbe1ea)] bg-[var(--color-surface)] px-3 py-4 text-center text-[10px] text-[var(--mx-color-94a3b8)]">No tasks</div>
                                        ) : (
                                            column.items.map((task) => <TaskCard key={task.id} task={task} />)
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <TaskGridSection title="Overdue" tasks={sections.overdue} sectionId="section-overdue" />
                        <TaskGridSection title="Today" tasks={sections.today} sectionId="section-today" />
                        <TaskGridSection title="Upcoming" tasks={sections.upcoming} sectionId="section-upcoming" />
                        <TaskGridSection title="Other" tasks={sections.other} sectionId="section-other" />
                        <TaskGridSection title="Completed" tasks={sections.completed} sectionId="section-completed" />
                    </div>
                )}
            </div>
            {/* ── Create / Edit Modal ── */}
            {showTaskModal && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--mx-color-151418)]/45 backdrop-blur-[3px]" onClick={() => { setShowTaskModal(false); setEditing(null) }}>
                    <div className="flex min-h-full items-start justify-center p-0 pt-12 sm:items-center sm:p-4 sm:pt-0">
                        <div className="w-full overflow-hidden rounded-t-3xl border border-[var(--mx-color-e2e8f0)] bg-[var(--color-surface)] shadow-2xl sm:max-w-[720px] sm:rounded-3xl" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between border-b border-[var(--mx-color-eef2f7)] bg-[var(--mx-color-f8fafc)] px-4.5 pb-3.5 pt-4 sm:px-5 sm:pt-4.5">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Task editor</p>
                                    <h3 className="mt-0.5 text-[15px] font-bold text-[var(--mx-color-111827)] sm:text-[17px]">{editing ? "Edit Task" : "New Task"}</h3>
                                    <p className="mt-0.5 text-[11px] text-[var(--mx-color-64748b)]">{editing ? "Update task details" : "Add a new task to your workspace"}</p>
                                </div>
                                <button onClick={() => { setShowTaskModal(false); setEditing(null) }} className="rounded-full border border-[var(--mx-color-e2e8f0)] bg-[var(--color-surface)] p-1.5 transition-colors hover:bg-[var(--mx-color-f8fafc)]">
                                    <FaTimes className="w-4 h-4 text-[var(--mx-color-64748b)]" />
                                </button>
                            </div>
                            <form onSubmit={createTask} className="max-h-[76vh] space-y-3.5 overflow-y-auto px-4.5 py-4 sm:max-h-[80vh] sm:px-5 sm:py-4.5">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div className="md:col-span-2">
                                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Title *</label>
                                        <input value={form.title} onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Finish report"
                                            className="w-full rounded-lg border border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] px-3 py-2.5 text-[13px] text-[var(--mx-color-111827)] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/70 focus:bg-[var(--color-surface)]" />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Type *</label>
                                        <select value={form.type_id} onChange={(e) => setForm(f => ({ ...f, type_id: e.target.value }))}
                                            className="w-full rounded-lg border border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] px-3 py-2.5 text-[13px] text-[var(--mx-color-111827)] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/70 focus:bg-[var(--color-surface)]">
                                            <option value="">Select a type</option>
                                            {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Project</label>
                                        <select value={form.project_id} onChange={(e) => setForm(f => ({ ...f, project_id: e.target.value }))}
                                            className="w-full rounded-lg border border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] px-3 py-2.5 text-[13px] text-[var(--mx-color-111827)] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/70 focus:bg-[var(--color-surface)]">
                                            <option value="">No Project</option>
                                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Priority</label>
                                        <select value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                                            className="w-full rounded-lg border border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] px-3 py-2.5 text-[13px] text-[var(--mx-color-111827)] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/70 focus:bg-[var(--color-surface)]">
                                            {priorityOptions.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Status</label>
                                        <select value={form.status} onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}
                                            className="w-full rounded-lg border border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] px-3 py-2.5 text-[13px] text-[var(--mx-color-111827)] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/70 focus:bg-[var(--color-surface)]">
                                            {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Due Date</label>
                                        <input type="date" value={form.due_date} onChange={(e) => setForm(f => ({ ...f, due_date: e.target.value }))}
                                            className="w-full rounded-lg border border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] px-3 py-2.5 text-[13px] text-[var(--mx-color-111827)] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/70 focus:bg-[var(--color-surface)]" />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Time</label>
                                        <input type="time" value={form.due_time} onChange={(e) => setForm(f => ({ ...f, due_time: e.target.value }))}
                                            className="w-full rounded-lg border border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] px-3 py-2.5 text-[13px] text-[var(--mx-color-111827)] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/70 focus:bg-[var(--color-surface)]" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Notes</label>
                                        <textarea value={form.description || ""} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Add details or notes..."
                                            className="w-full resize-none rounded-lg border border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] px-3 py-2.5 text-[13px] text-[var(--mx-color-111827)] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/70 focus:bg-[var(--color-surface)]" />
                                    </div>
                                </div>
                                {types.length === 0 && (
                                    <p className="rounded-lg bg-[var(--mx-color-f8fafc)] px-3 py-2 text-[11px] text-[var(--mx-color-64748b)]">No active types. <Link to="/dashboard/task-types" className="font-semibold text-[var(--mx-color-86b300)] hover:underline">Create types</Link></p>
                                )}
                                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">{error}</p>}
                                {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-[12px] font-medium text-green-700">{message}</p>}
                                <div className="flex gap-2 border-t border-[var(--mx-color-eef2f7)] pt-3">
                                    <button type="submit" disabled={loading}
                                        className="flex-1 rounded-lg bg-[var(--mx-color-c6ff00)] py-2.5 text-[13px] font-semibold text-[var(--mx-color-1d1d1f)] transition-colors hover:bg-[var(--mx-color-b8f000)] disabled:opacity-60">
                                        {loading ? (editing ? "Saving..." : "Creating...") : (editing ? "Update Task" : "Create Task")}
                                    </button>
                                    <button type="button" onClick={resetForm}
                                        className="rounded-lg border border-[var(--mx-color-d2d2d7)] bg-[var(--mx-color-f5f7fa)] px-4 py-2.5 text-[13px] font-semibold text-[var(--mx-color-334155)] transition-colors hover:bg-[var(--color-surface)]">
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Task Details Modal ── */}
            {selectedTask && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--mx-color-151418)]/45 backdrop-blur-[3px]" onClick={() => setSelectedTask(null)}>
                    <div className="flex min-h-full items-start justify-center p-0 pt-12 sm:items-center sm:p-4 sm:pt-0">
                        <div className="w-full overflow-hidden rounded-t-3xl border border-[var(--mx-color-e2e8f0)] bg-[var(--color-surface)] shadow-2xl sm:max-w-[720px] sm:rounded-3xl" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between border-b border-[var(--mx-color-eef2f7)] bg-[var(--mx-color-f8fafc)] px-4.5 pb-3.5 pt-4 sm:px-5 sm:pt-4.5">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Overview</p>
                                    <h3 className="mt-0.5 text-[15px] font-bold text-[var(--mx-color-111827)] sm:text-[17px]">Task Details</h3>
                                </div>
                                <button onClick={() => setSelectedTask(null)} className="rounded-full border border-[var(--mx-color-e2e8f0)] bg-[var(--color-surface)] p-1.5 transition-colors hover:bg-[var(--mx-color-f8fafc)]">
                                    <FaTimes className="h-4 w-4 text-[var(--mx-color-6b7280)]" />
                                </button>
                            </div>
                            <div className="max-h-[72vh] space-y-3.5 overflow-y-auto px-4.5 py-4 sm:max-h-[75vh] sm:px-5">
                                <div>
                                    <div className="flex items-start justify-between gap-3 mb-1">
                                        <h4 className={`text-[15px] sm:text-[17px] font-bold leading-snug ${selectedTask.status === "Done" ? "line-through text-[var(--mx-color-94a3b8)]" : "text-[var(--mx-color-111827)]"}`}>
                                            {selectedTask.title}
                                        </h4>
                                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                                            style={{ backgroundColor: statusColors[selectedTask.status]?.bg, color: statusColors[selectedTask.status]?.text }}>
                                            {selectedTask.status}
                                        </span>
                                    </div>
                                    {selectedTask.description && (
                                        <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-[var(--mx-color-64748b)]">{selectedTask.description}</p>
                                    )}
                                </div>
                                <div className="rounded-xl border border-[var(--mx-color-eef2f7)] bg-[var(--mx-color-fcfdff)]">
                                    <div className="flex items-center justify-between border-b border-[var(--mx-color-f1f5f9)] px-3 py-2.5">
                                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Priority</span>
                                        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                                            style={{ backgroundColor: priorityBgs[selectedTask.priority], color: priorityColors[selectedTask.priority] }}>
                                            {selectedTask.priority}
                                        </span>
                                    </div>
                                    {selectedTask.type_id && (
                                        <div className="flex items-center justify-between border-b border-[var(--mx-color-f1f5f9)] px-3 py-2.5">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Type</span>
                                            {(() => { const t = types.find(x => x.id === selectedTask.type_id); return t ? <span className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: t.color || "var(--mx-color-c6ff00)", color: "var(--mx-color-1d1d1f)" }}>{t.name}</span> : <span className="text-[12px] text-[var(--mx-color-64748b)]">—</span> })()}
                                        </div>
                                    )}
                                    {selectedTask.project_id && (
                                        <div className="flex items-center justify-between border-b border-[var(--mx-color-f1f5f9)] px-3 py-2.5">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Project</span>
                                            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--mx-color-111827)]">
                                                <FaFolder className="h-3.5 w-3.5 text-[var(--mx-color-c6ff00)]" />
                                                {projects.find(p => p.id === selectedTask.project_id)?.name || "—"}
                                            </span>
                                        </div>
                                    )}
                                    {selectedTask.due_at && (
                                        <div className="flex items-center justify-between px-3 py-2.5">
                                            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Due Date</span>
                                            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--mx-color-111827)]">
                                                <FaCalendar className="h-3.5 w-3.5 text-[var(--mx-color-64748b)]" />
                                                {formatDueDateTime(selectedTask.due_at)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2 rounded-xl border border-[var(--mx-color-eef2f7)] bg-[var(--mx-color-f8fafc)] p-3">
                                    <div className="flex justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Created</span><span className="text-[11px] text-[var(--mx-color-334155)]">{formatTimestamp(selectedTask.created_at)}</span></div>
                                    <div className="flex justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Updated</span><span className="text-[11px] text-[var(--mx-color-334155)]">{formatTimestamp(selectedTask.updated_at)}</span></div>
                                    {selectedTask.completed_at && <div className="flex justify-between"><span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Completed</span><span className="text-[11px] text-[var(--mx-color-334155)]">{formatTimestamp(selectedTask.completed_at)}</span></div>}
                                </div>
                            </div>
                            <div className="flex gap-2 border-t border-[var(--mx-color-eef2f7)] px-4.5 pb-4.5 pt-3 sm:px-5 sm:pb-5">
                                <button onClick={() => openEdit(selectedTask)}
                                    className="flex-1 rounded-lg bg-[var(--mx-color-c6ff00)] py-2.5 text-[13px] font-semibold text-[var(--mx-color-1d1d1f)] transition-colors hover:bg-[var(--mx-color-b8f000)]">
                                    Edit Task
                                </button>
                                <button onClick={() => setSelectedTask(null)}
                                    className="rounded-lg border border-[var(--mx-color-d2d2d7)] bg-[var(--mx-color-f5f7fa)] px-4 py-2.5 text-[13px] font-semibold text-[var(--mx-color-334155)] transition-colors hover:bg-[var(--color-surface)]">
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
