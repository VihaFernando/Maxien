import { useMemo, useState } from "react"
import { FaPlus, FaEdit, FaTrash, FaSearch, FaUserTag, FaSpinner, FaCheck } from "react-icons/fa"
import {
    createWorkplaceRole,
    updateWorkplaceRole,
    deleteWorkplaceRole,
} from "../../lib/workplaces"

const ROLE_COLORS = ["#6366f1", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"]

export default function WorkplaceRoles({ roles, workplace, user, loading, onRefresh, setError, setMessage }) {
    const [showForm, setShowForm] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [form, setForm] = useState({
        name: "",
        description: "",
        color: "#6366f1",
    })

    const filteredRoles = useMemo(() => {
        const query = searchTerm.trim().toLowerCase()
        if (!query) return roles
        return roles.filter((role) => {
            return role.name?.toLowerCase().includes(query) || role.description?.toLowerCase().includes(query)
        })
    }, [roles, searchTerm])

    const resetForm = () => {
        setForm({ name: "", description: "", color: "#6366f1" })
        setEditingId(null)
        setShowForm(false)
    }

    const startEdit = (role) => {
        setForm({
            name: role.name || "",
            description: role.description || "",
            color: role.color || "#6366f1",
        })
        setEditingId(role.id)
        setShowForm(true)
    }

    const handleDelete = async (roleId) => {
        if (!confirm("Delete this role? It will be removed from all assigned members.")) return

        setError("")
        setMessage("")
        setFormLoading(true)
        try {
            await deleteWorkplaceRole({ roleId })
            setMessage("Role deleted successfully.")
            await onRefresh()
            setTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to delete role.")
        } finally {
            setFormLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setMessage("")

        if (!form.name.trim()) {
            setError("Role name is required.")
            return
        }

        const payload = {
            workplace_id: workplace.id,
            created_by: user.id,
            name: form.name.trim(),
            description: form.description.trim() || null,
            color: form.color || "#6366f1",
            updated_at: new Date().toISOString(),
        }

        setFormLoading(true)
        try {
            if (editingId) {
                await updateWorkplaceRole({ roleId: editingId, payload })
                setMessage("Role updated successfully.")
            } else {
                await createWorkplaceRole(payload)
                setMessage("Role created successfully.")
            }
            resetForm()
            await onRefresh()
            setTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to save role.")
        } finally {
            setFormLoading(false)
        }
    }

    return (
        <div className="animate-in fade-in duration-500">
            <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-5 sm:p-6">
                
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                    <div>
                        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1d1d1f]">Roles</h2>
                        <p className="text-[13px] text-[#86868b] mt-1">Create and manage custom roles for this workplace.</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingId(null)
                            setShowForm(true)
                        }}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] rounded-xl text-[13px] font-bold transition-colors shadow-sm"
                    >
                        <FaPlus className="w-3.5 h-3.5" />
                        New Role
                    </button>
                </div>

                {/* Search Bar */}
                <div className="relative mb-6">
                    <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#86868b] w-4 h-4" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search roles by name or description..."
                        className="w-full pl-10 pr-4 py-3 border border-[#d2d2d7]/50 bg-[#f5f5f7]/50 rounded-xl text-[14px] transition-all focus:bg-white focus:outline-none focus:border-[#C6FF00] focus:ring-2 focus:ring-[#C6FF00]/20"
                    />
                </div>

                {/* List Section */}
                {loading ? (
                    <div className="py-16 flex flex-col items-center justify-center text-[#86868b]">
                        <FaSpinner className="w-6 h-6 animate-spin mb-3 text-[#C6FF00]" />
                        <p className="text-[13px] font-medium">Loading roles...</p>
                    </div>
                ) : filteredRoles.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center border-2 border-dashed border-[#d2d2d7]/50 rounded-2xl bg-[#f5f5f7]/30">
                        <FaUserTag className="w-10 h-10 text-[#86868b] mb-4 opacity-40" />
                        <p className="text-[15px] font-bold text-[#1d1d1f]">No roles found</p>
                        <p className="text-[13px] text-[#86868b] mt-1 max-w-[280px]">
                            {searchTerm ? "We couldn't find any roles matching your search." : "Create your first role to start organizing your team."}
                        </p>
                        {!searchTerm && (
                            <button
                                onClick={() => {
                                    setEditingId(null)
                                    setShowForm(true)
                                }}
                                className="mt-4 text-[13px] font-bold text-[#6366f1] hover:text-[#4f46e5] transition-colors"
                            >
                                + Create your first role
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                        {filteredRoles.map((role) => (
                            <div key={role.id} className="group rounded-2xl border border-[#d2d2d7]/50 bg-white p-5 hover:border-[#d2d2d7] hover:shadow-md transition-all duration-200">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[15px] font-bold text-[#1d1d1f] truncate">{role.name}</p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span
                                                className="text-[11px] font-bold px-2.5 py-1 rounded-full inline-flex items-center gap-1.5"
                                                style={{ backgroundColor: `${role.color || "#6366f1"}15`, color: role.color || "#6366f1" }}
                                            >
                                                <FaUserTag className="w-3 h-3" />
                                                Role Badge
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => startEdit(role)}
                                            className="p-2 rounded-lg hover:bg-[#f5f5f7] text-[#86868b] hover:text-[#1d1d1f] transition-colors"
                                            title="Edit role"
                                        >
                                            <FaEdit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(role.id)}
                                            className="p-2 rounded-lg hover:bg-red-50 text-[#86868b] hover:text-red-600 transition-colors"
                                            title="Delete role"
                                        >
                                            <FaTrash className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                {role.description && <p className="text-[13px] text-[#5f6368] leading-relaxed mt-2">{role.description}</p>}
                            </div>
                        ))}
                    </div>
                )}

                {/* Form Section */}
                {showForm && (
                    <div className="pt-6 border-t border-[#f0f0f0] animate-in slide-in-from-bottom-2 fade-in duration-300">
                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">Role Name *</label>
                                <input
                                    value={form.name}
                                    onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))}
                                    placeholder="e.g., Administrator, Designer, Guest..."
                                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl border border-transparent transition-all focus:border-[#C6FF00] focus:ring-2 focus:ring-[#C6FF00]/20 focus:bg-white outline-none text-[14px]"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">Description (Optional)</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))}
                                    rows={3}
                                    placeholder="Briefly describe the responsibilities of this role..."
                                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl border border-transparent transition-all focus:border-[#C6FF00] focus:ring-2 focus:ring-[#C6FF00]/20 focus:bg-white outline-none text-[14px] resize-none"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">Badge Color</label>
                                <div className="flex flex-wrap gap-3">
                                    {ROLE_COLORS.map((color) => (
                                        <button
                                            key={color}
                                            type="button"
                                            onClick={() => setForm((v) => ({ ...v, color }))}
                                            className={`relative w-9 h-9 rounded-full transition-all duration-200 flex items-center justify-center ${
                                                form.color === color 
                                                    ? "scale-110 ring-2 ring-offset-2 ring-[#1d1d1f]" 
                                                    : "hover:scale-110 border border-black/10"
                                            }`}
                                            style={{ backgroundColor: color }}
                                            title={`Select color ${color}`}
                                        >
                                            {form.color === color && <FaCheck className="w-3.5 h-3.5 text-white drop-shadow-md" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 py-3.5 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7]/80 text-[#1d1d1f] font-semibold text-[14px] hover:bg-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="flex-1 py-3.5 rounded-xl bg-[#C6FF00] hover:bg-[#b8f000] disabled:opacity-60 disabled:cursor-not-allowed text-[#1d1d1f] font-bold text-[14px] inline-flex items-center justify-center gap-2 transition-colors shadow-sm"
                                >
                                    {formLoading ? <FaSpinner className="w-4 h-4 animate-spin" /> : <FaUserTag className="w-4 h-4" />}
                                    {formLoading ? (editingId ? "Saving Updates..." : "Creating Role...") : (editingId ? "Save Changes" : "Create Role")}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}