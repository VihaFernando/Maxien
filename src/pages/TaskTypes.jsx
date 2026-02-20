import { useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import { Link } from "react-router-dom"
import { FaEdit, FaToggleOn, FaToggleOff, FaEllipsisH, FaTimes, FaPlus } from "react-icons/fa"

export default function TaskTypes() {
    const { user } = useAuth()
    const [types, setTypes] = useState([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [message, setMessage] = useState("")
    const [form, setForm] = useState({ name: "", description: "", color: "#C6FF00" })
    const [editing, setEditing] = useState(null)
    const [actionMenu, setActionMenu] = useState(null)
    const [showForm, setShowForm] = useState(false)

    const defaultColors = [
        "#C6FF00", // Brand yellow
        "#FF3B30", // Red
        "#FF9500", // Orange
        "#34C759", // Green
        "#00B4D8", // Blue
        "#8E44AD", // Purple
        "#E94B3C", // Rose
        "#1ABC9C", // Teal
        "#F39C12", // Amber
        "#34495E", // Dark gray
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
        } catch (err) {
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
            setTimeout(() => setMessage(""), 2500)
        } catch (err) {
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
                setTimeout(() => setMessage(""), 1500)
            }
        } catch {
            setError("Failed to update status.")
        }
    }

    const deleteType = async (typeId) => {
        // Delete is prevented - show message instead
        setError("Task types cannot be deleted. Toggle to 'Inactive' to disable them instead.")
        setTimeout(() => setError(""), 3000)
    }

    const resetForm = () => {
        setForm({ name: "", description: "", color: "#C6FF00" })
        setEditing(null)
    }

    const startEdit = (type) => {
        setForm({ name: type.name, description: type.description || "", color: type.color || "#C6FF00" })
        setEditing(type.id)
        setActionMenu(null)
        setShowForm(true)
    }

    const getTaskCount = (typeId) => {
        // This would require counting from tasks table
        // For now, we show a placeholder
        return "—"
    }

    return (
        <div className="space-y-8 sm:space-y-10 lg:space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <header className="space-y-2 px-1">
                <h2 className="text-[28px] sm:text-[32px] lg:text-[36px] font-bold text-[#1d1d1f] tracking-tight leading-tight">Task Types</h2>
                <p className="text-[#86868b] text-[15px] sm:text-[17px] lg:text-[19px] font-medium">Create and manage reusable task categories. Toggle status or edit details. Types cannot be deleted.</p>
            </header>

            <div className="bg-white rounded-[32px] sm:rounded-[36px] lg:rounded-[40px] p-6 sm:p-8 lg:p-10 shadow-sm border border-[#d2d2d7]/50 space-y-6">
                {/* Action Buttons */}
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <h3 className="text-[18px] font-bold text-[#1d1d1f]">
                            {editing ? "Edit Task Type" : "Create New Type"}
                        </h3>
                        <p className="text-[13px] text-[#86868b] mt-1">
                            {types.length} {types.length === 1 ? "type" : "types"} total
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => { resetForm(); setShowForm(!showForm); }}
                            className="px-5 py-3 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-semibold rounded-xl transition-colors active:scale-[0.98] flex items-center gap-2"
                        >
                            <FaPlus className="w-4 h-4" />
                            New Type
                        </button>
                        <Link to="/dashboard/tasks" className="px-5 py-3 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] border border-[#d2d2d7] font-medium hover:bg-white transition-colors">
                            View Tasks
                        </Link>
                    </div>
                </div>

                {/* Form */}
                {showForm && (
                    <div className="border-t border-[#d2d2d7] pt-6">
                        <form onSubmit={createOrUpdateType} className="space-y-4">
                            <div>
                                <label className="text-[12px] font-bold text-[#1d1d1f] ml-1 uppercase tracking-wider">Type Name</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                                    placeholder="e.g. Work, Personal, Client, Project"
                                    className="w-full px-4 py-3 bg-[#f5f5f7] border-2 border-transparent focus:border-[#C6FF00]/50 focus:bg-white rounded-[16px] text-[14px]"
                                />
                            </div>

                            <div>
                                <label className="text-[12px] font-bold text-[#1d1d1f] ml-1 uppercase tracking-wider">Description (Optional)</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Add a description for this type..."
                                    rows={2}
                                    className="w-full px-4 py-3 bg-[#f5f5f7] border-2 border-transparent focus:border-[#C6FF00]/50 focus:bg-white rounded-[16px] text-[14px] resize-none"
                                />
                            </div>

                            <div>
                                <label className="text-[12px] font-bold text-[#1d1d1f] ml-1 uppercase tracking-wider">Color</label>
                                <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 mt-2">
                                    {defaultColors.map(color => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setForm(f => ({ ...f, color }))}
                                            className={`w-10 h-10 rounded-lg transition-all ${form.color === color ? "ring-2 ring-offset-2 ring-[#1d1d1f]" : "hover:scale-110"}`}
                                            style={{ backgroundColor: color }}
                                            title={color}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-2 mt-3">
                                    <div
                                        className="w-10 h-10 rounded-lg border-2 border-[#d2d2d7]"
                                        style={{ backgroundColor: form.color }}
                                    />
                                    <input
                                        type="text"
                                        value={form.color}
                                        onChange={(e) => setForm(f => ({ ...f, color: e.target.value }))}
                                        placeholder="#C6FF00"
                                        className="flex-1 px-3 py-2 bg-[#f5f5f7] rounded-[10px] text-[13px] border border-[#d2d2d7]"
                                    />
                                </div>
                            </div>

                            {error && <div className="bg-red-50 text-red-600 text-[13px] font-medium px-4 py-3 rounded-xl border border-red-100/50">{error}</div>}
                            {message && <div className="bg-green-50 text-green-700 text-[13px] font-medium px-4 py-3 rounded-xl border border-green-100/50">{message}</div>}

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-semibold py-3 rounded-xl"
                                >
                                    {loading ? (editing ? "Updating..." : "Creating...") : (editing ? "Update Type" : "Create Type")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { resetForm(); setShowForm(false); }}
                                    className="px-6 py-3 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] font-semibold hover:bg-white"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Error/Message Display */}
                {!showForm && error && (
                    <div className="bg-red-50 text-red-600 text-[13px] font-medium px-4 py-3 rounded-xl border border-red-100/50">{error}</div>
                )}
                {!showForm && message && (
                    <div className="bg-green-50 text-green-700 text-[13px] font-medium px-4 py-3 rounded-xl border border-green-100/50">{message}</div>
                )}

                {/* Types Grid */}
                <div className="border-t border-[#d2d2d7] pt-6">
                    {loading && !types.length ? (
                        <div className="p-8 bg-[#f5f5f7] rounded-[20px] text-center text-[#86868b]">Loading…</div>
                    ) : types.length === 0 ? (
                        <div className="p-8 bg-[#f5f5f7] rounded-[20px] text-center">
                            <p className="text-[#86868b]">No task types yet. Create one to get started.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {types.map((t) => (
                                <div key={t.id} className={`p-5 rounded-[20px] border transition-all ${t.status === "Active"
                                        ? "bg-white border-[#d2d2d7]/50 shadow-sm"
                                        : "bg-[#f5f5f7] border-[#d2d2d7]/30 opacity-60"
                                    }`}>
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div
                                                    className="w-4 h-4 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: t.color || "#C6FF00" }}
                                                />
                                                <h4 className="text-[16px] font-bold text-[#1d1d1f] truncate">{t.name}</h4>
                                            </div>
                                            {t.description && (
                                                <p className="text-[12px] text-[#86868b] truncate">{t.description}</p>
                                            )}
                                        </div>

                                        <div className="relative">
                                            <button
                                                onClick={() => setActionMenu(actionMenu === t.id ? null : t.id)}
                                                className="p-2 rounded-lg hover:bg-[#f5f5f7] transition-colors flex-shrink-0"
                                            >
                                                <FaEllipsisH className="w-4 h-4 text-[#86868b]" />
                                            </button>

                                            {actionMenu === t.id && (
                                                <div className="absolute right-0 mt-2 bg-white rounded-[12px] border border-[#d2d2d7] shadow-lg z-50 min-w-[140px]">
                                                    <button
                                                        onClick={() => { startEdit(t); }}
                                                        className="w-full text-left px-4 py-2 hover:bg-[#f5f5f7] rounded-t-[12px] text-[13px] font-medium text-[#1d1d1f] flex items-center gap-2"
                                                    >
                                                        <FaEdit className="w-3 h-3" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => { toggleStatus(t); setActionMenu(null); }}
                                                        className="w-full text-left px-4 py-2 hover:bg-[#f5f5f7] rounded-b-[12px] text-[13px] font-medium text-[#1d1d1f] flex items-center gap-2"
                                                    >
                                                        {t.status === "Active" ? (
                                                            <>
                                                                <FaToggleOff className="w-3 h-3" />
                                                                Deactivate
                                                            </>
                                                        ) : (
                                                            <>
                                                                <FaToggleOn className="w-3 h-3" />
                                                                Activate
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <span className={`text-[12px] font-bold px-3 py-1 rounded-full ${t.status === "Active"
                                                    ? "bg-[#22c55e]/10 text-[#22c55e]"
                                                    : "bg-[#f5f5f7] text-[#86868b]"
                                                }`}>
                                                {t.status}
                                            </span>
                                            <span className="text-[12px] text-[#86868b]">
                                                {getTaskCount(t.id)} tasks
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-[#86868b]">Created {new Date(t.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
