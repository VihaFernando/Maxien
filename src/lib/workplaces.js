import { supabase } from "./supabase"

async function setDepartmentMembers({ departmentId, workplaceId, userIds, addedBy }) {
  await supabase.from("department_members").delete().eq("department_id", departmentId)

  const normalized = Array.isArray(userIds) ? userIds.filter(Boolean) : []
  if (!normalized.length) return

  const payload = normalized.map((user_id) => ({
    department_id: departmentId,
    workplace_id: workplaceId,
    user_id,
    added_by: addedBy || null,
  }))

  const { error } = await supabase.from("department_members").insert(payload)
  if (error) throw error
}

async function setTaskDepartmentLink({ taskId, workplaceId, departmentId, linkedBy }) {
  const { error: deleteError } = await supabase.from("department_task_links").delete().eq("task_id", taskId)
  if (deleteError) throw deleteError

  if (!departmentId) return

  const { error: insertError } = await supabase.from("department_task_links").insert({
    task_id: taskId,
    department_id: departmentId,
    workplace_id: workplaceId,
    linked_by: linkedBy || null,
  })
  if (insertError) throw insertError
}

async function setProjectDepartmentLink({ projectId, workplaceId, departmentId, linkedBy }) {
  const { error: deleteError } = await supabase.from("department_project_links").delete().eq("project_id", projectId)
  if (deleteError) throw deleteError

  if (!departmentId) return

  const { error: insertError } = await supabase.from("department_project_links").insert({
    project_id: projectId,
    department_id: departmentId,
    workplace_id: workplaceId,
    linked_by: linkedBy || null,
  })
  if (insertError) throw insertError
}

async function enrichWithTaskDepartments(tasks, workplaceId) {
  if (!tasks?.length) return tasks || []

  const taskIds = tasks.map((t) => t.id)
  const { data: links, error: linksError } = await supabase
    .from("department_task_links")
    .select("task_id, department_id")
    .eq("workplace_id", workplaceId)
    .in("task_id", taskIds)

  if (linksError) throw linksError
  if (!links?.length) {
    return tasks.map((task) => ({ ...task, department_id: null, department: null }))
  }

  const departmentIds = Array.from(new Set(links.map((l) => l.department_id).filter(Boolean)))
  const { data: departments, error: departmentsError } = await supabase
    .from("departments")
    .select("id, name, color")
    .in("id", departmentIds)

  if (departmentsError) throw departmentsError

  const linkMap = new Map(links.map((l) => [l.task_id, l.department_id]))
  const departmentMap = new Map((departments || []).map((d) => [d.id, d]))

  return tasks.map((task) => {
    const departmentId = linkMap.get(task.id) || null
    return {
      ...task,
      department_id: departmentId,
      department: departmentId ? departmentMap.get(departmentId) || null : null,
    }
  })
}

async function enrichWithProjectDepartments(projects, workplaceId) {
  if (!projects?.length) return projects || []

  const projectIds = projects.map((p) => p.id)
  const { data: links, error: linksError } = await supabase
    .from("department_project_links")
    .select("project_id, department_id")
    .eq("workplace_id", workplaceId)
    .in("project_id", projectIds)

  if (linksError) throw linksError
  if (!links?.length) {
    return projects.map((project) => ({ ...project, department_id: null, department: null }))
  }

  const departmentIds = Array.from(new Set(links.map((l) => l.department_id).filter(Boolean)))
  const { data: departments, error: departmentsError } = await supabase
    .from("departments")
    .select("id, name, color")
    .in("id", departmentIds)

  if (departmentsError) throw departmentsError

  const linkMap = new Map(links.map((l) => [l.project_id, l.department_id]))
  const departmentMap = new Map((departments || []).map((d) => [d.id, d]))

  return projects.map((project) => {
    const departmentId = linkMap.get(project.id) || null
    return {
      ...project,
      department_id: departmentId,
      department: departmentId ? departmentMap.get(departmentId) || null : null,
    }
  })
}

