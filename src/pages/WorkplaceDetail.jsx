import { useEffect, useMemo, useState } from "react"
import { useParams, useSearchParams } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import {
  listMyWorkplaces,
  listWorkplaceMembers,
  listWorkplaceProjects,
  listWorkplaceTasks,
  listWorkplaceTaskTypes,
} from "../lib/workplaces"
import WorkplaceProfile from "../components/Workplace/WorkplaceProfile"
import WorkplaceTasks from "../components/Workplace/WorkplaceTasks"
import WorkplaceProjects from "../components/Workplace/WorkplaceProjects"
import WorkplaceTaskTypes from "../components/Workplace/WorkplaceTaskTypes"
import WorkplaceUsers from "../components/Workplace/WorkplaceUsers"

export default function WorkplaceDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const activeTab = searchParams.get("tab") || "profile"
  const setActiveTab = (tab) => setSearchParams({ tab })

  const [myRows, setMyRows] = useState([])
  const [members, setMembers] = useState([])
  const [tasks, setTasks] = useState([])
  const [projects, setProjects] = useState([])
  const [types, setTypes] = useState([])

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

  if (!workplace && !loading && !error) {
    return (
      <div className="max-w-[1200px] mx-auto">
        <WorkplaceProfile workplace={null} loading={false} />
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
    <div className="animate-in fade-in duration-500 max-w-[1400px] mx-auto pb-10">
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

      {/* Workplace Profile Header */}
      <WorkplaceProfile workplace={workplace} loading={loading} />

      {/* Main Content Area */}
      <div className="animate-in fade-in duration-300">
        {loading && !tasks.length && !projects.length && !types.length && !members.length && (
          <div className="p-6 text-center text-[#86868b] text-[14px]">
            Loading workplace data…
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <div className="bg-white rounded-[22px] border border-[#d2d2d7]/50 shadow-sm p-6">
            <h2 className="text-[18px] font-bold text-[#1d1d1f] mb-4">About Workplace</h2>
            {workplace?.description ? (
              <p className="text-[14px] text-[#86868b] leading-relaxed whitespace-pre-wrap">
                {workplace.description}
              </p>
            ) : (
              <p className="text-[14px] text-[#86868b]">No description provided.</p>
            )}
          </div>
        )}

        {/* Tasks Tab */}
        {activeTab === "tasks" && (
          <WorkplaceTasks
            tasks={tasks}
            types={types}
            projects={projects}
            members={members}
            user={user}
            workplace={workplace}
            loading={loading}
            onRefresh={refresh}
            error={error}
            setError={setError}
            message={message}
            setMessage={setMessage}
          />
        )}

        {/* Projects Tab */}
        {activeTab === "projects" && (
          <WorkplaceProjects
            projects={projects}
            types={types}
            user={user}
            workplace={workplace}
            loading={loading}
            onRefresh={refresh}
            error={error}
            setError={setError}
            message={message}
            setMessage={setMessage}
          />
        )}

        {/* Task Types Tab */}
        {activeTab === "types" && (
          <WorkplaceTaskTypes
            types={types}
            user={user}
            workplace={workplace}
            loading={loading}
            onRefresh={refresh}
            error={error}
            setError={setError}
            message={message}
            setMessage={setMessage}
          />
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <WorkplaceUsers
            members={members}
            isOwner={isOwner}
            workplace={workplace}
            user={user}
            loading={loading}
            onRefresh={refresh}
            error={error}
            setError={setError}
            message={message}
            setMessage={setMessage}
          />
        )}
      </div>
    </div>
  )
}

