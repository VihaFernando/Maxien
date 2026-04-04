import { useEffect, useMemo, useState } from "react"
import { FaPlus, FaCheckCircle, FaClock } from "react-icons/fa"
import { inviteToWorkplace } from "../../lib/workplaces"
import { getUsersByIds, getUsername } from "../../lib/users"

export default function WorkplaceUsers({
    members,
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

    const memberIds = useMemo(() => members.map((m) => m.user_id).filter(Boolean), [members])

    useEffect(() => {
        const loadUsers = async () => {
            if (memberIds.length === 0) return
            try {
                const users = await getUsersByIds(memberIds)
                setUserMap(users.reduce((acc, user) => ({ ...acc, [user.id]: user }), {}))
            } catch (e) {
                // ignore load errors
            }
        }

        loadUsers()
    }, [memberIds])

    const getMemberLabel = (member) => {
        const user = userMap[member.user_id]
        if (user) {
            return `${getUsername(user)} (${user.email || user.id})`
        }
        return member.user_id
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

    const acceptedMembers = members.filter((m) => m.status === "accepted")
    const pendingMembers = members.filter((m) => m.status === "pending")

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
                        <h2 className="text-[18px] font-bold text-[#1d1d1f]">Members</h2>
                        <p className="text-[12px] text-[#86868b] mt-1">Manage workplace members and invitations</p>
                    </div>
                    <span className="text-[14px] font-bold px-3 py-1.5 rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                        {members.length}
                    </span>
                </div>

                {loading ? (
                    <div className="py-10 text-center text-[#86868b] text-[13px]">Loading…</div>
                ) : (
                    <>
                        {/* Accepted Members */}
                        <div className="mb-6">
                            <h3 className="text-[13px] font-bold text-[#1d1d1f] mb-3 flex items-center gap-2">
                                <FaCheckCircle className="w-3.5 h-3.5 text-green-500" />
                                Active Members ({acceptedMembers.length})
                            </h3>
                            {acceptedMembers.length === 0 ? (
                                <p className="text-[13px] text-[#86868b] py-4">No active members yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {acceptedMembers.map((m) => (
                                        <div
                                            key={m.id}
                                            className="p-4 rounded-[14px] border border-[#d2d2d7]/40 hover:border-[#d2d2d7] bg-white hover:shadow-sm transition-all flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[14px] font-bold text-[#1d1d1f] truncate">{getMemberLabel(m)}</p>
                                                <p className="text-[12px] text-[#86868b] mt-0.5">
                                                    {m.role} • Joined {new Date(m.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-green-50 text-green-700 whitespace-nowrap">
                                                {m.role}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Pending Invitations */}
                        {pendingMembers.length > 0 && (
                            <div className="mb-6 p-4 bg-[#fef3ef] rounded-[16px] border border-orange-200">
                                <h3 className="text-[13px] font-bold text-[#1d1d1f] mb-3 flex items-center gap-2">
                                    <FaClock className="w-3.5 h-3.5 text-orange-500" />
                                    Pending ({pendingMembers.length})
                                </h3>
                                <div className="space-y-2">
                                    {pendingMembers.map((m) => (
                                        <div
                                            key={m.id}
                                            className="p-3 rounded-[12px] bg-white border border-orange-200 flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="text-[13px] font-bold text-[#1d1d1f] truncate">{getMemberLabel(m)}</p>
                                                <p className="text-[11px] text-[#86868b] mt-0.5">Waiting for acceptance</p>
                                            </div>
                                            <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-orange-100 text-orange-700 whitespace-nowrap">
                                                Pending
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Invite Section */}
                <div className="pt-6 border-t border-[#f0f0f0]">
                    {!isOwner ? (
                        <div className="p-4 rounded-[14px] bg-[#f5f5f7] border border-[#d2d2d7] text-[13px] text-[#86868b]">
                            Only the workplace owner can send invites.
                        </div>
                    ) : !showForm ? (
                        <button
                            onClick={() => setShowForm(true)}
                            className="flex items-center gap-2 px-4 py-3 text-[14px] font-bold text-[#1d1d1f] hover:bg-[#f5f5f7] rounded-[12px] transition-colors"
                        >
                            <FaPlus className="w-3.5 h-3.5" />
                            Invite member
                        </button>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-2 block">
                                    Email address *
                                </label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="user@example.com"
                                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                                />
                            </div>

                            <p className="text-[12px] text-[#86868b] italic">
                                An invitation will be sent to this email. The user must accept it to join the workplace.
                            </p>

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
                                    {formLoading ? "Sending…" : "Send invite"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}