async function enrichMembersWithRoles(members, workplaceId) {
  if (!members?.length) return members || []

  const memberIds = members.map((member) => member.id)
  const [rolesResult, memberRolesResult] = await Promise.all([
    supabase
      .from("roles")
      .select("id, workplace_id, name, description, color, created_at, updated_at")
      .eq("workplace_id", workplaceId)
      .order("created_at", { ascending: true }),
    supabase
      .from("member_roles")
      .select("member_id, role_id")
      .eq("workplace_id", workplaceId)
      .in("member_id", memberIds),
  ])

  const rolesError = rolesResult.error
  const memberRolesError = memberRolesResult.error
  if (rolesError) throw rolesError
  if (memberRolesError) throw memberRolesError

  const roles = rolesResult.data || []
  const memberRoles = memberRolesResult.data || []
  const roleMap = new Map(roles.map((role) => [role.id, role]))

  const memberRoleMap = memberRoles.reduce((acc, row) => {
    if (!acc[row.member_id]) acc[row.member_id] = []
    const role = roleMap.get(row.role_id)
    if (role) acc[row.member_id].push(role)
    return acc
  }, {})

  return members.map((member) => ({
    ...member,
    roles: memberRoleMap[member.id] || [],
  }))
}

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

export async function removeWorkplaceMember({ workplaceId, memberId }) {
  const { error } = await supabase.rpc("remove_workplace_member", {
    p_workplace_id: workplaceId,
    p_member_id: memberId,
  })

  if (error) throw error
}

