import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// ─── CORS ─────────────────────────────────────────────────────────────────────
const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
}

// ─── Encryption helpers (AES-GCM 256) ─────────────────────────────────────────
const enc = new TextEncoder()
const dec = new TextDecoder()

const b64Encode = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))

const b64Decode = (s: string) =>
    Uint8Array.from(atob(s), c => c.charCodeAt(0))

async function deriveKey(secret: string): Promise<CryptoKey> {
    // Derive a 256-bit AES key from the secret using PBKDF2
    const keyMaterial = await crypto.subtle.importKey(
        "raw", enc.encode(secret), "PBKDF2", false, ["deriveKey"]
    )
    return crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: enc.encode("maxien-ai-salt"), iterations: 100_000, hash: "SHA-256" },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    )
}

async function encryptKey(plaintext: string, secret: string): Promise<{ ciphertext: string; iv: string }> {
    const key = await deriveKey(secret)
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plaintext))
    return { ciphertext: b64Encode(encrypted), iv: b64Encode(iv.buffer) }
}

async function decryptKey(ciphertext: string, iv: string, secret: string): Promise<string> {
    const key = await deriveKey(secret)
    const decrypted = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: b64Decode(iv) }, key, b64Decode(ciphertext)
    )
    return dec.decode(decrypted)
}

// ─── Groq call ───────────────────────────────────────────────────────────────
interface GeminiResult {
    action: "create_task" | "create_project" | "update_task" | "update_project" | "link_task_project" | "query_tasks" | "query_projects" | "none"
    summary: string
    task?: {
        title?: string; description?: string; due_at?: string
        priority?: string; status?: string; type_name?: string
    }
    project?: {
        name?: string; description?: string; status?: string
        type_name?: string; target_end_date?: string; start_date?: string
    }
    update_filter?: { task_title?: string; project_name?: string; due_date?: string }
    linking?: { task_title?: string; project_name?: string }
    query_filter?: { due_date?: string; date_range?: string; status?: string; priority?: string }
    items?: Array<{ type: "task" | "project"; id: string; title: string; meta: string }>
}

