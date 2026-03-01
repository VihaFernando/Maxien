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
    action: "create_task" | "create_project" | "update_task" | "update_project" | "link_task_project" | "none"
    summary: string
    task?: {
        title?: string; description?: string; due_at?: string
        priority?: string; status?: string; type_name?: string
    }
    project?: {
        name?: string; description?: string; status?: string
        type_name?: string; target_end_date?: string; start_date?: string
    }
    update_filter?: { task_title?: string; project_name?: string }
    linking?: { task_title?: string; project_name?: string }
}

async function callGroq(
    userMessage: string,
    apiKey: string,
    taskTypes: { id: string; name: string }[],
    projects: { id: string; name: string }[]
): Promise<GeminiResult> {
    const now = new Date().toISOString()

    const systemPrompt = `You are an AI assistant for Maxien, a productivity app.
Current date/time (UTC): ${now}

Available task types (use exact name when possible):
${taskTypes.length > 0 ? taskTypes.map(t => `- "${t.name}"`).join("\n") : "- (none created yet)"}

Available projects:
${projects.length > 0 ? projects.map(p => `- "${p.name}"`).join("\n") : "- (none created yet)"}

You MUST respond with ONLY a valid JSON object matching this exact schema. No other text.

{
  "action": "create_task" | "create_project" | "update_task" | "update_project" | "link_task_project" | "none",
  "summary": "Human-readable confirmation or response (1-2 sentences)",
  "task": {
    "title": "string (required for task actions)",
    "description": "string or empty",
    "due_at": "ISO 8601 datetime string or empty (compute from relative phrases like 'tomorrow')",
    "priority": "Low" | "Medium" | "High" | "Urgent" (default Medium),
    "status": "To Do" | "In Progress" | "Done" | "Cancelled" (default To Do),
    "type_name": "string matching an available task type name, or empty"
  },
  "project": {
    "name": "string (required for project actions)",
    "description": "string or empty",
    "status": "Active" | "On Hold" | "Completed" | "Archived" (default Active),
    "type_name": "string matching an available task type, or empty",
    "target_end_date": "YYYY-MM-DD or empty",
    "start_date": "YYYY-MM-DD or empty"
  },
  "update_filter": {
    "task_title": "partial title to find the task to update",
    "project_name": "partial name to find the project to update"
  },
  "linking": {
    "task_title": "title of the task to link (for link_task_project or when creating a task under a project)",
    "project_name": "name of the project to link to"
  }
}

RULES:
- If user says "create task X under project Y": set action="create_task", fill task fields, set linking.project_name="Y"
- For update actions, put search text in update_filter
- For "link task X to project Y": set action="link_task_project"
- Resolve relative dates like "tomorrow", "next week" using current date
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

// ─── DB action executor ────────────────────────────────────────────────────────
async function executeAction(
    result: GeminiResult,
    supabase: ReturnType<typeof createClient>,
    userId: string
): Promise<string> {
    const { action } = result

    // Helper: resolve type_id from name
    const resolveTypeId = async (typeName: string): Promise<string | null> => {
        if (!typeName) return null
        const { data } = await supabase
            .from("task_types")
            .select("id, name")
            .eq("user_id", userId)
            .eq("status", "Active")
            .ilike("name", `%${typeName}%`)
            .limit(1)
        return data?.[0]?.id || null
    }

    // Helper: resolve project_id from name
    const resolveProjectId = async (projectName: string): Promise<string | null> => {
        if (!projectName) return null
        const { data } = await supabase
            .from("projects")
            .select("id, name")
            .eq("user_id", userId)
            .ilike("name", `%${projectName}%`)
            .limit(1)
        return data?.[0]?.id || null
    }

    // ── create_task ──────────────────────────────────────────────────────────────
    if (action === "create_task") {
        const t = result.task || {}
        if (!t.title?.trim()) throw new Error("Task title is required")

        const typeId = await resolveTypeId(t.type_name || "")
        let projectId: string | null = null

        // Link to project if specified in linking OR task has a project reference
        const projectName = result.linking?.project_name || ""
        if (projectName) {
            projectId = await resolveProjectId(projectName)
            if (!projectId) {
                // Auto-create the project with minimal info
                const projTypeId = await resolveTypeId("")
                const { data: newProj, error: projErr } = await supabase
                    .from("projects")
                    .insert({
                        user_id: userId,
                        name: projectName,
                        type_id: projTypeId,
                        status: "Active",
                    })
                    .select("id")
                    .single()
                if (!projErr && newProj) projectId = newProj.id
            }
        }

        const validPriority = ["Low", "Medium", "High", "Urgent"].includes(t.priority || "")
            ? t.priority : "Medium"
        const validStatus = ["To Do", "In Progress", "Done", "Cancelled"].includes(t.status || "")
            ? t.status : "To Do"

        const { error } = await supabase.from("tasks").insert({
            user_id: userId,
            title: t.title.trim(),
            description: t.description || null,
            type_id: typeId,
            project_id: projectId,
            due_at: t.due_at || null,
            priority: validPriority,
            status: validStatus,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })

        if (error) throw new Error(`Failed to create task: ${error.message}`)
        return result.summary || `Task "${t.title}" created successfully.`
    }

    // ── create_project ───────────────────────────────────────────────────────────
    if (action === "create_project") {
        const p = result.project || {}
        if (!p.name?.trim()) throw new Error("Project name is required")

        const typeId = await resolveTypeId(p.type_name || "")
        if (!typeId) {
            // Need at least one task type - get any active one
            const { data: anyType } = await supabase
                .from("task_types")
                .select("id")
                .eq("user_id", userId)
                .eq("status", "Active")
                .limit(1)
            if (!anyType?.[0]) throw new Error("Please create at least one Task Type before creating a project.")
        }

        const resolvedTypeId = typeId || (await (async () => {
            const { data } = await supabase.from("task_types").select("id").eq("user_id", userId).eq("status", "Active").limit(1)
            return data?.[0]?.id || null
        })())

        if (!resolvedTypeId) throw new Error("Please create at least one Task Type before creating a project.")

        const validStatus = ["Active", "On Hold", "Completed", "Archived"].includes(p.status || "")
            ? p.status : "Active"

        const { error } = await supabase.from("projects").insert({
            user_id: userId,
            name: p.name.trim(),
            description: p.description || null,
            type_id: resolvedTypeId,
            status: validStatus,
            start_date: p.start_date || null,
            target_end_date: p.target_end_date || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })

        if (error) throw new Error(`Failed to create project: ${error.message}`)
        return result.summary || `Project "${p.name}" created successfully.`
    }

    // ── update_task ──────────────────────────────────────────────────────────────
    if (action === "update_task") {
        const searchTitle = result.update_filter?.task_title || result.task?.title || ""
        if (!searchTitle) throw new Error("Please specify which task to update.")

        const { data: found } = await supabase
            .from("tasks")
            .select("id")
            .eq("user_id", userId)
            .ilike("title", `%${searchTitle}%`)
            .limit(1)

        if (!found?.[0]) throw new Error(`Task matching "${searchTitle}" not found.`)

        const t = result.task || {}
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

        if (t.title?.trim()) updates.title = t.title.trim()
        if (t.description !== undefined) updates.description = t.description || null
        if (t.due_at) updates.due_at = t.due_at
        if (t.priority && ["Low", "Medium", "High", "Urgent"].includes(t.priority)) updates.priority = t.priority
        if (t.status && ["To Do", "In Progress", "Done", "Cancelled"].includes(t.status)) {
            updates.status = t.status
            if (t.status === "Done") updates.completed_at = new Date().toISOString()
        }
        if (t.type_name) {
            const typeId = await resolveTypeId(t.type_name)
            if (typeId) updates.type_id = typeId
        }

        const { error } = await supabase.from("tasks").update(updates).eq("id", found[0].id)
        if (error) throw new Error(`Failed to update task: ${error.message}`)
        return result.summary || `Task "${searchTitle}" updated.`
    }

    // ── update_project ───────────────────────────────────────────────────────────
    if (action === "update_project") {
        const searchName = result.update_filter?.project_name || result.project?.name || ""
        if (!searchName) throw new Error("Please specify which project to update.")

        const { data: found } = await supabase
            .from("projects")
            .select("id")
            .eq("user_id", userId)
            .ilike("name", `%${searchName}%`)
            .limit(1)

        if (!found?.[0]) throw new Error(`Project matching "${searchName}" not found.`)

        const p = result.project || {}
        const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }

        if (p.name?.trim()) updates.name = p.name.trim()
        if (p.description !== undefined) updates.description = p.description || null
        if (p.status && ["Active", "On Hold", "Completed", "Archived"].includes(p.status)) updates.status = p.status
        if (p.target_end_date) updates.target_end_date = p.target_end_date
        if (p.start_date) updates.start_date = p.start_date
        if (p.type_name) {
            const typeId = await resolveTypeId(p.type_name)
            if (typeId) updates.type_id = typeId
        }

        const { error } = await supabase.from("projects").update(updates).eq("id", found[0].id)
        if (error) throw new Error(`Failed to update project: ${error.message}`)
        return result.summary || `Project "${searchName}" updated.`
    }

    // ── link_task_project ────────────────────────────────────────────────────────
    if (action === "link_task_project") {
        const taskTitle = result.linking?.task_title || result.update_filter?.task_title || ""
        const projectName = result.linking?.project_name || result.update_filter?.project_name || ""

        if (!taskTitle || !projectName) throw new Error("Specify both the task title and project name to link.")

        const { data: taskRow } = await supabase
            .from("tasks").select("id").eq("user_id", userId).ilike("title", `%${taskTitle}%`).limit(1)
        if (!taskRow?.[0]) throw new Error(`Task matching "${taskTitle}" not found.`)

        const projectId = await resolveProjectId(projectName)
        if (!projectId) throw new Error(`Project matching "${projectName}" not found.`)

        const { error } = await supabase
            .from("tasks").update({ project_id: projectId, updated_at: new Date().toISOString() }).eq("id", taskRow[0].id)
        if (error) throw new Error(`Failed to link task: ${error.message}`)
        return result.summary || `Task "${taskTitle}" linked to project "${projectName}".`
    }

    // ── none / fallback ──────────────────────────────────────────────────────────
    return result.summary || "I couldn't determine an action to take. Please try rephrasing."
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

        // ── Chat ───────────────────────────────────────────────────────────────────
        if (body.type === "chat") {
            const userMessage = (body.message || "").trim()
            if (!userMessage) return new Response(JSON.stringify({ error: "Message cannot be empty" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })

            // Fetch encrypted key
            const { data: aiSettings } = await supabase
                .from("user_ai_settings")
                .select("encrypted_gemini_key, key_iv")
                .eq("user_id", user.id)
                .single()

            if (!aiSettings?.encrypted_gemini_key) {
                return new Response(JSON.stringify({ error: "No Groq API key found. Please add your API key first." }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })
            }

            const groqKey = await decryptKey(aiSettings.encrypted_gemini_key, aiSettings.key_iv, encryptionSecret)

            // Fetch context for Groq (task types + projects)
            const [{ data: taskTypes }, { data: projects }] = await Promise.all([
                supabase.from("task_types").select("id, name").eq("user_id", user.id).eq("status", "Active"),
                supabase.from("projects").select("id, name").eq("user_id", user.id).in("status", ["Active", "On Hold"]),
            ])

            // Call Groq (with one retry on JSON parse failure)
            let geminiResult: GeminiResult
            try {
                geminiResult = await callGroq(userMessage, groqKey, taskTypes || [], projects || [])
            } catch (firstErr) {
                // Retry once
                try {
                    geminiResult = await callGroq(userMessage, groqKey, taskTypes || [], projects || [])
                } catch {
                    throw firstErr
                }
            }

            // Execute the action
            const summaryMessage = await executeAction(geminiResult, supabase, user.id)

            return new Response(JSON.stringify({
                success: true,
                action: geminiResult.action,
                summary: summaryMessage,
                details: {
                    task: geminiResult.action.includes("task") ? geminiResult.task : undefined,
                    project: geminiResult.action.includes("project") ? geminiResult.project : undefined,
                },
            }), { headers: { ...cors, "Content-Type": "application/json" } })
        }

        return new Response(JSON.stringify({ error: "Unknown request type" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })

    } catch (err) {
        console.error("[ai-assistant]", err)
        return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } })
    }
})
