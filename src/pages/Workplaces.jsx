import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import {
  createWorkplace,
  listMyWorkplaces,
  setMyMembershipStatus,
} from "../lib/workplaces"
import { FaPlus, FaTimes } from "react-icons/fa"

export default function Workplaces() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState([])
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: "", description: "", bannerUrl: "" })

  const accepted = useMemo(
    () => rows.filter((r) => r.status === "accepted" && r.workplaces?.id),
    [rows],
  )
  const pending = useMemo(
    () => rows.filter((r) => r.status === "pending" && r.workplaces?.id),
    [rows],
  )

  const refresh = async () => {
    if (!user?.id) return
    setLoading(true)
    setError("")
    try {
      const data = await listMyWorkplaces(user.id)
      setRows(data)
    } catch (e) {
      setError(e?.message || "Failed to load workplaces.")
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const onCreate = async (e) => {
    e.preventDefault()
    setError("")
    setMessage("")
    if (!form.name.trim()) return setError("Workplace name is required.")

    setLoading(true)
    try {
      await createWorkplace({
        name: form.name.trim(),
        description: form.description,
        bannerUrl: form.bannerUrl,
      })
      setMessage("Workplace created.")
      setShowCreate(false)
      setForm({ name: "", description: "", bannerUrl: "" })
      await refresh()
      setTimeout(() => setMessage(""), 2000)
    } catch (e2) {
      setError(e2?.message || "Failed to create workplace.")
    } finally {
      setLoading(false)
    }
  }

  const respondToInvite = async (memberId, nextStatus) => {
    setError("")
    setMessage("")
    setLoading(true)
    try {
      await setMyMembershipStatus({ workplaceMemberId: memberId, status: nextStatus })
      setMessage(nextStatus === "accepted" ? "Invite accepted." : "Invite rejected.")
      await refresh()
      setTimeout(() => setMessage(""), 2000)
    } catch (e) {
      setError(e?.message || "Failed to update invite.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-[1200px] mx-auto pb-10">
      <div className="flex items-end justify-between gap-3 mb-6">
        <div>
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-1">
            Collaboration
          </p>
          <h1 className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] tracking-tight leading-tight">
            Workplaces
          </h1>
          <p className="text-[12px] text-[#86868b] mt-1">
            Optional shared spaces for tasks, projects, and task types.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-bold rounded-[12px] text-[13px] transition-colors"
        >
          <FaPlus className="w-3 h-3" />
          New Workplace
        </button>
      </div>

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-[#1d1d1f]">Your workplaces</h2>
            <span className="text-[11px] text-[#86868b] font-semibold">{accepted.length}</span>
          </div>

          {loading && accepted.length === 0 ? (
            <div className="py-10 text-center text-[#86868b] text-[13px]">Loading…</div>
          ) : accepted.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-[#86868b] text-[13px]">No workplaces yet.</p>
              <p className="text-[#86868b] text-[12px] mt-1">
                Personal tasks/projects remain unchanged. Workplaces are optional.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {accepted.map((r) => (
                <Link
                  key={r.id}
                  to={`/dashboard/workplaces/${r.workplaces.id}`}
                  className="block p-4 rounded-[16px] border border-[#d2d2d7]/40 hover:border-[#d2d2d7] hover:shadow-sm transition-all bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-bold text-[#1d1d1f] truncate">
                        {r.workplaces.name}
                      </p>
                      {r.workplaces.description && (
                        <p className="text-[12px] text-[#86868b] mt-1 line-clamp-2">
                          {r.workplaces.description}
                        </p>
                      )}
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                      {r.role}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[14px] font-bold text-[#1d1d1f]">Invites</h2>
            <span className="text-[11px] text-[#86868b] font-semibold">{pending.length}</span>
          </div>

          {pending.length === 0 ? (
            <div className="py-10 text-center text-[#86868b] text-[13px]">No pending invites.</div>
          ) : (
            <div className="space-y-3">
              {pending.map((r) => (
                <div
                  key={r.id}
                  className="p-4 rounded-[16px] border border-[#d2d2d7]/40 bg-white"
                >
                  <p className="text-[13px] font-bold text-[#1d1d1f] truncate">
                    {r.workplaces.name}
                  </p>
                  <p className="text-[11px] text-[#86868b] mt-1">Status: pending</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => respondToInvite(r.id, "accepted")}
                      className="flex-1 bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] font-bold py-2 rounded-[10px] text-[12px]"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => respondToInvite(r.id, "rejected")}
                      className="flex-1 bg-[#f5f5f7] hover:bg-white border border-[#d2d2d7] text-[#1d1d1f] font-semibold py-2 rounded-[10px] text-[12px]"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div
          className="fixed inset-0 bg-black/35 backdrop-blur-sm z-50"
          onClick={() => setShowCreate(false)}
        >
          <div className="flex min-h-full items-start sm:items-center justify-center pt-[80px] sm:pt-0 p-4">
            <div
              className="bg-white w-full max-w-lg rounded-[24px] shadow-xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0f0f0]">
                <div>
                  <h3 className="text-[16px] font-bold text-[#1d1d1f]">New Workplace</h3>
                  <p className="text-[12px] text-[#86868b] mt-0.5">Create an optional shared space.</p>
                </div>
                <button
                  onClick={() => setShowCreate(false)}
                  className="p-2 hover:bg-[#f5f5f7] rounded-full transition-colors"
                >
                  <FaTimes className="w-4 h-4 text-[#86868b]" />
                </button>
              </div>

              <form onSubmit={onCreate} className="px-5 py-5 space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">
                    Name *
                  </label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none transition-all text-[14px]"
                    placeholder="e.g. Product Team"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">
                    Description
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    rows={3}
                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none transition-all text-[14px] resize-none"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-[#86868b] uppercase tracking-wider mb-1.5 block">
                    Banner URL
                  </label>
                  <input
                    value={form.bannerUrl}
                    onChange={(e) => setForm((f) => ({ ...f, bannerUrl: e.target.value }))}
                    className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none transition-all text-[14px]"
                    placeholder="Optional image URL"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="flex-1 py-3 rounded-[12px] bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] font-semibold text-[14px] hover:bg-white transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 rounded-[12px] bg-[#C6FF00] hover:bg-[#b8f000] disabled:opacity-60 text-[#1d1d1f] font-bold text-[14px] transition-colors"
                  >
                    {loading ? "Creating…" : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

