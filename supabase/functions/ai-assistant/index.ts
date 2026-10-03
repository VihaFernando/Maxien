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

// ─── Agent: the model reads and changes the user's data through tools ─────────
const GROQ_MODEL = "openai/gpt-oss-120b"
const MAX_AGENT_STEPS = 8
const MAX_ROWS = 60

const TASK_STATUSES = ["To Do", "In Progress", "Done", "Cancelled"]
const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"]
const PROJECT_STATUSES = ["Active", "On Hold", "Completed", "Archived"]

type Db = ReturnType<typeof createClient>
type Args = Record<string, unknown>
interface ChatItem { type: "task" | "project"; id: string; title: string; meta: string }
interface AgentCtx {
    supabase: Db
    userId: string
    now: Date
    /** Minutes to ADD to a local wall-clock time to get UTC (JS getTimezoneOffset). */
    tz: number
    touched: Map<string, ChatItem>
    listed: ChatItem[]
    actions: Set<string>
}
interface ChatTurn { role: "user" | "assistant"; content: string }

// The model works in the user's local wall-clock time ("YYYY-MM-DD" or "YYYY-MM-DDTHH:mm").
function localToUtcIso(value: unknown, tz: number, endOfDay = true): string | null {
    if (typeof value !== "string" || !value.trim()) return null
    const m = value.trim().match(/^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2}))?/)
    if (!m) return null
    const time = m[2] ? `${m[2]}:${m[3]}` : (endOfDay ? "23:59" : "00:00")
    const asUtc = Date.parse(`${m[1]}T${time}:00Z`)
    if (Number.isNaN(asUtc)) return null
    return new Date(asUtc + tz * 60000).toISOString()
}

function utcToLocal(iso: string | null | undefined, tz: number): string | null {
    if (!iso) return null
    const t = Date.parse(iso)
    if (Number.isNaN(t)) return null
    return new Date(t - tz * 60000).toISOString().slice(0, 16)
}

const strList = (v: unknown, allowed?: string[]): string[] => {
    const arr = Array.isArray(v) ? v : (typeof v === "string" && v ? [v] : [])
    const out = arr.filter((x): x is string => typeof x === "string" && x.trim() !== "").map(x => x.trim())
    return allowed ? out.filter(x => allowed.includes(x)) : out
}
const idList = (v: unknown): string[] => strList(v).filter(x => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 200)
const likeSafe = (v: string) => v.replace(/[%_,()]/g, " ").trim()

const taskItem = (t: Record<string, any>, tz: number): ChatItem => ({
    type: "task", id: t.id, title: t.title,
    meta: [t.status, t.priority, t.due_at ? utcToLocal(t.due_at, tz)!.replace("T", " ") : "No due date"].filter(Boolean).join(" • "),
})
const projectItem = (p: Record<string, any>): ChatItem => ({
    type: "project", id: p.id, title: p.name,
    meta: [p.status, p.target_end_date ? `ends ${p.target_end_date}` : "No end date"].filter(Boolean).join(" • "),
})

const TASK_COLS = "id, title, description, status, priority, due_at, project_id, type_id"
const PROJECT_COLS = "id, name, description, status, start_date, target_end_date, type_id"

const taskForModel = (t: Record<string, any>, tz: number) => ({
    id: t.id, title: t.title, status: t.status, priority: t.priority,
    due: utcToLocal(t.due_at, tz), project_id: t.project_id || null, type_id: t.type_id || null,
    ...(t.description ? { description: String(t.description).slice(0, 200) } : {}),
})

async function defaultTypeId(ctx: AgentCtx): Promise<string | null> {
    const { data } = await ctx.supabase.from("task_types").select("id").eq("user_id", ctx.userId).eq("status", "Active").order("created_at", { ascending: true }).limit(1)
    return data?.[0]?.id || null
}

