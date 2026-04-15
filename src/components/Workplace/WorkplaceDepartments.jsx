import { useEffect, useMemo, useState } from "react"
import { FaPlus, FaEdit, FaTrash, FaUsers, FaSearch, FaBuilding } from "react-icons/fa"
import {
    createWorkplaceDepartment,
    updateWorkplaceDepartment,
    deleteWorkplaceDepartment,
} from "../../lib/workplaces"
import { getUsersByIds, getUsername } from "../../lib/users"
import useTimeoutRegistry from "../../hooks/useTimeoutRegistry"

const DEPARTMENT_COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#14b8a6"]

export default function WorkplaceDepartments({
    departments,
    members,
    workplace,
    user,
    loading,
    onRefresh,
    setError,
    setMessage,
}) {
    const [showForm, setShowForm] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [editingId, setEditingId] = useState(null)
    const [searchTerm, setSearchTerm] = useState("")
    const [userMap, setUserMap] = useState({})
    const [newDepartment, setNewDepartment] = useState({
        name: "",
        description: "",
        color: "#0ea5e9",
        member_user_ids: [],
    })
    const { registerTimeout } = useTimeoutRegistry()

    const acceptedMembers = useMemo(
        () => members.filter((m) => m.status === "accepted"),
        [members],
    )

    useEffect(() => {
        const loadUsers = async () => {
            const allUserIds = new Set(acceptedMembers.map((m) => m.user_id))
            departments.forEach((d) => {
                ; (d.member_user_ids || []).forEach((id) => allUserIds.add(id))
            })

            if (!allUserIds.size) return
            try {
                const users = await getUsersByIds(Array.from(allUserIds))
                setUserMap(users.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}))
            } catch {
                // ignore profile fetch issues in list rendering
            }
        }

        loadUsers()
    }, [acceptedMembers, departments])

    const filteredDepartments = useMemo(() => {
        const q = searchTerm.trim().toLowerCase()
        if (!q) return departments

        return departments.filter((d) => {
            return (
                d.name?.toLowerCase().includes(q)
                || d.description?.toLowerCase().includes(q)
            )
        })
    }, [departments, searchTerm])

    const resetForm = () => {
        setNewDepartment({
            name: "",
            description: "",
            color: "#0ea5e9",
            member_user_ids: [],
        })
        setEditingId(null)
        setShowForm(false)
    }

    const toggleMember = (userId) => {
        setNewDepartment((prev) => {
            const current = prev.member_user_ids || []
            const next = current.includes(userId)
                ? current.filter((id) => id !== userId)
                : [...current, userId]

            return { ...prev, member_user_ids: next }
        })
    }

    const startEdit = (department) => {
        setEditingId(department.id)
        setNewDepartment({
            name: department.name || "",
            description: department.description || "",
            color: department.color || "#0ea5e9",
            member_user_ids: department.member_user_ids || [],
        })
        setShowForm(true)
    }

    const handleDelete = async (departmentId) => {
        if (!confirm("Delete this department? Linked task/project tags will be removed.")) return

        setError("")
        setMessage("")
        setFormLoading(true)
        try {
            await deleteWorkplaceDepartment({ departmentId })
            setMessage("Department deleted.")
            await onRefresh()
            registerTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to delete department.")
        } finally {
            setFormLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setMessage("")

        if (!newDepartment.name.trim()) {
            setError("Department name is required.")
            return
        }

        const basePayload = {
            workplace_id: workplace.id,
            name: newDepartment.name.trim(),
            description: newDepartment.description.trim() || null,
            color: newDepartment.color || "#0ea5e9",
            member_user_ids: newDepartment.member_user_ids || [],
            updated_at: new Date().toISOString(),
        }

        setFormLoading(true)
        try {
            if (editingId) {
                await updateWorkplaceDepartment({
                    departmentId: editingId,
                    payload: basePayload,
                })
                setMessage("Department updated.")
            } else {
                await createWorkplaceDepartment({
                    ...basePayload,
                    created_by: user.id,
                })
                setMessage("Department created.")
            }

            resetForm()
            await onRefresh()
            registerTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to save department.")
        } finally {
            setFormLoading(false)
        }
    }

    const selectedMemberLabels = (newDepartment.member_user_ids || []).map((id) => {
        return getUsername(userMap[id] || { id })
    })

    return (
        <div className="animate-in fade-in duration-500">
            <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                    <div>
                        <h2 className="text-[18px] sm:text-[20px] font-bold text-[#1d1d1f]">Departments</h2>
                        <p className="text-[12px] text-[#86868b] mt-1">
                            Organize workplace members and tag projects/tasks by department.
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingId(null)
                            setShowForm(true)
                        }}
                        className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] rounded-xl text-[13px] font-bold"
                    >
                        <FaPlus className="w-3.5 h-3.5" />
                        New Department
                    </button>
                </div>

                <div className="relative mb-5">
                    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[#86868b] w-3.5 h-3.5" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search departments..."
                        className="w-full pl-9 pr-4 py-2.5 border border-[#d2d2d7]/50 rounded-xl text-[13px] focus:outline-none focus:ring-1 focus:ring-[#C6FF00]/50"
                    />
                </div>

                {loading ? (
                    <div className="py-10 text-center text-[#86868b] text-[13px]">Loading...</div>
                ) : filteredDepartments.length === 0 ? (
                    <div className="py-12 text-center text-[#86868b] text-[13px]">No departments yet.</div>
                ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-6">
                        {filteredDepartments.map((department) => {
                            const memberNames = (department.member_user_ids || []).map((id) => getUsername(userMap[id] || { id }))

                            return (
                                <div key={department.id} className="rounded-2xl border border-[#d2d2d7]/50 bg-white p-4 sm:p-5 hover:shadow-sm transition-all">
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="min-w-0 flex-1">
                                            <p className="text-[15px] font-bold text-[#1d1d1f] truncate">{department.name}</p>
                                            <div className="flex flex-wrap gap-2 mt-2">
                                                <span
                                                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full"
                                                    style={{ backgroundColor: `${department.color || "#0ea5e9"}20`, color: department.color || "#0ea5e9" }}
                                                >
                                                    Department
                                                </span>
                                                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f] inline-flex items-center gap-1.5">
                                                    <FaUsers className="w-3 h-3" />
                                                    {memberNames.length} members
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => startEdit(department)}
                                                className="p-2 rounded-lg hover:bg-[#f5f5f7] text-[#1d1d1f]"
                                                title="Edit department"
                                            >
                                                <FaEdit className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(department.id)}
                                                className="p-2 rounded-lg hover:bg-red-50 text-red-600"
                                                title="Delete department"
                                            >
                                                <FaTrash className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {department.description && (
                                        <p className="text-[13px] text-[#5f6368] leading-relaxed mb-3">{department.description}</p>
                                    )}

                                    <div className="rounded-xl border border-[#eef0f3] bg-[#fafbfc] p-3">
                                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#86868b] mb-2">Members</p>
                                        {memberNames.length === 0 ? (
                                            <p className="text-[12px] text-[#86868b]">No users assigned</p>
                                        ) : (
                                            <p className="text-[12px] text-[#374151] leading-relaxed">{memberNames.join(", ")}</p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {showForm && (
                    <div className="pt-6 border-t border-[#f0f0f0]">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">Department name *</label>
                                <input
                                    value={newDepartment.name}
                                    onChange={(e) => setNewDepartment((v) => ({ ...v, name: e.target.value }))}
                                    placeholder="Product, Engineering, Design..."
                                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                />
                            </div>

                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">Description</label>
                                <textarea
                                    value={newDepartment.description}
                                    onChange={(e) => setNewDepartment((v) => ({ ...v, description: e.target.value }))}
                                    rows={3}
                                    placeholder="What this department handles"
                                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-xl border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px] resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">Color</label>
                                    <div className="flex flex-wrap gap-2">
                                        {DEPARTMENT_COLORS.map((c) => (
                                            <button
                                                key={c}
                                                type="button"
                                                onClick={() => setNewDepartment((v) => ({ ...v, color: c }))}
                                                className={`w-8 h-8 rounded-full border-2 transition-transform ${newDepartment.color === c ? "scale-110 border-[#1d1d1f]" : "border-white"}`}
                                                style={{ backgroundColor: c }}
                                                title={c}
                                            />
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">Assign Members</label>
                                    <div className="max-h-40 overflow-y-auto rounded-xl border border-[#d2d2d7]/50 bg-white p-2 space-y-1">
                                        {acceptedMembers.length === 0 ? (
                                            <p className="text-[12px] text-[#86868b] p-2">No accepted workplace members.</p>
                                        ) : (
                                            acceptedMembers.map((member) => (
                                                <label
                                                    key={member.user_id}
                                                    className="flex items-center gap-2 cursor-pointer hover:bg-[#f5f5f7] p-2 rounded-lg"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={newDepartment.member_user_ids.includes(member.user_id)}
                                                        onChange={() => toggleMember(member.user_id)}
                                                        className="w-4 h-4 cursor-pointer"
                                                    />
                                                    <span className="text-[13px] text-[#1d1d1f]">
                                                        {getUsername(userMap[member.user_id] || { id: member.user_id })}
                                                    </span>
                                                </label>
                                            ))
                                        )}
                                    </div>
                                    {selectedMemberLabels.length > 0 && (
                                        <p className="text-[12px] text-[#86868b] mt-2">Selected: {selectedMemberLabels.join(", ")}</p>
                                    )}
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
                                    className="flex-1 py-3 rounded-xl bg-[#C6FF00] hover:bg-[#b8f000] disabled:opacity-60 text-[#1d1d1f] font-bold text-[14px] inline-flex items-center justify-center gap-2"
                                >
                                    <FaBuilding className="w-3.5 h-3.5" />
                                    {formLoading ? (editingId ? "Updating..." : "Creating...") : (editingId ? "Update department" : "Create department")}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}
