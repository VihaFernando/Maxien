import { useState } from "react"
import { FaPlus } from "react-icons/fa"
import { createWorkplaceTaskType } from "../../lib/workplaces"

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
    const [newType, setNewType] = useState({ name: "", description: "", color: "#C6FF00" })

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setMessage("")
        if (!newType.name.trim()) return setError("Type name is required.")

        setFormLoading(true)
        try {
            await createWorkplaceTaskType({
                user_id: user.id,
                workplace_id: workplace.id,
                name: newType.name.trim(),
                description: newType.description.trim() || null,
                color: newType.color,
                status: "Active",
            })
            setNewType({ name: "", description: "", color: "#C6FF00" })
            setMessage("Workplace task type created.")
            setShowForm(false)
            await onRefresh()
            setTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to create task type.")
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
                        <h2 className="text-[18px] font-bold text-[#1d1d1f]">Task Types</h2>
                        <p className="text-[12px] text-[#86868b] mt-1">Create and manage task categories</p>
                    </div>
                    <span className="text-[14px] font-bold px-3 py-1.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                        {types.length}
                    </span>
                </div>

                {loading ? (
                    <div className="py-10 text-center text-[#86868b] text-[13px]">Loading…</div>
                ) : types.length === 0 ? (
                    <div className="py-12 text-center">
                        <p className="text-[#86868b] text-[14px]">No task types yet.</p>
                        <p className="text-[#86868b] text-[13px] mt-1">Create one to categorize your tasks</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                        {types.map((t) => (
                            <div
                                key={t.id}
                                className="p-4 rounded-[14px] border border-[#d2d2d7]/40 hover:border-[#d2d2d7] bg-white hover:shadow-sm transition-all"
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className="w-4 h-4 rounded-full flex-shrink-0 mt-0.5"
                                        style={{ backgroundColor: t.color || "#C6FF00" }}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-[14px] font-bold text-[#1d1d1f] truncate">{t.name}</p>
                                        {t.description && (
                                            <p className="text-[12px] text-[#86868b] mt-1 line-clamp-2">{t.description}</p>
                                        )}
                                    </div>
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
                            Add new type
                        </button>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                    Type name *
                                </label>
                                <input
                                    value={newType.name}
                                    onChange={(e) => setNewType((v) => ({ ...v, name: e.target.value }))}
                                    placeholder="Enter type name"
                                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                    Description
                                </label>
                                <textarea
                                    value={newType.description}
                                    onChange={(e) => setNewType((v) => ({ ...v, description: e.target.value }))}
                                    placeholder="Add details (optional)"
                                    rows={3}
                                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px] resize-none"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                    Color
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="color"
                                        value={newType.color}
                                        onChange={(e) => setNewType((v) => ({ ...v, color: e.target.value }))}
                                        className="w-16 h-12 rounded-[8px] border-2 border-[#d2d2d7] cursor-pointer"
                                    />
                                    <input
                                        value={newType.color}
                                        onChange={(e) => setNewType((v) => ({ ...v, color: e.target.value }))}
                                        placeholder="#C6FF00"
                                        className="flex-1 px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
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
                                    {formLoading ? "Creating…" : "Create type"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