export async function listWorkplaceMembers(workplaceId) {
  const { data, error } = await supabase
    .from("workplace_members")
    .select("id, workplace_id, user_id, status, role, created_at")
    .eq("workplace_id", workplaceId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return enrichMembersWithRoles(data || [], workplaceId)
}

export async function listWorkplaceRoles({ workplaceId }) {
  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .eq("workplace_id", workplaceId)
    .order("created_at", { ascending: true })

  if (error) throw error
  return data || []
}

export async function createWorkplaceRole(payload) {
  const { data, error } = await supabase
    .from("roles")
    .insert([payload])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateWorkplaceRole({ roleId, payload }) {
  const { data, error } = await supabase
    .from("roles")
    .update(payload)
    .eq("id", roleId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteWorkplaceRole({ roleId }) {
  const { error } = await supabase.from("roles").delete().eq("id", roleId)
  if (error) throw error
}

export async function setWorkplaceMemberRoles({ workplaceId, memberId, roleIds }) {
  const normalized = Array.isArray(roleIds) ? Array.from(new Set(roleIds.filter(Boolean))) : []

  const { error: deleteError } = await supabase
    .from("member_roles")
    .delete()
    .eq("workplace_id", workplaceId)
    .eq("member_id", memberId)
  if (deleteError) throw deleteError

  if (!normalized.length) return []

  const payload = normalized.map((role_id) => ({
    workplace_id: workplaceId,
    member_id: memberId,
    role_id,
  }))

  const { data, error } = await supabase
    .from("member_roles")
    .insert(payload)
    .select()

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

  const tasksWithDepartments = await enrichWithTaskDepartments(data || [], workplaceId)

  // Filter on client-side if userId provided
  if (userId && tasksWithDepartments) {
    return tasksWithDepartments.filter((task) => {
      // Show tasks created by user OR assigned to user
      const isCreatedByUser = task.user_id === userId
      const isAssignedToUser = task.task_assignees?.some((a) => a.user_id === userId)
      return isCreatedByUser || isAssignedToUser
    })
  }

  return tasksWithDepartments || []
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
  const { assigned_to, department_id, workplace_id, linked_by, ...taskPayload } = payload

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

  if (department_id !== undefined) {
    await setTaskDepartmentLink({
      taskId,
      workplaceId: workplace_id || task.workplace_id,
      departmentId: department_id,
      linkedBy: linked_by || task.user_id,
    })
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
  return enrichWithProjectDepartments(data || [], workplaceId)
}

export async function listWorkplaceDepartments({ workplaceId }) {
  const { data, error } = await supabase
    .from("departments")
    .select("*")
    .eq("workplace_id", workplaceId)
    .order("created_at", { ascending: false })

  if (error) throw error

  const departments = data || []
  if (!departments.length) return []

  const departmentIds = departments.map((d) => d.id)
  const { data: members, error: membersError } = await supabase
    .from("department_members")
    .select("department_id, user_id")
    .eq("workplace_id", workplaceId)
    .in("department_id", departmentIds)

  if (membersError) throw membersError

  const memberMap = (members || []).reduce((acc, row) => {
    if (!acc[row.department_id]) acc[row.department_id] = []
    acc[row.department_id].push(row.user_id)
    return acc
  }, {})

  return departments.map((department) => ({
    ...department,
    member_user_ids: memberMap[department.id] || [],
  }))
}

export async function createWorkplaceDepartment(payload) {
  const { member_user_ids, ...departmentPayload } = payload

  const { data, error } = await supabase
    .from("departments")
    .insert([departmentPayload])
    .select()
    .single()
  if (error) throw error

  await setDepartmentMembers({
    departmentId: data.id,
    workplaceId: data.workplace_id,
    userIds: member_user_ids || [],
    addedBy: departmentPayload.created_by,
  })

  return data
}

export async function updateWorkplaceDepartment({ departmentId, payload }) {
  const { member_user_ids, updated_by, ...departmentPayload } = payload

  const { data, error } = await supabase
    .from("departments")
    .update(departmentPayload)
    .eq("id", departmentId)
    .select()
    .single()
  if (error) throw error

  if (member_user_ids !== undefined) {
    await setDepartmentMembers({
      departmentId,
      workplaceId: data.workplace_id,
      userIds: member_user_ids,
      addedBy: updated_by || payload.created_by || null,
    })
  }

  return data
}

export async function deleteWorkplaceDepartment({ departmentId }) {
  const { error } = await supabase.from("departments").delete().eq("id", departmentId)
  if (error) throw error
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
  const { assigned_to, department_id, linked_by, ...taskPayload } = payload

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

  if (department_id !== undefined) {
    await setTaskDepartmentLink({
      taskId: task.id,
      workplaceId: task.workplace_id,
      departmentId: department_id,
      linkedBy: linked_by || task.user_id,
    })
  }

  return task
}

export async function createWorkplaceProject(payload) {
  const { department_id, linked_by, ...projectPayload } = payload
  const { data, error } = await supabase.from("projects").insert([projectPayload]).select().single()
  if (error) throw error

  if (department_id !== undefined) {
    await setProjectDepartmentLink({
      projectId: data.id,
      workplaceId: data.workplace_id,
      departmentId: department_id,
      linkedBy: linked_by || data.user_id,
    })
  }

  return data
}

export async function updateWorkplaceProject({ projectId, payload }) {
  const { department_id, linked_by, workplace_id, ...projectPayload } = payload
  const { data, error } = await supabase
    .from("projects")
    .update(projectPayload)
    .eq("id", projectId)
    .select()
    .single()
  if (error) throw error

  if (department_id !== undefined) {
    await setProjectDepartmentLink({
      projectId,
      workplaceId: workplace_id || data.workplace_id,
      departmentId: department_id,
      linkedBy: linked_by || data.user_id,
    })
  }

  return data
}

export async function deleteWorkplaceProject({ projectId }) {
  const { error } = await supabase.from("projects").delete().eq("id", projectId)
  if (error) throw error
}

export async function createWorkplaceTaskType(payload) {
  const { data, error } = await supabase.from("task_types").insert([payload]).select().single()
  if (error) throw error
  return data
}

export async function updateWorkplaceTaskType({ typeId, payload }) {
  const { data, error } = await supabase
    .from("task_types")
    .update(payload)
    .eq("id", typeId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteWorkplaceTaskType({ typeId }) {
  const { error } = await supabase.from("task_types").delete().eq("id", typeId)
  if (error) throw error
}

