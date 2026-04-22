import { useMemo, useState } from "react"
import { FaPlus, FaEdit, FaTrash, FaSearch } from "react-icons/fa"
import {
    createWorkplaceTaskType,
    updateWorkplaceTaskType,
    deleteWorkplaceTaskType,
} from "../../lib/workplaces"
import useTimeoutRegistry from "../../hooks/useTimeoutRegistry"

export default function WorkplaceTaskTypes({
    types,
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
    const [searchTerm, setSearchTerm] = useState("")
    const [newType, setNewType] = useState({ name: "", description: "", color: "var(--mx-color-c6ff00)", status: "Active" })
    const { registerTimeout } = useTimeoutRegistry()

    const filteredTypes = useMemo(() => {
        return types.filter((t) => t.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    }, [types, searchTerm])

    const resetForm = () => {
        setNewType({ name: "", description: "", color: "var(--mx-color-c6ff00)", status: "Active" })
        setEditingId(null)
        setShowForm(false)
    }

    const startEdit = (type) => {
        setNewType({
            name: type.name || "",
            description: type.description || "",
            color: type.color || "var(--mx-color-c6ff00)",
            status: type.status || "Active",
        })
        setEditingId(type.id)
        setShowForm(true)
    }

    const handleDelete = async (typeId) => {
        if (!confirm("Delete this task type?")) return

        setError("")
        setMessage("")
        setFormLoading(true)
        try {
            await deleteWorkplaceTaskType({ typeId })
            setMessage("Task type deleted successfully.")
            await onRefresh()
            registerTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to delete task type.")
        } finally {
            setFormLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setMessage("")
        if (!newType.name.trim()) return setError("Type name is required.")

        const payload = {
            user_id: user.id,
            workplace_id: workplace.id,
            name: newType.name.trim(),
            description: newType.description.trim() || null,
            color: newType.color,
            status: newType.status || "Active",
        }

        setFormLoading(true)
        try {
            if (editingId) {
                await updateWorkplaceTaskType({ typeId: editingId, payload })
                setMessage("Task type updated successfully.")
            } else {
                await createWorkplaceTaskType(payload)
                setMessage("Workplace task type created.")
            }

            resetForm()
            await onRefresh()
            registerTimeout(() => setMessage(""), 2000)
        } catch (e2) {
            setError(e2?.message || (editingId ? "Failed to update task type." : "Failed to create task type."))
        } finally {
            setFormLoading(false)
        }
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

            <div className="bg-[var(--color-surface)] rounded-[22px] border border-[var(--mx-color-d2d2d7)]/50 shadow-sm p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                    <div>
                        <h2 className="text-[18px] sm:text-[20px] font-bold text-[var(--mx-color-1d1d1f)]">Workplace Task Types</h2>
                        <p className="text-[12px] text-[var(--mx-color-86868b)] mt-1">Manage categories used across workplace tasks and projects.</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingId(null)
                            setShowForm(true)
                        }}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[var(--mx-color-c6ff00)] hover:bg-[var(--mx-color-b8f000)] text-[var(--mx-color-1d1d1f)] rounded-xl text-[13px] font-bold"
                    >
                        <FaPlus className="w-3.5 h-3.5" />
                        New Type
                    </button>
                </div>

                <div className="relative mb-6">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--mx-color-86868b)] w-3.5 h-3.5" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search task types..."
                        className="w-full pl-9 pr-4 py-2.5 border border-[var(--mx-color-d2d2d7)]/50 rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-[var(--mx-color-c6ff00)]/50"
                    />
                </div>

                {loading ? (
                    <div className="py-10 text-center text-[var(--mx-color-86868b)] text-[13px]">Loading...</div>
                ) : filteredTypes.length === 0 ? (
                    <div className="py-12 text-center text-[var(--mx-color-86868b)] text-[13px]">No task types found.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        {filteredTypes.map((t) => (
                            <div key={t.id} className="rounded-2xl border border-[var(--mx-color-d2d2d7)]/50 bg-[var(--color-surface)] p-4 sm:p-5 hover:shadow-sm transition-all">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <div
                                                className="w-4 h-4 rounded-full border border-black/5"
                                                style={{ backgroundColor: t.color || "var(--mx-color-c6ff00)" }}
                                            />
                                            <p className="text-[15px] font-bold text-[var(--mx-color-1d1d1f)] truncate">{t.name}</p>
                                        </div>
                                        <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[var(--mx-color-f5f5f7)] text-[var(--mx-color-1d1d1f)]">
                                            {t.status || "Active"}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => startEdit(t)}
                                            className="p-2 rounded-lg hover:bg-[var(--mx-color-f5f5f7)] text-[var(--mx-color-1d1d1f)]"
                                            title="Edit type"
                                        >
                                            <FaEdit className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(t.id)}
                                            className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                                            title="Delete type"
                                        >
                                            <FaTrash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {t.description && (
                                    <p className="text-[13px] text-[var(--mx-color-5f6368)] leading-relaxed mb-2">{t.description}</p>
                                )}

                                <p className="text-[12px] text-[var(--mx-color-6b7280)]">
                                    Created: {t.created_at ? new Date(t.created_at).toLocaleDateString() : "-"}
                                </p>
                            </div>
                        ))}
                    </div>
                )}

                {showForm && (
                    <div className="pt-6 border-t border-[var(--mx-color-f0f0f0)]">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Type name *</label>
                                <input
                                    value={newType.name}
                                    onChange={(e) => setNewType((v) => ({ ...v, name: e.target.value }))}
                                    placeholder="Enter type name"
                                    className="w-full px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px]"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Description</label>
                                <textarea
                                    value={newType.description}
                                    onChange={(e) => setNewType((v) => ({ ...v, description: e.target.value }))}
                                    rows={3}
                                    placeholder="Add details"
                                    className="w-full px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px] resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Color</label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            type="color"
                                            value={newType.color}
                                            onChange={(e) => setNewType((v) => ({ ...v, color: e.target.value }))}
                                            className="w-16 h-12 rounded-lg border border-[var(--mx-color-d2d2d7)] cursor-pointer"
                                        />
                                        <input
                                            value={newType.color}
                                            onChange={(e) => setNewType((v) => ({ ...v, color: e.target.value }))}
                                            className="flex-1 px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px]"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-[var(--mx-color-86868b)] uppercase tracking-wider mb-2 block">Status</label>
                                    <select
                                        value={newType.status}
                                        onChange={(e) => setNewType((v) => ({ ...v, status: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[var(--mx-color-f5f5f7)] rounded-xl border border-transparent focus:border-[var(--mx-color-c6ff00)]/60 focus:bg-[var(--color-surface)] outline-none text-[14px]"
                                    >
                                        <option value="Active">Active</option>
                                        <option value="Inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 py-3 rounded-xl bg-[var(--mx-color-f5f5f7)] border border-[var(--mx-color-d2d2d7)] text-[var(--mx-color-1d1d1f)] font-semibold text-[14px] hover:bg-[var(--color-surface)]"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="flex-1 py-3 rounded-xl bg-[var(--mx-color-c6ff00)] hover:bg-[var(--mx-color-b8f000)] disabled:opacity-60 text-[var(--mx-color-1d1d1f)] font-bold text-[14px]"
                                >
                                    {formLoading ? (editingId ? "Updating..." : "Creating...") : (editingId ? "Update type" : "Create type")}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}
