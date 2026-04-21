import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import {
  listMyWorkplaces,
  getWorkplaceById,
  listWorkplaceMembers,
  listWorkplaceProjects,
  listWorkplaceTasks,
  listWorkplaceTaskTypes,
  listWorkplaceDepartments,
  listWorkplaceRoles,
} from "../lib/workplaces"
import WorkplaceProfile from "../components/Workplace/WorkplaceProfile"
import WorkplaceTasks from "../components/Workplace/WorkplaceTasks"
import WorkplaceProjects from "../components/Workplace/WorkplaceProjects"
import WorkplaceTaskTypes from "../components/Workplace/WorkplaceTaskTypes"
import WorkplaceUsers from "../components/Workplace/WorkplaceUsers"
import WorkplaceDepartments from "../components/Workplace/WorkplaceDepartments"
import WorkplaceRoles from "../components/Workplace/WorkplaceRoles"
import WorkplaceAnalytics from "../components/Workplace/WorkplaceAnalytics"

export default function WorkplaceDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const activeTab = searchParams.get("tab") || "profile"
  const validTabs = ["profile", "tasks", "projects", "analytics", "types", "departments", "roles", "users"]
  const resolvedTab = validTabs.includes(activeTab) ? activeTab : "profile"

  const [myRows, setMyRows] = useState([])
  const [members, setMembers] = useState([])
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [types, setTypes] = useState([])
  const [departments, setDepartments] = useState([])
  const [roles, setRoles] = useState([])

  const [workplace, setWorkplace] = useState(null)

  const currentMembership = useMemo(() => {
    return myRows.find((r) => r.workplace_id === id && r.status === "accepted") || null
  }, [myRows, id])

  const currentMember = useMemo(() => {
    return members.find((m) => m.user_id === user?.id && m.status === "accepted") || null
  }, [members, user?.id])

  const isOwner = currentMembership?.role === "owner" || workplace?.owner_id === user?.id
  const isAdmin = useMemo(() => {
    return (currentMember?.roles || []).some((role) => role?.name?.toLowerCase?.() === "admin")
  }, [currentMember])
  const canManageWorkplace = isOwner || isAdmin

  const refresh = async () => {
    if (!user?.id || !id) return
    setLoading(true)
    setError("")
    try {
      const [my, mem, p, tt, d, r] = await Promise.all([
        listMyWorkplaces(user.id),
        listWorkplaceMembers(id),
        listWorkplaceProjects({ workplaceId: id }),
        listWorkplaceTaskTypes({ workplaceId: id }),
        listWorkplaceDepartments({ workplaceId: id }),
        listWorkplaceRoles({ workplaceId: id }),
      ])

      const membership = my.find((row) => row.workplace_id === id && row.status === "accepted")
      const memberRow = mem.find((row) => row.user_id === user.id && row.status === "accepted")
      const isAdminUser = (memberRow?.roles || []).some((role) => role?.name?.toLowerCase?.() === "admin")
      const canSeeAllTasks = membership?.role === "owner" || isAdminUser
      const t = await listWorkplaceTasks({
        workplaceId: id,
        userId: canSeeAllTasks ? null : user.id,
      })

      setMyRows(my)
      setMembers(mem)
      setTasks(t)
      setProjects(p)
      setTypes(tt)
      setDepartments(d)
      setRoles(r)

      if (membership?.workplace_id) {
        try {
          const workplaceData = await getWorkplaceById(membership.workplace_id)
          setWorkplace(workplaceData)
        } catch {
          // keep existing workplace state if fetch fails
        }
      }
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

  if (!workplace && !loading && !error) {
    return (
      <div className="workplace-theme-surface max-w-[1200px] mx-auto">
        <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-6">
          <p className="text-[14px] font-bold text-[#1d1d1f]">Workplace not available</p>
          <p className="text-[12px] text-[#86868b] mt-1">
            You may not be an accepted member of this workplace.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="workplace-theme-surface animate-in fade-in duration-500 max-w-[1400px] mx-auto pb-10">
      {/* Top Error/Message Alerts */}
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

      <div className="animate-in fade-in duration-300">
        {loading && !tasks.length && !projects.length && !types.length && !members.length && !departments.length && !roles.length && (
          <div className="p-6 text-center text-[#86868b] text-[14px]">
            Loading workplace data…
          </div>
        )}

        {resolvedTab === "profile" && (
          <WorkplaceProfile
            workplace={workplace}
            loading={loading}
            isOwner={canManageWorkplace}
            onRefresh={refresh}
            setMessage={setMessage}
            setError={setError}
            members={members}
            projects={projects}
            tasks={tasks}
            currentMembership={currentMembership}
          />
        )}

        {/* Tasks Tab */}
        {resolvedTab === "tasks" && (
          <WorkplaceTasks
            tasks={tasks}
            types={types}
            projects={projects}
            departments={departments}
            members={members}
            user={user}
            workplace={workplace}
            isAdmin={isAdmin}
            loading={loading}
            onRefresh={refresh}
            setError={setError}
            setMessage={setMessage}
          />
        )}

        {/* Projects Tab */}
        {resolvedTab === "projects" && (
          <WorkplaceProjects
            projects={projects}
            departments={departments}
            user={user}
            workplace={workplace}
            loading={loading}
            onRefresh={refresh}
            setError={setError}
            setMessage={setMessage}
          />
        )}

        {resolvedTab === "analytics" && (
          <WorkplaceAnalytics
            tasks={tasks}
            projects={projects}
            departments={departments}
            members={members}
            user={user}
            isAdmin={isAdmin || isOwner}
            loading={loading}
          />
        )}

        {/* Task Types Tab */}
        {resolvedTab === "types" && (
          <WorkplaceTaskTypes
            types={types}
            user={user}
            workplace={workplace}
            loading={loading}
            onRefresh={refresh}
            setError={setError}
            setMessage={setMessage}
          />
        )}

        {resolvedTab === "departments" && (
          <WorkplaceDepartments
            departments={departments}
            members={members}
            workplace={workplace}
            user={user}
            loading={loading}
            onRefresh={refresh}
            setError={setError}
            setMessage={setMessage}
          />
        )}

        {resolvedTab === "roles" && (
          <WorkplaceRoles
            roles={roles}
            workplace={workplace}
            user={user}
            loading={loading}
            onRefresh={refresh}
            setError={setError}
            setMessage={setMessage}
          />
        )}

        {/* Users Tab */}
        {resolvedTab === "users" && (
          <WorkplaceUsers
            members={members}
            roles={roles}
            canManageMembers={canManageWorkplace}
            workplace={workplace}
            user={user}
            loading={loading}
            onRefresh={refresh}
            setError={setError}
            setMessage={setMessage}
          />
        )}
      </div>
    </div>
  )
}
