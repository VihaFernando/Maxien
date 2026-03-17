import { useEffect, useMemo, useState } from "react"
import { Link, useParams } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import {
  createWorkplaceProject,
  createWorkplaceTask,
  createWorkplaceTaskType,
  inviteToWorkplace,
  listMyWorkplaces,
  listWorkplaceMembers,
  listWorkplaceProjects,
  listWorkplaceTasks,
  listWorkplaceTaskTypes,
} from "../lib/workplaces"
import { FaChevronLeft, FaPlus } from "react-icons/fa"

export default function WorkplaceDetail() {
  const { id } = useParams()
  const { user } = useAuth()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const [myRows, setMyRows] = useState([])
  const [members, setMembers] = useState([])
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [types, setTypes] = useState([])

  const [inviteEmail, setInviteEmail] = useState("")

  const [newType, setNewType] = useState({ name: "", description: "", color: "#C6FF00" })
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    type_id: "",
    status: "Active",
    start_date: "",
    target_end_date: "",
  })
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    type_id: "",
    project_id: "",
    due_date: "",
    due_time: "",
    priority: "Medium",
    status: "To Do",
    assigned_to: "",
  })

  const currentMembership = useMemo(() => {
    return myRows.find((r) => r.workplaces?.id === id && r.status === "accepted") || null
  }, [myRows, id])

  const workplace = currentMembership?.workplaces || null
  const isOwner = currentMembership?.role === "owner" || workplace?.owner_id === user?.id

  const refresh = async () => {
    if (!user?.id || !id) return
    setLoading(true)
    setError("")
    try {
      const [my, mem, t, p, tt] = await Promise.all([
        listMyWorkplaces(user.id),
        listWorkplaceMembers(id),
        listWorkplaceTasks({ workplaceId: id }),
        listWorkplaceProjects({ workplaceId: id }),
        listWorkplaceTaskTypes({ workplaceId: id }),
      ])
      setMyRows(my)
      setMembers(mem)
      setTasks(t)
      setProjects(p)
      setTypes(tt)
    } catch (e) {
      setError(e?.message || "Failed to load workplace.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id])

  const buildDueAt = (date, time) => {
    if (!date) return null
    const timeValue = time || "09:00"
    const localDate = new Date(`${date}T${timeValue}:00`)
    return localDate.toISOString()
  }

  const onInvite = async (e) => {
    e.preventDefault()
    setError("")
    setMessage("")
    if (!inviteEmail.trim()) return setError("Email is required.")
    setLoading(true)
    try {
      await inviteToWorkplace({ workplaceId: id, email: inviteEmail.trim() })
      setInviteEmail("")
      setMessage("Invite sent (pending).")
      await refresh()
      setTimeout(() => setMessage(""), 2000)
    } catch (e2) {
      setError(e2?.message || "Failed to invite user.")
    } finally {
      setLoading(false)
    }
  }

  const onCreateType = async (e) => {
    e.preventDefault()
    setError("")
    setMessage("")
    if (!newType.name.trim()) return setError("Type name is required.")
    setLoading(true)
    try {
      await createWorkplaceTaskType({
        user_id: user.id,
        workplace_id: id,
        name: newType.name.trim(),
        description: newType.description.trim() || null,
        color: newType.color,
        status: "Active",
      })
      setNewType({ name: "", description: "", color: "#C6FF00" })
      setMessage("Workplace task type created.")
      await refresh()
      setTimeout(() => setMessage(""), 2000)
    } catch (e2) {
      setError(e2?.message || "Failed to create task type.")
    } finally {
      setLoading(false)
    }
  }

  const onCreateProject = async (e) => {
    e.preventDefault()
    setError("")
    setMessage("")
    if (!newProject.name.trim()) return setError("Project name is required.")
    if (!newProject.type_id) return setError("Project type is required.")
    setLoading(true)
    try {
      await createWorkplaceProject({
        user_id: user.id,
        workplace_id: id,
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
      await refresh()
      setTimeout(() => setMessage(""), 2000)
    } catch (e2) {
      setError(e2?.message || "Failed to create project.")
    } finally {
      setLoading(false)
    }
  }

  const onCreateTask = async (e) => {
    e.preventDefault()
    setError("")
    setMessage("")
    if (!newTask.title.trim()) return setError("Task title is required.")
    if (!newTask.type_id) return setError("Task type is required.")

    const due_at = buildDueAt(newTask.due_date, newTask.due_time)

    setLoading(true)
    try {
      await createWorkplaceTask({
        user_id: user.id,
        workplace_id: id,
        title: newTask.title.trim(),
        description: (newTask.description || "").trim() || null,
        type_id: newTask.type_id,
        project_id: newTask.project_id || null,
        status: newTask.status || "To Do",
        priority: newTask.priority || "Medium",
        due_at,
        assigned_to: newTask.assigned_to || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      setNewTask({
        title: "",
        description: "",
        type_id: "",
        project_id: "",
        due_date: "",
        due_time: "",
        priority: "Medium",
        status: "To Do",
        assigned_to: "",
      })
      setMessage("Workplace task created.")
      await refresh()
      setTimeout(() => setMessage(""), 2000)
    } catch (e2) {
      setError(e2?.message || "Failed to create task.")
    } finally {
      setLoading(false)
    }
  }

  const acceptedMembers = useMemo(
    () => members.filter((m) => m.status === "accepted"),
    [members],
  )

  if (!workplace && !loading && !error) {
    return (
      <div className="max-w-[900px] mx-auto">
        <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-6">
          <p className="text-[14px] font-bold text-[#1d1d1f]">Workplace not available</p>
          <p className="text-[12px] text-[#86868b] mt-1">
            You may not be an accepted member of this workplace.
          </p>
          <Link
            to="/dashboard/workplaces"
            className="inline-flex mt-4 px-4 py-2 rounded-[12px] bg-[#f5f5f7] border border-[#d2d2d7] text-[#1d1d1f] font-semibold text-[13px] hover:bg-white transition-colors"
          >
            Back to Workplaces
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-500 max-w-[1200px] mx-auto pb-10">
      <div className="flex items-center gap-3 mb-5">
        <Link
          to="/dashboard/workplaces"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-[12px] bg-white border border-[#d2d2d7]/60 text-[#1d1d1f] font-semibold text-[13px] hover:bg-[#f5f5f7] transition-colors"
        >
          <FaChevronLeft className="w-3 h-3" />
          Workplaces
        </Link>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-0.5">
            Workplace
          </p>
          <h1 className="text-[18px] sm:text-[22px] font-bold text-[#1d1d1f] truncate">
            {workplace?.name || "…"}
          </h1>
        </div>
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

      {loading && (
        <div className="mb-4 p-3 bg-white border border-[#d2d2d7]/50 text-[#86868b] rounded-xl text-[13px]">
          Loading…
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-bold text-[#1d1d1f]">Workplace Tasks</h2>
              <span className="text-[11px] text-[#86868b] font-semibold">{tasks.length}</span>
            </div>
            {tasks.length === 0 ? (
              <p className="text-[13px] text-[#86868b] py-4">No workplace tasks yet.</p>
            ) : (
              <div className="space-y-2">
                {tasks.slice(0, 8).map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-[14px] border border-[#d2d2d7]/40 bg-white"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#1d1d1f] truncate">{t.title}</p>
                        {t.description && (
                          <p className="text-[12px] text-[#86868b] mt-1 line-clamp-2">{t.description}</p>
                        )}
                      </div>
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                        {t.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#86868b]">
                      <span>Priority: {t.priority || "—"}</span>
                      {t.assigned_to && <span>Assigned: {t.assigned_to.slice(0, 8)}…</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-[#f0f0f0]">
              <h3 className="text-[13px] font-bold text-[#1d1d1f] mb-3 flex items-center gap-2">
                <FaPlus className="w-3 h-3" />
                Create workplace task
              </h3>
              <form onSubmit={onCreateTask} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={newTask.title}
                    onChange={(e) => setNewTask((v) => ({ ...v, title: e.target.value }))}
                    placeholder="Title"
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  />
                  <select
                    value={newTask.type_id}
                    onChange={(e) => setNewTask((v) => ({ ...v, type_id: e.target.value }))}
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  >
                    <option value="">Type *</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask((v) => ({ ...v, description: e.target.value }))}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px] resize-none"
                />

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={newTask.project_id}
                    onChange={(e) => setNewTask((v) => ({ ...v, project_id: e.target.value }))}
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  >
                    <option value="">Project</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask((v) => ({ ...v, priority: e.target.value }))}
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  >
                    {["Low", "Medium", "High", "Urgent"].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>

                  <select
                    value={newTask.status}
                    onChange={(e) => setNewTask((v) => ({ ...v, status: e.target.value }))}
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  >
                    {["To Do", "In Progress", "Done", "Cancelled"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="date"
                    value={newTask.due_date}
                    onChange={(e) => setNewTask((v) => ({ ...v, due_date: e.target.value }))}
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  />
                  <input
                    type="time"
                    value={newTask.due_time}
                    onChange={(e) => setNewTask((v) => ({ ...v, due_time: e.target.value }))}
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  />
                  <select
                    value={newTask.assigned_to}
                    onChange={(e) => setNewTask((v) => ({ ...v, assigned_to: e.target.value }))}
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  >
                    <option value="">Assign to (optional)</option>
                    {acceptedMembers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user_id}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-[12px] bg-[#C6FF00] hover:bg-[#b8f000] disabled:opacity-60 text-[#1d1d1f] font-bold text-[14px] transition-colors"
                >
                  {loading ? "Creating…" : "Create workplace task"}
                </button>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-bold text-[#1d1d1f]">Workplace Projects</h2>
              <span className="text-[11px] text-[#86868b] font-semibold">{projects.length}</span>
            </div>
            {projects.length === 0 ? (
              <p className="text-[13px] text-[#86868b] py-4">No workplace projects yet.</p>
            ) : (
              <div className="space-y-2">
                {projects.slice(0, 6).map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-[14px] border border-[#d2d2d7]/40 bg-white"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#1d1d1f] truncate">{p.name}</p>
                        {p.description && (
                          <p className="text-[12px] text-[#86868b] mt-1 line-clamp-2">{p.description}</p>
                        )}
                      </div>
                      <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                        {p.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-[#f0f0f0]">
              <h3 className="text-[13px] font-bold text-[#1d1d1f] mb-3 flex items-center gap-2">
                <FaPlus className="w-3 h-3" />
                Create workplace project
              </h3>
              <form onSubmit={onCreateProject} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={newProject.name}
                    onChange={(e) => setNewProject((v) => ({ ...v, name: e.target.value }))}
                    placeholder="Project name"
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  />
                  <select
                    value={newProject.type_id}
                    onChange={(e) => setNewProject((v) => ({ ...v, type_id: e.target.value }))}
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  >
                    <option value="">Type *</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject((v) => ({ ...v, description: e.target.value }))}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px] resize-none"
                />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select
                    value={newProject.status}
                    onChange={(e) => setNewProject((v) => ({ ...v, status: e.target.value }))}
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  >
                    {["Active", "On Hold", "Completed", "Archived"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={newProject.start_date}
                    onChange={(e) => setNewProject((v) => ({ ...v, start_date: e.target.value }))}
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  />
                  <input
                    type="date"
                    value={newProject.target_end_date}
                    onChange={(e) => setNewProject((v) => ({ ...v, target_end_date: e.target.value }))}
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-[12px] bg-[#C6FF00] hover:bg-[#b8f000] disabled:opacity-60 text-[#1d1d1f] font-bold text-[14px] transition-colors"
                >
                  {loading ? "Creating…" : "Create workplace project"}
                </button>
              </form>
            </div>
          </div>

          <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[14px] font-bold text-[#1d1d1f]">Workplace Task Types</h2>
              <span className="text-[11px] text-[#86868b] font-semibold">{types.length}</span>
            </div>
            {types.length === 0 ? (
              <p className="text-[13px] text-[#86868b] py-4">No workplace task types yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {types.slice(0, 8).map((t) => (
                  <div
                    key={t.id}
                    className="p-3 rounded-[14px] border border-[#d2d2d7]/40 bg-white"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: t.color || "#C6FF00" }}
                      />
                      <p className="text-[13px] font-bold text-[#1d1d1f] truncate">{t.name}</p>
                    </div>
                    {t.description && (
                      <p className="text-[12px] text-[#86868b] mt-1 line-clamp-2">{t.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 pt-5 border-t border-[#f0f0f0]">
              <h3 className="text-[13px] font-bold text-[#1d1d1f] mb-3 flex items-center gap-2">
                <FaPlus className="w-3 h-3" />
                Create workplace task type
              </h3>
              <form onSubmit={onCreateType} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    value={newType.name}
                    onChange={(e) => setNewType((v) => ({ ...v, name: e.target.value }))}
                    placeholder="Type name"
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  />
                  <input
                    value={newType.color}
                    onChange={(e) => setNewType((v) => ({ ...v, color: e.target.value }))}
                    placeholder="#C6FF00"
                    className="px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                  />
                </div>
                <textarea
                  value={newType.description}
                  onChange={(e) => setNewType((v) => ({ ...v, description: e.target.value }))}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px] resize-none"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-[12px] bg-[#C6FF00] hover:bg-[#b8f000] disabled:opacity-60 text-[#1d1d1f] font-bold text-[14px] transition-colors"
                >
                  {loading ? "Creating…" : "Create workplace task type"}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-5">
            <h2 className="text-[14px] font-bold text-[#1d1d1f] mb-3">Members</h2>
            <div className="space-y-2">
              {members.length === 0 ? (
                <p className="text-[13px] text-[#86868b] py-4">No members found.</p>
              ) : (
                members.map((m) => (
                  <div
                    key={m.id}
                    className="p-3 rounded-[14px] border border-[#d2d2d7]/40 bg-white flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-bold text-[#1d1d1f] truncate">
                        {m.user_id}
                      </p>
                      <p className="text-[11px] text-[#86868b] mt-0.5">
                        {m.role} • {m.status}
                      </p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#f5f5f7] text-[#1d1d1f]">
                      {m.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-5">
            <h2 className="text-[14px] font-bold text-[#1d1d1f] mb-1">Invites</h2>
            <p className="text-[12px] text-[#86868b] mb-4">
              Invite existing users by email.
            </p>

            {!isOwner ? (
              <div className="p-3 rounded-[14px] bg-[#f5f5f7] border border-[#d2d2d7] text-[12px] text-[#86868b]">
                Only the workplace owner can send invites.
              </div>
            ) : (
              <form onSubmit={onInvite} className="space-y-3">
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="w-full px-4 py-3 bg-[#f5f5f7] rounded-[12px] border border-transparent focus:border-[#C6FF00]/60 focus:bg-white outline-none text-[14px]"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-[12px] bg-[#C6FF00] hover:bg-[#b8f000] disabled:opacity-60 text-[#1d1d1f] font-bold text-[14px] transition-colors"
                >
                  {loading ? "Sending…" : "Send invite"}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