async function callGroq(
    userMessage: string,
    apiKey: string,
    taskTypes: { id: string; name: string }[],
    projects: { id: string; name: string }[],
    userLocalNow: string = new Date().toISOString()
): Promise<GeminiResult> {
    const now = userLocalNow

    const systemPrompt = `You are an AI assistant for Maxien, a productivity app.
Current date/time (user's local): ${now}

Available task types (use exact name when possible):
${taskTypes.length > 0 ? taskTypes.map(t => `- "${t.name}"`).join("\n") : "- (none created yet)"}

Available projects:
${projects.length > 0 ? projects.map(p => `- "${p.name}"`).join("\n") : "- (none created yet)"}

You MUST respond with ONLY a valid JSON object matching this exact schema. No other text.

{
  "action": "create_task" | "create_project" | "update_task" | "update_project" | "link_task_project" | "none",
  "summary": "Human-readable confirmation or response (1-2 sentences)",
  "task": {
    "title": "string (required for create_task; for update_task, leave empty and use update_filter instead)",
    "description": "string or empty",
    "due_at": "ISO 8601 datetime string or empty (compute from relative phrases like 'tomorrow')",
    "priority": "Low" | "Medium" | "High" | "Urgent" (default Medium),
    "status": "To Do" | "In Progress" | "Done" | "Cancelled" (default To Do),
    "type_name": "string matching an available task type name, or empty"
  },
  "project": {
    "name": "string (required for create_project; for update_project, leave empty and use update_filter instead)",
    "description": "string or empty",
    "status": "Active" | "On Hold" | "Completed" | "Archived" (default Active),
    "type_name": "string matching an available task type, or empty",
    "target_end_date": "YYYY-MM-DD or empty",
    "start_date": "YYYY-MM-DD or empty"
  },
  "update_filter": {
    "task_title": "partial title to find the task — use when user specifies a task name",
    "project_name": "partial name to find the project — use when user specifies a project name",
    "due_date": "'today', 'tomorrow', 'next week', or YYYY-MM-DD — use when user refers to tasks/projects by time instead of name (e.g., 'tomorrow task', 'today's projects', 'tasks due next week')"
  },
  "query_filter": {
    "due_date": "'today', 'tomorrow', 'this week', 'next week', 'overdue', or YYYY-MM-DD for single day queries",
    "date_range": "If user asks about a period: 'today_to_tomorrow', 'this_week', 'next_week', 'this_month'",
    "status": "Filter by status: 'To Do', 'In Progress', 'Done', or 'All' for all statuses",
    "priority": "Filter by priority: 'Low', 'Medium', 'High', 'Urgent', or 'All'"
  },
  "linking": {
    "task_title": "title of the task to link (for link_task_project or when creating a task under a project)",
    "project_name": "name of the project to link to"
  }
}

RULES:
- QUERY ACTIONS (when user asks for information, not to modify):
  * "What do I have today?" → action="query_tasks", query_filter.due_date="today"
  * "Show me tomorrow's tasks" → action="query_tasks", query_filter.due_date="tomorrow"
  * "What's overdue?" → action="query_tasks", query_filter.status="All", query_filter.date_range="overdue"
  * "Tasks due this week" → action="query_tasks", query_filter.date_range="this_week"
  * "Show my active projects" → action="query_projects", query_filter.status="Active"
  * "What tasks are in progress?" → action="query_tasks", query_filter.status="In Progress"
  * "High priority tasks" → action="query_tasks", query_filter.priority="High"
- MODIFICATION ACTIONS (when user wants to create/update):
  * "Create task X" → action="create_task"
  * "Update task X" → action="update_task"
  * "Mark task X as done" → action="update_task", task.status="Done"
- When user asks about dates/counts/lists → use query actions
- When user wants to change something → use create/update actions
  * "update tomorrow task status to done" → action="update_task", update_filter.due_date="tomorrow", task.status="Done"
  * "mark the task called X as done" → action="update_task", update_filter.task_title="X", task.status="Done"
  * "finish today's tasks" → action="update_task", update_filter.due_date="today", task.status="Done"
  * "update project X" OR "update tomorrow project" → action="update_project", use update_filter.project_name OR update_filter.due_date
  * "link task X to project Y" → action="link_task_project", linking.task_title="X", linking.project_name="Y"
- When user mentions a TIME instead of a name (today, tomorrow, next week, etc.): put it in update_filter.due_date, NOT task_title
- When user says "task" or "project" without a specific name but mentions a time reference → use time in update_filter.due_date
- For update actions, put search text in update_filter (either task_title, project_name, OR due_date)
- If user says "create task X under project Y": set action="create_task", fill task fields, set linking.project_name="Y"
- Resolve relative dates like "tomorrow", "today", "next week" using current date (convert to YYYY-MM-DD or leave as "today"/"tomorrow" string)
- Omit fields that are empty (use "" for strings, not null)
- Always fill "summary" with a friendly confirmation
- If the request is unclear or not about tasks/projects: set action="none" and explain in summary`

    const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userMessage },
                ],
                response_format: { type: "json_object" },
                temperature: 0.1,
                max_tokens: 1024,
            }),
        }
    )

    if (!response.ok) {
        const errText = await response.text()
        throw new Error(`Groq API error (${response.status}): ${errText}`)
    }

    const data = await response.json()
    const rawContent = data?.choices?.[0]?.message?.content

    if (!rawContent) throw new Error("Groq returned an empty response")

    // Parse JSON — strip markdown code fences if present
    const cleaned = rawContent.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()
    return JSON.parse(cleaned) as GeminiResult
}

// ─── Disambiguation types ─────────────────────────────────────────────────────
interface ClarifyOption { id: string; label: string; extra: string }
type ActionResult =
    | { type: "done"; summary: string }
    | { type: "clarify"; entityType: "task" | "project"; options: ClarifyOption[]; pendingAction: GeminiResult }

// ─── Parse relative/absolute due date string → YYYY-MM-DD ────────────────────
function parseDueDate(dateStr: string, userLocalNow: string = new Date().toISOString(), timezoneOffsetMinutes: number = 0): string | null {
    const s = dateStr.toLowerCase().trim()
    const now = new Date(userLocalNow)
    let targetDate: Date

    if (s === "today") {
        targetDate = new Date(now)
    } else if (s === "tomorrow") {
        targetDate = new Date(now.getTime() + 86400000)
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        targetDate = new Date(dateStr)
    } else {
        return null
    }

    // LLM outputs local time with no TZ suffix → JS on server parses it as UTC.
    // To get true UTC: add timezoneOffsetMinutes (negative for UTC+ zones).
    const utcDate = new Date(targetDate.getTime() + timezoneOffsetMinutes * 60000)
    return utcDate.toISOString().split("T")[0]
}

