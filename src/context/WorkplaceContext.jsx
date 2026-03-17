import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import { supabase } from "../lib/supabase"
import { useAuth } from "./AuthContext"

const WorkplaceContext = createContext(null)

const STORAGE_KEY = "maxien.workplace.selected"

const readStoredSelection = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return null
    if (raw === "personal") return null
    if (raw === "") return null
    return raw
  } catch {
    return null
  }
}

const writeStoredSelection = (workplaceIdOrNull) => {
  try {
    localStorage.setItem(STORAGE_KEY, workplaceIdOrNull ? workplaceIdOrNull : "personal")
  } catch {
    // ignore storage failures
  }
}

export const WorkplaceProvider = ({ children }) => {
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [workplaces, setWorkplaces] = useState([]) // accepted memberships (includes owner)
  const [pendingInvites, setPendingInvites] = useState([]) // memberships with status=pending
  const [selectedWorkplaceId, setSelectedWorkplaceId] = useState(null) // null = Personal

  const load = useCallback(async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const [{ data: accepted, error: accErr }, { data: pending, error: pendErr }] = await Promise.all([
        supabase
          .from("workplace_members")
          .select("id, role, status, created_at, workplace:workplaces(id, name, description, banner_url, owner_id, created_at)")
          .eq("user_id", user.id)
          .eq("status", "accepted")
          .order("created_at", { ascending: false }),
        supabase
          .from("workplace_members")
          .select("id, role, status, created_at, workplace:workplaces(id, name, description, banner_url, owner_id, created_at)")
          .eq("user_id", user.id)
          .eq("status", "pending")
          .order("created_at", { ascending: false }),
      ])

      if (accErr) throw accErr
      if (pendErr) throw pendErr

      const normalizedAccepted = (accepted || [])
        .map((m) => ({
          membershipId: m.id,
          role: m.role,
          status: m.status,
          created_at: m.created_at,
          workplace: m.workplace,
        }))
        .filter((m) => !!m.workplace?.id)

      const normalizedPending = (pending || [])
        .map((m) => ({
          membershipId: m.id,
          role: m.role,
          status: m.status,
          created_at: m.created_at,
          workplace: m.workplace,
        }))
        .filter((m) => !!m.workplace?.id)

      setWorkplaces(normalizedAccepted)
      setPendingInvites(normalizedPending)

      // Validate selection
      const stored = readStoredSelection()
      const allowedIds = new Set(normalizedAccepted.map((m) => m.workplace.id))
      const nextSelected = stored && allowedIds.has(stored) ? stored : null
      setSelectedWorkplaceId(nextSelected)
      writeStoredSelection(nextSelected)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user?.id) {
      setWorkplaces([])
      setPendingInvites([])
      setSelectedWorkplaceId(null)
      setLoading(false)
      return
    }
    load()
  }, [user?.id, load])

  const selectWorkplace = useCallback((workplaceIdOrNull) => {
    const next = workplaceIdOrNull || null
    setSelectedWorkplaceId(next)
    writeStoredSelection(next)
  }, [])

  const acceptInvite = useCallback(async (membershipId) => {
    if (!membershipId) return { error: new Error("membershipId required") }
    const { error } = await supabase
      .from("workplace_members")
      .update({ status: "accepted" })
      .eq("id", membershipId)
    if (!error) await load()
    return { error }
  }, [load])

  const rejectInvite = useCallback(async (membershipId) => {
    if (!membershipId) return { error: new Error("membershipId required") }
    const { error } = await supabase
      .from("workplace_members")
      .update({ status: "rejected" })
      .eq("id", membershipId)
    if (!error) await load()
    return { error }
  }, [load])

  const createWorkplace = useCallback(async ({ name, description, banner_url }) => {
    if (!user?.id) return { data: null, error: new Error("Not signed in") }
    const trimmedName = (name || "").trim()
    if (!trimmedName) return { data: null, error: new Error("Workplace name is required") }

    const { data: workplace, error: wErr } = await supabase
      .from("workplaces")
      .insert([{
        name: trimmedName,
        description: (description || "").trim() || null,
        banner_url: (banner_url || "").trim() || null,
        owner_id: user.id,
      }])
      .select()
      .single()

    if (wErr) return { data: null, error: wErr }

    const { error: mErr } = await supabase
      .from("workplace_members")
      .insert([{
        workplace_id: workplace.id,
        user_id: user.id,
        status: "accepted",
        role: "owner",
      }])

    if (mErr) return { data: null, error: mErr }

    await load()
    selectWorkplace(workplace.id)
    return { data: workplace, error: null }
  }, [user?.id, load, selectWorkplace])

  const value = useMemo(() => {
    const selectedWorkplace = selectedWorkplaceId
      ? workplaces.find((m) => m.workplace.id === selectedWorkplaceId)?.workplace || null
      : null

    const shouldPromptCreateWorkplace = !!user?.id && workplaces.length === 0

    return {
      loading,
      workplaces,
      pendingInvites,
      selectedWorkplaceId,
      selectedWorkplace,
      shouldPromptCreateWorkplace,
      selectWorkplace,
      reloadWorkplaces: load,
      acceptInvite,
      rejectInvite,
      createWorkplace,
    }
  }, [loading, workplaces, pendingInvites, selectedWorkplaceId, selectWorkplace, load, acceptInvite, rejectInvite, createWorkplace, user?.id])

  return (
    <WorkplaceContext.Provider value={value}>
      {children}
    </WorkplaceContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useWorkplace = () => {
  const ctx = useContext(WorkplaceContext)
  if (!ctx) throw new Error("useWorkplace must be used within a WorkplaceProvider")
  return ctx
}

