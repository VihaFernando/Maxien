import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { supabase } from "../lib/supabase"
import { useAuth } from "../context/AuthContext"
import { useVoice } from "../lib/useVoice"

// ─── Icons ─────────────────────────────────────────────────────────────────
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

const CloseIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
)

const ExpandIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
    </svg>
)

const TrashIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
)

const MinimizeIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4" />
    </svg>
)

const MicIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line strokeLinecap="round" x1="12" y1="19" x2="12" y2="23" />
        <line strokeLinecap="round" x1="8" y1="23" x2="16" y2="23" />
    </svg>
)

const SpeakerOnIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <polygon strokeLinecap="round" strokeLinejoin="round" points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.54 8.46a5 5 0 0 1 0 7.07" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
)

const SpeakerOffIcon = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <polygon strokeLinecap="round" strokeLinejoin="round" points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <line strokeLinecap="round" x1="23" y1="9" x2="17" y2="15" />
        <line strokeLinecap="round" x1="17" y1="9" x2="23" y2="15" />
    </svg>
)

// ─── Inline voice waveform (5 bars) ─────────────────────────────────────────
const VoiceWave = ({ color = "var(--mx-color-c6ff00)", size = 14 }) => (
    <div className="flex items-end gap-[2px]" style={{ height: size }}>
        {[0.5, 0.9, 1, 0.7, 0.45].map((h, i) => (
            <span
                key={i}
                className="voice-bar rounded-full"
                style={{ width: 2.5, height: size * h, background: color, display: "block" }}
            />
        ))}
    </div>
)

// ─── Action colours ─────────────────────────────────────────────────────────
const ACTION_STYLES = {
    create_task: { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-100", label: "Task Created" },
    create_project: { bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-100", label: "Project Created" },
    update_task: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-100", label: "Task Updated" },
    update_project: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-100", label: "Project Updated" },
    link_task_project: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-100", label: "Task Linked" },
    none: { bg: "bg-[var(--mx-color-f5f5f7)]", text: "text-[var(--mx-color-86868b)]", border: "border-[var(--mx-color-e5e5ea)]", label: "No Action" },
    clarify: { bg: "bg-sky-50", text: "text-sky-700", border: "border-sky-100", label: "Select One" },
}

function formatTime(date) {
    return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
}

const EXAMPLE_PROMPTS = [
    "Create a high priority task due tomorrow",
    "Create project \"Website Redesign\"",
    "Show my tasks this week",
    "Mark task as Done",
]

/** Legacy free-position FAB (migrated to corner snap). */
const FLOAT_POS_KEY_LEGACY = "maxien_ai_fab_pos_v1"
/** Persisted corner: tl | tr | bl | br */
const FLOAT_CORNER_KEY = "maxien_ai_fab_corner_v2"
const FAB_VIEWPORT_PAD = 12

function isValidCorner(c) {
    return c === "tl" || c === "tr" || c === "bl" || c === "br"
}

function cornerToPixels(corner, vw, vh, bw, bh, pad = FAB_VIEWPORT_PAD) {
    const maxL = Math.max(pad, vw - bw - pad)
    const maxT = Math.max(pad, vh - bh - pad)
    switch (corner) {
        case "tl":
            return { left: pad, top: pad }
        case "tr":
            return { left: maxL, top: pad }
        case "bl":
            return { left: pad, top: maxT }
        case "br":
        default:
            return { left: maxL, top: maxT }
    }
}

/** Pick the corner whose “rest” button center is closest to the dragged button center. */
function nearestCornerFromRect(left, top, bw, bh, vw, vh, pad = FAB_VIEWPORT_PAD) {
    const cx = left + bw / 2
    const cy = top + bh / 2
    const targets = [
        { id: "tl", x: pad + bw / 2, y: pad + bh / 2 },
        { id: "tr", x: vw - pad - bw / 2, y: pad + bh / 2 },
        { id: "bl", x: pad + bw / 2, y: vh - pad - bh / 2 },
        { id: "br", x: vw - pad - bw / 2, y: vh - pad - bh / 2 },
    ]
    let best = "br"
    let bestD = Infinity
    for (const t of targets) {
        const d = (cx - t.x) ** 2 + (cy - t.y) ** 2
        if (d < bestD) {
            bestD = d
            best = t.id
        }
    }
    return best
}

// ─── Message Bubble (compact version for popup) ─────────────────────────────
function ChatBubble({ msg, onSelectOption }) {
    const navigate = useNavigate()
    const isUser = msg.role === "user"
    const isLoading = msg.status === "loading"

    const handleItemClick = (item) => {
        if (item.type === "task") navigate(`/dashboard/tasks?task=${item.id}`)
        else if (item.type === "project") navigate(`/dashboard/projects?project=${item.id}`)
    }

    const getStatusColor = (meta) => {
        const status = meta?.split("•")[0]?.trim()?.toLowerCase()
        switch (status) {
            case "to do": return "bg-gray-100 text-gray-600"
            case "in progress": return "bg-blue-100 text-blue-700"
            case "done": return "bg-green-100 text-green-700"
            case "active": return "bg-blue-100 text-blue-700"
            case "on hold": return "bg-amber-100 text-amber-700"
            case "paused": return "bg-amber-100 text-amber-700"
            case "completed": return "bg-green-100 text-green-700"
            default: return "bg-gray-100 text-gray-600"
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
        <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : "flex-row"} items-start`}>
            {/* AI avatar */}
            {!isUser && (
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[var(--mx-color-c6ff00)] to-[var(--mx-color-a8db00)] flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                    <SparkleIcon className="w-3 h-3 text-[var(--mx-color-1d1d1f)]" />
                </div>
            )}

            <div className={`flex flex-col gap-1.5 max-w-[82%] ${isUser ? "items-end" : "items-start"}`}>
                {/* Bubble */}
                <div className={`px-3 py-2.5 rounded-[14px] ${isUser
                    ? "bg-[var(--mx-color-1d1d1f)] text-white rounded-br-[5px]"
                    : "bg-[var(--color-surface)] border border-[var(--mx-color-e8e8ed)] text-[var(--mx-color-1d1d1f)] rounded-bl-[5px] shadow-sm"
                    }`}>
                    {isLoading ? (
                        <div className="flex items-center gap-1.5 px-1 py-1">
                            {[0, 120, 240].map(d => (
                                <span key={d} className="w-1.5 h-1.5 rounded-full bg-[var(--mx-color-c6ff00)] animate-bounce" style={{ animationDelay: `${d}ms` }} />
                            ))}
                        </div>
                    ) : (
                        <p className={`text-[12.5px] leading-relaxed whitespace-pre-wrap ${isUser ? "text-white" : "text-[var(--mx-color-1d1d1f)]"}`}>
                            {getDisplayContent()}
                        </p>
                    )}
                </div>

                {/* Items grid */}
                {!isLoading && msg.items && msg.items.length > 0 && (
                    <div className="flex flex-col gap-1.5 w-full">
                        {msg.items.map((item) => (
                            <button
                                key={`${item.type}-${item.id}`}
                                onClick={() => handleItemClick(item)}
                                className={`flex flex-col gap-1 p-2.5 rounded-[10px] border text-left transition-all active:scale-95 ${item.type === "task"
                                    ? "bg-blue-50 border-blue-100 hover:bg-blue-100/60"
                                    : "bg-violet-50 border-violet-100 hover:bg-violet-100/60"
                                    }`}
                            >
                                <p className="font-semibold text-[12px] text-[var(--mx-color-1d1d1f)] line-clamp-1">{item.title}</p>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${getStatusColor(item.meta)}`}>
                                        {item.meta.split("•")[0]?.trim()}
                                    </span>
                                    <span className="text-[10px] text-[var(--mx-color-86868b)]">
                                        {item.meta.split("•").slice(1).join("•").trim()}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {/* Clarification options */}
                {!isLoading && msg.options && msg.options.length > 0 && onSelectOption && (
                    <div className="flex flex-col gap-1 w-full">
                        {msg.options.map((opt, i) => (
                            <button
                                key={i}
                                onClick={() => onSelectOption((i + 1).toString())}
                                className="text-left px-3 py-2 text-[11.5px] font-medium bg-sky-50 hover:bg-sky-100 text-sky-800 rounded-[10px] border border-sky-100 transition-colors active:scale-95"
                            >
                                <span className="font-bold text-sky-600 mr-1.5">{i + 1}.</span>
                                {opt.label || opt.name || opt.title || opt}
                            </button>
                        ))}
                    </div>
                )}

                {/* Action badge */}
                {!isLoading && msg.action && msg.action !== "none" && msg.action !== "error" && msg.action !== "clarify" && (
                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${ACTION_STYLES[msg.action]?.bg || "bg-[var(--mx-color-f5f5f7)]"} ${ACTION_STYLES[msg.action]?.text || "text-[var(--mx-color-86868b)]"} ${ACTION_STYLES[msg.action]?.border || "border-[var(--mx-color-e5e5ea)]"}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {ACTION_STYLES[msg.action]?.label || msg.action}
                    </div>
                )}

                {/* Error badge */}
                {msg.status === "error" && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-red-50 text-red-600 border-red-100">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        Error
                    </div>
                )}

                <p className="text-[9.5px] text-[var(--mx-color-aeaeb2)] px-0.5">{formatTime(msg.ts)}</p>
            </div>
        </div>
    )
}

