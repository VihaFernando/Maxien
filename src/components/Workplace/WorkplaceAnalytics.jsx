import { useEffect, useMemo, useState } from "react"
import { FaChartLine, FaClock, FaFolderOpen, FaBuilding, FaUsers } from "react-icons/fa"
import { getUsersByIds, getUsername } from "../../lib/users"

const STATUS_DONE = "Done"

const CANCELED_STATUSES = new Set(["canceled", "cancelled"])

function StatCard({ label, value, accent = "#1d1d1f" }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#e8e8ed] bg-gradient-to-br from-white via-white to-[#f8fafc] p-4 shadow-[0_8px_30px_rgba(15,23,42,0.05)]">
      <div className="pointer-events-none absolute -right-7 -top-7 h-20 w-20 rounded-full opacity-15" style={{ backgroundColor: accent }} />
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#86868b]">{label}</p>
      <p className="mt-1.5 text-[26px] font-bold leading-none" style={{ color: accent }}>{value}</p>
    </div>
  )
}

function CompletionBar({ done = 0, total = 0, color = "#22c55e" }) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[11px] text-[#5f6b7c]">
        <span>{done}/{total} done</span>
        <span>{percent}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-[#edf1f5]">
        <div
          className="h-2.5 rounded-full transition-all"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export default function WorkplaceAnalytics({
  tasks,
  projects,
  departments,
  members,
  user,
  isAdmin,
  loading,
}) {
  const [scopeChoice, setScopeChoice] = useState(isAdmin ? "company" : "me")
  const [userMap, setUserMap] = useState({})
  const scope = isAdmin ? scopeChoice : "me"

  useEffect(() => {
    const loadUsers = async () => {
      const ids = Array.from(new Set((members || []).map((m) => m.user_id).filter(Boolean)))
      if (!ids.length) return
      try {
        const users = await getUsersByIds(ids)
        setUserMap(users.reduce((acc, item) => ({ ...acc, [item.id]: item }), {}))
      } catch {
        // ignore user profile fetch errors for analytics labels
      }
    }

    loadUsers()
  }, [members])

  const tasksAssignedToUser = (task, userId) => {
    return task.task_assignees?.some((entry) => entry.user_id === userId)
  }

  const isCanceledTask = (task) => {
    const status = String(task?.status || "").trim().toLowerCase()
    return CANCELED_STATUSES.has(status)
  }

  const activeTasks = useMemo(() => {
    return (tasks || []).filter((task) => !isCanceledTask(task))
  }, [tasks])

  const myTasks = useMemo(() => {
    return activeTasks.filter((task) => {
      const isAssignedToMe = tasksAssignedToUser(task, user?.id)
      return isAssignedToMe
    })
  }, [activeTasks, user?.id])

  const visibleTasks = useMemo(() => {
    return scope === "company" && isAdmin ? activeTasks : myTasks
  }, [scope, isAdmin, activeTasks, myTasks])

  const baseSummary = useMemo(() => {
    const now = new Date()
    const total = visibleTasks.length
    const done = visibleTasks.filter((task) => task.status === STATUS_DONE).length
    const inProgress = visibleTasks.filter((task) => task.status === "In Progress").length
    const todo = visibleTasks.filter((task) => task.status === "To Do").length
    const overdue = visibleTasks.filter((task) => {
      if (!task.due_at || task.status === STATUS_DONE) return false
      return new Date(task.due_at) < now
    }).length

    return {
      total,
      done,
      inProgress,
      todo,
      overdue,
      completionRate: total > 0 ? Math.round((done / total) * 100) : 0,
    }
  }, [visibleTasks])

  const userPerformance = useMemo(() => {
    if (!isAdmin || scope !== "company") return []

    const acceptedMembers = (members || []).filter((m) => m.status === "accepted")

    return acceptedMembers
      .map((member) => {
        const assignedTasks = activeTasks.filter((task) => tasksAssignedToUser(task, member.user_id))
        const done = assignedTasks.filter((task) => task.status === STATUS_DONE).length
        const overdue = assignedTasks.filter((task) => {
          if (!task.due_at || task.status === STATUS_DONE) return false
          return new Date(task.due_at) < new Date()
        }).length

        const userProfile = userMap[member.user_id]

        return {
          memberId: member.id,
          userId: member.user_id,
          label: userProfile ? getUsername(userProfile) : member.user_id,
          role: member.role,
          total: assignedTasks.length,
          done,
          overdue,
          rate: assignedTasks.length > 0 ? Math.round((done / assignedTasks.length) * 100) : 0,
        }
      })
      .sort((a, b) => b.rate - a.rate || b.done - a.done)
  }, [isAdmin, scope, members, activeTasks, userMap])

  const projectPerformance = useMemo(() => {
    if (!isAdmin || scope !== "company") return []

    return (projects || []).map((project) => {
      const linkedTasks = activeTasks.filter((task) => task.project_id === project.id)
      const done = linkedTasks.filter((task) => task.status === STATUS_DONE).length

      return {
        id: project.id,
        name: project.name,
        total: linkedTasks.length,
        done,
      }
    })
  }, [isAdmin, scope, projects, activeTasks])

  const departmentPerformance = useMemo(() => {
    if (!isAdmin || scope !== "company") return []

    return (departments || []).map((department) => {
      const linkedTasks = activeTasks.filter((task) => task.department_id === department.id)
      const done = linkedTasks.filter((task) => task.status === STATUS_DONE).length

      return {
        id: department.id,
        name: department.name,
        color: department.color || "#0ea5e9",
        total: linkedTasks.length,
        done,
      }
    })
  }, [isAdmin, scope, departments, activeTasks])

  const upcomingTasks = useMemo(() => {
    return [...visibleTasks]
      .filter((task) => task.due_at && task.status !== STATUS_DONE)
      .sort((a, b) => new Date(a.due_at) - new Date(b.due_at))
      .slice(0, 6)
  }, [visibleTasks])

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6 rounded-[26px] border border-[#e8e8ed] bg-[radial-gradient(120%_120%_at_100%_0%,#eef4ff_0%,#ffffff_45%,#ffffff_100%)] p-5 sm:p-6 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
        <p className="text-[10px] font-bold text-[#7a8392] uppercase tracking-[0.2em] mb-3">Workplace Intelligence</p>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-[28px] sm:text-[32px] font-bold tracking-tight text-[#121417]">Analytics</h1>
            <p className="text-[13px] text-[#6a7280] mt-1.5 max-w-[680px] leading-relaxed">
              {isAdmin
                ? "Company-wide progress plus individual performance insights."
                : "Your personal task analytics for this workplace."}
            </p>
          </div>

          {isAdmin && (
            <div className="inline-flex items-center gap-1 rounded-xl bg-white/90 p-1 border border-[#e5e7eb] shadow-sm">
              <button
                type="button"
                onClick={() => setScopeChoice("company")}
                className={`px-3.5 py-2 text-[12px] font-semibold rounded-lg transition-colors ${scope === "company" ? "bg-[#111827] text-white shadow-sm" : "text-[#6b7280] hover:text-[#111827]"}`}
              >
                Company
              </button>
              <button
                type="button"
                onClick={() => setScopeChoice("me")}
                className={`px-3.5 py-2 text-[12px] font-semibold rounded-lg transition-colors ${scope === "me" ? "bg-[#111827] text-white shadow-sm" : "text-[#6b7280] hover:text-[#111827]"}`}
              >
                My Tasks
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
        <StatCard label="Total Tasks" value={baseSummary.total} />
        <StatCard label="Completed" value={baseSummary.done} accent="#16a34a" />
        <StatCard label="In Progress" value={baseSummary.inProgress} accent="#3b82f6" />
        <StatCard label="To Do" value={baseSummary.todo} accent="#64748b" />
        <StatCard label="Overdue" value={baseSummary.overdue} accent="#ef4444" />
      </div>

      <div className="rounded-2xl border border-[#e8e8ed] bg-white p-5 mb-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13px] font-bold text-[#1d1d1f] inline-flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#eef2ff] text-[#4f46e5]">
              <FaChartLine className="w-3.5 h-3.5" />
            </span>
            Completion Rate
          </p>
          <span className="text-[12px] font-semibold text-[#334155] rounded-full bg-[#f1f5f9] px-2.5 py-1">{baseSummary.completionRate}%</span>
        </div>
        <CompletionBar done={baseSummary.done} total={baseSummary.total} color="#22c55e" />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#e8e8ed] bg-white p-10 text-center text-[13px] text-[#7a8392] shadow-[0_8px_24px_rgba(15,23,42,0.04)]">Loading analytics...</div>
      ) : (
        <>
          {isAdmin && scope === "company" && (
            <>
              <div className="rounded-2xl border border-[#e8e8ed] bg-white p-5 mb-6 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                <h3 className="text-[14px] font-bold text-[#1d1d1f] mb-4 inline-flex items-center gap-2.5">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#ecfeff] text-[#0f766e]">
                    <FaUsers className="w-3.5 h-3.5" />
                  </span>
                  User Performance
                </h3>
                {userPerformance.length === 0 ? (
                  <p className="text-[12px] text-[#86868b]">No active members found.</p>
                ) : (
                  <div className="space-y-3">
                    {userPerformance.map((row) => (
                      <div key={row.memberId} className="rounded-xl border border-[#ebedf2] bg-gradient-to-br from-[#ffffff] to-[#f8fafc] p-3.5">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">{row.label}</p>
                          <span className="text-[11px] font-bold rounded-full px-2 py-1 bg-[#e2fbe8] text-[#166534]">{row.rate}%</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px] text-[#64748b] mb-2">
                          <p>Assigned: <span className="font-semibold text-[#334155]">{row.total}</span></p>
                          <p>Done: <span className="font-semibold text-[#166534]">{row.done}</span></p>
                          <p>Overdue: <span className="font-semibold text-[#dc2626]">{row.overdue}</span></p>
                        </div>
                        <CompletionBar done={row.done} total={row.total} color="#22c55e" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
                <div className="rounded-2xl border border-[#e8e8ed] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                  <h3 className="text-[14px] font-bold text-[#1d1d1f] mb-4 inline-flex items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#eff6ff] text-[#1d4ed8]">
                      <FaFolderOpen className="w-3.5 h-3.5" />
                    </span>
                    Project Completion
                  </h3>
                  {projectPerformance.length === 0 ? (
                    <p className="text-[12px] text-[#86868b]">No workplace projects found.</p>
                  ) : (
                    <div className="space-y-3">
                      {projectPerformance.map((item) => (
                        <div key={item.id} className="rounded-xl border border-[#ebedf2] bg-gradient-to-br from-[#ffffff] to-[#f8fafc] p-3.5">
                          <p className="text-[13px] font-semibold text-[#1d1d1f] mb-2 truncate">{item.name}</p>
                          <CompletionBar done={item.done} total={item.total} color="#3b82f6" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#e8e8ed] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
                  <h3 className="text-[14px] font-bold text-[#1d1d1f] mb-4 inline-flex items-center gap-2.5">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0fdf4] text-[#15803d]">
                      <FaBuilding className="w-3.5 h-3.5" />
                    </span>
                    Department Completion
                  </h3>
                  {departmentPerformance.length === 0 ? (
                    <p className="text-[12px] text-[#86868b]">No departments found.</p>
                  ) : (
                    <div className="space-y-3">
                      {departmentPerformance.map((item) => (
                        <div key={item.id} className="rounded-xl border border-[#ebedf2] bg-gradient-to-br from-[#ffffff] to-[#f8fafc] p-3.5">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                            <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">{item.name}</p>
                          </div>
                          <CompletionBar done={item.done} total={item.total} color={item.color} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="rounded-2xl border border-[#e8e8ed] bg-white p-5 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
            <h3 className="text-[14px] font-bold text-[#1d1d1f] mb-4 inline-flex items-center gap-2.5">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#fff7ed] text-[#c2410c]">
                <FaClock className="w-3.5 h-3.5" />
              </span>
              Upcoming Due Tasks
            </h3>
            {upcomingTasks.length === 0 ? (
              <p className="text-[12px] text-[#86868b]">No upcoming due tasks in this view.</p>
            ) : (
              <div className="space-y-2.5">
                {upcomingTasks.map((task) => (
                  <div key={task.id} className="rounded-xl border border-[#ebedf2] bg-gradient-to-br from-[#ffffff] to-[#f8fafc] p-3.5 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-[#1d1d1f] truncate">{task.title}</p>
                      <p className="text-[11px] text-[#64748b] mt-0.5">
                        {task.status} • Due {task.due_at ? new Date(task.due_at).toLocaleString() : "Not set"}
                      </p>
                    </div>
                    <span className={`text-[10px] font-bold rounded-full px-2 py-1 ${task.status === STATUS_DONE ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {task.status === STATUS_DONE ? "Done" : "Open"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
