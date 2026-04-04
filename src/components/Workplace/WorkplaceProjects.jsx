import { useMemo, useState } from "react"
import { FaPlus, FaCalendarAlt, FaEdit, FaTrash, FaSearch } from "react-icons/fa"
import {
    createWorkplaceProject,
    updateWorkplaceProject,
    deleteWorkplaceProject,
} from "../../lib/workplaces"

export default function WorkplaceProjects({
    projects,
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
    const [filterStatus, setFilterStatus] = useState("")
    const [newProject, setNewProject] = useState({
        name: "",
        description: "",
        type_id: "",
        status: "Active",
        start_date: "",
        target_end_date: "",
    })

    const statusOptions = ["Active", "On Hold", "Completed", "Archived"]

    const filteredProjects = useMemo(() => {
        return projects.filter((p) => {
            const matchesSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase())
            const matchesStatus = filterStatus ? p.status === filterStatus : true
            return matchesSearch && matchesStatus
        })
    }, [projects, searchTerm, filterStatus])

    const getTypeName = (typeId) => types.find((t) => t.id === typeId)?.name || "Uncategorized"

    const resetForm = () => {
        setNewProject({
            name: "",
            description: "",
            type_id: "",
            status: "Active",
            start_date: "",
            target_end_date: "",
        })
        setEditingId(null)
        setShowForm(false)
    }

    const startEdit = (project) => {
        setNewProject({
            name: project.name || "",
            description: project.description || "",
            type_id: project.type_id || "",
            status: project.status || "Active",
            start_date: project.start_date || "",
            target_end_date: project.target_end_date || "",
        })
        setEditingId(project.id)
        setShowForm(true)
    }

    const handleDelete = async (projectId) => {
        if (!confirm("Delete this workplace project?")) return

        setError("")
        setMessage("")
        setFormLoading(true)
        try {
            await deleteWorkplaceProject({ projectId })
            setMessage("Project deleted successfully.")
            await onRefresh()
            setTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to delete project.")
        } finally {
            setFormLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setMessage("")

        if (!newProject.name.trim()) return setError("Project name is required.")
        if (!newProject.type_id) return setError("Project type is required.")

        const payload = {
            user_id: user.id,
            workplace_id: workplace.id,
            name: newProject.name.trim(),
            description: newProject.description.trim() || null,
            type_id: newProject.type_id,
            status: newProject.status || "Active",
            start_date: newProject.start_date || null,
            target_end_date: newProject.target_end_date || null,
            updated_at: new Date().toISOString(),
        }

        setFormLoading(true)
        try {
            if (editingId) {
                await updateWorkplaceProject({ projectId: editingId, payload })
                setMessage("Project updated successfully.")
            } else {
                await createWorkplaceProject({
                    ...payload,
                    created_at: new Date().toISOString(),
                })
                setMessage("Workplace project created.")
            }

            resetForm()
            await onRefresh()
            setTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || (editingId ? "Failed to update project." : "Failed to create project."))
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

            <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                    <div>
                        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1d1d1f]">Workplace Projects</h2>
                        <p className="text-[12px] text-[#86868b] mt-1">Track ownership, timeline, and current status.</p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingId(null)
                            setShowForm(true)
                        }}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] rounded-xl text-[13px] font-bold"
                    >
                        <FaPlus className="w-3.5 h-3.5" />
                        New Project
                    </button>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <div className="relative flex-1">
                        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b] w-3.5 h-3.5" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search projects..."
                            className="w-full pl-9 pr-4 py-2.5 border border-[#d2d2d7]/50 rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-[#C6FF00]/50"
                        />
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-4 py-2.5 border border-[#d2d2d7]/50 rounded-xl text-[13px] bg-white"
                    >
                        <option value="">All Statuses</option>
                        {statusOptions.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className="py-10 text-center text-[#86868b] text-[13px]">Loading...</div>
                ) : filteredProjects.length === 0 ? (
                    <div className="py-12 text-center text-[#86868b] text-[13px]">No projects found.</div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                        {filteredProjects.map((p) => (
                            <div key={p.id} className="rounded-2xl border border-[#d2d2d7]/50 bg-white p-4 sm:p-5 hover:shadow-sm transition-all">
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[15px] font-bold text-[#1d1d1f] truncate">{p.name}</p>
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                                                {p.status || "Active"}
                                            </span>
                                            <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#eff6ff] text-[#3b82f6]">
                                                {getTypeName(p.type_id)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => startEdit(p)}
                                            className="p-2 rounded-lg hover:bg-[#f5f5f7] text-[#1d1d1f]"
                                            title="Edit project"
                                        >
                                            <FaEdit className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(p.id)}
                                            className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                                            title="Delete project"
                                        >
                                            <FaTrash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {p.description && (
                                    <p className="text-[13px] text-[#5f6368] leading-relaxed mb-3">{p.description}</p>
                                )}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[12px] text-[#6b7280]">
                                    <span className="inline-flex items-center gap-1.5">
                                        <FaCalendarAlt className="w-3 h-3" />
                                        Start: {p.start_date ? new Date(p.start_date).toLocaleDateString() : "Not set"}
                                    </span>
                                    <span className="inline-flex items-center gap-1.5">
                                        <FaCalendarAlt className="w-3 h-3" />
                                        Target: {p.target_end_date ? new Date(p.target_end_date).toLocaleDateString() : "Not set"}
                                    </span>
                                    <span>Created: {p.created_at ? new Date(p.created_at).toLocaleDateString() : "-"}</span>
                                    <span>Updated: {p.updated_at ? new Date(p.updated_at).toLocaleDateString() : "-"}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {showForm && (
                    <div className="pt-6 border-t border-[#f0f0f0]">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">Project name *</label>
                                <input
                                    value={newProject.name}
                                    onChange={(e) => setNewProject((v) => ({ ...v, name: e.target.value }))}
                                    placeholder="Enter project name"
                                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">Description</label>
                                <textarea
                                    value={newProject.description}
                                    onChange={(e) => setNewProject((v) => ({ ...v, description: e.target.value }))}
                                    rows={3}
                                    placeholder="Add details"
                                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px] resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">Type *</label>
                                    <select
                                        value={newProject.type_id}
                                        onChange={(e) => setNewProject((v) => ({ ...v, type_id: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                    >
                                        <option value="">Select type</option>
                                        {types.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">Status</label>
                                    <select
                                        value={newProject.status}
                                        onChange={(e) => setNewProject((v) => ({ ...v, status: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                    >
                                        {statusOptions.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">Start date</label>
                                    <input
                                        type="date"
                                        value={newProject.start_date}
                                        onChange={(e) => setNewProject((v) => ({ ...v, start_date: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">Target end date</label>
                                    <input
                                        type="date"
                                        value={newProject.target_end_date}
                                        onChange={(e) => setNewProject((v) => ({ ...v, target_end_date: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="flex-1 py-3 rounded-xl bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] font-semibold text-[14px] hover:bg-white"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="flex-1 py-3 rounded-xl bg-[#C6FF00] hover:bg-[#b8f000] disabled:opacity-60 text-[#1d1d1f] font-bold text-[14px]"
                                >
                                    {formLoading ? (editingId ? "Updating..." : "Creating...") : (editingId ? "Update project" : "Create project")}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}
