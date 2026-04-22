import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { FaPlus, FaEdit, FaTrash, FaSearch, FaBars, FaThLarge, FaEllipsisH, FaCalendarAlt, FaTags, FaBuilding } from "react-icons/fa"
import { createWorkplaceTask, updateWorkplaceTask, deleteWorkplaceTask } from "../../lib/workplaces"
import { getUsersByIds, getUsername } from "../../lib/users"
import useTimeoutRegistry from "../../hooks/useTimeoutRegistry"

export default function WorkplaceTasks({
    tasks,
    types,
    projects,
    departments,
    members,
    user,
    workplace,
    isAdmin = false,
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
    const [searchTerm, setSearchTerm] = useState("")
    const [filterStatus] = useState("")
    const [filterPriority] = useState("")
    const [filterAssigned, setFilterAssigned] = useState("all")
    const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false)
    const [viewMode, setViewMode] = useState("board")
    const [actionMenu, setActionMenu] = useState(null)
    const [newTask, setNewTask] = useState({
        title: "",
        description: "",
        type_id: "",
        project_id: "",
        department_id: "",
        due_date: "",
        due_time: "",
        priority: "Medium",
        status: "To Do",
        assigned_to: [],
    })
    const { registerTimeout } = useTimeoutRegistry()

    const acceptedMembers = useMemo(() => members.filter((m) => m.status === "accepted"), [members])
    const memberIds = useMemo(() => members.map((m) => m.user_id), [members])
    const departmentMap = useMemo(() => {
        return (departments || []).reduce((acc, d) => {
            acc[d.id] = d
            return acc
        }, {})
    }, [departments])

    const availableAssignees = useMemo(() => {
        if (!newTask.department_id) return acceptedMembers
        const department = departmentMap[newTask.department_id]
        if (!department) return acceptedMembers

        const allowed = new Set(department.member_user_ids || [])
        return acceptedMembers.filter((m) => allowed.has(m.user_id))
    }, [acceptedMembers, departmentMap, newTask.department_id])

    useEffect(() => {
        const allowedIds = new Set(availableAssignees.map((m) => m.user_id))
        setNewTask((prev) => {
            if (!prev.assigned_to?.length) return prev
            const nextAssigned = prev.assigned_to.filter((id) => allowedIds.has(id))
            if (nextAssigned.length === prev.assigned_to.length) return prev
            return { ...prev, assigned_to: nextAssigned }
        })
    }, [availableAssignees])

    useEffect(() => {
        const loadUsers = async () => {
            if (!memberIds.length) return
            try {
                const users = await getUsersByIds(memberIds)
                setUserMap(users.reduce((acc, u) => ({ ...acc, [u.id]: u }), {}))
            } catch {
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
            } catch {
                // ignore
            }
        }
        loadAssignedUsers()
    }, [tasks])

    const filteredTasks = useMemo(() => {
        return tasks.filter((task) => {
            const query = searchTerm.toLowerCase()
            const matchesSearch =
                task.title?.toLowerCase().includes(query)
                || task.description?.toLowerCase().includes(query)
            const matchesStatus = filterStatus ? task.status === filterStatus : true
            const matchesPriority = filterPriority ? task.priority === filterPriority : true
            const isAssignedToMe = task.task_assignees?.some((a) => a.user_id === user?.id)
            const matchesAssigned = filterAssigned === "assigned" ? isAssignedToMe : true

            return matchesSearch && matchesStatus && matchesPriority && matchesAssigned
        })
    }, [tasks, searchTerm, filterStatus, filterPriority, filterAssigned, user?.id])

    const boardColumns = useMemo(() => {
        const statuses = [
            { key: "To Do", color: "var(--mx-color-64748b)" },
            { key: "In Progress", color: "var(--mx-color-f59e0b)" },
            { key: "Done", color: "var(--mx-color-22c55e)" },
            { key: "Cancelled", color: "var(--mx-color-ef4444)" }
        ]
        return statuses.map((status) => ({
            ...status,
            items: filteredTasks.filter((t) => t.status === status.key)
        }))
    }, [filteredTasks])

    const taskStats = useMemo(
        () => ({
            total: tasks.length,
            todo: tasks.filter((t) => t.status === "To Do").length,
            inProgress: tasks.filter((t) => t.status === "In Progress").length,
            done: tasks.filter((t) => t.status === "Done").length,
            overdue: tasks.filter((t) => {
                if (!t.due_at) return false
                return new Date(t.due_at) < new Date() && t.status !== "Done"
            }).length,
        }),
        [tasks]
    )

    const getTypeName = (typeId) => types.find((t) => t.id === typeId)?.name || "No type"
    const getDepartment = (departmentId) => departmentMap[departmentId] || null

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
                        department_id: newTask.department_id || null,
                        status: newTask.status || "To Do",
                        priority: newTask.priority || "Medium",
                        due_at,
                        assigned_to: newTask.assigned_to || null,
                        workplace_id: workplace.id,
                        linked_by: user.id,
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
                    department_id: newTask.department_id || null,
                    status: newTask.status || "To Do",
                    priority: newTask.priority || "Medium",
                    due_at,
                    assigned_to: newTask.assigned_to || null,
                    linked_by: user.id,
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
                department_id: "",
                due_date: "",
                due_time: "",
                priority: "Medium",
                status: "To Do",
                assigned_to: [],
            })
            setShowForm(false)
            await onRefresh()
            registerTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to save task.")
        } finally {
            setFormLoading(false)
        }
    }
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
        return task.user_id === user.id || isAdmin
    }

    const canUpdateTaskStatus = (task) => {
        if (task.user_id === user.id) return true
        return task.task_assignees?.some((a) => a.user_id === user.id)
    }

    const handleStatusChange = async (task, nextStatus) => {
        if (!canUpdateTaskStatus(task) || !nextStatus || nextStatus === task.status) return

        setError("")
        setMessage("")
        try {
            await updateWorkplaceTask({
                taskId: task.id,
                payload: {
                    status: nextStatus,
                    workplace_id: workplace.id,
                    updated_at: new Date().toISOString(),
                },
            })
            setMessage("Task status updated.")
            await onRefresh()
            registerTimeout(() => setMessage(""), 1500)
        } catch (e) {
            setError(e?.message || "Failed to update task status.")
        }
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
            } catch {
                // ignore
            }
        }

        setNewTask({
            title: task.title,
            description: task.description || "",
            type_id: task.type_id,
            project_id: task.project_id || "",
            department_id: task.department_id || "",
            due_date: dueDate,
            due_time: dueTime,
            priority: task.priority || "Medium",
            status: task.status || "To Do",
            assigned_to: assignedUserIds,
        })
        setEditingId(task.id)
        setShowForm(true)
    }

    const handleCancelEdit = () => {
        setEditingId(null)
        setNewTask({
            title: "",
            description: "",
            type_id: "",
            project_id: "",
            department_id: "",
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
            registerTimeout(() => setMessage(""), 2000)
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

    // Task Card Component for detailed display
    const TaskCard = ({ task }) => (
        <div className="p-4 rounded-[14px] border border-[var(--mx-color-d2d2d7)]/40 hover:border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)] hover:shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-[var(--mx-color-1d1d1f)] truncate">{task.title}</p>
                    {task.description && <p className="text-[12px] text-[var(--mx-color-86868b)] mt-1 line-clamp-1">{task.description}</p>}
                </div>
                <TaskActionsMenu task={task} />
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
                <PriorityBadge priority={task.priority} />
                <span className="text-[10px] font-semibold px-2 py-1 rounded-full bg-[var(--mx-color-f5f5f7)] text-[var(--mx-color-86868b)]">{getTypeName(task.type_id)}</span>
                {task.department && (
                    <span
                        className="text-[10px] font-semibold px-2 py-1 rounded-full"
                        style={{
                            backgroundColor: task.department.color
                                ? `${task.department.color}20`
                                : "color-mix(in srgb, var(--mx-color-0ea5e9) 20%, transparent)",
                            color: task.department.color || "var(--mx-color-0ea5e9)",
                        }}
                    >
                        {task.department.name}
                    </span>
                )}
            </div>

            <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] text-[var(--mx-color-86868b)] flex items-center gap-1.5">
                    <FaCalendarAlt className="w-3 h-3" />
                    {task.due_at ? new Date(task.due_at).toLocaleDateString() : "No due date"}
                </span>
                {canUpdateTaskStatus(task) ? (
                    <select
                        value={task.status || "To Do"}
                        onChange={(e) => handleStatusChange(task, e.target.value)}
                        className="rounded-full px-2 py-1 text-[10px] font-semibold border border-[var(--mx-color-d2d2d7)] bg-[var(--color-surface)]"
                    >
                        {["To Do", "In Progress", "Done", "Cancelled"].map((status) => (
                            <option key={status} value={status}>{status}</option>
                        ))}
                    </select>
                ) : (
                    <StatusBadge status={task.status} />
                )}
            </div>

            {task.task_assignees?.length > 0 && (
                <div className="pt-2 border-t border-[var(--mx-color-f0f0f0)]">
                    <p className="text-[11px] text-[var(--mx-color-86868b)]">{formatTaskAssignees(task).join(", ")}</p>
                </div>
            )}
        </div>
    )

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
                <div className="absolute right-0 top-8 z-50 min-w-[152px] overflow-hidden rounded-xl border border-[var(--mx-color-d2d2d7)]/80 bg-[var(--color-surface)] shadow-xl" onClick={(e) => e.stopPropagation()}>
                    {canEditTask(task) ? (
                        <>
                            <button onClick={() => handleEditClick(task)} className="w-full px-3 py-2 text-left text-[12px] font-medium text-[var(--mx-color-1d1d1f)] hover:bg-[var(--mx-color-f5f5f7)]">Edit</button>
                            <button onClick={() => {
                                handleDeleteTask(task.id)
                                setActionMenu(null)
                            }} className="w-full px-3 py-2 text-left text-[12px] font-medium text-red-600 hover:bg-red-50">Delete</button>
                        </>
                    ) : (
                        <p className="px-3 py-2 text-[11px] text-[var(--mx-color-86868b)]">Status can be updated from the card.</p>
                    )}
                </div>
            )}
        </div>
    )

    const StatusBadge = ({ status }) => {
        const colors = {
            "To Do": { bg: "var(--mx-color-f5f5f7)", text: "var(--mx-color-86868b)" },
            "In Progress": { bg: "var(--mx-color-eff6ff)", text: "var(--mx-color-3b82f6)" },
            "Done": { bg: "var(--mx-color-f0fdf4)", text: "var(--mx-color-16a34a)" },
            "Cancelled": { bg: "var(--mx-color-fef2f2)", text: "var(--mx-color-dc2626)" }
        }
        const color = colors[status] || colors["To Do"]
        return (
            <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ backgroundColor: color.bg, color: color.text }}>
                {status}
            </span>
        )
    }

    const PriorityBadge = ({ priority }) => {
        const colors = {
            "Low": "var(--mx-color-f5f5f7)",
            "Medium": "var(--mx-color-eff6ff)",
            "High": "var(--mx-color-fff7ed)",
            "Urgent": "var(--mx-color-fef2f2)"
        }
        const textColors = {
            "Low": "var(--mx-color-86868b)",
            "Medium": "var(--mx-color-3b82f6)",
            "High": "var(--mx-color-f97316)",
            "Urgent": "var(--mx-color-ef4444)"
        }
        return (
            <span className="rounded-full px-2 py-1 text-[10px] font-semibold" style={{ backgroundColor: colors[priority], color: textColors[priority] }}>
                {priority}
            </span>
        )
    }

    const TaskGridSection = ({ title, taskList }) => (
        <div className="mb-6">
            <div className="flex items-center gap-2 mb-4">
                <h3 className="text-[14px] font-bold text-[var(--mx-color-1d1d1f)] uppercase tracking-wide">{title}</h3>
                <span className="text-[12px] font-semibold text-[var(--mx-color-86868b)] bg-[var(--mx-color-f5f5f7)] px-2.5 py-1 rounded-full">{taskList.length}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {taskList.length === 0 ? (
                    <p className="text-[13px] text-[var(--mx-color-86868b)]">No tasks</p>
                ) : (
                    taskList.map((task) => <TaskCard key={task.id} task={task} />)
                )}
            </div>
        </div>
    )

    const StatCard = ({ label, value, color = "var(--mx-color-1d1d1f)" }) => (
        <div className="flex-1 min-w-[120px] bg-[var(--color-surface)] rounded-[14px] border border-[var(--mx-color-d2d2d7)]/30 p-4">
            <p className="text-[11px] font-semibold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2">{label}</p>
            <p className="text-[28px] font-bold" style={{ color }}>{value}</p>
        </div>
    )

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

            <div className="mb-6">
                <p className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-3">WORKSPACE</p>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-[32px] font-bold text-[var(--mx-color-1d1d1f)]">Tasks</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link
                            to={workplace?.id ? `/dashboard/workplaces/${workplace.id}?tab=types` : "/dashboard/workplaces"}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-[var(--mx-color-d2d2d7)]/50 bg-[var(--color-surface)] hover:bg-[var(--mx-color-f5f5f7)] text-[var(--mx-color-1d1d1f)] rounded-lg text-[13px] font-bold"
                        >
                            <FaTags className="w-3.5 h-3.5" />
                            Task Types
                        </Link>
                        <button
                            onClick={() => {
                                setShowForm(true)
                                setEditingId(null)
                            }}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--mx-color-c6ff00)] hover:bg-[var(--mx-color-b8f000)] text-[var(--mx-color-1d1d1f)] rounded-lg text-[13px] font-bold"
                        >
                            <FaPlus className="w-3.5 h-3.5" />
                            New Task
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3">
                    <StatCard label="TOTAL" value={taskStats.total} />
                    <StatCard label="TO DO" value={taskStats.todo} />
                    <StatCard label="IN PROGRESS" value={taskStats.inProgress} color="var(--mx-color-3b82f6)" />
                    <StatCard label="COMPLETED" value={taskStats.done} color="var(--mx-color-16a34a)" />
                    <StatCard label="OVERDUE" value={taskStats.overdue} color="var(--mx-color-ef4444)" />
                </div>
            </div>

            <div className="bg-[var(--color-surface)] rounded-[22px] border border-[var(--mx-color-d2d2d7)]/50 shadow-sm p-6">
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mx-color-86868b)] w-3.5 h-3.5" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search tasks..."
                            className="w-full pl-9 pr-4 py-2.5 border border-[var(--mx-color-d2d2d7)]/50 rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-[var(--mx-color-c6ff00)]/50"
                        />
                    </div>
                    <select
                        value={filterAssigned}
                        onChange={(e) => setFilterAssigned(e.target.value)}
                        className="px-4 py-2.5 border border-[var(--mx-color-d2d2d7)]/50 rounded-xl text-[13px] bg-[var(--color-surface)]"
                    >
                        <option value="all">All visible tasks</option>
                        <option value="assigned">Assigned to me</option>
                    </select>
                    <div className="flex items-center gap-1 bg-[var(--mx-color-f5f5f7)] rounded-lg p-1">
                        <button onClick={() => setViewMode("list")} className={`px-3 py-2 rounded-lg transition-colors text-[13px] font-medium ${viewMode === "list" ? "bg-[var(--color-surface)] text-[var(--mx-color-1d1d1f)] shadow-sm" : "text-[var(--mx-color-86868b)] hover:text-[var(--mx-color-1d1d1f)]"}`} title="List view">
                            List
                        </button>
                        <button onClick={() => setViewMode("board")} className={`px-3 py-2 rounded-lg transition-colors text-[13px] font-medium ${viewMode === "board" ? "bg-[var(--color-surface)] text-[var(--mx-color-1d1d1f)] shadow-sm" : "text-[var(--mx-color-86868b)] hover:text-[var(--mx-color-1d1d1f)]"}`} title="Board view">
                            Board
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="py-10 text-center text-[var(--mx-color-86868b)] text-[13px]">Loading…</div>
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
                    <>
                        {filteredTasks.length === 0 ? (
                            <div className="py-12 text-center">
                                <p className="text-[var(--mx-color-86868b)] text-[14px]">No tasks found.</p>
                            </div>
                        ) : (
                            <TaskGridSection title="ALL TASKS" taskList={filteredTasks} />
                        )}
                    </>
                )}

                {!showForm && !editingId ? (
                    <button onClick={() => setShowForm(true)} className="mt-6 flex items-center gap-2 px-4 py-3 text-[14px] font-bold text-[var(--mx-color-1d1d1f)] hover:bg-[var(--mx-color-f5f5f7)] rounded-lg transition-colors">
                        <FaPlus className="w-3.5 h-3.5" />
                        Add new task
                    </button>
                ) : (
                    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                        <div>
                            <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Task title *</label>
                            <input value={newTask.title} onChange={(e) => setNewTask((v) => ({ ...v, title: e.target.value }))} placeholder="Enter task title" className="w-full px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px]" />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Description</label>
                            <textarea value={newTask.description} onChange={(e) => setNewTask((v) => ({ ...v, description: e.target.value }))} placeholder="Add details (optional)" rows={3} className="w-full px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px] resize-none" />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Type *</label>
                                <select value={newTask.type_id} onChange={(e) => setNewTask((v) => ({ ...v, type_id: e.target.value }))} className="w-full px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px]">
                                    <option value="">Select type</option>
                                    {types.map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Project</label>
                                <select value={newTask.project_id} onChange={(e) => setNewTask((v) => ({ ...v, project_id: e.target.value }))} className="w-full px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px]">
                                    <option value="">Optional</option>
                                    {projects.map((p) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Department</label>
                                <select value={newTask.department_id} onChange={(e) => setNewTask((v) => ({ ...v, department_id: e.target.value }))} className="w-full px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px]">
                                    <option value="">Optional</option>
                                    {departments.map((d) => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Priority</label>
                                <select value={newTask.priority} onChange={(e) => setNewTask((v) => ({ ...v, priority: e.target.value }))} className="w-full px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px]">
                                    {["Low", "Medium", "High", "Urgent"].map((p) => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Status</label>
                                <select value={newTask.status} onChange={(e) => setNewTask((v) => ({ ...v, status: e.target.value }))} className="w-full px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px]">
                                    {["To Do", "In Progress", "Done", "Cancelled"].map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="relative">
                                <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Assign To</label>
                                <button type="button" onClick={() => setAssigneeDropdownOpen(!assigneeDropdownOpen)} className="w-full px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent hover:border-[var(--mx-color-d2d2d7)] focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px] text-left text-[var(--mx-color-1d1d1f)] flex items-center justify-between">
                                    <span>{newTask.assigned_to.length === 0 ? "Select users" : `${newTask.assigned_to.length} selected`}</span>
                                    <svg className={`w-4 h-4 transition-transform ${assigneeDropdownOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                                    </svg>
                                </button>

                                {assigneeDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1 border border-[var(--mx-color-d2d2d7)]/40 rounded-xl bg-[var(--color-surface)] p-3 space-y-2 max-h-48 overflow-y-auto shadow-lg z-50">
                                        {availableAssignees.length === 0 ? (
                                            <p className="text-[13px] text-[var(--mx-color-86868b)]">No members available</p>
                                        ) : (
                                            availableAssignees.map((m) => (
                                                <label key={m.user_id} className="flex items-center gap-2 cursor-pointer hover:bg-[var(--mx-color-f5f5f7)] p-2 rounded-lg">
                                                    <input type="checkbox" checked={newTask.assigned_to.includes(m.user_id)} onChange={() => toggleAssignee(m.user_id)} className="w-4 h-4 cursor-pointer" />
                                                    <span className="text-[13px] text-[var(--mx-color-1d1d1f)]">{getUsername(userMap[m.user_id] || { id: m.user_id })}</span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                )}

                                {newTask.assigned_to.length > 0 && <p className="text-[12px] text-[var(--mx-color-86868b)] mt-2">Selected: {getAssignedNames(newTask.assigned_to).join(", ")}</p>}
                                {newTask.department_id && (
                                    <p className="text-[11px] text-[var(--mx-color-86868b)] mt-1 inline-flex items-center gap-1.5">
                                        <FaBuilding className="w-3 h-3" />
                                        Showing users from {getDepartment(newTask.department_id)?.name || "selected department"}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Due Date</label>
                                <input type="date" value={newTask.due_date} onChange={(e) => setNewTask((v) => ({ ...v, due_date: e.target.value }))} className="w-full px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px]" />
                            </div>
                            <div>
                                <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Time</label>
                                <input type="time" value={newTask.due_time} onChange={(e) => setNewTask((v) => ({ ...v, due_time: e.target.value }))} className="w-full px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px]" />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button type="button" onClick={() => {
                                handleCancelEdit()
                                setShowForm(false)
                            }} className="flex-1 py-3 rounded-xl bg-[var(--mx-color-f5f5f7)] border border-[var(--mx-color-d2d2d7)] text-[var(--mx-color-1d1d1f)] font-semibold text-[14px] hover:bg-[var(--color-surface)] transition-colors">
                                Cancel
                            </button>
                            <button type="submit" disabled={formLoading} className="flex-1 py-3 rounded-xl bg-[var(--mx-color-c6ff00)] hover:bg-[var(--mx-color-b8f000)] disabled:opacity-60 text-[var(--mx-color-1d1d1f)] font-bold text-[14px] transition-colors">
                                {formLoading ? (editingId ? "Updating…" : "Creating…") : (editingId ? "Update task" : "Create task")}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    )
}
