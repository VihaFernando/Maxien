import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { FaPlus, FaEllipsisH, FaTimes, FaSearch, FaChevronDown, FaArchive, FaSync, FaCheckSquare } from "react-icons/fa"
import { formatTimestamp, formatDate } from "../lib/dateUtils"

export default function Projects() {
    const { user } = useAuth()
    const [projects, setProjects] = useState([])

    // Utility: Check if task is overdue (local comparison)
    const isOverdueTask = (task) => {
        if (!task.due_at || task.status === "Done" || task.status === "Cancelled") return false
        const now = new Date()
        const dueDate = new Date(task.due_at)
        return dueDate < now
    }

    // Utility: Check if due within 2 hours (not overdue)
    const isOverdueSoon = (task) => {
        if (!task.due_at || task.status === "Done" || task.status === "Cancelled") return false
        if (isOverdueTask(task)) return false
        const now = new Date()
        const dueDate = new Date(task.due_at)
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)
        return dueDate <= twoHoursFromNow && dueDate > now
    }
    const [types, setTypes] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [message, setMessage] = useState("")
    const [searchTerm, setSearchTerm] = useState("")
    const [filterStatus, setFilterStatus] = useState("")
    const [showForm, setShowForm] = useState(false)
    const [selectedProject, setSelectedProject] = useState(null)
    const [selectedProjectTasks, setSelectedProjectTasks] = useState(null)
    const [projectTasksData, setProjectTasksData] = useState([])
    const [taskLoading, setTaskLoading] = useState(false)
    const [actionMenu, setActionMenu] = useState(null)
    const [editing, setEditing] = useState(null)

    const [form, setForm] = useState({
        name: "",
        description: "",
        type_id: "",
        status: "Active",
        start_date: "",
        target_end_date: ""
    })

    const statusOptions = ["Active", "On Hold", "Completed", "Archived"]
    const statusColors = {
        "Active": "bg-green-50 text-green-600 border-green-200",
        "On Hold": "bg-yellow-50 text-yellow-600 border-yellow-200",
        "Completed": "bg-blue-50 text-blue-600 border-blue-200",
        "Archived": "bg-gray-50 text-gray-600 border-gray-200"
    }

    useEffect(() => {
        if (!user) return
        fetchTypes()
        fetchProjects()
    }, [user])

    const fetchTypes = async () => {
        try {
            const { data } = await supabase
                .from("task_types")
                .select("*")
                .eq("user_id", user.id)
                .eq("status", "Active")
                .order("created_at", { ascending: false })
            setTypes(data || [])
        } catch {
            setTypes([])
        }
    }

    const fetchProjects = async () => {
        setLoading(true)
        try {
            const { data, error: err } = await supabase
                .from("projects")
                .select("*, task_types(id, name), tasks(id, status)")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })

            if (err) {
                setError("Failed to load projects")
                setProjects([])
            } else {
                setProjects(data || [])
            }
        } catch {
            setError("Failed to load projects")
            setProjects([])
        } finally {
            setLoading(false)
        }
    }

    const fetchProjectTasks = async (projectId) => {
        setTaskLoading(true)
        try {
            const { data, error: err } = await supabase
                .from("tasks")
                .select("*")
                .eq("project_id", projectId)
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })

            if (err) {
                setProjectTasksData([])
            } else {
                setProjectTasksData(data || [])
            }
        } catch {
            setProjectTasksData([])
        } finally {
            setTaskLoading(false)
        }
    }

    const createProject = async (e) => {
        e.preventDefault()
        setError("")

        if (!form.name.trim()) return setError("Project name is required")
        if (!form.type_id) return setError("Please select a project type")

        setLoading(true)

        const payload = {
            user_id: user.id,
            name: form.name.trim(),
            description: (form.description || "").trim() || null,
            type_id: form.type_id,
            status: form.status || "Active",
            start_date: form.start_date || null,
            target_end_date: form.target_end_date || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        }

        try {
            if (editing) {
                // Update existing project
                const { error: err } = await supabase
                    .from("projects")
                    .update({ ...payload, created_at: undefined })
                    .eq("id", editing)
                    .eq("user_id", user.id)

                if (err) {
                    setError("Failed to update project")
                } else {
                    setProjects(prev => prev.map(p =>
                        p.id === editing ? { ...p, ...payload, created_at: p.created_at } : p
                    ))
                    setMessage("Project updated successfully")
                    setEditing(null)
                }
            } else {
                // Create new project
                const { data, error: err } = await supabase
                    .from("projects")
                    .insert([payload])
                    .select()
                    .single()

                if (err) {
                    setError("Failed to create project")
                } else {
                    setProjects(prev => [data, ...prev])
                    setMessage("Project created successfully")
                }
            }

            setForm({
                name: "",
                description: "",
                type_id: "",
                status: "Active",
                start_date: "",
                target_end_date: ""
            })
            setShowForm(false)
            setTimeout(() => setMessage(""), 2000)
        } catch {
            setError(editing ? "Failed to update project" : "Failed to create project")
        } finally {
            setLoading(false)
        }
    }

    const updateProjectStatus = async (projectId, newStatus) => {
        try {
            await supabase
                .from("projects")
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq("id", projectId)
                .eq("user_id", user.id)

            setProjects(prev => prev.map(p =>
                p.id === projectId ? { ...p, status: newStatus } : p
            ))
            setMessage("Project status updated")
            setActionMenu(null)
            setTimeout(() => setMessage(""), 2000)
        } catch {
            setError("Failed to update project status")
        }
    }

    const deleteProject = async (projectId) => {
        if (!confirm("Are you sure you want to delete this project?")) return

        try {
            await supabase
                .from("projects")
                .delete()
                .eq("id", projectId)
                .eq("user_id", user.id)

            setProjects(prev => prev.filter(p => p.id !== projectId))
            setMessage("Project deleted")
            setActionMenu(null)
            setTimeout(() => setMessage(""), 2000)
        } catch {
            setError("Failed to delete project")
        }
    }

    const startEdit = (project) => {
        setForm({
            name: project.name,
            description: project.description || "",
            type_id: project.type_id,
            status: project.status,
            start_date: project.start_date || "",
            target_end_date: project.target_end_date || ""
        })
        setEditing(project.id)
        setShowForm(true)
        setActionMenu(null)
    }

    const cancelEdit = () => {
        setForm({
            name: "",
            description: "",
            type_id: "",
            status: "Active",
            start_date: "",
            target_end_date: ""
        })
        setEditing(null)
        setShowForm(false)
    }

    const getTypeInfo = (typeId) => {
        return types.find(t => t.id === typeId)
    }

    const getProjectStats = (project) => {
        const tasks = project.tasks || []
        const total = tasks.length
        const completed = tasks.filter(t => t.status === "Done").length
        return { total, completed }
    }

    const filterAndSearchProjects = () => {
        return projects.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesStatus = filterStatus ? p.status === filterStatus : p.status !== "Archived"
            return matchesSearch && matchesStatus
        })
    }

    const filteredProjects = filterAndSearchProjects()

    return (
        <div className="animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-10">

            {/* Top Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 px-0">
                <div>
                    <p className="text-[10px] sm:text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Projects</p>
                    <h1 className="text-[18px] sm:text-[24px] font-bold text-[#1d1d1f] tracking-tight leading-tight">
                        Organize Your Work
                    </h1>
                </div>
                <button
                    onClick={() => setShowForm(true)}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-[#C6FF00] text-[#1d1d1f] rounded-xl font-semibold text-[13px] hover:bg-[#b3e600] transition-colors shadow-sm flex-shrink-0"
                >
                    <FaPlus className="w-3.5 h-3.5" />
                    New Project
                </button>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col gap-3 mb-5 sm:mb-6">
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-3">
                    <div className="flex-1 relative">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b] w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 sm:py-2 border border-[#d2d2d7]/50 rounded-xl text-[13px] placeholder:text-[#86868b] focus:outline-none focus:border-[#86868b] focus:ring-1 focus:ring-[#C6FF00]/50"
                        />
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="w-full sm:w-auto px-3 sm:px-4 py-2.5 sm:py-2 border border-[#d2d2d7]/50 rounded-xl text-[13px] bg-white text-[#1d1d1f] font-medium focus:outline-none focus:border-[#86868b] focus:ring-1 focus:ring-[#C6FF00]/50"
                    >
                        <option value="">All Statuses</option>
                        {statusOptions.map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Status Messages */}
            {error && (
                <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl text-[13px] flex items-start gap-2">
                    <span className="text-red-600 font-bold text-lg leading-none">!</span>
                    <span>{error}</span>
                </div>
            )}
            {message && (
                <div className="mb-4 p-3 sm:p-4 bg-green-50 border border-green-200 text-green-600 rounded-xl text-[13px] flex items-start gap-2">
                    <span className="text-green-600 font-bold text-lg leading-none">✓</span>
                    <span>{message}</span>
                </div>
            )}

            {/* Projects Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-48">
                    <div className="w-8 h-8 border-4 border-[#C6FF00] border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : filteredProjects.length === 0 ? (
                <div className="text-center py-12">
                    <p className="text-[#86868b] text-[13px] mb-3">No projects yet</p>
                    <button
                        onClick={() => setShowForm(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#f5f5f7] text-[#1d1d1f] rounded-xl font-semibold text-[13px] hover:bg-[#e8e8ed] transition-colors"
                    >
                        <FaPlus className="w-3.5 h-3.5" />
                        Create Your First Project
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {filteredProjects.map(project => {
                        const typeInfo = getTypeInfo(project.type_id)
                        const stats = getProjectStats(project)
                        const progress = stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0

                        return (
                            <div
                                key={project.id}
                                className={`bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden transition-all ${project.status === "Archived" ? "opacity-50 hover:shadow-sm" : "hover:shadow-md"}`}
                            >
                                {/* Header */}
                                <div className="p-4 sm:p-5 md:p-6 border-b border-[#f0f0f0]">
                                    <div className="flex items-start justify-between gap-2 mb-3 min-w-0">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-[14px] sm:text-[15px] font-bold text-[#1d1d1f] tracking-tight mb-2 truncate">
                                                {project.name}
                                            </h3>
                                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                                <span className={`inline-block px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold border ${statusColors[project.status]}`}>
                                                    {project.status}
                                                </span>
                                                {typeInfo && (
                                                    <span className="inline-block px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-semibold bg-[#f5f5f7] text-[#1d1d1f] truncate">
                                                        {typeInfo.name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                onClick={() => {
                                                    fetchProjectTasks(project.id)
                                                    setSelectedProjectTasks(project)
                                                }}
                                                className="p-1.5 hover:bg-[#f5f5f7] rounded-lg text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                                                title="View Tasks"
                                            >
                                                <FaCheckSquare className="w-3.5 h-3.5" />
                                            </button>
                                            <div className="relative">
                                                <button
                                                    onClick={() => setActionMenu(actionMenu === project.id ? null : project.id)}
                                                    className="p-1.5 hover:bg-[#f5f5f7] rounded-lg text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                                                >
                                                    <FaEllipsisH className="w-4 h-4" />
                                                </button>
                                                {actionMenu === project.id && (
                                                    <div className="absolute top-10 right-0 bg-white border border-[#d2d2d7]/50 rounded-xl shadow-lg z-20 min-w-[160px]">
                                                        <button
                                                            onClick={() => startEdit(project)}
                                                            className="w-full text-left px-4 py-2 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] border-b border-[#f0f0f0]"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => setSelectedProject(project)}
                                                            className="w-full text-left px-4 py-2 text-[13px] font-medium text-[#1d1d1f] hover:bg-[#f5f5f7] border-b border-[#f0f0f0]"
                                                        >
                                                            View Details
                                                        </button>
                                                        {project.status !== "Archived" && (
                                                            <button
                                                                onClick={() => updateProjectStatus(project.id, "Archived")}
                                                                className="w-full text-left px-4 py-2 text-[13px] font-medium text-[#86868b] hover:bg-[#f5f5f7] border-b border-[#f0f0f0] flex items-center gap-2"
                                                            >
                                                                <FaArchive className="w-3 h-3" />
                                                                Archive
                                                            </button>
                                                        )}
                                                        {project.status === "Archived" && (
                                                            <button
                                                                onClick={() => updateProjectStatus(project.id, "Active")}
                                                                className="w-full text-left px-4 py-2 text-[13px] font-medium text-[#86868b] hover:bg-[#f5f5f7] border-b border-[#f0f0f0] flex items-center gap-2"
                                                            >
                                                                <FaSync className="w-3 h-3" />
                                                                Restore
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => deleteProject(project.id)}
                                                            className="w-full text-left px-4 py-2 text-[13px] font-medium text-red-600 hover:bg-red-50"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {project.description && (
                                        <p className="text-[12px] sm:text-[13px] text-[#86868b] line-clamp-2 mb-3 leading-relaxed">
                                            {project.description}
                                        </p>
                                    )}
                                </div>

                                {/* Progress */}
                                <div className="px-4 sm:px-5 md:px-6 py-3 border-b border-[#f0f0f0]">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] sm:text-[11px] font-semibold text-[#86868b] uppercase tracking-wide">Progress</span>
                                        <span className="text-[12px] sm:text-[13px] font-semibold text-[#1d1d1f]">{progress}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-[#C6FF00] transition-all duration-300"
                                            style={{ width: `${progress}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-[10px] sm:text-[11px] text-[#86868b] mt-2">
                                        {stats.completed} of {stats.total} task{stats.total !== 1 ? 's' : ''} completed
                                    </p>
                                </div>

                                {/* Dates */}
                                {(project.start_date || project.target_end_date) && (
                                    <div className="px-4 sm:px-5 md:px-6 py-3 border-b border-[#f0f0f0]">
                                        <div className="space-y-1.5">
                                            {project.start_date && (
                                                <div className="flex justify-between items-center text-[12px] sm:text-[13px]">
                                                    <span className="text-[#86868b]">Start:</span>
                                                    <span className="text-[#1d1d1f] font-medium">{formatDate(project.start_date)}</span>
                                                </div>
                                            )}
                                            {project.target_end_date && (
                                                <div className="flex justify-between items-center text-[12px] sm:text-[13px]">
                                                    <span className="text-[#86868b]">Target:</span>
                                                    <span className="text-[#1d1d1f] font-medium">{formatDate(project.target_end_date)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Timestamps */}
                                <div className="px-4 sm:px-5 md:px-6 py-2.5 bg-[#f9f9fb] text-[10px] sm:text-[11px] text-[#86868b] space-y-0.5">
                                    <div className="flex justify-between">
                                        <span>Created:</span>
                                        <span>{formatTimestamp(project.created_at)}</span>
                                    </div>
                                    {project.updated_at && project.updated_at !== project.created_at && (
                                        <div className="flex justify-between">
                                            <span>Updated:</span>
                                            <span>{formatTimestamp(project.updated_at)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* Create/Edit Project Modal */}
            {showForm && (
                <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40 overflow-y-auto animate-in fade-in duration-200">
                    <div className="flex min-h-full items-start sm:items-center justify-center pt-[80px] sm:pt-0 p-4 sm:p-6">
                        <div className="bg-white rounded-[24px] shadow-xl max-w-[500px] w-full overflow-hidden animate-in zoom-in duration-200">

                            {/* Modal Header */}
                            <div className="bg-white border-b border-[#f0f0f0] px-4 sm:px-6 py-4 flex items-center justify-between">
                                <h2 className="text-[16px] sm:text-[18px] font-bold text-[#1d1d1f]">
                                    {editing ? "Edit Project" : "New Project"}
                                </h2>
                                <button
                                    onClick={cancelEdit}
                                    className="p-1 hover:bg-[#f5f5f7] rounded-lg text-[#86868b] transition-colors flex-shrink-0"
                                >
                                    <FaTimes className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Modal Form */}
                            <form onSubmit={createProject} className="p-4 sm:p-6 space-y-4">
                                {/* Project Name */}
                                <div>
                                    <label className="block text-[11px] sm:text-[12px] font-semibold text-[#1d1d1f] uppercase tracking-wide mb-2">
                                        Project Name *
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name}
                                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                                        placeholder="Enter project name"
                                        className="w-full px-3 py-2.5 sm:py-2 border border-[#d2d2d7]/50 rounded-xl text-[13px] placeholder:text-[#86868b] focus:outline-none focus:border-[#86868b] focus:ring-1 focus:ring-[#C6FF00]/50"
                                    />
                                </div>

                                {/* Type */}
                                <div>
                                    <label className="block text-[11px] sm:text-[12px] font-semibold text-[#1d1d1f] uppercase tracking-wide mb-2">
                                        Type *
                                    </label>
                                    <select
                                        value={form.type_id}
                                        onChange={(e) => setForm({ ...form, type_id: e.target.value })}
                                        className="w-full px-3 py-2.5 sm:py-2 border border-[#d2d2d7]/50 rounded-xl text-[13px] bg-white text-[#1d1d1f] focus:outline-none focus:border-[#86868b] focus:ring-1 focus:ring-[#C6FF00]/50"
                                    >
                                        <option value="">Select a type</option>
                                        {types.map(t => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Description */}
                                <div>
                                    <label className="block text-[11px] sm:text-[12px] font-semibold text-[#1d1d1f] uppercase tracking-wide mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        value={form.description}
                                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                                        placeholder="Add project description (optional)"
                                        rows="3"
                                        className="w-full px-3 py-2.5 sm:py-2 border border-[#d2d2d7]/50 rounded-xl text-[13px] placeholder:text-[#86868b] focus:outline-none focus:border-[#86868b] focus:ring-1 focus:ring-[#C6FF00]/50 resize-none"
                                    />
                                </div>

                                {/* Status */}
                                <div>
                                    <label className="block text-[11px] sm:text-[12px] font-semibold text-[#1d1d1f] uppercase tracking-wide mb-2">
                                        Status
                                    </label>
                                    <select
                                        value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                                        className="w-full px-3 py-2.5 sm:py-2 border border-[#d2d2d7]/50 rounded-xl text-[13px] bg-white text-[#1d1d1f] focus:outline-none focus:border-[#86868b] focus:ring-1 focus:ring-[#C6FF00]/50"
                                    >
                                        {statusOptions.map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Start Date */}
                                <div>
                                    <label className="block text-[11px] sm:text-[12px] font-semibold text-[#1d1d1f] uppercase tracking-wide mb-2">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={form.start_date}
                                        onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                                        className="w-full px-3 py-2.5 sm:py-2 border border-[#d2d2d7]/50 rounded-xl text-[13px] focus:outline-none focus:border-[#86868b] focus:ring-1 focus:ring-[#C6FF00]/50"
                                    />
                                </div>

                                {/* Target End Date */}
                                <div>
                                    <label className="block text-[11px] sm:text-[12px] font-semibold text-[#1d1d1f] uppercase tracking-wide mb-2">
                                        Target End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={form.target_end_date}
                                        onChange={(e) => setForm({ ...form, target_end_date: e.target.value })}
                                        className="w-full px-3 py-2.5 sm:py-2 border border-[#d2d2d7]/50 rounded-xl text-[13px] focus:outline-none focus:border-[#86868b] focus:ring-1 focus:ring-[#C6FF00]/50"
                                    />
                                </div>

                                {/* Error Message */}
                                {error && (
                                    <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-[12px]">
                                        {error}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 pt-4">
                                    <button
                                        type="button"
                                        onClick={cancelEdit}
                                        className="flex-1 px-4 py-2.5 sm:py-2 border border-[#d2d2d7]/50 text-[#1d1d1f] rounded-xl font-semibold text-[13px] hover:bg-[#f5f5f7] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 px-4 py-2.5 sm:py-2 bg-[#C6FF00] text-[#1d1d1f] rounded-xl font-semibold text-[13px] hover:bg-[#b3e600] transition-colors disabled:opacity-50"
                                    >
                                        {loading ? "Saving..." : (editing ? "Update" : "Create")}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Project Details Modal */}
            {selectedProject && (
                <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40 overflow-y-auto animate-in fade-in duration-200">
                    <div className="flex min-h-full items-start sm:items-center justify-center pt-[80px] sm:pt-0 p-4 sm:p-6">
                        <div className="bg-white rounded-[24px] shadow-xl max-w-[600px] w-full overflow-hidden animate-in zoom-in duration-200">

                            {/* Modal Header */}
                            <div className="bg-white border-b border-[#f0f0f0] px-4 sm:px-6 py-4 flex items-center justify-between">
                                <h2 className="text-[16px] sm:text-[18px] font-bold text-[#1d1d1f]">Project Details</h2>
                                <button
                                    onClick={() => setSelectedProject(null)}
                                    className="p-1 hover:bg-[#f5f5f7] rounded-lg text-[#86868b] transition-colors flex-shrink-0"
                                >
                                    <FaTimes className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-4 sm:p-6 space-y-6">
                                {/* Name and Status */}
                                <div>
                                    <h3 className="text-[16px] sm:text-[18px] font-bold text-[#1d1d1f] mb-2">{selectedProject.name}</h3>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${statusColors[selectedProject.status]}`}>
                                            {selectedProject.status}
                                        </span>
                                        {getTypeInfo(selectedProject.type_id) && (
                                            <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#f5f5f7] text-[#1d1d1f]">
                                                {getTypeInfo(selectedProject.type_id).name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Description */}
                                {selectedProject.description && (
                                    <div>
                                        <p className="text-[11px] sm:text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-2">Description</p>
                                        <p className="text-[13px] sm:text-[14px] text-[#1d1d1f] leading-relaxed">
                                            {selectedProject.description}
                                        </p>
                                    </div>
                                )}

                                {/* Dates */}
                                {(selectedProject.start_date || selectedProject.target_end_date) && (
                                    <div>
                                        <p className="text-[11px] sm:text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-2">Timeline</p>
                                        <div className="space-y-1.5">
                                            {selectedProject.start_date && (
                                                <div className="flex justify-between items-center text-[12px] sm:text-[13px]">
                                                    <span className="text-[#86868b]">Start Date:</span>
                                                    <span className="text-[#1d1d1f] font-medium">{formatDate(selectedProject.start_date)}</span>
                                                </div>
                                            )}
                                            {selectedProject.target_end_date && (
                                                <div className="flex justify-between items-center text-[12px] sm:text-[13px]">
                                                    <span className="text-[#86868b]">Target End:</span>
                                                    <span className="text-[#1d1d1f] font-medium">{formatDate(selectedProject.target_end_date)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Progress */}
                                {getProjectStats(selectedProject).total > 0 && (
                                    <div>
                                        <p className="text-[11px] sm:text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-2">Task Progress</p>
                                        <div className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 h-2 bg-[#f5f5f7] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-[#C6FF00]"
                                                        style={{ width: `${Math.round((getProjectStats(selectedProject).completed / getProjectStats(selectedProject).total) * 100)}%` }}
                                                    ></div>
                                                </div>
                                                <span className="text-[12px] sm:text-[13px] font-semibold text-[#1d1d1f] w-12 text-right">
                                                    {Math.round((getProjectStats(selectedProject).completed / getProjectStats(selectedProject).total) * 100)}%
                                                </span>
                                            </div>
                                            <p className="text-[10px] sm:text-[11px] text-[#86868b]">
                                                {getProjectStats(selectedProject).completed} of {getProjectStats(selectedProject).total} tasks completed
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Timestamps */}
                                <div className="pt-4 border-t border-[#f0f0f0]">
                                    <p className="text-[11px] sm:text-[12px] font-semibold text-[#86868b] uppercase tracking-wide mb-3">Timeline</p>
                                    <div className="space-y-1.5 text-[11px] sm:text-[12px] text-[#86868b]">
                                        <div className="flex justify-between">
                                            <span>Created:</span>
                                            <span>{formatTimestamp(selectedProject.created_at)}</span>
                                        </div>
                                        {selectedProject.updated_at && selectedProject.updated_at !== selectedProject.created_at && (
                                            <div className="flex justify-between">
                                                <span>Last Updated:</span>
                                                <span>{formatTimestamp(selectedProject.updated_at)}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                                    <button
                                        onClick={() => startEdit(selectedProject)}
                                        className="flex-1 px-4 py-2.5 sm:py-2 bg-[#C6FF00] text-[#1d1d1f] rounded-xl font-semibold text-[13px] hover:bg-[#b3e600] transition-colors"
                                    >
                                        Edit Project
                                    </button>
                                    <button
                                        onClick={() => setSelectedProject(null)}
                                        className="flex-1 px-4 py-2.5 sm:py-2 border border-[#d2d2d7]/50 text-[#1d1d1f] rounded-xl font-semibold text-[13px] hover:bg-[#f5f5f7] transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Project Tasks Modal */}
            {selectedProjectTasks && (
                <div className="fixed inset-0 bg-black/25 backdrop-blur-sm z-40 overflow-y-auto animate-in fade-in duration-200">
                    <div className="flex min-h-full items-start sm:items-center justify-center pt-[80px] sm:pt-0 p-4 sm:p-6">
                        <div className="bg-white rounded-[24px] shadow-xl max-w-[700px] w-full overflow-hidden animate-in zoom-in duration-200">

                            {/* Modal Header */}
                            <div className="bg-white border-b border-[#f0f0f0] px-4 sm:px-6 py-4 flex items-center justify-between">
                                <div className="min-w-0">
                                    <h2 className="text-[16px] sm:text-[18px] font-bold text-[#1d1d1f] truncate">{selectedProjectTasks.name}</h2>
                                    <p className="text-[11px] sm:text-[12px] text-[#86868b] mt-0.5">Tasks ({projectTasksData.length})</p>
                                </div>
                                <button
                                    onClick={() => setSelectedProjectTasks(null)}
                                    className="p-1 hover:bg-[#f5f5f7] rounded-lg text-[#86868b] transition-colors flex-shrink-0 ml-4"
                                >
                                    <FaTimes className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-4 sm:p-6">
                                {taskLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <div className="w-6 h-6 border-3 border-[#C6FF00] border-t-transparent rounded-full animate-spin"></div>
                                    </div>
                                ) : projectTasksData.length === 0 ? (
                                    <div className="text-center py-10">
                                        <p className="text-[#86868b] text-[12px] sm:text-[13px]">No tasks linked to this project yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {projectTasksData.map(task => (
                                            <div
                                                key={task.id}
                                                className={`p-3 sm:p-4 rounded-[14px] border flex items-start justify-between gap-3 ${task.status === "Done"
                                                    ? "bg-[#f5f5f7] border-[#d2d2d7]/30 opacity-60"
                                                    : "bg-white border-[#d2d2d7]/50 hover:border-[#C6FF00]/50"
                                                    } transition-all relative`}
                                            >
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <div
                                                            className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${task.status === "Done"
                                                                ? "bg-[#22c55e]"
                                                                : "border-2 border-[#C6FF00]"
                                                                }`}
                                                        >
                                                            {task.status === "Done" && (
                                                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                    <path strokeWidth="3" d="M5 13l4 4L19 7" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <h4 className={`text-[12px] sm:text-[13px] font-semibold truncate ${task.status === "Done" ? "line-through text-[#86868b]" : "text-[#1d1d1f]"}`}>
                                                            {task.title}
                                                        </h4>
                                                        {task.due_at && (
                                                            <span className="text-[10px] sm:text-[11px] text-[#86868b] ml-2">
                                                                {new Date(task.due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {new Date(task.due_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                                                            </span>
                                                        )}
                                                        {(isOverdueTask(task) || isOverdueSoon(task)) && task.status !== "Done" && (
                                                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full ${isOverdueTask(task) ? "bg-red-100 text-red-600" : "bg-orange-100 text-orange-600"}`}>{isOverdueTask(task) ? "OVERDUE" : "SOON"}</span>
                                                        )}
                                                    </div>
                                                    {task.description && (
                                                        <p className="text-[10px] sm:text-[11px] text-[#86868b] ml-7 truncate">{task.description}</p>
                                                    )}
                                                    <div className="text-[10px] sm:text-[11px] text-[#86868b] ml-7 mt-1">
                                                        {task.status === "Done" ? "✓ Completed" : task.status}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Actions */}
                                <div className="flex gap-2 pt-6 mt-6 border-t border-[#f0f0f0]">
                                    <button
                                        onClick={() => setSelectedProjectTasks(null)}
                                        className="flex-1 px-4 py-2.5 sm:py-2 bg-[#C6FF00] text-[#1d1d1f] rounded-xl font-semibold text-[13px] hover:bg-[#b3e600] transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
