import { useState, useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"

// ─── Icons ────────────────────────────────────────────────────────────────────
const SparkleIcon = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
        <path d="M19 15l1.12 3.38L23.5 19.5l-3.38 1.12L19 24l-1.12-3.38L14.5 19.5l3.38-1.12L19 15z" opacity=".6" />
        <path d="M5 2l.84 2.52L8.5 5.5 5.84 6.34 5 8.86 4.16 6.34 1.5 5.5l2.66-.84L5 2z" opacity=".5" />
    </svg>
)

const SendIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
)

const KeyIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
)

const TrashIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
)

// ─── Action badge colours ─────────────────────────────────────────────────────
const ACTION_STYLES = {
    create_task: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100", label: "Task Created" },
    create_project: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-100", label: "Project Created" },
    update_task: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100", label: "Task Updated" },
    update_project: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-100", label: "Project Updated" },
    link_task_project: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100", label: "Task Linked" },
    none: { bg: "bg-[#f5f5f7]", text: "text-[#86868b]", border: "border-[#e5e5ea]", label: "No Action" },
    clarify: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-100", label: "Select One" },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTime(date) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

const EXAMPLE_PROMPTS = [
    "Create a high priority task \"Finish dashboard UI\" due tomorrow 6pm",
    "Create a project called \"Website Redesign\" with status Active",
    "Create a task \"Write tests\" under project \"Website Redesign\"",
    "Mark the task \"Finish dashboard UI\" as Done",
    "Update project \"Website Redesign\" status to On Hold",
]

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ msg }) {
    const navigate = useNavigate()
    const isUser = msg.role === "user"
    const isLoading = msg.status === "loading"

    const handleItemClick = (item) => {
        if (item.type === "task") {
            navigate(`/dashboard/tasks?task=${item.id}`)
        } else if (item.type === "project") {
            navigate(`/dashboard/projects?project=${item.id}`)
        }
    }

    const getStatusColor = (status) => {
        switch (status?.split("•")[0]?.trim()?.toLowerCase()) {
            case "to do": return "bg-gray-100 text-gray-700"
            case "in progress": return "bg-blue-100 text-blue-700"
            case "done": return "bg-green-100 text-green-700"
            case "active": return "bg-blue-100 text-blue-700"
            case "on hold": return "bg-amber-100 text-amber-700"
            case "paused": return "bg-amber-100 text-amber-700"
            case "completed": return "bg-green-100 text-green-700"
            default: return "bg-gray-100 text-gray-700"
        }
    }

    // Filter content: show only summary when items exist (remove detailed list)
    const getDisplayContent = () => {
        if (!msg.items || msg.items.length === 0) return msg.content

        // Extract only the summary part (before numbered/bulleted list)
        const lines = msg.content.split('\n')
        const summaryLines = []

        for (const line of lines) {
            // Stop at numbered list items (1., 2., 3., etc) or bullet points
            if (/^\d+\.|^[-•*]\s/.test(line.trim())) break
            summaryLines.push(line)
        }

        return summaryLines.join('\n').trim() || msg.content
    }

    return (
        <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"} items-start`}>
            {/* Avatar */}
            {!isUser && (
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#C6FF00] to-[#a8db00] flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                    <SparkleIcon className="w-3.5 h-3.5 text-[#1d1d1f]" />
                </div>
            )}

            <div className={`flex flex-col gap-2 max-w-[85%] sm:max-w-[72%] ${isUser ? "items-end" : "items-start"}`}>
                {/* Bubble */}
                <div className={`px-4 py-3 rounded-[18px] ${isUser
                    ? "bg-[#1d1d1f] text-white rounded-br-[6px]"
                    : "bg-white border border-[#e5e5ea] text-[#1d1d1f] rounded-bl-[6px] shadow-sm"
                    }`}>
                    {isLoading ? (
                        <div className="flex items-center gap-1.5 px-1 py-0.5">
                            {[0, 150, 300].map(d => (
                                <span key={d} className="w-2 h-2 rounded-full bg-[#C6FF00] animate-bounce" style={{ animationDelay: `${d}ms` }}></span>
                            ))}
                        </div>
                    ) : (
                        <p className={`text-[13px] sm:text-[14px] leading-relaxed whitespace-pre-wrap ${isUser ? "text-white" : "text-[#1d1d1f]"}`}>
                            {getDisplayContent()}
                        </p>
                    )}
                </div>

                {/* Items grid (tasks/projects) */}
                {!isLoading && msg.items && msg.items.length > 0 && (
                    <div className={`grid grid-cols-1 gap-2 w-full ${msg.items.length > 1 ? "sm:grid-cols-2 lg:grid-cols-3" : ""}`}>
                        {msg.items.map((item) => (
                            <button
                                key={`${item.type}-${item.id}`}
                                onClick={() => handleItemClick(item)}
                                className={`flex flex-col gap-1.5 p-3 rounded-[12px] border text-left transition-colors hover:bg-opacity-100 active:scale-95 ${item.type === "task"
                                    ? "bg-blue-50 border-blue-100 hover:bg-blue-75"
                                    : "bg-violet-50 border-violet-100 hover:bg-violet-75"
                                    }`}
                            >
                                <p className="font-semibold text-[13px] text-[#1d1d1f] line-clamp-2">
                                    {item.title}
                                </p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${getStatusColor(item.meta)}`}>
                                        {item.meta.split("•")[0]?.trim()}
                                    </span>
                                    <span className="text-[11px] text-[#86868b]">
                                        {item.meta.split("•").slice(1).join("•").trim()}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Action badge */}
                {!isLoading && msg.action && msg.action !== "none" && msg.action !== "error" && (
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${ACTION_STYLES[msg.action]?.bg || "bg-[#f5f5f7]"} ${ACTION_STYLES[msg.action]?.text || "text-[#86868b]"} ${ACTION_STYLES[msg.action]?.border || "border-[#e5e5ea]"}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
                        {ACTION_STYLES[msg.action]?.label || msg.action}
                    </div>
                )}

                {/* Error badge */}
                {msg.status === "error" && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border bg-red-50 text-red-600 border-red-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                        Error
                    </div>
                )}

                {/* Timestamp */}
                <p className="text-[10px] text-[#86868b] px-1">{formatTime(msg.ts)}</p>
            </div>
        </div>
    )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AIAssistant() {
    const { user } = useAuth()

    // Key management
    const [hasKey, setHasKey] = useState(null)   // null = checking
    const [showSettings, setShowSettings] = useState(false)
    const [keyInput, setKeyInput] = useState("")
    const [keyLoading, setKeyLoading] = useState(false)
    const [keyError, setKeyError] = useState("")
    const [keySuccess, setKeySuccess] = useState("")

    // Chat
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState("")
    const [sending, setSending] = useState(false)
    const [pendingClarification, setPendingClarification] = useState(null)

    const bottomRef = useRef(null)
    const inputRef = useRef(null)
    const chatRef = useRef(null)

    // ── Check if user has key ──────────────────────────────────────────────────
    useEffect(() => {
        if (!user) return
        supabase
            .from("user_ai_settings")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle()
            .then(({ data }) => {
                setHasKey(!!data)
                if (data) {
                    // Show welcome message
                    setMessages([{
                        id: "welcome",
                        role: "ai",
                        content: "Hey! I'm your AI assistant, powered by Groq. I can help you create tasks, projects, and manage your productivity data using natural language.\n\nTry something like:\n• \"Create a high priority task Finish UI by tomorrow\"\n• \"Create project Website Redesign\"\n• \"Link task X to project Y\"",
                        ts: new Date(),
                        action: null,
                    }])
                }
            })
    }, [user])

    // ── Auto-scroll ────────────────────────────────────────────────────────────
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages])

    // ── Save API key ───────────────────────────────────────────────────────────
    const handleSaveKey = async (e) => {
        e.preventDefault()
        setKeyError("")
        setKeySuccess("")
        if (!keyInput.trim()) { setKeyError("Please enter your Groq API key"); return }

        setKeyLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ type: "save_key", key: keyInput.trim() }),
            })
            const data = await res.json()
            if (!res.ok || data.error) { setKeyError(data.error || "Failed to save key"); return }

            setKeySuccess("API key saved and verified!")
            setKeyInput("")
            setHasKey(true)
            setShowSettings(false)
            // Show welcome message on first setup
            if (!hasKey) {
                setMessages([{
                    id: "welcome",
                    role: "ai",
                    content: "Hey! I'm your AI assistant, powered by Groq. I can help you create tasks, projects, and manage your productivity data using natural language.\n\nTry something like:\n\u2022 \"Create a high priority task Finish UI by tomorrow\"\n\u2022 \"Create project Website Redesign\"\n\u2022 \"Link task X to project Y\"",
                    ts: new Date(),
                    action: null,
                }])
            }
            setTimeout(() => setKeySuccess(""), 3000)
        } catch {
            setKeyError("Network error. Please check your connection.")
        } finally {
            setKeyLoading(false)
        }
    }

    // ── Delete API key ─────────────────────────────────────────────────────────
    const handleDeleteKey = async () => {
        if (!window.confirm("Remove your Groq API key? You won't be able to use AI features until you add a new one.")) return
        setKeyLoading(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ type: "delete_key" }),
            })
            setHasKey(false)
            setMessages([])
            setShowSettings(false)
        } catch {
            setKeyError("Failed to remove key")
        } finally {
            setKeyLoading(false)
        }
    }

    // ── Send message ───────────────────────────────────────────────────────────
    const handleSend = async (messageText) => {
        const text = (messageText || input).trim()
        if (!text || sending) return

        const userMsg = { id: Date.now().toString(), role: "user", content: text, ts: new Date() }
        const loadingMsg = { id: "loading-" + Date.now(), role: "ai", content: "", ts: new Date(), status: "loading" }

        setMessages(prev => [...prev, userMsg, loadingMsg])
        setInput("")
        setSending(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()

            // Get user's current local date/time and timezone offset for AI to use
            const now = new Date()
            const userLocalNow = now.toISOString()
            const timezoneOffsetMinutes = now.getTimezoneOffset() // minutes (positive = behind UTC, negative = ahead)

            // If disambiguation is pending, send clarify_resolve instead of chat
            const reqBody = pendingClarification
                ? {
                    type: "clarify_resolve",
                    selection: text,
                    entity_type: pendingClarification.entityType,
                    options: pendingClarification.options,
                    pending_action: pendingClarification.pendingAction,
                    userLocalNow,
                    timezoneOffsetMinutes,
                }
                : { type: "chat", message: text, userLocalNow, timezoneOffsetMinutes }

            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify(reqBody),
            })
            const data = await res.json()

            if (data.action === "clarify") {
                setPendingClarification({
                    entityType: data.clarify.entityType,
                    options: data.clarify.options,
                    pendingAction: data.clarify.pendingAction,
                })
            } else if (data.action !== "clarify_error") {
                // clarify_error = bad selection, keep pendingClarification so user can retry
                setPendingClarification(null)
            }

            setMessages(prev => prev.filter(m => m.status !== "loading").concat({
                id: "ai-" + Date.now(),
                role: "ai",
                content: data.error || data.summary || "Something went wrong.",
                ts: new Date(),
                action: data.error ? "error" : (data.action || "none"),
                status: data.error ? "error" : "success",
                options: data.clarify?.options || null,
                items: data.items || null,
            }))
        } catch {
            setPendingClarification(null)
            setMessages(prev => prev.filter(m => m.status !== "loading").concat({
                id: "err-" + Date.now(),
                role: "ai",
                content: "Network error. Please check your connection and try again.",
                ts: new Date(),
                action: "error",
                status: "error",
            }))
        } finally {
            setSending(false)
            setTimeout(() => inputRef.current?.focus(), 50)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
    }

    // ── Loading state ──────────────────────────────────────────────────────────
    if (hasKey === null) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="flex flex-col items-center gap-3">
                    <div className="flex gap-1.5">
                        {[0, 150, 300].map(d => (
                            <span key={d} className="w-2.5 h-2.5 rounded-full bg-[#C6FF00] animate-bounce" style={{ animationDelay: `${d}ms` }}></span>
                        ))}
                    </div>
                    <p className="text-[13px] text-[#86868b] font-medium">Loading AI Assistant…</p>
                </div>
            </div>
        )
    }

    return (
        <div className="animate-in fade-in duration-500 h-[calc(100vh-120px)] flex flex-col">

            {/* ── Page header ── */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-4 sm:mb-5 px-0.5 flex-shrink-0">
                <div>
                    <p className="text-[11px] font-semibold text-[#86868b] uppercase tracking-widest mb-0.5">Maxien</p>
                    <h1 className="text-[20px] sm:text-[24px] font-bold text-[#1d1d1f] tracking-tight leading-tight flex items-center gap-2.5">
                        <span className="inline-flex w-7 h-7 rounded-lg bg-gradient-to-br from-[#C6FF00] to-[#a8db00] items-center justify-center flex-shrink-0">
                            <SparkleIcon className="w-4 h-4 text-[#1d1d1f]" />
                        </span>
                        AI Assistant
                    </h1>
                </div>
                {hasKey && (
                    <button
                        onClick={() => setShowSettings(s => !s)}
                        className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-semibold transition-all border ${showSettings
                            ? "bg-[#1d1d1f] text-white border-[#1d1d1f]"
                            : "bg-white text-[#1d1d1f] border-[#d2d2d7] hover:bg-[#f5f5f7]"
                            }`}
                    >
                        <KeyIcon className="w-3.5 h-3.5" />
                        Manage API Key
                    </button>
                )}
            </div>

            {/* ── Settings panel ── */}
            {showSettings && hasKey && (
                <div className="flex-shrink-0 mb-4 bg-white rounded-[20px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden">
                    <div className="px-5 sm:px-6 py-4 border-b border-[#f0f0f0] flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <KeyIcon className="w-3.5 h-3.5 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-[13px] font-bold text-[#1d1d1f]">Groq API Key</h3>
                            <p className="text-[10px] text-[#86868b]">Encrypted and stored securely on our servers</p>
                        </div>
                    </div>
                    <div className="px-5 sm:px-6 py-4">
                        {keyError && (
                            <div className="mb-3 bg-red-50 text-red-600 text-[12px] font-medium px-4 py-2.5 rounded-xl border border-red-100 flex items-center gap-2">
                                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                {keyError}
                            </div>
                        )}
                        {keySuccess && (
                            <div className="mb-3 bg-green-50 text-green-700 text-[12px] font-medium px-4 py-2.5 rounded-xl border border-green-100 flex items-center gap-2">
                                <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                                {keySuccess}
                            </div>
                        )}
                        <form onSubmit={handleSaveKey} className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="password"
                                value={keyInput}
                                onChange={e => setKeyInput(e.target.value)}
                                placeholder="Enter new Groq API key (gsk_...)"
                                autoComplete="off"
                                className="flex-1 px-3.5 py-2.5 text-[13px] bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6FF00]/50 focus:border-[#C6FF00] transition-all placeholder:text-[#86868b]"
                            />
                            <div className="flex gap-2">
                                <button
                                    type="submit"
                                    disabled={keyLoading}
                                    className="flex-1 sm:flex-none px-4 py-2.5 bg-[#1d1d1f] hover:bg-black text-white text-[12px] font-semibold rounded-xl transition-all disabled:opacity-50"
                                >
                                    {keyLoading ? "Saving…" : "Update Key"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteKey}
                                    disabled={keyLoading}
                                    className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl transition-colors disabled:opacity-50 border border-red-100"
                                    title="Remove API key"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── No key — Setup state ── */}
            {!hasKey ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-full max-w-lg bg-white rounded-[24px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden">
                        {/* Header */}
                        <div className="bg-gradient-to-br from-[#f0f9d4] via-[#e2f5a0] to-[#f5f5f7] px-6 pt-8 pb-6 flex flex-col items-center gap-4 text-center">
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#C6FF00] to-[#a8db00] flex items-center justify-center shadow-lg">
                                <SparkleIcon className="w-8 h-8 text-[#1d1d1f]" />
                            </div>
                            <div>
                                <h2 className="text-[18px] font-bold text-[#1d1d1f]">Set Up AI Assistant</h2>
                                <p className="text-[13px] text-[#86868b] mt-1.5 max-w-xs mx-auto">
                                    Connect your Groq API key to start managing tasks and projects with natural language.
                                </p>
                            </div>
                        </div>

                        {/* Form */}
                        <div className="px-6 py-6">
                            {/* Instruction steps */}
                            <div className="bg-[#f5f5f7] rounded-xl p-4 mb-5">
                                <p className="text-[11px] font-bold text-[#1d1d1f] uppercase tracking-wider mb-3">How to get your free API key</p>
                                {[
                                    ["1", "Go to", "console.groq.com", "https://console.groq.com"],
                                    ["2", "Sign in or create a free Groq account", null, null],
                                    ["3", "Click", "Get API Key", null],
                                    ["4", "Copy the key and paste it below", null, null],
                                ].map(([n, pre, link, href]) => (
                                    <div key={n} className="flex items-start gap-2.5 mb-2 last:mb-0">
                                        <span className="w-4 h-4 rounded-full bg-[#C6FF00] flex items-center justify-center text-[9px] font-black text-[#1d1d1f] flex-shrink-0 mt-0.5">{n}</span>
                                        <p className="text-[12px] text-[#1d1d1f]">
                                            {pre}{" "}
                                            {link && href && <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-[#0969da] hover:underline">{link}</a>}
                                            {link && !href && <span className="font-semibold">{link}</span>}
                                        </p>
                                    </div>
                                ))}
                            </div>

                            {keyError && (
                                <div className="mb-4 bg-red-50 text-red-600 text-[12px] font-medium px-4 py-3 rounded-xl border border-red-100 flex items-center gap-2">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                    {keyError}
                                </div>
                            )}

                            <form onSubmit={handleSaveKey} className="space-y-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-[#86868b] uppercase tracking-wide mb-1.5">Groq API Key</label>
                                    <input
                                        type="password"
                                        value={keyInput}
                                        onChange={e => setKeyInput(e.target.value)}
                                        placeholder="gsk_..."
                                        autoComplete="off"
                                        className="w-full px-4 py-3 text-[13px] bg-[#f5f5f7] border border-[#e5e5ea] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6FF00]/50 focus:border-[#C6FF00] transition-all placeholder:text-[#86868b]"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={keyLoading}
                                    className="w-full flex items-center justify-center gap-2 bg-[#1d1d1f] hover:bg-black text-white text-[13px] font-semibold py-3 rounded-xl transition-all disabled:opacity-60 active:scale-[0.99]"
                                >
                                    {keyLoading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                            Verifying key…
                                        </>
                                    ) : (
                                        <>
                                            <KeyIcon className="w-4 h-4" />
                                            Connect Groq
                                        </>
                                    )}
                                </button>
                                <p className="text-center text-[11px] text-[#86868b]">
                                    Your key is encrypted with AES-256 and never exposed to the browser.
                                </p>
                            </form>
                        </div>
                    </div>
                </div>
            ) : (
                /* ── Chat interface ── */
                <div className="flex-1 flex flex-col min-h-0 bg-white rounded-[20px] sm:rounded-[24px] border border-[#d2d2d7]/50 shadow-sm overflow-hidden">

                    {/* Chat messages area */}
                    <div ref={chatRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
                        {messages.map(msg => (
                            <MessageBubble
                                key={msg.id}
                                msg={msg}
                                onSelectOption={pendingClarification && msg.options?.length ? (val) => handleSend(val) : null}
                            />
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    {/* Example prompts (shown when only welcome message) */}
                    {messages.length === 1 && (
                        <div className="px-4 sm:px-6 pb-3 flex-shrink-0">
                            <p className="text-[10px] font-semibold text-[#86868b] uppercase tracking-wider mb-2">Try these examples</p>
                            <div className="flex flex-wrap gap-2">
                                {EXAMPLE_PROMPTS.map((p, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(p)}
                                        disabled={sending}
                                        className="text-[11px] font-medium bg-[#f5f5f7] hover:bg-[#ebebed] text-[#1d1d1f] px-3 py-1.5 rounded-full border border-[#e5e5ea] transition-colors disabled:opacity-50 text-left"
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Divider */}
                    <div className="border-t border-[#f0f0f0] flex-shrink-0"></div>

                    {/* Pending clarification banner */}
                    {pendingClarification && (
                        <div className="px-4 sm:px-5 py-2.5 bg-sky-50 border-b border-sky-100 flex items-center gap-2.5 flex-shrink-0">
                            <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse flex-shrink-0"></span>
                            <p className="text-[11px] text-sky-700 font-medium flex-1">
                                Waiting for your selection — type a number or the name
                            </p>
                            <button
                                onClick={() => setPendingClarification(null)}
                                className="text-[10px] text-sky-500 hover:text-sky-700 font-semibold flex-shrink-0"
                            >
                                Cancel
                            </button>
                        </div>
                    )}

                    {/* Input area */}
                    <div className="px-4 sm:px-5 py-3.5 flex-shrink-0">
                        <div className="flex items-end gap-3">
                            <div className="flex-1 relative">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={e => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Create a task, project, or update something… (Enter to send)"
                                    rows={1}
                                    disabled={sending}
                                    className="w-full px-4 py-3 pr-3 text-[13px] bg-[#f5f5f7] border border-[#e5e5ea] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[#C6FF00]/50 focus:border-[#C6FF00] transition-all resize-none placeholder:text-[#86868b] disabled:opacity-60 leading-relaxed"
                                    style={{ maxHeight: "120px", overflowY: "auto" }}
                                    onInput={e => {
                                        e.target.style.height = "auto"
                                        e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"
                                    }}
                                />
                            </div>
                            <button
                                onClick={() => handleSend()}
                                disabled={!input.trim() || sending}
                                className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-[#C6FF00] hover:bg-[#b8f000] text-[#1d1d1f] rounded-[14px] transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.95] shadow-sm mb-0.5"
                            >
                                {sending ? (
                                    <div className="w-4 h-4 border-2 border-[#1d1d1f]/30 border-t-[#1d1d1f] rounded-full animate-spin"></div>
                                ) : (
                                    <SendIcon className="w-4 h-4" />
                                )}
                            </button>
                        </div>
                        <p className="text-[10px] text-[#86868b] mt-2 text-center">
                            AI can make mistakes. Review important changes in Tasks & Projects.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
