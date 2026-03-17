import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
}

type Json = Record<string, unknown>

const json = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  })

const requireEnv = (key: string) => {
  const v = Deno.env.get(key)
  if (!v) throw new Error(`Missing required env var: ${key}`)
  return v
}

async function findUserIdByEmail(admin: ReturnType<typeof createClient>, email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  const perPage = 200
  const maxPages = 10

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`Auth admin listUsers failed: ${error.message}`)

    const users = data?.users || []
    const match = users.find((u) => (u.email || "").toLowerCase() === normalized)
    if (match?.id) return match.id

    if (users.length < perPage) break
  }

  return null
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors })
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405)

  try {
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) return json({ error: "Unauthorized" }, 401)

    const supabaseUrl = requireEnv("SUPABASE_URL")
    const anonKey = requireEnv("SUPABASE_ANON_KEY")
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY")

    const authed = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const admin = createClient(supabaseUrl, serviceRoleKey)

    const { data: { user }, error: authErr } = await authed.auth.getUser()
    if (authErr || !user) return json({ error: "Unauthorized" }, 401)

    const body = await req.json().catch(() => ({}))
    const workplace_id = typeof body?.workplace_id === "string" ? body.workplace_id : ""
    const email = typeof body?.email === "string" ? body.email : ""

    if (!workplace_id) return json({ error: "workplace_id is required" }, 400)
    if (!email || !email.includes("@")) return json({ error: "email is required" }, 400)

    // Authorize: only workplace owner can invite
    const { data: workplace, error: wErr } = await admin
      .from("workplaces")
      .select("id, owner_id")
      .eq("id", workplace_id)
      .maybeSingle()

    if (wErr) return json({ error: wErr.message }, 400)
    if (!workplace) return json({ error: "Workplace not found" }, 404)
    if (workplace.owner_id !== user.id) return json({ error: "Forbidden" }, 403)

    const inviteeId = await findUserIdByEmail(admin, email)
    if (!inviteeId) return json({ error: "No registered user found for that email" }, 404)
    if (inviteeId === user.id) return json({ error: "You are already the owner" }, 400)

    // If already exists, handle states idempotently
    const { data: existing, error: mErr } = await admin
      .from("workplace_members")
      .select("id, status, role, user_id")
      .eq("workplace_id", workplace_id)
      .eq("user_id", inviteeId)
      .maybeSingle()

    if (mErr) return json({ error: mErr.message }, 400)

    if (existing?.status === "accepted") {
      return json({ ok: true, status: "accepted", message: "User is already a member." })
    }

    if (existing?.id) {
      const { error: upErr } = await admin
        .from("workplace_members")
        .update({ status: "pending", role: existing.role === "owner" ? "owner" : "member" })
        .eq("id", existing.id)

      if (upErr) return json({ error: upErr.message }, 400)
      return json({ ok: true, status: "pending", message: "Invitation updated." })
    }

    const { error: insErr } = await admin
      .from("workplace_members")
      .insert([{ workplace_id, user_id: inviteeId, status: "pending", role: "member" }])

    if (insErr) return json({ error: insErr.message }, 400)

    return json({ ok: true, status: "pending", message: "Invitation sent." })
  } catch (err) {
    console.error("[workplace-invite]", err)
    return json({ error: err instanceof Error ? err.message : "Internal server error" }, 500)
  }
})

