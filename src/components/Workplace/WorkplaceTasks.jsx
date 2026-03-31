import { useEffect, useMemo, useState } from "react"
import { FaPlus, FaEdit, FaTrash } from "react-icons/fa"
import { createWorkplaceTask, updateWorkplaceTask, deleteWorkplaceTask } from "../../lib/workplaces"
import { getUsersByIds, getDisplayName, getUsername } from "../../lib/users"

export default function WorkplaceTasks({
    tasks,
    types,
    projects,
    members,
    user,
    workplace,
    loading,
    onRefresh,
    error,
    setError,
    message,
    setMessage,
}) {
    const [showForm, setShowForm] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [userMap, setUserMap] = useState({})
    const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false)
    const [newTask, setNewTask] = useState({
        title: "",
        description: "",
        type_id: "",
        project_id: "",
        due_date: "",
        due_time: "",
        priority: "Medium",
        status: "To Do",
        assigned_to: [],
    })

    const memberIds = useMemo(() => members.map((m) => m.user_id), [members])

    useEffect(() => {
        const loadUsers = async () => {
            if (!memberIds.length) return
            try {
                const users = await getUsersByIds(memberIds)
                setUserMap(users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {}))
            } catch (e) {
                // ignore
            }
        }

        loadUsers()
    }, [memberIds])

    // Also load user data for assigned users in tasks
    useEffect(() => {
        const loadAssignedUsers = async () => {
            if (!tasks.length) return
            const assignedUserIds = new Set()
            tasks.forEach((task) => {
                task.task_assignees?.forEach((a) => {
                    if (a.user_id && !userMap[a.user_id]) {
                        assignedUserIds.add(a.user_id)
                    }
                })
            })
            if (assignedUserIds.size === 0) return
            try {
                const users = await getUsersByIds(Array.from(assignedUserIds))
                setUserMap((prev) => ({
                    ...prev,
                    ...users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {}),
                }))
            } catch (e) {
                // ignore
            }
        }
        loadAssignedUsers()
    }, [tasks])

    const assignedUsers = useMemo(() => {
        return (newTask.assigned_to || []).map((id) => userMap[id]).filter(Boolean)
    }, [newTask.assigned_to, userMap])

    const formatTaskAssignees = (task) => {
        const ids = task?.task_assignees?.map((a) => a.user_id) || []
        return getAssignedNames(ids)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setMessage("")
        if (!newTask.title.trim()) return setError("Task title is required.")
        if (!newTask.type_id) return setError("Task type is required.")

        const due_at = buildDueAt(newTask.due_date, newTask.due_time)

        setFormLoading(true)
        try {
            if (editingId) {
                // Update existing task
                await updateWorkplaceTask({
                    taskId: editingId,
                    payload: {
                        title: newTask.title.trim(),
                        description: (newTask.description || "").trim() || null,
                        type_id: newTask.type_id,
                        project_id: newTask.project_id || null,
                        status: newTask.status || "To Do",
                        priority: newTask.priority || "Medium",
                        due_at,
                        assigned_to: newTask.assigned_to || null,
                        updated_at: new Date().toISOString(),
                    },
                })
                setMessage("Task updated successfully.")
                setEditingId(null)
            } else {
                // Create new task
                await createWorkplaceTask({
                    user_id: user.id,
                    workplace_id: workplace.id,
                    title: newTask.title.trim(),
                    description: (newTask.description || "").trim() || null,
                    type_id: newTask.type_id,
                    project_id: newTask.project_id || null,
                    status: newTask.status || "To Do",
                    priority: newTask.priority || "Medium",
                    due_at,
                    assigned_to: newTask.assigned_to || null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                setMessage("Workplace task created.")
            }

            setNewTask({
                title: "",
                description: "",
                type_id: "",
                project_id: "",
                due_date: "",
                due_time: "",
                priority: "Medium",
                status: "To Do",
                assigned_to: [],
            })
            setShowForm(false)
            await onRefresh()
            setTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to save task.")
        } finally {
            setFormLoading(false)
        }
    }

    const acceptedMembers = members.filter((m) => m.status === "accepted")

    const getAssignedNames = (ids) => {
        if (!ids || !Array.isArray(ids)) return []
        return ids
            .map((id) => {
                const user = userMap[id]
                return user ? getUsername(user) : id
            })
            .filter(Boolean)
    }

    const canEditTask = (task) => {
        return task.user_id === user.id
    }

    const handleEditClick = async (task) => {
        const assignedUserIds = task.task_assignees?.map((a) => a.user_id) || []
        const dueDate = task.due_at ? new Date(task.due_at).toISOString().split("T")[0] : ""
        const dueTime = task.due_at ? new Date(task.due_at).toTimeString().slice(0, 5) : ""

        // Load user data for assigned users if not already loaded
        const missingUserIds = assignedUserIds.filter((id) => !userMap[id])
        if (missingUserIds.length > 0) {
            try {
                const users = await getUsersByIds(missingUserIds)
                setUserMap((prev) => ({
                    ...prev,
                    ...users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {}),
                }))
            } catch (e) {
                // ignore
            }
        }

        setNewTask({
            title: task.title,
            description: task.description || "",
            type_id: task.type_id,
            project_id: task.project_id || "",
            due_date: dueDate,
            due_time: dueTime,
            priority: task.priority || "Medium",
            status: task.status || "To Do",
            assigned_to: assignedUserIds,
        })
        setEditingId(task.id)
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setNewTask({
            title: "",
            description: "",
            type_id: "",
            project_id: "",
            due_date: "",
            due_time: "",
            priority: "Medium",
            status: "To Do",
            assigned_to: [],
        })
    }

    const handleDeleteTask = async (taskId) => {
        if (!confirm("Are you sure you want to delete this task?")) return
        setFormLoading(true)
        try {
            await deleteWorkplaceTask({ taskId })
            setMessage("Task deleted successfully.")
            await onRefresh()
            setTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to delete task.")
        } finally {
            setFormLoading(false)
        }
    }

    const buildDueAt = (date, time) => {
        if (!date) return null
        const timeValue = time || "09:00"
        const localDate = new Date(`${date}T${timeValue}:00`)
        return localDate.toISOString()
    }

    const toggleAssignee = (userId) => {
        setNewTask((v) => {
            const current = v.assigned_to || []
            const updated = current.includes(userId)
                ? current.filter((id) => id !== userId)
                : [...current, userId]
            return { ...v, assigned_to: updated }
        })
    }

    return (
        <div className="animate-in fade-in duration-500">
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-[13px]">
                    {error}
                </div>
            )}
            {message && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-[13px]">
                    {message}
                </div>
            )}

            <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-[18px] font-bold text-[#1d1d1f]">Tasks</h2>
                        <p className="text-[12px] text-[#86868b] mt-1">Manage and organize all workplace tasks</p>
                    </div>
                    <span className="text-[14px] font-bold px-3 py-1.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                        {tasks.length}
                    </span>
                </div>

                {loading ? (
                    <div className="py-10 text-center text-[#86868b] text-[13px]">Loading…</div>
                ) : tasks.length === 0 ? (
                    <div className="py-12 text-center">
                        <p className="text-[#86868b] text-[14px]">No tasks yet.</p>
                        <p className="text-[#86868b] text-[13px] mt-1">Create one to get started!</p>
                    </div>
                ) : (
                    <div className="space-y-3 mb-6">
                        {tasks.map((t) => (
                            <div
                                key={t.id}
                                className="p-4 rounded-[14px] border border-[#d2d2d7]/40 hover:border-[#d2d2d7] bg-white hover:shadow-sm transition-all"
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[14px] font-bold text-[#1d1d1f] truncate">{t.title}</p>
                                        {t.description && (
                                            <p className="text-[13px] text-[#86868b] mt-1 line-clamp-2">{t.description}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f] whitespace-nowrap">
                                            {t.status}
                                        </span>
                                        {canEditTask(t) && (
                                            <>
                                                <button
                                                    onClick={() => handleEditClick(t)}
                                                    className="p-2 hover:bg-[#f5f5f7] rounded-lg transition-colors text-[#1d1d1f]"
                                                    title="Edit task"
                                                >
                                                    <FaEdit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteTask(t.id)}
                                                    className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                                                    title="Delete task"
                                                >
                                                    <FaTrash className="w-4 h-4" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-3 text-[12px] text-[#86868b]">
                                    <span>Priority: {t.priority || "—"}</span>
                                    {t.task_assignees?.length > 0 && (
                                        <span>
                                            Assigned: {formatTaskAssignees(t).join(", ")}
                                        </span>
                                    )}
                                    {t.due_at && (
                                        <span>Due: {new Date(t.due_at).toLocaleDateString()}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="pt-6 border-t border-[#f0f0f0]">
                    {!showForm && !editingId ? (
                        <button
                            onClick={() => setShowForm(true)}
                            className="flex items-center gap-2 px-4 py-3 text-[14px] font-bold text-[#1d1d1f] hover:bg-[#f5f5f7] rounded-[12px] transition-colors"
                        >
                            <FaPlus className="w-3.5 h-3.5" />
                            Add new task
                        </button>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                    Task title *
                                </label>
                                <input
                                    value={newTask.title}
                                    onChange={(e) => setNewTask((v) => ({ ...v, title: e.target.value }))}
                                    placeholder="Enter task title"
                                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                    Description
                                </label>
                                <textarea
                                    value={newTask.description}
                                    onChange={(e) => setNewTask((v) => ({ ...v, description: e.target.value }))}
                                    placeholder="Add details (optional)"
                                    rows={3}
                                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px] resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                        Type *
                                    </label>
                                    <select
                                        value={newTask.type_id}
                                        onChange={(e) => setNewTask((v) => ({ ...v, type_id: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                    >
                                        <option value="">Select type</option>
                                        {types.map((t) => (
                                            <option key={t.id} value={t.id}>
                                                {t.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                        Project
                                    </label>
                                    <select
                                        value={newTask.project_id}
                                        onChange={(e) => setNewTask((v) => ({ ...v, project_id: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                    >
                                        <option value="">Optional</option>
                                        {projects.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                        Priority
                                    </label>
                                    <select
                                        value={newTask.priority}
                                        onChange={(e) => setNewTask((v) => ({ ...v, priority: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                    >
                                        {["Low", "Medium", "High", "Urgent"].map((p) => (
                                            <option key={p} value={p}>
                                                {p}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                        Status
                                    </label>
                                    <select
                                        value={newTask.status}
                                        onChange={(e) => setNewTask((v) => ({ ...v, status: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                    >
                                        {["To Do", "In Progress", "Done", "Cancelled"].map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="relative">
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                        Assign To
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent hover:border-[#d2d2d7] focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px] text-left text-[#1d1d1f] flex items-center justify-between"
                                    >
                                        <span>
                                            {newTask.assigned_to.length === 0
                                                ? "Select users"
                                                : `${newTask.assigned_to.length} selected`}
                                        </span>
                                        <svg
                                            className={`w-4 h-4 transition-transform ${assigneeDropdownOpen ? "rotate-180" : ""}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M19 14l-7 7m0 0l-7-7m7 7V3"
                                            />
                                        </svg>
                                    </button>

                                    {assigneeDropdownOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-1 border border-[#d2d2d7]/40 rounded-[12px] bg-white p-3 space-y-2 max-h-48 overflow-y-auto shadow-lg z-50">
                                            {acceptedMembers.length === 0 ? (
                                                <p className="text-[13px] text-[#86868b]">No members available</p>
                                            ) : (
                                                acceptedMembers.map((m) => (
                                                    <label
                                                        key={m.user_id}
                                                        className="flex items-center gap-2 cursor-pointer hover:bg-[#f5f5f7] p-2 rounded-lg"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={newTask.assigned_to.includes(m.user_id)}
                                                            onChange={() => toggleAssignee(m.user_id)}
                                                            className="w-4 h-4 cursor-pointer"
                                                        />
                                                        <span className="text-[13px] text-[#1d1d1f]">
                                                            {getUsername(userMap[m.user_id] || { id: m.user_id })}
                                                        </span>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {newTask.assigned_to.length > 0 && (
                                        <p className="text-[12px] text-[#86868b] mt-2">
                                            Selected: {getAssignedNames(newTask.assigned_to).join(", ")}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                        Due Date
                                    </label>
                                    <input
                                        type="date"
                                        value={newTask.due_date}
                                        onChange={(e) => setNewTask((v) => ({ ...v, due_date: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                        Time
                                    </label>
                                    <input
                                        type="time"
                                        value={newTask.due_time}
                                        onChange={(e) => setNewTask((v) => ({ ...v, due_time: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleCancelEdit()
                                        setShowForm(false)
                                    }}
                                    className="flex-1 py-3 rounded-[12px] bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] font-semibold text-[14px] hover:bg-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="flex-1 py-3 rounded-[12px] bg-[#C6FF00] hover:bg-[#b8f000] disabled:opacity-60 text-[#1d1d1f] font-bold text-[14px] transition-colors"
                                >
                                    {formLoading ? (editingId ? "Updating…" : "Creating…") : (editingId ? "Update task" : "Create task")}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