// ─── Setup key screen (compact) ─────────────────────────────────────────────
function KeySetupScreen({ onSaved }) {
    const [keyInput, setKeyInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")

    const handleSubmit = async (e) => {
        e.preventDefault()
        setError("")
        if (!keyInput.trim()) { setError("Please enter your Groq API key"); return }
        setLoading(true)
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
            if (!res.ok || data.error) { setError(data.error || "Failed to save key"); return }
            onSaved()
        } catch {
            setError("Network error. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-6 overflow-y-auto">
            {/* Icon */}
            <div className="w-14 h-14 rounded-[18px] bg-gradient-to-br from-[var(--mx-color-c6ff00)] to-[var(--mx-color-a8db00)] flex items-center justify-center shadow-lg mb-4">
                <SparkleIcon className="w-7 h-7 text-[var(--mx-color-1d1d1f)]" />
            </div>
            <h3 className="text-[15px] font-bold text-[var(--mx-color-1d1d1f)] mb-1">Connect Groq AI</h3>
            <p className="text-[12px] text-[var(--mx-color-86868b)] text-center mb-5 max-w-[260px]">
                Add your free Groq API key to use AI features
            </p>

            {/* Setup steps */}
            <div className="w-full bg-[var(--mx-color-f5f5f7)] rounded-[14px] p-4 mb-5">
                <p className="text-[10px] font-bold text-[var(--mx-color-1d1d1f)] uppercase tracking-wider mb-3">How to get a free key</p>
                {[
                    ["1", "Go to", "console.groq.com", "https://console.groq.com"],
                    ["2", "Sign in (free account)", null, null],
                    ["3", "Click Get API Key", null, null],
                    ["4", "Paste it below", null, null],
                ].map(([n, pre, link, href]) => (
                    <div key={n} className="flex items-start gap-2 mb-1.5 last:mb-0">
                        <span className="w-4 h-4 rounded-full bg-[var(--mx-color-c6ff00)] flex items-center justify-center text-[9px] font-black text-[var(--mx-color-1d1d1f)] flex-shrink-0 mt-0.5">{n}</span>
                        <p className="text-[11.5px] text-[var(--mx-color-3a3a3c)]">
                            {pre}{" "}
                            {link && href && <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-[var(--mx-color-0969da)] hover:underline">{link}</a>}
                        </p>
                    </div>
                ))}
            </div>

            {error && (
                <div className="w-full mb-3 bg-red-50 text-red-600 text-[11.5px] font-medium px-3 py-2 rounded-xl border border-red-100">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="w-full space-y-2.5">
                <input
                    type="password"
                    value={keyInput}
                    onChange={e => setKeyInput(e.target.value)}
                    placeholder="gsk_..."
                    autoComplete="off"
                    className="w-full px-3.5 py-2.5 text-[12.5px] bg-[var(--mx-color-f5f5f7)] border border-[var(--mx-color-e5e5ea)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50 focus:border-[var(--mx-color-c6ff00)] transition-all placeholder:text-[var(--mx-color-aeaeb2)]"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 bg-[var(--mx-color-1d1d1f)] hover:bg-black text-white text-[12.5px] font-semibold py-2.5 rounded-xl transition-all disabled:opacity-60"
                >
                    {loading ? (
                        <>
                            <div className="w-3.5 h-3.5 border-2 border-[var(--color-border-strong)]/30 border-t-white rounded-full animate-spin" />
                            Verifying…
                        </>
                    ) : (
                        <>
                            <KeyIcon className="w-3.5 h-3.5" />
                            Connect Groq
                        </>
                    )}
                </button>
            </form>
            <p className="text-[10px] text-[var(--mx-color-aeaeb2)] text-center mt-3">
                Encrypted with AES-256 · never exposed to browser
            </p>
        </div>
    )
}

// ─── Main Floating Widget ────────────────────────────────────────────────────
export default function FloatingAIChat() {
    const { user } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()

    const [isOpen, setIsOpen] = useState(false)
    const [hasKey, setHasKey] = useState(null)
    const [messages, setMessages] = useState([])
    const [input, setInput] = useState("")
    const [sending, setSending] = useState(false)
    const [pendingClarification, setPendingClarification] = useState(null)
    const [unreadCount, setUnreadCount] = useState(0)
    const [showKeySettings, setShowKeySettings] = useState(false)
    const [showVoiceSettings, setShowVoiceSettings] = useState(false)
    const [keyInput, setKeyInput] = useState("")
    const [keyLoading, setKeyLoading] = useState(false)
    const [keyError, setKeyError] = useState("")

    const bottomRef = useRef(null)
    const inputRef = useRef(null)

    // ── Don't show on the dedicated AI Assistant page or auth pages ──────────
    const isOnAIPage = location.pathname === "/dashboard/ai-assistant"
    const isAuthPage = location.pathname === "/login" || location.pathname === "/signup"

    if (!user || isOnAIPage || isAuthPage) return null

    return <FloatingAIChatInner
        user={user}
        isOpen={isOpen}
        setIsOpen={setIsOpen}
        hasKey={hasKey}
        setHasKey={setHasKey}
        messages={messages}
        setMessages={setMessages}
        input={input}
        setInput={setInput}
        sending={sending}
        setSending={setSending}
        pendingClarification={pendingClarification}
        setPendingClarification={setPendingClarification}
        unreadCount={unreadCount}
        setUnreadCount={setUnreadCount}
        showKeySettings={showKeySettings}
        setShowKeySettings={setShowKeySettings}
        showVoiceSettings={showVoiceSettings}
        setShowVoiceSettings={setShowVoiceSettings}
        keyInput={keyInput}
        setKeyInput={setKeyInput}
        keyLoading={keyLoading}
        setKeyLoading={setKeyLoading}
        keyError={keyError}
        setKeyError={setKeyError}
        bottomRef={bottomRef}
        inputRef={inputRef}
        navigate={navigate}
    />
}

function FloatingAIChatInner({
    user, isOpen, setIsOpen, hasKey, setHasKey,
    messages, setMessages, input, setInput,
    sending, setSending, pendingClarification, setPendingClarification,
    unreadCount, setUnreadCount, showKeySettings, setShowKeySettings, showVoiceSettings, setShowVoiceSettings,
    keyInput, setKeyInput, keyLoading, setKeyLoading, keyError, setKeyError,
    bottomRef, inputRef, navigate,
}) {
    const fabRef = useRef(null)
    const dragRef = useRef({
        dragging: false,
        moved: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
        lastLeft: 0,
        lastTop: 0,
    })
    /** Resting corner after drag snap (persisted). */
    const [fabCorner, setFabCorner] = useState("br")
    /** While dragging: live pixel position; null = use corner-derived position. */
    const [dragOverride, setDragOverride] = useState(null)
    const [layout, setLayout] = useState(() => ({
        vw: typeof window !== "undefined" ? window.innerWidth : 0,
        vh: typeof window !== "undefined" ? window.innerHeight : 0,
        bw: 56,
        bh: 56,
    }))

    // ── Load saved corner (migrate legacy free-position key once) ─────────
    useEffect(() => {
        try {
            const rawCorner = localStorage.getItem(FLOAT_CORNER_KEY)
            if (rawCorner) {
                const p = JSON.parse(rawCorner)
                if (p?.corner && isValidCorner(p.corner)) {
                    setFabCorner(p.corner)
                    return
                }
            }
            const legacy = localStorage.getItem(FLOAT_POS_KEY_LEGACY)
            if (legacy) {
                const parsed = JSON.parse(legacy)
                if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
                    const vw = window.innerWidth
                    const vh = window.innerHeight
                    const bw = 56
                    const bh = 56
                    const corner = nearestCornerFromRect(parsed.left, parsed.top, bw, bh, vw, vh)
                    setFabCorner(corner)
                    localStorage.setItem(FLOAT_CORNER_KEY, JSON.stringify({ corner }))
                }
            }
        } catch {
            /* ignore */
        }
    }, [])

    useLayoutEffect(() => {
        const el = fabRef.current
        const update = () => {
            setLayout({
                vw: window.innerWidth,
                vh: window.innerHeight,
                bw: el?.offsetWidth || 56,
                bh: el?.offsetHeight || 56,
            })
        }
        update()
        window.addEventListener("resize", update)
        let ro
        if (typeof ResizeObserver !== "undefined" && el) {
            ro = new ResizeObserver(update)
            ro.observe(el)
        }
        return () => {
            window.removeEventListener("resize", update)
            ro?.disconnect()
        }
    }, [])

    // ── Load key status ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!user || hasKey !== null) return
        let cancelled = false
        supabase
            .from("user_ai_settings")
            .select("id")
            .eq("user_id", user.id)
            .maybeSingle()
            .then(({ data }) => {
                if (cancelled) return
                setHasKey(!!data)
                if (data && messages.length === 0) {
                    setMessages([{
                        id: "welcome",
                        role: "ai",
                        content: "Hi! I can create tasks, projects, and manage your data with natural language. What would you like to do?",
                        ts: new Date(),
                        action: null,
                    }])
                }
            })
        return () => {
            cancelled = true
        }
    }, [user, hasKey])

    // ── Auto scroll ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return
        if (scrollToBottomTimerRef.current != null) {
            window.clearTimeout(scrollToBottomTimerRef.current)
            scrollToBottomTimerRef.current = null
        }
        scrollToBottomTimerRef.current = window.setTimeout(() => {
            scrollToBottomTimerRef.current = null
            bottomRef.current?.scrollIntoView({ behavior: "smooth" })
        }, 50)
        return () => {
            if (scrollToBottomTimerRef.current != null) {
                window.clearTimeout(scrollToBottomTimerRef.current)
                scrollToBottomTimerRef.current = null
            }
        }
    }, [messages, isOpen])

    // ── Focus input on open ──────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen || !hasKey) return
        if (focusInputTimerRef.current != null) {
            window.clearTimeout(focusInputTimerRef.current)
            focusInputTimerRef.current = null
        }
        focusInputTimerRef.current = window.setTimeout(() => {
            focusInputTimerRef.current = null
            inputRef.current?.focus()
        }, 150)
        return () => {
            if (focusInputTimerRef.current != null) {
                window.clearTimeout(focusInputTimerRef.current)
                focusInputTimerRef.current = null
            }
        }
    }, [isOpen, hasKey])

    // ── Track unread when closed ─────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen && messages.length > 0) {
            const lastMsg = messages[messages.length - 1]
            if (lastMsg.role === "ai" && lastMsg.status !== "loading" && lastMsg.id !== "welcome") {
                setUnreadCount(c => c + 1)
            }
        }
    }, [messages])

    // ── Keyboard shortcut to toggle chat (Alt+C on Windows/Linux, Cmd+/ on Mac) ──
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Detect OS and check for appropriate shortcut
            const isMac = /Mac|iPhone|iPad|iPod/.test(navigator.platform)
            const isShortcut = isMac
                ? e.metaKey && e.key === "/" // Cmd+/ on Mac
                : e.altKey && e.key.toLowerCase() === "c" // Alt+C on Windows/Linux

            if (isShortcut) {
                e.preventDefault()
                setIsOpen(prev => !prev)
            }
        }

        window.addEventListener("keydown", handleKeyDown)
        return () => window.removeEventListener("keydown", handleKeyDown)
    }, [])

    // ── Custom event to open from anywhere (e.g. sidebar hint card) ──────────
    useEffect(() => {
        const handleCustomOpen = () => {
            setIsOpen(true)
            setUnreadCount(0)
        }
        window.addEventListener("maxien:open-ai-chat", handleCustomOpen)
        return () => window.removeEventListener("maxien:open-ai-chat", handleCustomOpen)
    }, [])

    // ── Voice ────────────────────────────────────────────────────────────
    const voice = useVoice()

    // track whether last message originated from voice input
    const lastWasVoiceRef = useRef(false)
    const scrollToBottomTimerRef = useRef(null)
    const focusInputTimerRef = useRef(null)
    const sendFocusTimerRef = useRef(null)

    useEffect(
        () => () => {
            if (scrollToBottomTimerRef.current != null) {
                window.clearTimeout(scrollToBottomTimerRef.current)
                scrollToBottomTimerRef.current = null
            }
            if (focusInputTimerRef.current != null) {
                window.clearTimeout(focusInputTimerRef.current)
                focusInputTimerRef.current = null
            }
            if (sendFocusTimerRef.current != null) {
                window.clearTimeout(sendFocusTimerRef.current)
                sendFocusTimerRef.current = null
            }
        },
        [],
    )

    // Auto-send when voice transcript arrives
    useEffect(() => {
        if (voice.transcript) {
            lastWasVoiceRef.current = true
            handleSend(voice.transcript.text, { viaVoice: true })
        }
    }, [voice.transcript])

    // Auto-speak new AI responses, but only if the user spoke their query
    useEffect(() => {
        const last = messages[messages.length - 1]
        if (last?.role === "ai" && last?.status !== "loading" && last?.id !== "welcome") {
            if (lastWasVoiceRef.current) {
                voice.speak(last.content)
            }
        }
    }, [messages])

    // Stop speaking when chat is closed
    useEffect(() => {
        if (!isOpen) voice.stopSpeaking()
    }, [isOpen])

    const handleOpen = () => {
        setIsOpen(true)
        setUnreadCount(0)
    }

    const handleClose = () => {
        setIsOpen(false)
        voice.stopListening()
    }

    // ── Save key (from settings panel inside widget) ─────────────────────────
    const handleSaveKey = async (e) => {
        e.preventDefault()
        setKeyError("")
        if (!keyInput.trim()) { setKeyError("Please enter your key"); return }
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
            setHasKey(true)
            setKeyInput("")
            setShowKeySettings(false)
            if (messages.length === 0) {
                setMessages([{
                    id: "welcome",
                    role: "ai",
                    content: "Hi! I can create tasks, projects, and manage your data with natural language. What would you like to do?",
                    ts: new Date(),
                    action: null,
                }])
            }
        } catch {
            setKeyError("Network error. Please try again.")
        } finally {
            setKeyLoading(false)
        }
    }

    const handleDeleteKey = async () => {
        if (!window.confirm("Remove your Groq API key?")) return
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
            setShowKeySettings(false)
        } catch {
            setKeyError("Failed to remove key")
        } finally {
            setKeyLoading(false)
        }
    }

    // ── Send message ─────────────────────────────────────────────────────────
    const handleSend = async (messageText, { viaVoice = false } = {}) => {
        const text = (messageText || input).trim()
        if (!text || sending) return

        lastWasVoiceRef.current = viaVoice

        const userMsg = { id: Date.now().toString(), role: "user", content: text, ts: new Date() }
        const loadingMsg = { id: "loading-" + Date.now(), role: "ai", content: "", ts: new Date(), status: "loading" }

        setMessages(prev => [...prev, userMsg, loadingMsg])
        setInput("")
        setSending(true)

        try {
            const { data: { session } } = await supabase.auth.getSession()
            const now = new Date()
            const userLocalNow = now.toISOString()
            const timezoneOffsetMinutes = now.getTimezoneOffset()

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
                content: "Network error. Please check your connection.",
                ts: new Date(),
                action: "error",
                status: "error",
            }))
        } finally {
            setSending(false)
            if (sendFocusTimerRef.current != null) {
                window.clearTimeout(sendFocusTimerRef.current)
                sendFocusTimerRef.current = null
            }
            sendFocusTimerRef.current = window.setTimeout(() => {
                sendFocusTimerRef.current = null
                inputRef.current?.focus()
            }, 50)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
    }

    const handleKeySetupDone = () => {
        setHasKey(true)
        setMessages([{
            id: "welcome",
            role: "ai",
            content: "Hi! I can create tasks, projects, and manage your data with natural language. What would you like to do?",
            ts: new Date(),
            action: null,
        }])
    }

    const restingFabPos =
        layout.vw > 0
            ? cornerToPixels(fabCorner, layout.vw, layout.vh, layout.bw, layout.bh)
            : null
    const fabScreenPos = dragOverride ?? restingFabPos

    // ────────────────────────────────────────────────────────────────────────
    return (
        <>
            {/* ── Backdrop (mobile only) ───────────────────────────────────── */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/30 backdrop-blur-[2px] z-[9998] sm:hidden"
                    onClick={handleClose}
                />
            )}

            {/* ── Chat popup ──────────────────────────────────────────────── */}
            <div
                className={`
                    fixed z-[9999] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                    /* Mobile: full screen sheet from bottom */
                    bottom-0 left-0 right-0
                    /* Tablet/Desktop: anchored bottom-right corner */
                    sm:bottom-24 sm:right-6 sm:left-auto
                    md:right-8
                    lg:right-8
                    /* Size */
                    sm:w-[380px]
                    md:w-[400px]
                    /* Visibility & transform */
                    ${isOpen
                        ? "opacity-100 translate-y-0 pointer-events-auto"
                        : "opacity-0 translate-y-6 pointer-events-none"
                    }
                `}
            >
                <div className={`
                    bg-[var(--color-surface)] flex flex-col overflow-hidden shadow-2xl
                    /* Mobile: rounded top corners only, full width */
                    rounded-t-[28px] 
                    /* Tablet+: fully rounded */
                    sm:rounded-[24px]
                    /* Height */
                    h-[82svh] sm:h-[580px]
                    border border-[var(--mx-color-e5e5ea)]/80
                `}
                    style={{ boxShadow: "0 20px 60px -12px rgba(0,0,0,0.20), 0 4px 20px -4px rgba(0,0,0,0.10)" }}
                >

                    {/* ── Header ──────────────────────────────────────────── */}
                    <div className="relative flex-shrink-0 bg-gradient-to-br from-[var(--mx-color-1d1d1f)] to-[var(--mx-color-2d2d30)] px-4 py-4 rounded-t-[28px] sm:rounded-t-[24px]">
                        {/* Drag handle (mobile) */}
                        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-[var(--color-surface)]/20 sm:hidden" />

                        <div className="flex items-center gap-3 mt-1.5 sm:mt-0">
                            {/* Logo */}
                            <div className="w-9 h-9 rounded-[12px] bg-gradient-to-br from-[var(--mx-color-c6ff00)] to-[var(--mx-color-a8db00)] flex items-center justify-center shadow-md flex-shrink-0">
                                <SparkleIcon className="w-4.5 h-4.5 text-[var(--mx-color-1d1d1f)]" style={{ width: "18px", height: "18px" }} />
                            </div>

                            {/* Title */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[14px] font-bold text-white tracking-tight">Maxien AI</span>
                                    <span className="flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--mx-color-c6ff00)] animate-pulse" />
                                        <span className="text-[10px] font-semibold text-[var(--mx-color-c6ff00)]/80 hidden sm:inline">Online</span>
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-[10.5px] text-white/50 truncate">Powered by Groq · llama-3.3-70b</p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                                {/* Voice settings button */}
                                {voice.ttsSupported && (
                                    <button
                                        onClick={() => setShowVoiceSettings(s => !s)}
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${showVoiceSettings ? "bg-[var(--color-surface)]/20 text-white" : "text-white/60 hover:bg-[var(--color-surface)]/10 hover:text-white"
                                            }`}
                                        title="Voice settings"
                                    >
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                                            <circle cx="12" cy="12" r="1" />
                                            <circle cx="19" cy="12" r="1" />
                                            <circle cx="5" cy="12" r="1" />
                                        </svg>
                                    </button>
                                )}
                                {/* Voice toggle button (toggle on/off) */}
                                {voice.ttsSupported && hasKey && (
                                    <button
                                        onClick={() => { voice.setVoiceEnabled(v => !v); if (voice.isSpeaking) voice.stopSpeaking() }}
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${voice.voiceEnabled ? "text-[var(--mx-color-c6ff00)]/90 hover:bg-[var(--color-surface)]/10" : "text-white/35 hover:bg-[var(--color-surface)]/10 hover:text-white/60"
                                            }`}
                                        title={voice.voiceEnabled ? "Voice responses on" : "Voice responses off"}
                                    >
                                        {voice.isSpeaking
                                            ? <VoiceWave size={12} color="var(--mx-color-c6ff00)" />
                                            : voice.voiceEnabled
                                                ? <SpeakerOnIcon className="w-3.5 h-3.5" />
                                                : <SpeakerOffIcon className="w-3.5 h-3.5" />
                                        }
                                    </button>
                                )}
                                {hasKey && (
                                    <button
                                        onClick={() => setShowKeySettings(s => !s)}
                                        className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${showKeySettings ? "bg-[var(--color-surface)]/20 text-white" : "text-white/60 hover:bg-[var(--color-surface)]/10 hover:text-white"}`}
                                        title="API Key settings"
                                    >
                                        <KeyIcon className="w-3.5 h-3.5" />
                                    </button>
                                )}
                                <button
                                    onClick={() => navigate("/dashboard/ai-assistant")}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-white/60 hover:bg-[var(--color-surface)]/10 hover:text-white transition-colors"
                                    title="Open full page"
                                >
                                    <ExpandIcon className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={handleClose}
                                    className="w-7 h-7 flex items-center justify-center rounded-lg text-white/60 hover:bg-[var(--color-surface)]/10 hover:text-white transition-colors"
                                >
                                    <CloseIcon className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Voice settings panel ──────────────────────────────── */}
                    {showVoiceSettings && voice.ttsSupported && (
                        <div className="flex-shrink-0 border-b border-[var(--mx-color-f0f0f5)] bg-[var(--mx-color-fafafa)] px-4 py-3 space-y-3">
                            {/* Voice select */}
                            {voice.availableVoices.length > 0 && (
                                <div>
                                    <label className="text-[10px] font-semibold text-[var(--mx-color-1d1d1f)] block mb-1.5">VOICE</label>
                                    <select
                                        value={voice.selectedVoiceIndex}
                                        onChange={e => voice.setSelectedVoiceIndex(Number(e.target.value))}
                                        className="w-full px-2.5 py-1.5 text-[11px] bg-[var(--color-surface)] border border-[var(--mx-color-e5e5ea)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50 focus:border-[var(--mx-color-c6ff00)] transition-all"
                                    >
                                        {voice.availableVoices.map((v, i) => (
                                            <option key={i} value={i}>
                                                {v.name} ({v.lang})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Speech rate */}
                            <div>
                                <label className="text-[10px] font-semibold text-[var(--mx-color-1d1d1f)] flex items-center justify-between mb-1.5">
                                    <span>SPEED</span>
                                    <span className="text-[var(--mx-color-86868b)]">{voice.speechRate.toFixed(1)}x</span>
                                </label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2"
                                    step="0.1"
                                    value={voice.speechRate}
                                    onChange={e => voice.setSpeechRate(Number(e.target.value))}
                                    className="w-full h-1.5 bg-[var(--mx-color-e5e5ea)] rounded-full appearance-none cursor-pointer accent-[var(--mx-color-c6ff00)]"
                                />
                            </div>

                            {/* Speech pitch */}
                            <div>
                                <label className="text-[10px] font-semibold text-[var(--mx-color-1d1d1f)] flex items-center justify-between mb-1.5">
                                    <span>PITCH</span>
                                    <span className="text-[var(--mx-color-86868b)]">{voice.speechPitch.toFixed(1)}</span>
                                </label>
                                <input
                                    type="range"
                                    min="0.5"
                                    max="2"
                                    step="0.1"
                                    value={voice.speechPitch}
                                    onChange={e => voice.setSpeechPitch(Number(e.target.value))}
                                    className="w-full h-1.5 bg-[var(--mx-color-e5e5ea)] rounded-full appearance-none cursor-pointer accent-[var(--mx-color-c6ff00)]"
                                />
                            </div>

                            {/* Speech volume */}
                            <div>
                                <label className="text-[10px] font-semibold text-[var(--mx-color-1d1d1f)] flex items-center justify-between mb-1.5">
                                    <span>VOLUME</span>
                                    <span className="text-[var(--mx-color-86868b)]">{Math.round(voice.speechVolume * 100)}%</span>
                                </label>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={voice.speechVolume}
                                    onChange={e => voice.setSpeechVolume(Number(e.target.value))}
                                    className="w-full h-1.5 bg-[var(--mx-color-e5e5ea)] rounded-full appearance-none cursor-pointer accent-[var(--mx-color-c6ff00)]"
                                />
                            </div>
                        </div>
                    )}

                    {/* ── Key settings panel ──────────────────────────────── */}
                    {showKeySettings && hasKey && (
                        <div className="flex-shrink-0 border-b border-[var(--mx-color-f0f0f5)] bg-[var(--mx-color-fafafa)] px-4 py-3">
                            {keyError && (
                                <p className="text-[11px] text-red-600 bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 mb-2">{keyError}</p>
                            )}
                            <form onSubmit={handleSaveKey} className="flex gap-2">
                                <input
                                    type="password"
                                    value={keyInput}
                                    onChange={e => setKeyInput(e.target.value)}
                                    placeholder="New Groq API key…"
                                    autoComplete="off"
                                    className="flex-1 px-3 py-2 text-[12px] bg-[var(--color-surface)] border border-[var(--mx-color-e5e5ea)] rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50 focus:border-[var(--mx-color-c6ff00)] transition-all placeholder:text-[var(--mx-color-aeaeb2)]"
                                />
                                <button
                                    type="submit"
                                    disabled={keyLoading}
                                    className="px-3 py-2 bg-[var(--mx-color-1d1d1f)] text-white text-[11.5px] font-semibold rounded-xl disabled:opacity-50 hover:bg-black transition-colors"
                                >
                                    {keyLoading ? "…" : "Save"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteKey}
                                    disabled={keyLoading}
                                    className="w-9 flex items-center justify-center bg-red-50 border border-red-100 text-red-500 rounded-xl hover:bg-red-100 transition-colors disabled:opacity-50"
                                    title="Remove key"
                                >
                                    <TrashIcon className="w-4 h-4" />
                                </button>
                            </form>
                        </div>
                    )}

                    {/* ── Body: key setup or chat ──────────────────────────── */}
                    {hasKey === null ? (
                        /* Loading */
                        <div className="flex-1 flex items-center justify-center">
                            <div className="flex gap-1.5">
                                {[0, 120, 240].map(d => (
                                    <span key={d} className="w-2 h-2 rounded-full bg-[var(--mx-color-c6ff00)] animate-bounce" style={{ animationDelay: `${d}ms` }} />
                                ))}
                            </div>
                        </div>
                    ) : !hasKey ? (
                        /* Key setup */
                        <KeySetupScreen onSaved={handleKeySetupDone} />
                    ) : (
                        /* Chat */
                        <div className="flex-1 flex flex-col min-h-0">
                            {/* Messages */}
                            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth hide-scrollbar">
                                {messages.map(msg => (
                                    <ChatBubble
                                        key={msg.id}
                                        msg={msg}
                                        onSelectOption={pendingClarification && msg.options?.length ? (val) => handleSend(val) : null}
                                    />
                                ))}
                                <div ref={bottomRef} />
                            </div>

                            {/* Example prompts */}
                            {messages.length === 1 && (
                                <div className="px-4 pb-2 flex-shrink-0">
                                    <p className="text-[9.5px] font-bold text-[var(--mx-color-aeaeb2)] uppercase tracking-wider mb-1.5">Try asking</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {EXAMPLE_PROMPTS.map((p, i) => (
                                            <button
                                                key={i}
                                                onClick={() => handleSend(p)}
                                                disabled={sending}
                                                className="text-[11px] font-medium bg-[var(--mx-color-f5f5f7)] hover:bg-[var(--mx-color-ebebed)] text-[var(--mx-color-3a3a3c)] px-2.5 py-1 rounded-full border border-[var(--mx-color-e5e5ea)] transition-colors disabled:opacity-50 text-left"
                                            >
                                                {p}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Clarification banner */}
                            {pendingClarification && (
                                <div className="px-4 py-2 bg-sky-50 border-t border-sky-100 flex items-center gap-2 flex-shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse flex-shrink-0" />
                                    <p className="text-[11px] text-sky-700 font-medium flex-1">Type a number to select</p>
                                    <button onClick={() => setPendingClarification(null)} className="text-[10px] text-sky-500 hover:text-sky-700 font-semibold">Cancel</button>
                                </div>
                            )}

                            {/* Divider */}
                            <div className="h-px bg-[var(--mx-color-f0f0f5)] flex-shrink-0" />

                            {/* Input */}
                            <div className="px-3 py-3 flex-shrink-0 bg-[var(--color-surface)]">
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 relative">
                                        <textarea
                                            ref={inputRef}
                                            value={input}
                                            onChange={e => setInput(e.target.value)}
                                            onKeyDown={handleKeyDown}
                                            placeholder={voice.isListening ? "" : "Ask me anything… (Enter to send)"}
                                            rows={1}
                                            disabled={sending || voice.isListening}
                                            className="w-full px-3.5 py-2.5 pr-3 text-[12.5px] bg-[var(--mx-color-f5f5f7)] border border-[var(--mx-color-e8e8ed)] rounded-[14px] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50 focus:border-[var(--mx-color-c6ff00)] transition-all resize-none placeholder:text-[var(--mx-color-aeaeb2)] disabled:opacity-60 leading-relaxed hide-scrollbar"
                                            style={{ maxHeight: "100px", overflowY: "auto" }}
                                            onInput={e => {
                                                e.target.style.height = "auto"
                                                e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"
                                            }}
                                        />
                                        {/* Listening overlay */}
                                        {voice.isListening && (
                                            <div className="absolute inset-0 bg-[var(--mx-color-f5f5f7)] border border-[var(--mx-color-c6ff00)] rounded-[14px] flex items-center gap-2.5 px-3.5 pointer-events-none">
                                                <VoiceWave size={16} color="var(--mx-color-1d1d1f)" />
                                                <span className="text-[12px] text-[var(--mx-color-1d1d1f)] flex-1 truncate">
                                                    {voice.interimText || "Listening…"}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {/* Mic button */}
                                    {voice.sttSupported && (
                                        <button
                                            onClick={voice.isListening ? voice.stopListening : voice.startListening}
                                            disabled={sending}
                                            title={voice.isListening ? "Stop listening" : "Speak your message"}
                                            className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-[14px] transition-all disabled:opacity-40 ${voice.isListening
                                                ? "bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)] scale-105"
                                                : "bg-[var(--mx-color-f5f5f7)] border border-[var(--mx-color-e8e8ed)] text-[var(--mx-color-86868b)] hover:bg-[var(--mx-color-ebebed)] hover:text-[var(--mx-color-1d1d1f)] active:scale-95"
                                                }`}
                                        >
                                            {voice.isListening
                                                ? <VoiceWave size={14} color="white" />
                                                : <MicIcon className="w-3.5 h-3.5" />
                                            }
                                        </button>
                                    )}
                                    {/* Send button */}
                                    <button
                                        onClick={() => handleSend()}
                                        disabled={!input.trim() || sending || voice.isListening}
                                        className="w-9 h-9 flex-shrink-0 flex items-center justify-center bg-[var(--mx-color-c6ff00)] hover:bg-[var(--mx-color-b8f000)] text-[var(--mx-color-1d1d1f)] rounded-[14px] transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 shadow-sm"
                                    >
                                        {sending ? (
                                            <div className="w-3.5 h-3.5 border-2 border-[var(--mx-color-1d1d1f)]/30 border-t-[var(--mx-color-1d1d1f)] rounded-full animate-spin" />
                                        ) : (
                                            <SendIcon className="w-3.5 h-3.5" />
                                        )}
                                    </button>
                                </div>
                                <p className="text-[9.5px] text-[var(--mx-color-c7c7cc)] mt-1.5 text-center">
                                    {voice.isListening ? "Speak clearly · tap mic to stop" : "AI can make mistakes · Review changes in Tasks & Projects"}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Floating trigger button ──────────────────────────────────── */}
            <button
                ref={fabRef}
                onPointerDown={(e) => {
                    // Only left click / primary touch
                    if (e.button != null && e.button !== 0) return
                    if (!fabRef.current) return
                    const r = fabRef.current.getBoundingClientRect()
                    dragRef.current.dragging = true
                    dragRef.current.moved = false
                    dragRef.current.pointerId = e.pointerId
                    dragRef.current.startX = e.clientX
                    dragRef.current.startY = e.clientY
                    dragRef.current.startLeft = r.left
                    dragRef.current.startTop = r.top
                    dragRef.current.lastLeft = r.left
                    dragRef.current.lastTop = r.top
                    try {
                        fabRef.current.setPointerCapture(e.pointerId)
                    } catch {
                        /* ignore */
                    }
                    e.preventDefault()
                }}
                onPointerMove={(e) => {
                    if (!dragRef.current.dragging) return
                    if (dragRef.current.pointerId != null && e.pointerId !== dragRef.current.pointerId) return
                    const dx = e.clientX - dragRef.current.startX
                    const dy = e.clientY - dragRef.current.startY
                    if (!dragRef.current.moved && Math.hypot(dx, dy) >= 6) {
                        dragRef.current.moved = true
                    }
                    const btnW = fabRef.current?.offsetWidth || 56
                    const btnH = fabRef.current?.offsetHeight || 56
                    const pad = FAB_VIEWPORT_PAD
                    const vw = window.innerWidth
                    const vh = window.innerHeight
                    const maxLeft = Math.max(pad, vw - btnW - pad)
                    const maxTop = Math.max(pad, vh - btnH - pad)
                    const nextLeft = Math.min(maxLeft, Math.max(pad, dragRef.current.startLeft + dx))
                    const nextTop = Math.min(maxTop, Math.max(pad, dragRef.current.startTop + dy))
                    dragRef.current.lastLeft = nextLeft
                    dragRef.current.lastTop = nextTop
                    setDragOverride({ left: nextLeft, top: nextTop })
                }}
                onPointerUp={(e) => {
                    if (!dragRef.current.dragging) return
                    if (dragRef.current.pointerId != null && e.pointerId !== dragRef.current.pointerId) return
                    dragRef.current.dragging = false
                    dragRef.current.pointerId = null

                    if (dragRef.current.moved) {
                        const btnW = fabRef.current?.offsetWidth || 56
                        const btnH = fabRef.current?.offsetHeight || 56
                        const vw = window.innerWidth
                        const vh = window.innerHeight
                        const corner = nearestCornerFromRect(
                            dragRef.current.lastLeft,
                            dragRef.current.lastTop,
                            btnW,
                            btnH,
                            vw,
                            vh,
                        )
                        setFabCorner(corner)
                        setDragOverride(null)
                        try {
                            localStorage.setItem(FLOAT_CORNER_KEY, JSON.stringify({ corner }))
                        } catch {
                            /* ignore */
                        }
                        return
                    }
                    setDragOverride(null)
                    handleOpen()
                }}
                onPointerCancel={() => {
                    if (dragRef.current.dragging && dragRef.current.moved) {
                        const btnW = fabRef.current?.offsetWidth || 56
                        const btnH = fabRef.current?.offsetHeight || 56
                        const vw = window.innerWidth
                        const vh = window.innerHeight
                        const corner = nearestCornerFromRect(
                            dragRef.current.lastLeft,
                            dragRef.current.lastTop,
                            btnW,
                            btnH,
                            vw,
                            vh,
                        )
                        setFabCorner(corner)
                        try {
                            localStorage.setItem(FLOAT_CORNER_KEY, JSON.stringify({ corner }))
                        } catch {
                            /* ignore */
                        }
                    }
                    dragRef.current.dragging = false
                    dragRef.current.pointerId = null
                    setDragOverride(null)
                }}
                aria-label="Open AI Assistant (drag to a screen corner to dock)"
                title={
                    (/Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "Cmd+/ to toggle · " : "Alt+C to toggle · ") +
                    "Drag to dock in a corner"
                }
                className={`
                    fixed z-[9998] touch-none select-none
                    w-14 h-14
                    sm:w-[58px] sm:h-[58px]
                    rounded-full
                    bg-gradient-to-br from-[var(--mx-color-1d1d1f)] to-[var(--mx-color-3a3a3c)]
                    text-white
                    shadow-[0_8px_24px_-4px_rgba(0,0,0,0.35),0_2px_8px_-2px_rgba(0,0,0,0.2)]
                    hover:shadow-[0_12px_32px_-4px_rgba(0,0,0,0.45),0_4px_12px_-2px_rgba(0,0,0,0.25)]
                    hover:scale-105
                    active:scale-95
                    flex items-center justify-center
                    ${dragOverride ? "transition-[transform,box-shadow,opacity] duration-200 ease-out" : "transition-[left,top,transform,box-shadow,opacity] duration-300 ease-[cubic-bezier(0.34,1.25,0.64,1)]"}
                    ${isOpen ? "opacity-0 scale-75 pointer-events-none" : "opacity-100 scale-100"}
                `}
                style={{
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "none",
                    ...(fabScreenPos
                        ? {
                              left: `${fabScreenPos.left}px`,
                              top: `${fabScreenPos.top}px`,
                              right: "auto",
                              bottom: "auto",
                          }
                        : {
                              right: "20px",
                              bottom: "24px",
                              left: "auto",
                              top: "auto",
                          }),
                }}
            >
                {/* Glow ring */}
                <span className="absolute inset-0 rounded-full bg-[var(--mx-color-c6ff00)]/10 animate-ping pointer-events-none" style={{ animationDuration: "2.5s" }} />

                {/* Icon */}
                <SparkleIcon className="w-6 h-6 relative z-10 text-[var(--mx-color-c6ff00)]" />

                {/* Unread badge */}
                {unreadCount > 0 && !isOpen && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-sm z-20">
                        {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                )}
            </button>
        </>
    )
}