// ─── Convert local datetime string to UTC ISO string ───────────────────────────
function localDateTimeToUTC(dateStr: string, timeStr: string, timezoneOffsetMinutes: number = 0): string | null {
    // dateStr: "2026-03-03", timeStr: "14:30"
    try {
        // Create a date treating the date/time as LOCAL time
        const localDate = new Date(`${dateStr}T${timeStr}:00`)
        // LLM outputs local time → server JS parses no-TZ string as UTC.
        // To get true UTC: add timezoneOffsetMinutes.
        const utcDate = new Date(localDate.getTime() + timezoneOffsetMinutes * 60000)
        return utcDate.toISOString()
    } catch {
        return null
    }
}

// ─── Parse date range for queries ─────────────────────────────────────────────
function getDateRange(rangeStr: string, userLocalNow: string = new Date().toISOString(), timezoneOffsetMinutes: number = 0): { start: string; end: string } | { overdue: true } | null {
    const s = rangeStr.toLowerCase().trim()
    const now = new Date(userLocalNow)
    const localNow = new Date(now.getTime() - timezoneOffsetMinutes * 60000)
    const today = localNow.toISOString().split("T")[0]

    if (s === "overdue") return { overdue: true }

    if (s === "today") return { start: today, end: today }
    if (s === "tomorrow") {
        const tom = new Date(localNow.getTime() + 86400000)
        const tomStr = tom.toISOString().split("T")[0]
        return { start: tomStr, end: tomStr }
    }

    if (s === "this_week") {
        const dayOfWeek = localNow.getDay()
        const start = new Date(localNow.getTime() - dayOfWeek * 86400000).toISOString().split("T")[0]
        const end = new Date(localNow.getTime() + (6 - dayOfWeek) * 86400000).toISOString().split("T")[0]
        return { start, end }
    }

    if (s === "next_week") {
        const dayOfWeek = localNow.getDay()
        const weekStart = new Date(localNow.getTime() - dayOfWeek * 86400000).getTime()
        const start = new Date(weekStart + 7 * 86400000).toISOString().split("T")[0]
        const end = new Date(weekStart + 13 * 86400000).toISOString().split("T")[0]
        return { start, end }
    }

    if (s === "this_month") {
        const start = new Date(localNow.getFullYear(), localNow.getMonth(), 1).toISOString().split("T")[0]
        const end = new Date(localNow.getFullYear(), localNow.getMonth() + 1, 0).toISOString().split("T")[0]
        return { start, end }
    }

    return null
}

// ─── Apply an action to a known entity ID (used after disambiguation) ─────────
async function executeActionById(
    pending: GeminiResult,
    targetId: string,
    entityType: "task" | "project",
    supabase: ReturnType<typeof createClient>,
    userId: string,
    userLocalNow: string = new Date().toISOString(),
    timezoneOffsetMinutes: number = 0
): Promise<string> {
    const resolveTypeId = async (typeName: string): Promise<string | null> => {
        if (!typeName) return null
        const { data } = await supabase.from("task_types").select("id").eq("user_id", userId).eq("status", "Active").ilike("name", `%${typeName}%`).limit(1)
        return data?.[0]?.id || null
    }

    if (entityType === "task") {
        if (pending.action === "link_task_project") {
            const projectName = pending.linking?.project_name || ""
            const { data: proj } = await supabase.from("projects").select("id").eq("user_id", userId).ilike("name", `%${projectName}%`).limit(1)
            if (!proj?.[0]) throw new Error(`Project "${projectName}" not found.`)
            const { error } = await supabase.from("tasks").update({ project_id: proj[0].id, updated_at: new Date().toISOString() }).eq("id", targetId)
            if (error) throw new Error(`Failed to link task: ${error.message}`)
            return pending.summary || "Task linked to project."
        }
        // update_task
        const t = pending.task || {}
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (t.title?.trim()) updates.title = t.title.trim()
        if (t.description !== undefined) updates.description = t.description || null
        if (t.due_at) {
            let finalDueAt = t.due_at
            // Convert due_at from local to UTC if it includes a time component
            if (finalDueAt.includes("T")) {
                try {
                    const parsed = new Date(finalDueAt)
                    // LLM outputs local time → server JS parses no-TZ string as UTC.
                    // True UTC = parsed-as-UTC + timezoneOffsetMinutes (negative for UTC+ zones).
                    const utcDate = new Date(parsed.getTime() + timezoneOffsetMinutes * 60000)
                    finalDueAt = utcDate.toISOString()
                } catch {
                    // If parsing fails, use as-is
                }
            }
            updates.due_at = finalDueAt
        }
        if (t.priority && ["Low", "Medium", "High", "Urgent"].includes(t.priority)) updates.priority = t.priority
        if (t.status && ["To Do", "In Progress", "Done", "Cancelled"].includes(t.status)) {
            updates.status = t.status
            if (t.status === "Done") updates.completed_at = new Date().toISOString()
        }
        if (t.type_name) { const tid = await resolveTypeId(t.type_name); if (tid) updates.type_id = tid }
        const { error } = await supabase.from("tasks").update(updates).eq("id", targetId)
        if (error) throw new Error(`Failed to update task: ${error.message}`)
        return pending.summary || "Task updated successfully."
    }

    if (entityType === "project") {
        const p = pending.project || {}
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (p.name?.trim()) updates.name = p.name.trim()
        if (p.description !== undefined) updates.description = p.description || null
        if (p.status && ["Active", "On Hold", "Completed", "Archived"].includes(p.status)) updates.status = p.status
        if (p.target_end_date) updates.target_end_date = p.target_end_date
        if (p.start_date) updates.start_date = p.start_date
        if (p.type_name) { const tid = await resolveTypeId(p.type_name); if (tid) updates.type_id = tid }
        const { error } = await supabase.from("projects").update(updates).eq("id", targetId)
        if (error) throw new Error(`Failed to update project: ${error.message}`)
        return pending.summary || "Project updated successfully."
    }

    throw new Error("Unknown entity type")
}