function taskChanges(c: Args, ctx: AgentCtx): Record<string, unknown> {
    const u: Record<string, unknown> = {}
    if (typeof c.title === "string" && c.title.trim()) u.title = c.title.trim()
    if (typeof c.description === "string") u.description = c.description.trim() || null
    if (typeof c.priority === "string" && TASK_PRIORITIES.includes(c.priority)) u.priority = c.priority
    if (typeof c.status === "string" && TASK_STATUSES.includes(c.status)) {
        u.status = c.status
        u.completed_at = c.status === "Done" ? ctx.now.toISOString() : null
    }
    if (c.due === null || c.due === "") u.due_at = null
    else if (c.due !== undefined) { const d = localToUtcIso(c.due, ctx.tz); if (d) u.due_at = d }
    if (c.project_id === null || c.project_id === "") u.project_id = null
    else if (typeof c.project_id === "string") u.project_id = c.project_id
    if (typeof c.type_id === "string" && c.type_id) u.type_id = c.type_id
    return u
}

function projectChanges(c: Args): Record<string, unknown> {
    const u: Record<string, unknown> = {}
    if (typeof c.name === "string" && c.name.trim()) u.name = c.name.trim()
    if (typeof c.description === "string") u.description = c.description.trim() || null
    if (typeof c.status === "string" && PROJECT_STATUSES.includes(c.status)) u.status = c.status
    for (const k of ["start_date", "target_end_date"]) {
        if (c[k] === null || c[k] === "") u[k] = null
        else if (typeof c[k] === "string" && /^\d{4}-\d{2}-\d{2}/.test(c[k] as string)) u[k] = (c[k] as string).slice(0, 10)
    }
    if (typeof c.type_id === "string" && c.type_id) u.type_id = c.type_id
    return u
}

const textToHtml = (text: string) =>
    text.split(/\n+/).map(l => `<p>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`).join("")
const htmlToText = (html: string) => html.replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim()

