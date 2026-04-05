import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { FaPlus, FaCheckCircle, FaClock, FaUserTag, FaUserMinus } from "react-icons/fa"
import { inviteToWorkplace, setWorkplaceMemberRoles, removeWorkplaceMember } from "../../lib/workplaces"
import { getUsersByIds, getUsername } from "../../lib/users"

export default function WorkplaceUsers({
    members,
    roles,
    isOwner,
    workplace,
    user,
    loading,
    onRefresh,
    error,
    setError,
    message,
    setMessage,
}) {
    const [showForm, setShowForm] = useState(false)
    const [formLoading, setFormLoading] = useState(false)
    const [inviteEmail, setInviteEmail] = useState("")
    const [userMap, setUserMap] = useState({})
    const [rolePickerOpenFor, setRolePickerOpenFor] = useState(null)
    const [roleDraft, setRoleDraft] = useState([])
    const workplaceId = workplace?.id || null
    const safeRoles = (roles || []).filter((role) => role?.id)

    const memberIds = useMemo(() => members.map((m) => m.user_id).filter(Boolean), [members])

    useEffect(() => {
        const loadUsers = async () => {
            if (memberIds.length === 0) return
            try {
                const users = await getUsersByIds(memberIds)
                setUserMap(users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {}))
            } catch {
                // ignore load errors
            }
        }

        loadUsers()
    }, [memberIds])

    const getMemberLabel = (member) => {
        const user = userMap[member.user_id]
        if (user) {
            return { name: getUsername(user), email: user.email || user.id }
        }
        return { name: member.user_id, email: "" }
    }

    const getInitials = (name) => {
        return name?.substring(0, 2).toUpperCase() || "??"
    }

    const startRoleEdit = (member) => {
        setRolePickerOpenFor(member.id)
        setRoleDraft((member.roles || []).filter((role) => role?.id).map((role) => role.id))
    }

    const toggleRoleDraft = (roleId) => {
        setRoleDraft((prev) => (
            prev.includes(roleId)
                ? prev.filter((id) => id !== roleId)
                : [...prev, roleId]
        ))
    }

    const saveMemberRoles = async (memberId) => {
        setError("")
        setMessage("")
        setFormLoading(true)
        try {
            await setWorkplaceMemberRoles({
                workplaceId: workplace.id,
                memberId,
                roleIds: roleDraft,
            })
            setMessage("Member roles updated.")
            setRolePickerOpenFor(null)
            await onRefresh()
            setTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to update member roles.")
        } finally {
            setFormLoading(false)
        }
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        setMessage("")
        if (!inviteEmail.trim()) return setError("Email is required.")

        setFormLoading(true)
        try {
            await inviteToWorkplace({ workplaceId: workplace.id, email: inviteEmail.trim() })
            setInviteEmail("")
            setMessage("Invite sent (pending).")
            setShowForm(false)
            await onRefresh()
            setTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to invite user.")
        } finally {
            setFormLoading(false)
        }
    }

    const handleRemoveMember = async (member) => {
        if (!isOwner) return
        if (!workplaceId) {
            setError("Workplace is not loaded yet.")
            return
        }
        if (!member?.id || !member?.user_id) return
        if (member.user_id === user?.id) {
            setError("You cannot remove yourself from this workplace.")
            return
        }

        const confirmed = confirm("Remove this user from the workplace? This removes only workplace-related assignments and memberships.")
        if (!confirmed) return

        setError("")
        setMessage("")
        setFormLoading(true)
        try {
            await removeWorkplaceMember({
                workplaceId,
                memberId: member.id,
            })
            setMessage("Member removed from workplace.")
            setRolePickerOpenFor(null)
            await onRefresh()
            setTimeout(() => setMessage(""), 2000)
        } catch (e) {
            setError(e?.message || "Failed to remove member.")
        } finally {
            setFormLoading(false)
        }
    }

    const acceptedMembers = members.filter((m) => m.status === "accepted")
    const pendingMembers = members.filter((m) => m.status === "pending")

    return (
        <div className="w-full animate-in fade-in duration-500 space-y-4">
            {/* Alerts */}
            {error && (
                <div className="pl-4 py-3 bg-red-50/80 border-l-4 border-red-500 text-red-700 text-xs md:text-sm rounded-r-lg">
                    {error}
                </div>
            )}
            {message && (
                <div className="pl-4 py-3 bg-green-50/80 border-l-4 border-green-500 text-green-700 text-xs md:text-sm rounded-r-lg">
                    {message}
                </div>
            )}

            {/* Main Container */}
            <div className="w-full bg-white rounded-2xl md:rounded-[1.5rem] border border-gray-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 md:p-6 border-b border-gray-100 bg-gray-50/30">
                    <div className="mb-3 sm:mb-0">
                        <h2 className="text-base md:text-lg font-bold tracking-tight text-[#1d1d1f] flex items-center gap-2">
                            Team Members
                            <span className="text-[10px] md:text-xs font-semibold px-2.5 py-0.5 rounded-full bg-gray-200/70 text-gray-700">
                                {members.length}
                            </span>
                        </h2>
                        <p className="text-[11px] md:text-[13px] text-gray-500 mt-1">Manage workspace access and assignments</p>
                    </div>
                    {isOwner && workplaceId && (
                        <Link
                            to={`/dashboard/workplaces/${workplaceId}?tab=roles`}
                            className="inline-flex items-center gap-1.5 px-3 md:px-4 py-1.5 md:py-2 rounded-lg bg-gray-900 text-white text-[11px] md:text-xs font-medium hover:bg-gray-800 transition-colors shadow-sm w-full sm:w-auto justify-center"
                        >
                            <FaUserTag className="w-3 h-3 md:w-3.5 md:h-3.5" />
                            Manage Roles
                        </Link>
                    )}
                </div>

                {loading ? (
                    <div className="py-12 text-center text-gray-400 text-sm animate-pulse">Loading members...</div>
                ) : (
                    <div className="flex flex-col">
                        
                        {/* Active Members List */}
                        {acceptedMembers.length === 0 ? (
                            <p className="text-xs md:text-sm text-gray-400 py-8 text-center">No active members yet.</p>
                        ) : (
                            <div className="divide-y divide-gray-100">
                                {acceptedMembers.map((m) => {
                                    const { name, email } = getMemberLabel(m)
                                    const initials = getInitials(name)
                                    
                                    return (
                                        <div key={m.id} className="group flex flex-col md:flex-row md:items-center justify-between p-4 md:p-6 gap-4 hover:bg-gray-50/50 transition-colors">
                                            
                                            {/* User Info */}
                                            <div className="flex items-center gap-3 md:gap-4 min-w-0">
                                                <div className="flex-shrink-0 w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 border border-gray-300/50 flex items-center justify-center text-[10px] md:text-xs font-bold text-gray-600">
                                                    {initials}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[13px] md:text-[14px] font-semibold text-gray-900 truncate">
                                                            {name}
                                                        </p>
                                                        {m.role === 'owner' && (
                                                            <span className="text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 uppercase tracking-wide">Owner</span>
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] md:text-xs text-gray-500 truncate mt-0.5">
                                                        {email} • Joined {new Date(m.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Roles & Actions */}
                                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full md:w-auto pl-11 md:pl-0">
                                                
                                                {/* Role Tags */}
                                                <div className="flex flex-wrap gap-1.5 flex-1 md:justify-end">
                                                    {(m.roles || []).filter((role) => role?.id).length === 0 ? (
                                                        <span className="text-[10px] md:text-[11px] text-gray-400 italic">No custom roles</span>
                                                    ) : (
                                                        (m.roles || []).filter((role) => role?.id).map((role) => (
                                                            <span
                                                                key={role.id}
                                                                className="text-[10px] md:text-[11px] font-medium px-2 py-0.5 rounded-md inline-flex items-center border border-transparent"
                                                                style={{ backgroundColor: `${role.color || "#6366f1"}15`, color: role.color || "#6366f1", borderColor: `${role.color || "#6366f1"}30` }}
                                                            >
                                                                {role.name}
                                                            </span>
                                                        ))
                                                    )}
                                                </div>

                                                {/* Actions */}
                                                {isOwner && (
                                                    <div className="relative flex items-center gap-2 pt-2 sm:pt-0 border-t sm:border-0 border-gray-100">
                                                        <button
                                                            type="button"
                                                            onClick={() => startRoleEdit(m)}
                                                            className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-3 py-1.5 md:py-1.5 rounded-lg border border-gray-200 bg-white text-[11px] md:text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors"
                                                        >
                                                            <FaUserTag className="w-3 h-3 text-gray-400" />
                                                            <span className="sm:hidden lg:inline">Roles</span>
                                                        </button>

                                                        {m.user_id !== user?.id && (
                                                            <button
                                                                type="button"
                                                                disabled={formLoading}
                                                                onClick={() => handleRemoveMember(m)}
                                                                className="flex-1 sm:flex-none inline-flex justify-center items-center gap-1.5 px-3 py-1.5 md:py-1.5 rounded-lg border border-red-100 bg-red-50/50 text-[11px] md:text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
                                                            >
                                                                <FaUserMinus className="w-3 h-3 opacity-70" />
                                                                <span className="sm:hidden lg:inline">Remove</span>
                                                            </button>
                                                        )}

                                                        {/* Role Picker Dropdown */}
                                                        {rolePickerOpenFor === m.id && (
                                                            <div className="absolute right-0 top-full mt-2 z-10 w-[calc(100vw-2rem)] sm:w-64 origin-top-right rounded-xl border border-gray-200 bg-white/95 backdrop-blur-md p-3 shadow-xl ring-1 ring-black/5 focus:outline-none">
                                                                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-2 px-1">Assign Roles</p>
                                                                <div className="max-h-48 overflow-y-auto space-y-1 mb-3">
                                                                    {safeRoles.length === 0 ? (
                                                                        <p className="text-[11px] text-gray-400 p-2 italic">No roles created yet.</p>
                                                                    ) : (
                                                                        safeRoles.map((role) => (
                                                                            <label key={role.id} className="flex items-center gap-2.5 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors group/label">
                                                                                <div className="relative flex items-center justify-center">
                                                                                    <input
                                                                                        type="checkbox"
                                                                                        checked={roleDraft.includes(role.id)}
                                                                                        onChange={() => toggleRoleDraft(role.id)}
                                                                                        className="peer w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer appearance-none checked:bg-black transition-all"
                                                                                    />
                                                                                    <FaCheckCircle className="absolute w-2.5 h-2.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                                                                                </div>
                                                                                <span
                                                                                    className="text-[11px] font-medium px-2 py-0.5 rounded-md truncate"
                                                                                    style={{ backgroundColor: `${role.color || "#6366f1"}15`, color: role.color || "#6366f1" }}
                                                                                >
                                                                                    {role.name}
                                                                                </span>
                                                                            </label>
                                                                        ))
                                                                    )}
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => setRolePickerOpenFor(null)}
                                                                        className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
                                                                    >
                                                                        Cancel
                                                                    </button>
                                                                    <button
                                                                        type="button"
                                                                        disabled={formLoading}
                                                                        onClick={() => saveMemberRoles(m.id)}
                                                                        className="flex-1 rounded-lg bg-[#C6FF00] px-2 py-1.5 text-[11px] font-bold text-gray-900 hover:bg-[#b8f000] disabled:opacity-60 transition-colors"
                                                                    >
                                                                        {formLoading ? "Saving…" : "Save"}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {/* Pending Invitations Section */}
                        {pendingMembers.length > 0 && (
                            <div className="bg-orange-50/30 border-t border-orange-100/50 p-4 md:p-6">
                                <h3 className="text-xs md:text-[13px] font-semibold text-orange-800 mb-3 flex items-center gap-2">
                                    <FaClock className="w-3 h-3 md:w-3.5 md:h-3.5 text-orange-500" />
                                    Pending Invitations ({pendingMembers.length})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-3">
                                    {pendingMembers.map((m) => {
                                        const { email } = getMemberLabel(m)
                                        return (
                                            <div key={m.id} className="px-3 py-2 md:px-4 md:py-2.5 rounded-xl bg-white border border-orange-100/60 shadow-sm flex items-center justify-between gap-3">
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-[11px] md:text-xs font-medium text-gray-700 truncate">{email || m.user_id}</p>
                                                </div>
                                                <span className="text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 uppercase tracking-wider">
                                                    Invited
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Invite Section (Floating below the main list) */}
            <div className="w-full">
                {!isOwner ? (
                    <div className="text-center p-3 rounded-xl bg-gray-50 border border-gray-200 border-dashed text-[11px] md:text-xs text-gray-500">
                        Only the workspace owner can send invites.
                    </div>
                ) : !showForm ? (
                    <button
                        onClick={() => setShowForm(true)}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 md:py-3 text-[12px] md:text-[13px] font-medium text-gray-700 bg-white border border-gray-200 border-dashed rounded-xl hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300 transition-all shadow-sm"
                    >
                        <FaPlus className="w-3 h-3" />
                        Invite New Member
                    </button>
                ) : (
                    <div className="bg-white p-4 md:p-5 rounded-2xl border border-[#C6FF00]/40 shadow-sm shadow-[#C6FF00]/5">
                        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row items-start sm:items-end gap-3 md:gap-4">
                            <div className="w-full sm:flex-1">
                                <label className="text-[10px] md:text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block ml-1">
                                    Send Invitation
                                </label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="colleague@company.com"
                                    className="w-full px-3 md:px-4 py-2 md:py-2.5 bg-gray-50 rounded-xl border border-gray-200 focus:border-[#C6FF00] focus:ring-2 focus:ring-[#C6FF00]/20 focus:bg-white transition-all outline-none text-[12px] md:text-[14px]"
                                />
                            </div>
                            <div className="flex gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1 sm:flex-none px-4 py-2 md:py-2.5 rounded-xl bg-white border border-gray-200 text-gray-700 font-medium text-[12px] md:text-[13px] hover:bg-gray-50 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="flex-1 sm:flex-none px-4 md:px-6 py-2 md:py-2.5 rounded-xl bg-[#C6FF00] hover:bg-[#b8f000] disabled:opacity-60 text-gray-900 font-bold text-[12px] md:text-[13px] transition-colors shadow-sm"
                                >
                                    {formLoading ? "Sending…" : "Send Invite"}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    )
}