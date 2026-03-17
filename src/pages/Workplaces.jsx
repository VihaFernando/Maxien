import { useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
import { useWorkplace } from "../context/WorkplaceContext"
import { FaCheck, FaTimes, FaPlus, FaUsers, FaEnvelope, FaChevronRight } from "react-icons/fa"
import { Link } from "react-router-dom"

export default function Workplaces() {
  const {
    loading,
    workplaces,
    pendingInvites,
    selectedWorkplaceId,
    selectedWorkplace,
    selectWorkplace,
    acceptInvite,
    rejectInvite,
    createWorkplace,
    reloadWorkplaces,
  } = useWorkplace()

  const [membersLoading, setMembersLoading] = useState(false)
  const [members, setMembers] = useState([])

  const [createForm, setCreateForm] = useState({ name: "", description: "", banner_url: "" })
  const [inviteEmail, setInviteEmail] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const acceptedWorkplaces = useMemo(() => workplaces.map((m) => m.workplace), [workplaces])

  useEffect(() => {
    const loadMembers = async () => {
      if (!selectedWorkplaceId) {
        setMembers([])
        return
      }
      setMembersLoading(true)
      setError("")
      try {
        const { data, error } = await supabase
          .from("workplace_members")
          .select("id, user_id, role, status, created_at")
          .eq("workplace_id", selectedWorkplaceId)
          .eq("status", "accepted")
          .order("created_at", { ascending: true })
        if (error) throw error
        setMembers(data || [])
      } catch (e) {
        setMembers([])
        setError(e?.message || "Failed to load members.")
      } finally {
        setMembersLoading(false)
      }
    }
    loadMembers()
  }, [selectedWorkplaceId])

  const handleCreate = async (e) => {
    e.preventDefault()
    setError("")
    setMessage("")
    const { error } = await createWorkplace(createForm)
    if (error) {
      setError(error.message || "Failed to create workplace.")
      return
    }
    setCreateForm({ name: "", description: "", banner_url: "" })
    setMessage("Workplace created.")
    setTimeout(() => setMessage(""), 2000)
  }

  const handleInvite = async (e) => {
    e.preventDefault()
    setError("")
    setMessage("")

    if (!selectedWorkplaceId) {
      setError("Select a workplace first.")
      return
    }
    const email = inviteEmail.trim()
    if (!email) {
      setError("Enter an email to invite.")
      return
    }

    try {
      const { data, error } = await supabase.functions.invoke("workplace-invite", {
        body: { workplace_id: selectedWorkplaceId, email },
      })
      if (error) throw error
      if (!data?.ok) throw new Error(data?.error || "Invite failed.")
      setInviteEmail("")
      setMessage(data?.message || "Invitation sent.")
      await reloadWorkplaces()
      setTimeout(() => setMessage(""), 2500)
    } catch (e) {
      setError(e?.message || "Failed to invite user.")
    }
  }

  const handleAccept = async (membershipId) => {
    setError("")
    const { error } = await acceptInvite(membershipId)
    if (error) setError(error.message || "Failed to accept invite.")
  }

  const handleReject = async (membershipId) => {
    setError("")
    const { error } = await rejectInvite(membershipId)
    if (error) setError(error.message || "Failed to reject invite.")
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-[1600px] mx-auto pb-10 space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 px-0.5">
        <div>
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">Workplaces</p>
          <h1 className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] tracking-tight leading-tight">Team Collaboration</h1>
        </div>
        <Link
          to="/dashboard"
          className="text-[12px] font-semibold text-[#86868b] hover:text-[#1d1d1f] transition-colors flex items-center gap-1 self-start sm:self-auto"
        >
          Back to dashboard <FaChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {(error || message) && (
        <div className="space-y-2">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-[13px] font-medium px-4 py-3 rounded-[16px]">{error}</div>}
          {message && <div className="bg-green-50 border border-green-200 text-green-700 text-[13px] font-medium px-4 py-3 rounded-[16px]">{message}</div>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">
        {/* Left: list + invites */}
        <div className="lg:col-span-7 space-y-4 sm:space-y-6">
          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-bold text-[#1d1d1f] flex items-center gap-2">
                <FaUsers className="w-4 h-4 text-[#C6FF00]" />
                Your Workplaces
              </h2>
              <span className="text-[11px] font-semibold text-[#86868b]">{acceptedWorkplaces.length} total</span>
            </div>

            {loading ? (
              <div className="py-10 flex items-center justify-center">
                <div className="w-7 h-7 border-4 border-[#C6FF00] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : acceptedWorkplaces.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-[13px] text-[#86868b] font-medium">No workplaces yet. Create one to collaborate.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {acceptedWorkplaces.map((w) => {
                  const active = selectedWorkplaceId === w.id
                  return (
                    <button
                      key={w.id}
                      onClick={() => selectWorkplace(w.id)}
                      className={`w-full text-left px-4 py-3 rounded-[16px] border transition-all ${
                        active ? "border-[#C6FF00] bg-[#C6FF00]/10" : "border-[#d2d2d7]/60 hover:border-[#d2d2d7] hover:bg-[#f9f9fb]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-[#1d1d1f] truncate">{w.name}</p>
                          {w.description && <p className="text-[12px] text-[#86868b] truncate mt-0.5">{w.description}</p>}
                        </div>
                        {active && (
                          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#C6FF00] text-[#1d1d1f] flex-shrink-0">
                            Selected
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[14px] font-bold text-[#1d1d1f] flex items-center gap-2">
                <FaEnvelope className="w-4 h-4 text-[#C6FF00]" />
                Invitations
              </h2>
              <span className="text-[11px] font-semibold text-[#86868b]">{pendingInvites.length} pending</span>
            </div>

            {pendingInvites.length === 0 ? (
              <div className="py-6 text-center text-[13px] text-[#86868b] font-medium">No pending invites.</div>
            ) : (
              <div className="space-y-2">
                {pendingInvites.map((inv) => (
                  <div key={inv.membershipId} className="p-4 rounded-[16px] border border-[#d2d2d7]/60 bg-white flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[#1d1d1f] truncate">{inv.workplace?.name || "Workplace"}</p>
                      <p className="text-[11px] text-[#86868b] mt-0.5">Invitation pending</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleReject(inv.membershipId)}
                        className="px-3 py-2 rounded-[12px] bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] font-semibold text-[12px] hover:bg-white transition-colors flex items-center gap-2"
                      >
                        <FaTimes className="w-3 h-3 text-red-600" />
                        Reject
                      </button>
                      <button
                        onClick={() => handleAccept(inv.membershipId)}
                        className="px-3.5 py-2 rounded-[12px] bg-[#C6FF00] text-[#1d1d1f] font-bold text-[12px] hover:bg-[#b8f000] transition-colors flex items-center gap-2"
                      >
                        <FaCheck className="w-3 h-3" />
                        Accept
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: create + members + invite */}
        <div className="lg:col-span-5 space-y-4 sm:space-y-6">
          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-4 sm:p-5">
            <h2 className="text-[14px] font-bold text-[#1d1d1f] mb-3">Create Workplace</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Name *</label>
                <input
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white text-[14px] outline-none transition-all"
                  placeholder="e.g. Acme Team"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Description</label>
                <input
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white text-[14px] outline-none transition-all"
                  placeholder="Optional"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">Banner URL</label>
                <input
                  value={createForm.banner_url}
                  onChange={(e) => setCreateForm((f) => ({ ...f, banner_url: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white text-[14px] outline-none transition-all"
                  placeholder="Optional"
                />
              </div>
              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-bold rounded-[12px] text-[13px] transition-colors"
              >
                <FaPlus className="w-3 h-3" />
                Create
              </button>
            </form>
          </div>

          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-bold text-[#1d1d1f]">Members</h2>
              <span className="text-[11px] font-semibold text-[#86868b]">
                {selectedWorkplaceId ? (membersLoading ? "Loading..." : `${members.length}`) : "—"}
              </span>
            </div>
            {!selectedWorkplaceId ? (
              <div className="py-6 text-center text-[13px] text-[#86868b] font-medium">Select a workplace to view members.</div>
            ) : membersLoading ? (
              <div className="py-8 flex items-center justify-center">
                <div className="w-7 h-7 border-4 border-[#C6FF00] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="px-4 py-3 rounded-[16px] border border-[#d2d2d7]/60 bg-white flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-[#1d1d1f] truncate">
                        {m.user_id}
                      </p>
                      <p className="text-[11px] text-[#86868b] mt-0.5">Role: {m.role}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                      m.role === "owner" ? "bg-[#f5f5f7] text-[#1d1d1f] border border-[#d2d2d7]" : "bg-[#f0fdf4] text-[#16a34a]"
                    }`}>
                      {m.role.toUpperCase()}
                    </span>
                  </div>
                ))}
                {members.length === 0 && (
                  <div className="py-6 text-center text-[13px] text-[#86868b] font-medium">No members found.</div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm p-4 sm:p-5">
            <h2 className="text-[14px] font-bold text-[#1d1d1f] mb-3">Invite Member</h2>
            <p className="text-[12px] text-[#86868b] mb-3">
              Invites require the user to already be registered.
              {selectedWorkplace ? ` Inviting to “${selectedWorkplace.name}”.` : ""}
            </p>
            <form onSubmit={handleInvite} className="flex gap-2">
              <input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 px-4 py-2.5 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white text-[14px] outline-none transition-all"
                placeholder="user@example.com"
              />
              <button
                type="submit"
                className="px-4 py-2.5 rounded-[12px] bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-bold text-[13px] transition-colors"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