// ── Tool implementations ──────────────────────────────────────────────────────
const TOOL_HANDLERS: Record<string, (a: Args, ctx: AgentCtx) => Promise<unknown>> = {
    async find_tasks(a, ctx) {
        let q = ctx.supabase.from("tasks").select(TASK_COLS).eq("user_id", ctx.userId).is("workplace_id", null)
        if (typeof a.text === "string" && likeSafe(a.text)) {
            const s = likeSafe(a.text)
            q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%`)
        }
        const statuses = strList(a.status, TASK_STATUSES)
        if (statuses.length) q = q.in("status", statuses)
        const priorities = strList(a.priority, TASK_PRIORITIES)
        if (priorities.length) q = q.in("priority", priorities)
        if (a.overdue === true) {
            // Same rule the dashboard uses: past its due time and still open.
            q = q.lt("due_at", ctx.now.toISOString()).not("status", "in", '("Done","Cancelled")')
        }
        const from = localToUtcIso(a.due_from, ctx.tz, false)
        const to = localToUtcIso(a.due_to, ctx.tz, true)
        if (from) q = q.gte("due_at", from)
        if (to) q = q.lte("due_at", to)
        if (a.has_due_date === true) q = q.not("due_at", "is", null)
        if (a.has_due_date === false) q = q.is("due_at", null)
        if (a.no_project === true) q = q.is("project_id", null)
        else if (typeof a.project_id === "string" && a.project_id) q = q.eq("project_id", a.project_id)
        if (typeof a.type_id === "string" && a.type_id) q = q.eq("type_id", a.type_id)

        const { data, error } = await q.order("due_at", { ascending: true, nullsFirst: false }).limit(MAX_ROWS)
        if (error) throw new Error(error.message)
        const rows = data || []
        ctx.listed = rows.map(t => taskItem(t, ctx.tz))
        return { count: rows.length, truncated: rows.length === MAX_ROWS, tasks: rows.map(t => taskForModel(t, ctx.tz)) }
    },

    async create_tasks(a, ctx) {
        const list = Array.isArray(a.tasks) ? (a.tasks as Args[]).slice(0, 25) : []
        if (!list.length) throw new Error("Provide at least one task.")
        const fallbackType = await defaultTypeId(ctx)
        const nowIso = ctx.now.toISOString()
        const rows = list.map(t => {
            if (typeof t.title !== "string" || !t.title.trim()) throw new Error("Every task needs a title.")
            const c = taskChanges(t, ctx)
            return {
                user_id: ctx.userId, title: c.title, description: c.description ?? null,
                type_id: c.type_id ?? fallbackType, project_id: c.project_id ?? null, due_at: c.due_at ?? null,
                priority: c.priority ?? "Medium", status: c.status ?? "To Do",
                ...(c.status === "Done" ? { completed_at: nowIso } : {}),
                created_at: nowIso, updated_at: nowIso,
            }
        })
        const { data, error } = await ctx.supabase.from("tasks").insert(rows).select(TASK_COLS)
        if (error) throw new Error(error.message)
        for (const t of data || []) ctx.touched.set(t.id, taskItem(t, ctx.tz))
        ctx.actions.add("create_task")
        return { created: (data || []).map(t => taskForModel(t, ctx.tz)) }
    },

    async update_tasks(a, ctx) {
        const ids = idList(a.ids)
        if (!ids.length) throw new Error("Provide the ids of the tasks to change (get them from find_tasks).")
        const updates = taskChanges((a.changes || {}) as Args, ctx)
        if (!Object.keys(updates).length) throw new Error("No valid changes given.")
        updates.updated_at = ctx.now.toISOString()
        const { data, error } = await ctx.supabase.from("tasks").update(updates).eq("user_id", ctx.userId).in("id", ids).select(TASK_COLS)
        if (error) throw new Error(error.message)
        for (const t of data || []) ctx.touched.set(t.id, taskItem(t, ctx.tz))
        ctx.actions.add("update_task")
        return { updated_count: (data || []).length, requested: ids.length, titles: (data || []).map(t => t.title) }
    },

    async delete_tasks(a, ctx) {
        const ids = idList(a.ids)
        if (!ids.length) throw new Error("Provide the ids of the tasks to delete.")
        const { data, error } = await ctx.supabase.from("tasks").delete().eq("user_id", ctx.userId).in("id", ids).select("id, title")
        if (error) throw new Error(error.message)
        ctx.actions.add("delete")
        return { deleted_count: (data || []).length, titles: (data || []).map(t => t.title) }
    },

    async find_projects(a, ctx) {
        let q = ctx.supabase.from("projects").select(PROJECT_COLS).eq("user_id", ctx.userId)
        if (typeof a.text === "string" && likeSafe(a.text)) {
            const s = likeSafe(a.text)
            q = q.or(`name.ilike.%${s}%,description.ilike.%${s}%`)
        }
        const statuses = strList(a.status, PROJECT_STATUSES)
        if (statuses.length) q = q.in("status", statuses)
        const { data, error } = await q.order("created_at", { ascending: false }).limit(MAX_ROWS)
        if (error) throw new Error(error.message)
        const rows = data || []
        ctx.listed = rows.map(projectItem)
        return { count: rows.length, projects: rows.map(p => ({ ...p, description: p.description ? String(p.description).slice(0, 200) : null })) }
    },

    async create_project(a, ctx) {
        const c = projectChanges(a)
        if (!c.name) throw new Error("A project needs a name.")
        const typeId = c.type_id ?? await defaultTypeId(ctx)
        if (!typeId) throw new Error("The user has no task types yet; create one with create_task_type first.")
        const nowIso = ctx.now.toISOString()
        const { data, error } = await ctx.supabase.from("projects").insert({
            user_id: ctx.userId, name: c.name, description: c.description ?? null, type_id: typeId,
            status: c.status ?? "Active", start_date: c.start_date ?? null, target_end_date: c.target_end_date ?? null,
            created_at: nowIso, updated_at: nowIso,
        }).select(PROJECT_COLS).single()
        if (error) throw new Error(error.message)
        ctx.touched.set(data.id, projectItem(data))
        ctx.actions.add("create_project")
        return { created: data }
    },

    async update_projects(a, ctx) {
        const ids = idList(a.ids)
        if (!ids.length) throw new Error("Provide the ids of the projects to change (get them from find_projects).")
        const updates = projectChanges((a.changes || {}) as Args)
        if (!Object.keys(updates).length) throw new Error("No valid changes given.")
        updates.updated_at = ctx.now.toISOString()
        const { data, error } = await ctx.supabase.from("projects").update(updates).eq("user_id", ctx.userId).in("id", ids).select(PROJECT_COLS)
        if (error) throw new Error(error.message)
        for (const p of data || []) ctx.touched.set(p.id, projectItem(p))
        ctx.actions.add("update_project")
        return { updated_count: (data || []).length, requested: ids.length, names: (data || []).map(p => p.name) }
    },

    async delete_projects(a, ctx) {
        const ids = idList(a.ids)
        if (!ids.length) throw new Error("Provide the ids of the projects to delete.")
        const { data, error } = await ctx.supabase.from("projects").delete().eq("user_id", ctx.userId).in("id", ids).select("id, name")
        if (error) throw new Error(error.message)
        ctx.actions.add("delete")
        return { deleted_count: (data || []).length, names: (data || []).map(p => p.name) }
    },

    async list_task_types(_a, ctx) {
        const { data, error } = await ctx.supabase.from("task_types").select("id, name, description, color, status").eq("user_id", ctx.userId).order("created_at", { ascending: true })
        if (error) throw new Error(error.message)
        return { task_types: data || [] }
    },

    async create_task_type(a, ctx) {
        if (typeof a.name !== "string" || !a.name.trim()) throw new Error("A task type needs a name.")
        const color = typeof a.color === "string" && /^#[0-9a-f]{6}$/i.test(a.color) ? a.color : "#c6ff00"
        const { data, error } = await ctx.supabase.from("task_types").insert({
            user_id: ctx.userId, name: a.name.trim(), description: typeof a.description === "string" ? a.description.trim() || null : null, color, status: "Active",
        }).select("id, name").single()
        if (error) throw new Error(error.message)
        ctx.actions.add("other")
        return { created: data }
    },

    async find_notes(a, ctx) {
        let q = ctx.supabase.from("notes").select("id, title, content_html, updated_at").eq("user_id", ctx.userId)
        if (typeof a.text === "string" && likeSafe(a.text)) {
            const s = likeSafe(a.text)
            q = q.or(`title.ilike.%${s}%,content_html.ilike.%${s}%`)
        }
        const { data, error } = await q.order("updated_at", { ascending: false }).limit(30)
        if (error) throw new Error(error.message)
        return { count: (data || []).length, notes: (data || []).map(n => ({ id: n.id, title: n.title, updated: utcToLocal(n.updated_at, ctx.tz), text: htmlToText(n.content_html || "").slice(0, 400) })) }
    },

    async save_note(a, ctx) {
        const nowIso = ctx.now.toISOString()
        const fields: Record<string, unknown> = { updated_at: nowIso }
        if (typeof a.title === "string") fields.title = a.title.trim() || null
        if (typeof a.content === "string") fields.content_html = textToHtml(a.content)
        if (typeof a.id === "string" && a.id) {
            const { data, error } = await ctx.supabase.from("notes").update(fields).eq("user_id", ctx.userId).eq("id", a.id).select("id, title")
            if (error) throw new Error(error.message)
            if (!data?.length) throw new Error("No note with that id.")
            ctx.actions.add("other")
            return { updated: data[0] }
        }
        if (fields.content_html === undefined && !fields.title) throw new Error("A new note needs a title or content.")
        const { data, error } = await ctx.supabase.from("notes").insert({ user_id: ctx.userId, title: fields.title ?? null, content_html: fields.content_html ?? "<p></p>", created_at: nowIso, updated_at: nowIso }).select("id, title").single()
        if (error) throw new Error(error.message)
        ctx.actions.add("other")
        return { created: data }
    },

    async delete_notes(a, ctx) {
        const ids = idList(a.ids)
        if (!ids.length) throw new Error("Provide the ids of the notes to delete.")
        const { data, error } = await ctx.supabase.from("notes").delete().eq("user_id", ctx.userId).in("id", ids).select("id, title")
        if (error) throw new Error(error.message)
        ctx.actions.add("delete")
        return { deleted_count: (data || []).length }
    },

    async list_subscriptions(_a, ctx) {
        const { data, error } = await ctx.supabase.from("subscriptions").select("id, name, amount, currency, renewal_date").eq("user_id", ctx.userId).order("renewal_date", { ascending: true })
        if (error) throw new Error(error.message)
        return { count: (data || []).length, note: "renewal_date repeats monthly on that day of the month", subscriptions: data || [] }
    },

    async save_subscription(a, ctx) {
        const fields: Record<string, unknown> = { updated_at: ctx.now.toISOString() }
        if (typeof a.name === "string" && a.name.trim()) fields.name = a.name.trim()
        if (a.amount !== undefined && Number.isFinite(Number(a.amount)) && Number(a.amount) >= 0) fields.amount = Number(a.amount)
        if (typeof a.currency === "string" && /^[A-Za-z]{3}$/.test(a.currency)) fields.currency = a.currency.toUpperCase()
        if (typeof a.renewal_date === "string" && /^\d{4}-\d{2}-\d{2}/.test(a.renewal_date)) fields.renewal_date = a.renewal_date.slice(0, 10)
        if (typeof a.id === "string" && a.id) {
            const { data, error } = await ctx.supabase.from("subscriptions").update(fields).eq("user_id", ctx.userId).eq("id", a.id).select("id, name, amount, currency, renewal_date")
            if (error) throw new Error(error.message)
            if (!data?.length) throw new Error("No subscription with that id.")
            ctx.actions.add("other")
            return { updated: data[0] }
        }
        if (!fields.name || fields.amount === undefined || !fields.renewal_date) throw new Error("A new subscription needs name, amount and renewal_date.")
        const { data, error } = await ctx.supabase.from("subscriptions").insert({ user_id: ctx.userId, currency: "LKR", ...fields }).select("id, name, amount, currency, renewal_date").single()
        if (error) throw new Error(error.message)
        ctx.actions.add("other")
        return { created: data }
    },

    async delete_subscriptions(a, ctx) {
        const ids = idList(a.ids)
        if (!ids.length) throw new Error("Provide the ids of the subscriptions to delete.")
        const { data, error } = await ctx.supabase.from("subscriptions").delete().eq("user_id", ctx.userId).in("id", ids).select("id, name")
        if (error) throw new Error(error.message)
        ctx.actions.add("delete")
        return { deleted_count: (data || []).length, names: (data || []).map(s => s.name) }
    },
}

// ── Tool schemas sent to the model ────────────────────────────────────────────
const S = { type: "string" }
const fn = (name: string, description: string, properties: Record<string, unknown>, required: string[] = []) =>
    ({ type: "function", function: { name, description, parameters: { type: "object", properties, required } } })
const IDS = { type: "array", items: S, description: "Exact ids returned by a find/list tool. Never invent ids." }
const DUE = { type: "string", description: "User-local 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm'. Empty string clears it." }
const TASK_FIELDS = {
    title: S, description: S, due: DUE,
    priority: { type: "string", enum: TASK_PRIORITIES }, status: { type: "string", enum: TASK_STATUSES },
    type_id: S, project_id: { type: "string", description: "Project id. Empty string removes the task from its project." },
}
const PROJECT_FIELDS = {
    name: S, description: S, status: { type: "string", enum: PROJECT_STATUSES }, type_id: S,
    start_date: { type: "string", description: "YYYY-MM-DD. Empty string clears it." }, target_end_date: { type: "string", description: "YYYY-MM-DD. Empty string clears it." },
}

const TOOLS = [
    fn("find_tasks", "Search the user's tasks. All filters are optional and combine with AND; no filters returns everything. Use this before changing or deleting tasks and to answer questions.", {
        text: { type: "string", description: "Words to look for in the title or description." },
        status: { type: "array", items: { type: "string", enum: TASK_STATUSES } },
        priority: { type: "array", items: { type: "string", enum: TASK_PRIORITIES } },
        overdue: { type: "boolean", description: "true = due time has passed and the task is not Done or Cancelled." },
        due_from: { type: "string", description: "Due on/after this user-local date or datetime." },
        due_to: { type: "string", description: "Due on/before this user-local date or datetime (a bare date means end of that day)." },
        has_due_date: { type: "boolean" },
        project_id: { type: "string", description: "Only tasks in this project." },
        no_project: { type: "boolean", description: "true = only tasks that are in no project." },
        type_id: S,
    }),
    fn("create_tasks", "Create one or more tasks.", { tasks: { type: "array", items: { type: "object", properties: TASK_FIELDS, required: ["title"] } } }, ["tasks"]),
    fn("update_tasks", "Apply the same changes to one or many tasks at once (status, priority, due, title, project, type...).", { ids: IDS, changes: { type: "object", properties: TASK_FIELDS } }, ["ids", "changes"]),
    fn("delete_tasks", "Permanently delete tasks.", { ids: IDS }, ["ids"]),
    fn("find_projects", "Search the user's projects. No filters returns all.", { text: S, status: { type: "array", items: { type: "string", enum: PROJECT_STATUSES } } }),
    fn("create_project", "Create a project.", PROJECT_FIELDS, ["name"]),
    fn("update_projects", "Apply the same changes to one or many projects.", { ids: IDS, changes: { type: "object", properties: PROJECT_FIELDS } }, ["ids", "changes"]),
    fn("delete_projects", "Permanently delete projects.", { ids: IDS }, ["ids"]),
    fn("list_task_types", "List the user's task types (categories).", {}),
    fn("create_task_type", "Create a task type (category).", { name: S, description: S, color: { type: "string", description: "Hex colour like #3b82f6" } }, ["name"]),
    fn("find_notes", "Search the user's notes; no text returns the most recent.", { text: S }),
    fn("save_note", "Create a note, or update one when id is given. content is plain text.", { id: S, title: S, content: S }),
    fn("delete_notes", "Permanently delete notes.", { ids: IDS }, ["ids"]),
    fn("list_subscriptions", "List the user's recurring subscriptions.", {}),
    fn("save_subscription", "Create a subscription, or update one when id is given.", { id: S, name: S, amount: { type: "number" }, currency: { type: "string", description: "3-letter code, e.g. LKR, USD" }, renewal_date: { type: "string", description: "YYYY-MM-DD" } }),
    fn("delete_subscriptions", "Permanently delete subscriptions.", { ids: IDS }, ["ids"]),
]

function buildSystemPrompt(ctx: AgentCtx, taskTypes: { id: string; name: string }[], projects: { id: string; name: string; status: string }[]): string {
    const local = new Date(ctx.now.getTime() - ctx.tz * 60000)
    const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][local.getUTCDay()]
    return `You are the assistant built into Maxien, a personal productivity app. You act on the user's own data (tasks, projects, task types, notes, subscriptions) by calling tools.

User's local date and time right now: ${local.toISOString().slice(0, 16)} (${weekday}). All dates you send or receive are in this local time.

Task types: ${taskTypes.length ? taskTypes.map(t => `${t.name} [${t.id}]`).join("; ") : "(none)"}
Projects: ${projects.length ? projects.map(p => `${p.name} (${p.status}) [${p.id}]`).join("; ") : "(none)"}

How to work:
- Understand what the user means however they phrase it, then do it. Do not require special wording.
- Look things up with the find/list tools before changing them. Never guess or invent ids, and never say something was done unless a tool call confirmed it.
- "all", "every", "these", "my overdue tasks" and similar mean every matching item: find them with the right filters, then change them all in ONE update call with all their ids. Do not ask the user to pick one.
- Use precise filters. "Overdue" is find_tasks with overdue=true, not all unfinished tasks. "Pending" or "open" means status To Do or In Progress. "Today" is due_from and due_to on today's date.
- Only ask a short question when the request truly cannot be resolved, for example a name that matches several different items and the user clearly meant one. If there is one sensible reading, act on it.
- Deleting is permanent. Delete only when the user asked to delete or remove. If a delete would remove more than 5 items and the user did not clearly say all of them, ask for confirmation first.
- Earlier turns of the conversation are provided; use them to resolve follow-ups like "yes", "the second one", or "do the same for tomorrow".
- You cannot change finance records, workouts, calendar events or workplace data. Say so plainly if asked.

Replying:
- Plain text, short. Say exactly what you did with real counts and names from the tool results, or answer the question.
- When listing items, use a short numbered list. No tables, no markdown headings.`
}

async function groqChat(apiKey: string, messages: unknown[]): Promise<Record<string, any>> {
    let lastErr = ""
    for (let attempt = 0; attempt < 2; attempt++) {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
            body: JSON.stringify({
                model: GROQ_MODEL,
                messages,
                tools: TOOLS,
                tool_choice: "auto",
                temperature: 0.2,
                reasoning_effort: "medium",
                include_reasoning: false,
                max_completion_tokens: 4096,
            }),
        })
        if (res.ok) {
            const data = await res.json()
            const msg = data?.choices?.[0]?.message
            if (msg) return msg
            lastErr = "Groq returned an empty response"
            continue
        }
        lastErr = `Groq API error (${res.status}): ${await res.text()}`
        // Only a malformed tool call (400) or a server hiccup is worth one retry.
        if (res.status !== 400 && res.status < 500) break
    }
    throw new Error(lastErr)
}

async function runAgent(
    apiKey: string,
    userMessage: string,
    history: ChatTurn[],
    ctx: AgentCtx,
    taskTypes: { id: string; name: string }[],
    projects: { id: string; name: string; status: string }[],
): Promise<{ summary: string; action: string; items?: ChatItem[] }> {
    const messages: unknown[] = [
        { role: "system", content: buildSystemPrompt(ctx, taskTypes, projects) },
        ...history,
        { role: "user", content: userMessage },
    ]

    let summary = ""
    for (let step = 0; step < MAX_AGENT_STEPS; step++) {
        const msg = await groqChat(apiKey, messages)
        const calls: any[] = Array.isArray(msg.tool_calls) ? msg.tool_calls : []
        if (!calls.length) { summary = (msg.content || "").trim(); break }

        messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls })
        for (const call of calls) {
            let result: unknown
            try {
                const handler = TOOL_HANDLERS[call.function?.name]
                if (!handler) throw new Error(`Unknown tool "${call.function?.name}".`)
                const args = call.function?.arguments ? JSON.parse(call.function.arguments) : {}
                result = await handler(args || {}, ctx)
            } catch (err) {
                // Hand the failure back so the model can correct itself or tell the user.
                result = { error: err instanceof Error ? err.message : String(err) }
            }
            messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) })
        }
    }

    if (!summary) {
        summary = ctx.actions.size
            ? "I made the changes shown below, but ran out of steps before I could finish. Please check the result and tell me what is left."
            : "I couldn't finish working that out. Please try again or rephrase."
    }

    // Badge shown in the chat: only when the turn did one clear kind of change.
    const badgeable = ["create_task", "update_task", "create_project", "update_project"]
    const action = ctx.actions.size === 1 && badgeable.includes([...ctx.actions][0]) ? [...ctx.actions][0] : "none"
    const items = ctx.touched.size ? [...ctx.touched.values()] : ctx.listed
    return { summary, action, items: items.length ? items.slice(0, 30) : undefined }
}

// ─── Legacy single-intent shape (still used to resolve an already-open "pick one" prompt) ──
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
interface ClarifyOption { id: string; label: string; extra: string }

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

            // Quick connectivity test before saving (list models  zero quota cost)
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
            if (!userMessage) return new Response(JSON.stringify({ error: "Message cannot be empty" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })

            const parsedNow = new Date((body.userLocalNow || "").toString())
            const now = Number.isNaN(parsedNow.getTime()) ? new Date() : parsedNow
            const tz = Number.isFinite(Number(body.timezoneOffsetMinutes)) ? Number(body.timezoneOffsetMinutes) : 0

            // Recent turns let the model handle follow-ups ("yes", "the second one", "same for tomorrow").
            const history: ChatTurn[] = (Array.isArray(body.history) ? body.history : [])
                .filter((h: any) => h && (h.role === "user" || h.role === "assistant") && typeof h.content === "string" && h.content.trim())
                .slice(-12)
                .map((h: any) => ({ role: h.role, content: h.content.slice(0, 2000) }))

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
                supabase.from("projects").select("id, name, status").eq("user_id", user.id).in("status", ["Active", "On Hold"]).limit(60),
            ])

            const ctx: AgentCtx = { supabase, userId: user.id, now, tz, touched: new Map(), listed: [], actions: new Set() }
            const result = await runAgent(groqKey, userMessage, history, ctx, taskTypes || [], projects || [])

            return new Response(JSON.stringify({
                success: true,
                action: result.action,
                summary: result.summary,
                items: result.items,
            }), { headers: { ...cors, "Content-Type": "application/json" } })
        }

        return new Response(JSON.stringify({ error: "Unknown request type" }), { status: 400, headers: { ...cors, "Content-Type": "application/json" } })

    } catch (err) {
        console.error("[ai-assistant]", err)
        return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } })
    }
})
