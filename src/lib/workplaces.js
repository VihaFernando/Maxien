import { supabase } from "./supabase"

export async function listMyWorkplaces(userId) {
  const { data, error } = await supabase
    .from("workplace_members")
    .select("id, role, status, workplace_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) throw error
  return data || []
}

export async function getWorkplaceById(workplaceId) {
  const { data, error } = await supabase
    .from("workplaces")
    .select("*")
    .eq("id", workplaceId)
    .single()

  if (error) throw error
  return data
}

export async function getWorkplacesByIds(workplaceIds) {
  if (!workplaceIds || workplaceIds.length === 0) return []
  const { data, error } = await supabase
    .from("workplaces")
    .select("*")
    .in("id", workplaceIds)

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

export async function updateWorkplace({ workplaceId, name, description, bannerUrl }) {
  const { data, error } = await supabase
    .from("workplaces")
    .update({
      name: name ?? undefined,
      description: description ?? undefined,
      banner_url: bannerUrl ?? undefined,
    })
    .eq("id", workplaceId)
    .select()
    .single()

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

export async function listWorkplaceTasks({ workplaceId, userId = null }) {
  const { data, error } = await supabase
    .from("tasks")
    .select(
      `*,
      task_assignees!left ( user_id )`
    )
    .eq("workplace_id", workplaceId)
    .order("created_at", { ascending: false })

  if (error) throw error

  // Filter on client-side if userId provided
  if (userId && data) {
    return data.filter((task) => {
      // Show tasks created by user OR assigned to user
      const isCreatedByUser = task.user_id === userId
      const isAssignedToUser = task.task_assignees?.some((a) => a.user_id === userId)
      return isCreatedByUser || isAssignedToUser
    })
  }

  return data || []
}

export async function assignTaskUsers({ taskId, userIds }) {
  if (!taskId || !userIds?.length) return
  const payload = userIds.map((user_id) => ({ task_id: taskId, user_id }))
  const { data, error } = await supabase.from("task_assignees").insert(payload)
  if (error) throw error
  return data
}

export async function clearTaskAssignees({ taskId }) {
  const { data, error } = await supabase.from("task_assignees").delete().eq("task_id", taskId)
  if (error) throw error
  return data
}

export async function updateWorkplaceTask({ taskId, payload }) {
  const { assigned_to, ...taskPayload } = payload

  // Update the task
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .update(taskPayload)
    .eq("id", taskId)
    .select()
    .single()

  if (taskError) throw taskError

  // If assigned_to is provided, clear old assignees and add new ones
  if (assigned_to !== undefined) {
    await clearTaskAssignees({ taskId })

    const userIds = Array.isArray(assigned_to)
      ? assigned_to.filter(Boolean)
      : assigned_to
        ? [assigned_to]
        : []

    if (userIds.length) {
      await assignTaskUsers({ taskId, userIds })
    }
  }

  return task
}

export async function deleteWorkplaceTask({ taskId }) {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId)
  if (error) throw error
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
  const { assigned_to, ...taskPayload } = payload

  // Create the task first, then assign users via task_assignees join table
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert([taskPayload])
    .select()
    .single()

  if (taskError) throw taskError

  const userIds = Array.isArray(assigned_to)
    ? assigned_to.filter(Boolean)
    : assigned_to
      ? [assigned_to]
      : []

  if (userIds.length) {
    await assignTaskUsers({ taskId: task.id, userIds })
  }

  return task
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