// ─── DB action executor ────────────────────────────────────────────────────────
async function executeAction(
    result: GeminiResult,
    supabase: ReturnType<typeof createClient>,
    userId: string,
    userLocalNow: string = new Date().toISOString(),
    timezoneOffsetMinutes: number = 0
): Promise<ActionResult> {
    const { action } = result

    const resolveTypeId = async (typeName: string): Promise<string | null> => {
        if (!typeName) return null
        const { data } = await supabase.from("task_types").select("id, name").eq("user_id", userId).eq("status", "Active").ilike("name", `%${typeName}%`).limit(1)
        return data?.[0]?.id || null
    }

    const resolveProjectId = async (projectName: string): Promise<string | null> => {
        if (!projectName) return null
        const { data } = await supabase.from("projects").select("id, name").eq("user_id", userId).ilike("name", `%${projectName}%`).limit(1)
        return data?.[0]?.id || null
    }

    // ── create_task ──────────────────────────────────────────────────────────────
    if (action === "create_task") {
        const t = result.task || {}
        if (!t.title?.trim()) throw new Error("Task title is required")

        const typeId = await resolveTypeId(t.type_name || "")
        let projectId: string | null = null
        const projectName = result.linking?.project_name || ""
        if (projectName) {
            projectId = await resolveProjectId(projectName)
            if (!projectId) {
                const projTypeId = await resolveTypeId("")
                const { data: newProj, error: projErr } = await supabase.from("projects").insert({
                    user_id: userId, name: projectName, type_id: projTypeId, status: "Active",
                }).select("id").single()
                if (!projErr && newProj) projectId = newProj.id
            }
        }

        const validPriority = ["Low", "Medium", "High", "Urgent"].includes(t.priority || "") ? t.priority : "Medium"
        const validStatus = ["To Do", "In Progress", "Done", "Cancelled"].includes(t.status || "") ? t.status : "To Do"

        // Convert due_at from local to UTC if it includes a time component
        let finalDueAt = t.due_at || null
        if (finalDueAt && finalDueAt.includes("T")) {
            // Has time component - needs timezone conversion
            try {
                const parsed = new Date(finalDueAt)
                // LLM outputs local time → server JS parses no-TZ string as UTC.
                // True UTC = parsed-as-UTC + timezoneOffsetMinutes (negative for UTC+ zones).
                const utcDate = new Date(parsed.getTime() + timezoneOffsetMinutes * 60000)
                finalDueAt = utcDate.toISOString()
            } catch {
                // If parsing fails, use as-is
            }
        }

        const { error } = await supabase.from("tasks").insert({
            user_id: userId, title: t.title.trim(), description: t.description || null,
            type_id: typeId, project_id: projectId, due_at: finalDueAt,
            priority: validPriority, status: validStatus,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        })
        if (error) throw new Error(`Failed to create task: ${error.message}`)
        return { type: "done", summary: result.summary || `Task "${t.title}" created successfully.` }
    }

    // ── create_project ───────────────────────────────────────────────────────────
    if (action === "create_project") {
        const p = result.project || {}
        if (!p.name?.trim()) throw new Error("Project name is required")

        const typeId = await resolveTypeId(p.type_name || "")
        const resolvedTypeId = typeId || (await (async () => {
            const { data } = await supabase.from("task_types").select("id").eq("user_id", userId).eq("status", "Active").limit(1)
            return data?.[0]?.id || null
        })())
        if (!resolvedTypeId) throw new Error("Please create at least one Task Type before creating a project.")

        const validStatus = ["Active", "On Hold", "Completed", "Archived"].includes(p.status || "") ? p.status : "Active"
        const { error } = await supabase.from("projects").insert({
            user_id: userId, name: p.name.trim(), description: p.description || null,
            type_id: resolvedTypeId, status: validStatus,
            start_date: p.start_date || null, target_end_date: p.target_end_date || null,
            created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        })
        if (error) throw new Error(`Failed to create project: ${error.message}`)
        return { type: "done", summary: result.summary || `Project "${p.name}" created successfully.` }
    }

    // ── update_task ──────────────────────────────────────────────────────────────
    if (action === "update_task") {
        const searchTitle = result.update_filter?.task_title || result.task?.title || ""
        const dueDate = result.update_filter?.due_date || ""
        if (!searchTitle && !dueDate) throw new Error("Please specify which task to update.")

        let query = supabase.from("tasks")
            .select("id, title, due_at, priority, status")
            .eq("user_id", userId)
            .neq("status", "Cancelled")
        if (searchTitle) query = query.ilike("title", `%${searchTitle}%`)
        if (dueDate) {
            const targetDate = parseDueDate(dueDate, userLocalNow, timezoneOffsetMinutes)
            if (targetDate) query = query.gte("due_at", `${targetDate}T00:00:00.000Z`).lte("due_at", `${targetDate}T23:59:59.999Z`)
        }

        const { data: found } = await query.limit(5)

        // If no tasks found, ask for clarification instead of erroring
        if (!found?.length) {
            // Get tasks from nearby dates to suggest alternatives
            const todayStr = new Date(userLocalNow).toISOString().split("T")[0]
            const { data: todayTasks } = await supabase.from("tasks")
                .select("id, title, due_at, priority, status")
                .eq("user_id", userId).neq("status", "Cancelled")
                .gte("due_at", `${todayStr}T00:00:00.000Z`)
                .lte("due_at", `${todayStr}T23:59:59.999Z`).limit(5)

            const suggests: ClarifyOption[] = (todayTasks || []).map(t => ({
                id: t.id,
                label: t.title,
                extra: [t.priority, t.status, t.due_at ? "today" : ""].filter(Boolean).join(" · "),
            }))

            const msg = dueDate
                ? `I didn't find any tasks due on ${dueDate}. ${suggests.length > 0 ? "Did you mean one of these tasks from today?" : "Do you have a specific task in mind?"}`
                : `I didn't find any tasks matching "${searchTitle}". Please describe which task you want to update.`

            return {
                type: "clarify",
                entityType: "task",
                options: suggests.length > 0 ? suggests : [{ id: "cancel", label: "Cancel – I'll be more specific", extra: "" }],
                pendingAction: { ...result, summary: msg },
            }
        }

        if (found.length > 1) {
            return {
                type: "clarify",
                entityType: "task",
                options: found.map(t => ({
                    id: t.id,
                    label: t.title,
                    extra: [t.priority, t.status, t.due_at ? new Date(t.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""].filter(Boolean).join(" · "),
                })),
                pendingAction: result,
            }
        }

        const summary = await executeActionById(result, found[0].id, "task", supabase, userId, userLocalNow, timezoneOffsetMinutes)
        return { type: "done", summary }
    }

    // ── update_project ───────────────────────────────────────────────────────────
    if (action === "update_project") {
        const searchName = result.update_filter?.project_name || result.project?.name || ""
        if (!searchName) throw new Error("Please specify which project to update.")

        const { data: found } = await supabase
            .from("projects").select("id, name, status, target_end_date")
            .eq("user_id", userId).ilike("name", `%${searchName}%`).limit(5)

        // If no projects found, ask for clarification instead of erroring
        if (!found?.length) {
            // Get all active projects to suggest
            const { data: allProjects } = await supabase
                .from("projects").select("id, name, status, target_end_date")
                .eq("user_id", userId).in("status", ["Active", "On Hold"]).limit(5)

            const suggests: ClarifyOption[] = (allProjects || []).map(p => ({
                id: p.id,
                label: p.name,
                extra: [p.status, p.target_end_date ? `ends ${new Date(p.target_end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""].filter(Boolean).join(" · "),
            }))

            return {
                type: "clarify",
                entityType: "project",
                options: suggests.length > 0 ? suggests : [{ id: "none", label: "No projects found – create a new one?", extra: "" }],
                pendingAction: { ...result, summary: suggests.length > 0 ? `Did you mean one of these projects?` : `I didn't find any matching project. Check the name or spell it differently.` },
            }
        }

        if (found.length > 1) {
            return {
                type: "clarify",
                entityType: "project",
                options: found.map(p => ({
                    id: p.id,
                    label: p.name,
                    extra: [p.status, p.target_end_date ? `ends ${new Date(p.target_end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""].filter(Boolean).join(" · "),
                })),
                pendingAction: result,
            }
        }

        const summary = await executeActionById(result, found[0].id, "project", supabase, userId, userLocalNow, timezoneOffsetMinutes)
        return { type: "done", summary }
    }

    // ── link_task_project ────────────────────────────────────────────────────────
    if (action === "link_task_project") {
        const taskTitle = result.linking?.task_title || result.update_filter?.task_title || ""
        const projectName = result.linking?.project_name || result.update_filter?.project_name || ""
        if (!taskTitle || !projectName) throw new Error("Specify both the task title and project name to link.")

        const { data: taskRows } = await supabase
            .from("tasks").select("id, title, priority, status").eq("user_id", userId).ilike("title", `%${taskTitle}%`).limit(5)
        if (!taskRows?.length) throw new Error(`Task matching "${taskTitle}" not found.`)

        if (taskRows.length > 1) {
            return {
                type: "clarify",
                entityType: "task",
                options: taskRows.map(t => ({
                    id: t.id,
                    label: t.title,
                    extra: [t.priority, t.status].filter(Boolean).join(" · "),
                })),
                pendingAction: result,
            }
        }

        const projectId = await resolveProjectId(projectName)
        if (!projectId) throw new Error(`Project matching "${projectName}" not found.`)
        const { error } = await supabase.from("tasks").update({ project_id: projectId, updated_at: new Date().toISOString() }).eq("id", taskRows[0].id)
        if (error) throw new Error(`Failed to link task: ${error.message}`)
        return { type: "done", summary: result.summary || `Task "${taskTitle}" linked to project "${projectName}".` }
    }

    // ── query_tasks ──────────────────────────────────────────────────────────────
    if (action === "query_tasks") {
        const qf = result.query_filter || {}
        const dueDateStr = qf.due_date || ""
        const rangeStr = qf.date_range || ""
        const status = qf.status || "All"
        const priority = qf.priority || "All"

        let query = supabase.from("tasks").select("id, title, due_at, priority, status, type_id").eq("user_id", userId)

        // Apply date filters
        if (dueDateStr) {
            const targetDate = parseDueDate(dueDateStr, userLocalNow, timezoneOffsetMinutes)
            if (targetDate) {
                query = query.gte("due_at", `${targetDate}T00:00:00.000Z`).lte("due_at", `${targetDate}T23:59:59.999Z`)
            }
        } else if (rangeStr) {
            const range = getDateRange(rangeStr, userLocalNow, timezoneOffsetMinutes)
            if (range && "overdue" in range && range.overdue) {
                query = query.lt("due_at", new Date(userLocalNow).toISOString()).neq("status", "Done")
            } else if (range && "start" in range) {
                query = query.gte("due_at", `${range.start}T00:00:00.000Z`).lte("due_at", `${range.end}T23:59:59.999Z`)
            }
        }

        // Apply status filter
        if (status !== "All") {
            query = query.eq("status", status)
        }

        // Apply priority filter
        if (priority !== "All") {
            query = query.eq("priority", priority)
        }

        const { data: tasks } = await query.order("due_at", { ascending: true }).limit(50)

        if (!tasks || tasks.length === 0) {
            return { type: "done", summary: `No tasks found for ${dueDateStr || rangeStr || "your search"}.` }
        }

        // Format task list with clickable items
        const taskList = tasks.map((t, i) => {
            const dueDate = t.due_at ? new Date(t.due_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "No due date"
            const badge = `[${t.status}] • ${t.priority} • ${dueDate}`
            return `${i + 1}. ${t.title}\n   ${badge}`
        }).join("\n\n")

        return {
            type: "done",
            summary: `Found ${tasks.length} task${tasks.length > 1 ? "s" : ""}:\n\n${taskList}`,
            items: tasks.map(t => {
                let dueDateStr = "No due date"
                if (t.due_at) {
                    const date = new Date(t.due_at)
                    const dateStr = date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
                    })
                    const timeStr = date.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true
                    })
                    dueDateStr = `${dateStr} — ${timeStr}`
                }
                return {
                    type: "task",
                    id: t.id,
                    title: t.title,
                    meta: `${t.status} • ${t.priority} • ${dueDateStr}`
                }
            })
        }
    }

    // ── query_projects ───────────────────────────────────────────────────────────
    if (action === "query_projects") {
        const qf = result.query_filter || {}
        const status = qf.status || "All"

        let query = supabase.from("projects").select("id, name, status, target_end_date, created_at").eq("user_id", userId)

        if (status !== "All") {
            query = query.eq("status", status)
        } else {
            query = query.in("status", ["Active", "On Hold", "Completed", "Archived"])
        }

        const { data: projects } = await query.order("created_at", { ascending: false }).limit(50)

        if (!projects || projects.length === 0) {
            return { type: "done", summary: `No projects found${status !== "All" ? ` with status "${status}"` : ""}.` }
        }

        const projList = projects.map((p, i) => {
            const endDate = p.target_end_date ? new Date(p.target_end_date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No end date"
            return `${i + 1}. ${p.name}\n   [${p.status}] • ends ${endDate}`
        }).join("\n\n")

        return {
            type: "done",
            summary: `Found ${projects.length} project${projects.length > 1 ? "s" : ""}:\n\n${projList}`,
            items: projects.map(p => {
                let endDateStr = "No end date"
                if (p.target_end_date) {
                    const date = new Date(p.target_end_date)
                    endDateStr = date.toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined
                    })
                }
                return {
                    type: "project",
                    id: p.id,
                    title: p.name,
                    meta: `${p.status} • ${endDateStr}`
                }
            })
        }
    }

    // ── none / fallback ──────────────────────────────────────────────────────────
    return { type: "done", summary: result.summary || "I couldn't determine an action to take. Please try rephrasing." }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: cors })

    try {
        const authHeader = req.headers.get("Authorization")
        if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } })

        // Build authenticated Supabase client (respects RLS)
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
        )

        // Verify user
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } })

        const body = await req.json()
        const encryptionSecret = Deno.env.get("AI_ENCRYPTION_KEY")
        if (!encryptionSecret) throw new Error("Server misconfiguration: AI_ENCRYPTION_KEY not set")

        // ── Save key ───────────────────────────────────────────────────────────────
        if (body.type === "save_key") {
            const rawKey = (body.key || "").trim()
            if (!rawKey) return new Response(JSON.stringify({ error: "API key cannot be empty" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })
            if (!rawKey.startsWith("gsk_")) return new Response(JSON.stringify({ error: "That doesn't look like a valid Groq API key (should start with gsk_)" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })

            // Quick connectivity test before saving (list models — zero quota cost)
            const testRes = await fetch(
                "https://api.groq.com/openai/v1/models",
                { headers: { "Authorization": `Bearer ${rawKey}` } }
            )
            if (!testRes.ok) {
                const errData = await testRes.json().catch(() => ({}))
                const msg = errData?.error?.message || `Groq returned status ${testRes.status}`
                return new Response(JSON.stringify({ error: `Invalid API key: ${msg}` }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })
            }

            const { ciphertext, iv } = await encryptKey(rawKey, encryptionSecret)
            const { error: upsertErr } = await supabase
                .from("user_ai_settings")
                .upsert({ user_id: user.id, encrypted_gemini_key: ciphertext, key_iv: iv, updated_at: new Date().toISOString() }, { onConflict: "user_id" })

            if (upsertErr) throw new Error(upsertErr.message)
            return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } })
        }

        // ── Delete key ─────────────────────────────────────────────────────────────
        if (body.type === "delete_key") {
            await supabase.from("user_ai_settings").delete().eq("user_id", user.id)
            return new Response(JSON.stringify({ success: true }), { headers: { ...cors, "Content-Type": "application/json" } })
        }

        // ── Clarify resolve ────────────────────────────────────────────────────────
        if (body.type === "clarify_resolve") {
            const { selection, entity_type, options, pending_action, userLocalNow: uln, timezoneOffsetMinutes: tzOffset } = body as {
                selection: string; entity_type: "task" | "project"
                options: ClarifyOption[]; pending_action: GeminiResult; userLocalNow?: string; timezoneOffsetMinutes?: number
            }
            const userLocalNow = (uln || new Date().toISOString()).toString()
            const timezoneOffsetMinutes = tzOffset || 0
            if (!selection || !entity_type || !options?.length || !pending_action) {
                return new Response(JSON.stringify({ error: "Invalid clarification data" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })
            }

            const selTrimmed = (selection || "").trim()
            let targetId: string | null = null
            const num = parseInt(selTrimmed)
            if (!isNaN(num) && num >= 1 && num <= options.length) {
                targetId = options[num - 1].id
            } else {
                const lower = selTrimmed.toLowerCase()
                const match = options.find(o => o.label.toLowerCase().includes(lower))
                targetId = match?.id || null
            }

            if (!targetId) {
                return new Response(JSON.stringify({
                    error: `Couldn't match "${selTrimmed}". Reply with a number (1–${options.length}) or part of the name.`,
                    action: "clarify_error",
                }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })
            }

            const summary = await executeActionById(pending_action, targetId, entity_type, supabase, user.id, userLocalNow, timezoneOffsetMinutes)
            return new Response(JSON.stringify({
                success: true,
                action: pending_action.action,
                summary,
            }), { headers: { ...cors, "Content-Type": "application/json" } })
        }

        // ── Chat ───────────────────────────────────────────────────────────────────
        if (body.type === "chat") {
            const userMessage = (body.message || "").trim()
            const userLocalNow = (body.userLocalNow || new Date().toISOString()).toString()
            const timezoneOffsetMinutes = body.timezoneOffsetMinutes || 0
            if (!userMessage) return new Response(JSON.stringify({ error: "Message cannot be empty" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })

            const { data: aiSettings } = await supabase
                .from("user_ai_settings")
                .select("encrypted_gemini_key, key_iv")
                .eq("user_id", user.id)
                .single()

            if (!aiSettings?.encrypted_gemini_key) {
                return new Response(JSON.stringify({ error: "No Groq API key found. Please add your API key first." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })
            }

            const groqKey = await decryptKey(aiSettings.encrypted_gemini_key, aiSettings.key_iv, encryptionSecret)

            const [{ data: taskTypes }, { data: projects }] = await Promise.all([
                supabase.from("task_types").select("id, name").eq("user_id", user.id).eq("status", "Active"),
                supabase.from("projects").select("id, name").eq("user_id", user.id).in("status", ["Active", "On Hold"]),
            ])

            let groqResult: GeminiResult
            try {
                groqResult = await callGroq(userMessage, groqKey, taskTypes || [], projects || [], userLocalNow)
            } catch (firstErr) {
                try {
                    groqResult = await callGroq(userMessage, groqKey, taskTypes || [], projects || [], userLocalNow)
                } catch { throw firstErr }
            }

            const actionResult = await executeAction(groqResult, supabase, user.id, userLocalNow, timezoneOffsetMinutes)

            if (actionResult.type === "clarify") {
                const optionLines = actionResult.options.map((o, i) => `${i + 1}. ${o.label}${o.extra ? ` (${o.extra})` : ""}`).join("\n")
                const entityLabel = actionResult.entityType === "task" ? "tasks" : "projects"
                return new Response(JSON.stringify({
                    success: true,
                    action: "clarify",
                    summary: `I found ${actionResult.options.length} ${entityLabel} that could match. Which one did you mean?\n\n${optionLines}`,
                    clarify: {
                        entityType: actionResult.entityType,
                        options: actionResult.options,
                        pendingAction: actionResult.pendingAction,
                    },
                }), { headers: { ...cors, "Content-Type": "application/json" } })
            }

            return new Response(JSON.stringify({
                success: true,
                action: groqResult.action,
                summary: actionResult.summary,
                items: actionResult.items || undefined,
                details: {
                    task: groqResult.action.includes("task") ? groqResult.task : undefined,
                    project: groqResult.action.includes("project") ? groqResult.project : undefined,
                },
            }), { headers: { ...cors, "Content-Type": "application/json" } })
        }

        return new Response(JSON.stringify({ error: "Unknown request type" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })

    } catch (err) {
        console.error("[ai-assistant]", err)
        return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } })
    }
})
