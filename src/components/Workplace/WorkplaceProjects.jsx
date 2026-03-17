import { useState } from "react"
import { FaPlus, FaCalendarAlt } from "react-icons/fa"
import { createWorkplaceProject } from "../../lib/workplaces"

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
    const [newProject, setNewProject] = useState({
        name: "",
        description: "",
        type_id: "",
        status: "Active",
        start_date: "",
        target_end_date: "",
    })

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setMessage("")
        if (!newProject.name.trim()) return setError("Project name is required.")
        if (!newProject.type_id) return setError("Project type is required.")

        setFormLoading(true)
        try {
            await createWorkplaceProject({
                user_id: user.id,
                workplace_id: workplace.id,
                name: newProject.name.trim(),
                description: newProject.description.trim() || null,
                type_id: newProject.type_id,
                status: newProject.status || "Active",
                start_date: newProject.start_date || null,
                target_end_date: newProject.target_end_date || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            setNewProject({
                name: "",
                description: "",
                type_id: "",
                status: "Active",
                start_date: "",
                target_end_date: "",
            })
            setMessage("Workplace project created.")
            setShowForm(false)
            await onRefresh()
            setTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to create project.")
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

            <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-[18px] font-bold text-[#1d1d1f]">Projects</h2>
                        <p className="text-[12px] text-[#86868b] mt-1">Track and manage workplace projects</p>
                    </div>
                    <span className="text-[14px] font-bold px-3 py-1.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                        {projects.length}
                    </span>
                </div>

                {loading ? (
                    <div className="py-10 text-center text-[#86868b] text-[13px]">Loading…</div>
                ) : projects.length === 0 ? (
                    <div className="py-12 text-center">
                        <p className="text-[#86868b] text-[14px]">No projects yet.</p>
                        <p className="text-[#86868b] text-[13px] mt-1">Create one to organize your work</p>
                    </div>
                ) : (
                    <div className="space-y-3 mb-6">
                        {projects.map((p) => (
                            <div
                                key={p.id}
                                className="p-4 rounded-[14px] border border-[#d2d2d7]/40 hover:border-[#d2d2d7] bg-white hover:shadow-sm transition-all"
                            >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[14px] font-bold text-[#1d1d1f] truncate">{p.name}</p>
                                        {p.description && (
                                            <p className="text-[13px] text-[#86868b] mt-1 line-clamp-2">{p.description}</p>
                                        )}
                                    </div>
                                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f] whitespace-nowrap">
                                        {p.status}
                                    </span>
                                </div>
                                <div className="flex flex-wrap gap-3 text-[12px] text-[#86868b]">
                                    {p.start_date && (
                                        <span className="flex items-center gap-1">
                                            <FaCalendarAlt className="w-3 h-3" />
                                            Start: {new Date(p.start_date).toLocaleDateString()}
                                        </span>
                                    )}
                                    {p.target_end_date && (
                                        <span className="flex items-center gap-1">
                                            <FaCalendarAlt className="w-3 h-3" />
                                            End: {new Date(p.target_end_date).toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="pt-6 border-t border-[#f0f0f0]">
                    {!showForm ? (
                        <button
                            onClick={() => setShowForm(true)}
                            className="flex items-center gap-2 px-4 py-3 text-[14px] font-bold text-[#1d1d1f] hover:bg-[#f5f5f7] rounded-[12px] transition-colors"
                        >
                            <FaPlus className="w-3.5 h-3.5" />
                            Add new project
                        </button>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                    Project name *
                                </label>
                                <input
                                    value={newProject.name}
                                    onChange={(e) => setNewProject((v) => ({ ...v, name: e.target.value }))}
                                    placeholder="Enter project name"
                                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                    Description
                                </label>
                                <textarea
                                    value={newProject.description}
                                    onChange={(e) => setNewProject((v) => ({ ...v, description: e.target.value }))}
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
                                        value={newProject.type_id}
                                        onChange={(e) => setNewProject((v) => ({ ...v, type_id: e.target.value }))}
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
                                        Status
                                    </label>
                                    <select
                                        value={newProject.status}
                                        onChange={(e) => setNewProject((v) => ({ ...v, status: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                    >
                                        {["Active", "On Hold", "Completed", "Archived"].map((s) => (
                                            <option key={s} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                        Start Date
                                    </label>
                                    <input
                                        type="date"
                                        value={newProject.start_date}
                                        onChange={(e) => setNewProject((v) => ({ ...v, start_date: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                    />
                                </div>
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                        Target End Date
                                    </label>
                                    <input
                                        type="date"
                                        value={newProject.target_end_date}
                                        onChange={(e) => setNewProject((v) => ({ ...v, target_end_date: e.target.value }))}
                                        className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 py-3 rounded-[12px] bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] font-semibold text-[14px] hover:bg-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="flex-1 py-3 rounded-[12px] bg-[#C6FF00] hover:bg-[#b8f000] disabled:opacity-60 text-[#1d1d1f] font-bold text-[14px] transition-colors"
                                >
                                    {formLoading ? "Creating…" : "Create project"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
