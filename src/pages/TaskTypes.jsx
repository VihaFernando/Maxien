import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import { Link } from "react-router-dom"
import { FaEdit, FaToggleOn, FaToggleOff, FaEllipsisH, FaTimes, FaPlus } from "react-icons/fa"
import useTimeoutRegistry from "../hooks/useTimeoutRegistry"

export default function TaskTypes() {
    const { user } = useAuth()
    const [types, setTypes] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [message, setMessage] = useState("")
    const [form, setForm] = useState({ name: "", description: "", color: "var(--mx-color-c6ff00)" })
    const [editing, setEditing] = useState(null)
    const [actionMenu, setActionMenu] = useState(null)
    const [showForm, setShowForm] = useState(false)
    const { registerTimeout } = useTimeoutRegistry()

    const defaultColors = [
        "var(--mx-color-c6ff00)", // Brand yellow
        "var(--mx-color-ff3b30)", // Red
        "var(--mx-color-ff9500)", // Orange
        "var(--mx-color-34c759)", // Green
        "var(--mx-color-00b4d8)", // Blue
        "var(--mx-color-8e44ad)", // Purple
        "var(--mx-color-e94b3c)", // Rose
        "var(--mx-color-1abc9c)", // Teal
        "var(--mx-color-f39c12)", // Amber
        "var(--mx-color-34495e)", // Dark gray
    ]

    useEffect(() => {
        if (!user) return
        fetchTypes()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    const fetchTypes = async () => {
        setLoading(true)
        setError("")
        try {
            const { data, error } = await supabase
                .from("task_types")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })

            if (error) {
                setError("Unable to load task types.")
                setTypes([])
            } else {
                setTypes(data || [])
            }
        } catch {
            setError("Failed to load task types.")
            setTypes([])
        } finally {
            setLoading(false)
        }
    }

    const createOrUpdateType = async (e) => {
        e.preventDefault()
        setError("")
        if (!form.name.trim()) return setError("Please enter a name for the task type.")
        setLoading(true)

        try {
            if (editing) {
                // Update existing type
                const { error } = await supabase
                    .from("task_types")
                    .update({
                        name: form.name.trim(),
                        description: form.description.trim() || null,
                        color: form.color,
                    })
                    .eq("id", editing)
                    .eq("user_id", user.id)

                if (error) {
                    setError("Failed to update task type.")
                } else {
                    setTypes(prev => prev.map(t =>
                        t.id === editing
                            ? { ...t, name: form.name.trim(), description: form.description.trim() || null, color: form.color }
                            : t
                    ))
                    setMessage("Task type updated.")
                    resetForm()
                    setShowForm(false)
                }
            } else {
                // Create new type
                const payload = {
                    user_id: user.id,
                    name: form.name.trim(),
                    description: form.description.trim() || null,
                    color: form.color,
                    status: "Active"
                }

                const { data, error } = await supabase.from("task_types").insert([payload]).select().single()

                if (error) {
                    setTypes(prev => [{ id: Date.now(), ...payload, created_at: new Date().toISOString() }, ...prev])
                    setMessage("Saved locally — server insert failed.")
                } else {
                    setTypes(prev => [data, ...prev])
                    setMessage("Task type created.")
                }
                resetForm()
                setShowForm(false)
            }
            registerTimeout(() => setMessage(""), 2500)
        } catch {
            setError("Failed to save task type.")
        } finally {
            setLoading(false)
        }
    }

    const toggleStatus = async (item) => {
        const newStatus = item.status === "Active" ? "Inactive" : "Active"
        setTypes(prev => prev.map(t => (t.id === item.id ? { ...t, status: newStatus } : t)))
        try {
            const { error } = await supabase
                .from("task_types")
                .update({ status: newStatus })
                .eq("id", item.id)
                .eq("user_id", user.id)
            if (error) {
                setError("Failed to update status.")
            } else {
                setMessage(`Type ${newStatus === "Active" ? "activated" : "deactivated"}.`)
                registerTimeout(() => setMessage(""), 1500)
            }
        } catch {
            setError("Failed to update status.")
        }
    }

    const resetForm = () => {
        setForm({ name: "", description: "", color: "var(--mx-color-c6ff00)" })
        setEditing(null)
    }

    const startEdit = (type) => {
        setForm({ name: type.name, description: type.description || "", color: type.color || "var(--mx-color-c6ff00)" })
        setEditing(type.id)
        setActionMenu(null)
        setShowForm(true)
    }

    const getTaskCount = () => {
        // This would require counting from tasks table
        // For now, we show a placeholder
        return "—"
    }

    return (
        <div className="mx-auto max-w-[1320px] animate-in fade-in pb-8 duration-500" onClick={() => setActionMenu(null)}>
            <div className="mb-4 flex flex-col gap-2.5 px-0.5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--mx-color-6b7280)]">Workspace</p>
                    <h1 className="text-[20px] font-bold tracking-tight text-[var(--mx-color-111827)] sm:text-[24px]">Task Types</h1>
                    <p className="mt-1 text-[12px] text-[var(--mx-color-64748b)]">Create and manage reusable task categories.</p>
                </div>
                <div className="flex gap-2 self-start sm:self-auto">
                    <button
                        onClick={(e) => { e.stopPropagation(); resetForm(); setShowForm(true) }}
                        className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--mx-color-c6ff00)] px-3.5 py-2 text-[12px] font-bold text-[var(--mx-color-111827)] transition-colors hover:bg-[var(--mx-color-b8f000)] sm:text-[13px]"
                    >
                        <FaPlus className="h-3 w-3" />
                        New Type
                    </button>
                    <Link
                        to="/dashboard/tasks"
                        className="inline-flex items-center rounded-[10px] border border-[var(--mx-color-d2d2d7)] bg-[var(--mx-color-f5f7fa)] px-3.5 py-2 text-[12px] font-semibold text-[var(--mx-color-334155)] transition-colors hover:bg-[var(--color-surface)] sm:text-[13px]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        View Tasks
                    </Link>
                </div>
            </div>

            {error && !showForm && (
                <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">{error}</div>
            )}
            {message && !showForm && (
                <div className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-[12px] font-medium text-green-700">{message}</div>
            )}

            <div className="rounded-2xl border border-[var(--mx-color-e2e8f0)] bg-[var(--color-surface)] p-3 shadow-sm sm:p-4">
                {loading && !types.length ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="h-7 w-7 animate-spin rounded-full border-4 border-[var(--mx-color-c6ff00)] border-t-transparent"></div>
                    </div>
                ) : types.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-14">
                        <p className="text-[14px] font-semibold text-[var(--mx-color-111827)]">No task types found</p>
                        <p className="text-[12px] text-[var(--mx-color-6b7280)]">Create your first type to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {types.map((t) => (
                            <div key={t.id} className={`rounded-xl border p-3 transition-all ${t.status === "Active" ? "border-[var(--mx-color-e2e8f0)] bg-[var(--color-surface)]" : "border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] opacity-70"}`}>
                                <div className="mb-2.5 flex items-start justify-between gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="mb-1 flex items-center gap-2">
                                            <div className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: t.color || "var(--mx-color-c6ff00)" }} />
                                            <h4 className="truncate text-[14px] font-bold text-[var(--mx-color-111827)]">{t.name}</h4>
                                        </div>
                                        {t.description && <p className="truncate text-[12px] text-[var(--mx-color-64748b)]">{t.description}</p>}
                                    </div>

                                    <div className="relative">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setActionMenu(actionMenu === t.id ? null : t.id) }}
                                            className="rounded-lg p-1.5 text-[var(--mx-color-64748b)] transition-colors hover:bg-[var(--mx-color-f5f7fa)]"
                                        >
                                            <FaEllipsisH className="h-3.5 w-3.5" />
                                        </button>

                                        {actionMenu === t.id && (
                                            <div className="absolute right-0 top-8 z-50 min-w-[152px] overflow-hidden rounded-xl border border-[var(--mx-color-d2d2d7)]/80 bg-[var(--color-surface)] shadow-xl" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => startEdit(t)}
                                                    className="w-full border-b border-[var(--mx-color-f0f0f0)] px-3 py-2 text-left text-[12px] font-medium text-[var(--mx-color-1d1d1f)] hover:bg-[var(--mx-color-f5f5f7)]"
                                                >
                                                    <span className="inline-flex items-center gap-2"><FaEdit className="h-3 w-3" />Edit</span>
                                                </button>
                                                <button
                                                    onClick={() => { toggleStatus(t); setActionMenu(null) }}
                                                    className="w-full px-3 py-2 text-left text-[12px] font-medium text-[var(--mx-color-1d1d1f)] hover:bg-[var(--mx-color-f5f5f7)]"
                                                >
                                                    {t.status === "Active" ? (
                                                        <span className="inline-flex items-center gap-2"><FaToggleOff className="h-3 w-3" />Deactivate</span>
                                                    ) : (
                                                        <span className="inline-flex items-center gap-2"><FaToggleOn className="h-3 w-3" />Activate</span>
                                                    )}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between">
                                    <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${t.status === "Active" ? "bg-[var(--mx-color-22c55e)]/10 text-[var(--mx-color-22c55e)]" : "bg-[var(--mx-color-f1f5f9)] text-[var(--mx-color-64748b)]"}`}>
                                        {t.status}
                                    </span>
                                    <span className="text-[11px] text-[var(--mx-color-64748b)]">{getTaskCount(t.id)} tasks</span>
                                </div>
                                <p className="mt-2 text-[10px] text-[var(--mx-color-94a3b8)]">Created {new Date(t.created_at).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showForm && (
                <div className="fixed inset-0 z-50 overflow-y-auto bg-[var(--mx-color-151418)]/45 backdrop-blur-[3px]" onClick={() => { resetForm(); setShowForm(false) }}>
                    <div className="flex min-h-full items-start justify-center p-0 pt-12 sm:items-center sm:p-4 sm:pt-0">
                        <div className="w-full overflow-hidden rounded-t-3xl border border-[var(--mx-color-e2e8f0)] bg-[var(--color-surface)] shadow-2xl sm:max-w-[720px] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between border-b border-[var(--mx-color-eef2f7)] bg-[var(--mx-color-f8fafc)] px-4.5 pb-3.5 pt-4 sm:px-5 sm:pt-4.5">
                                <div>
                                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Type editor</p>
                                    <h3 className="mt-0.5 text-[15px] font-bold text-[var(--mx-color-111827)] sm:text-[17px]">{editing ? "Edit Task Type" : "New Task Type"}</h3>
                                    <p className="mt-0.5 text-[11px] text-[var(--mx-color-64748b)]">{editing ? "Update task type details" : "Add a reusable type for task categorization"}</p>
                                </div>
                                <button onClick={() => { resetForm(); setShowForm(false) }} className="rounded-full border border-[var(--mx-color-e2e8f0)] bg-[var(--color-surface)] p-1.5 transition-colors hover:bg-[var(--mx-color-f8fafc)]">
                                    <FaTimes className="h-4 w-4 text-[var(--mx-color-64748b)]" />
                                </button>
                            </div>

                            <form onSubmit={createOrUpdateType} className="max-h-[76vh] space-y-3.5 overflow-y-auto px-4.5 py-4 sm:max-h-[80vh] sm:px-5 sm:py-4.5">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                    <div>
                                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Type Name *</label>
                                        <input
                                            value={form.name}
                                            onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                                            placeholder="e.g. Work, Personal, Client"
                                            className="w-full rounded-lg border border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] px-3 py-2.5 text-[13px] text-[var(--mx-color-111827)] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/70 focus:bg-[var(--color-surface)]"
                                        />
                                    </div>

                                    <div>
                                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Color code</label>
                                        <input
                                            type="text"
                                            value={form.color}
                                            onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                                            placeholder="var(--mx-color-c6ff00)"
                                            className="w-full rounded-lg border border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] px-3 py-2.5 text-[13px] text-[var(--mx-color-111827)] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/70 focus:bg-[var(--color-surface)]"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Description</label>
                                        <textarea
                                            value={form.description}
                                            onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                                            placeholder="Add a description for this type..."
                                            rows={3}
                                            className="w-full resize-none rounded-lg border border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] px-3 py-2.5 text-[13px] text-[var(--mx-color-111827)] outline-none transition-all focus:border-[var(--mx-color-c6ff00)]/70 focus:bg-[var(--color-surface)]"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--mx-color-64748b)]">Quick colors</label>
                                        <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
                                            {defaultColors.map(color => (
                                                <button
                                                    key={color}
                                                    type="button"
                                                    onClick={() => setForm(f => ({ ...f, color }))}
                                                    className={`h-9 w-9 rounded-lg border transition-all ${form.color === color ? "border-[var(--mx-color-111827)] ring-2 ring-[var(--mx-color-111827)]/15" : "border-transparent hover:scale-105"}`}
                                                    style={{ backgroundColor: color }}
                                                    title={color}
                                                />
                                            ))}
                                        </div>
                                        <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--mx-color-e2e8f0)] bg-[var(--mx-color-f8fafc)] px-2.5 py-2">
                                            <span className="inline-block h-5 w-5 rounded-md border border-[var(--mx-color-d2d2d7)]" style={{ backgroundColor: form.color }} />
                                            <span className="text-[11px] font-medium text-[var(--mx-color-64748b)]">Selected: {form.color}</span>
                                        </div>
                                    </div>
                                </div>

                                {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600">{error}</p>}
                                {message && <p className="rounded-lg bg-green-50 px-3 py-2 text-[12px] font-medium text-green-700">{message}</p>}

                                <div className="flex gap-2 border-t border-[var(--mx-color-eef2f7)] pt-3">
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex-1 rounded-lg bg-[var(--mx-color-c6ff00)] py-2.5 text-[13px] font-semibold text-[var(--mx-color-1d1d1f)] transition-colors hover:bg-[var(--mx-color-b8f000)] disabled:opacity-60"
                                    >
                                        {loading ? (editing ? "Updating..." : "Creating...") : (editing ? "Update Type" : "Create Type")}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { resetForm(); setShowForm(false) }}
                                        className="rounded-lg border border-[var(--mx-color-d2d2d7)] bg-[var(--mx-color-f5f7fa)] px-4 py-2.5 text-[13px] font-semibold text-[var(--mx-color-334155)] transition-colors hover:bg-[var(--color-surface)]"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
