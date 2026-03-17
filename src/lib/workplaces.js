import { supabase } from "./supabase"

export async function listMyWorkplaces(userId) {
  const { data, error } = await supabase
    .from("workplace_members")
    .select("id, role, status, workplace_id, workplaces ( id, name, description, banner_url, owner_id, created_at )")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function createWorkplace({ name, description, bannerUrl }) {
  const { data, error } = await supabase
    .rpc("create_workplace", {
      p_name: name,
      p_description: description ?? null,
      p_banner_url: bannerUrl ?? null,
    })

  if (error) throw error
  return data
}

export async function inviteToWorkplace({ workplaceId, email }) {
  const { data, error } = await supabase
    .rpc("create_workplace_invite", { p_workplace_id: workplaceId, p_email: email })

  if (error) throw error
  return data
}

export async function setMyMembershipStatus({ workplaceMemberId, status }) {
  const { data, error } = await supabase
    .from("workplace_members")
    .update({ status })
    .eq("id", workplaceMemberId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function listWorkplaceMembers(workplaceId) {
  const { data, error } = await supabase
    .from("workplace_members")
    .select("id, workplace_id, user_id, status, role, created_at")
    .eq("workplace_id", workplaceId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return data || []
}

export async function listWorkplaceTasks({ workplaceId }) {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("workplace_id", workplaceId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function listWorkplaceProjects({ workplaceId }) {
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("workplace_id", workplaceId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function listWorkplaceTaskTypes({ workplaceId }) {
  const { data, error } = await supabase
    .from("task_types")
    .select("*")
    .eq("workplace_id", workplaceId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function createWorkplaceTask(payload) {
  const { data, error } = await supabase.from("tasks").insert([payload]).select().single()
  if (error) throw error
  return data
}

export async function createWorkplaceProject(payload) {
  const { data, error } = await supabase.from("projects").insert([payload]).select().single()
  if (error) throw error
  return data
}

export async function createWorkplaceTaskType(payload) {
  const { data, error } = await supabase.from("task_types").insert([payload]).select().single()
  if (error) throw error
  return data
}

