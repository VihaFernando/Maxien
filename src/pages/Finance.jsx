import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import { fetchCurrencyConversion } from "../lib/commandPalette"

const CURRENCIES = ["LKR", "USD", "GBP", "AUD", "EUR"]
const CHART_COLORS = ["#c6ff00", "#3B82F6", "#F97316", "#A855F7", "#22C55E", "#EF4444", "#F59E0B", "#06B6D4"]

const fmt = (n, currency = "LKR") => {
    const num = Number(n)
    if (!Number.isFinite(num)) return "-"
    return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

const fmtShort = (n) => {
    const num = Number(n)
    if (!Number.isFinite(num)) return "-"
    return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const fmtDate = (d) => {
    if (!d) return ""
    const date = new Date(d)
    if (Number.isNaN(date.getTime())) return d
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const today = () => new Date().toISOString().slice(0, 10)

const fuzzyMatch = (target, query) => {
    if (!query) return true
    const t = target.toLowerCase(), q = query.toLowerCase()
    let ti = 0
    for (let qi = 0; qi < q.length; qi++) {
        ti = t.indexOf(q[qi], ti)
        if (ti === -1) return false
        ti++
    }
    return true
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = "w-4 h-4", stroke = 2 }) => (
    <svg className={size} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={stroke}>
        <path strokeLinecap="round" strokeLinejoin="round" d={d} />
    </svg>
)
const PlusIcon = ({ size }) => <Icon size={size} d="M12 4v16m8-8H4" />
const TrashIcon = () => <Icon size="w-3.5 h-3.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
const CalIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <rect x="3" y="4" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
        <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
        <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
    </svg>
)
const ImportIcon = () => <Icon d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
const SparkleIcon = () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
)
const SignOutIcon = () => <Icon d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />

// ─── Shared input class ───────────────────────────────────────────────────────
const inputCls = "w-full rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50 transition-shadow"

// ─── Donut chart (ring style — used in Reports) ───────────────────────────────
function DonutChart({ data, size = 160, strokeWidth = 26, centerLabel }) {
    const r = (size - strokeWidth) / 2
    const circ = 2 * Math.PI * r
    const total = data.reduce((s, d) => s + d.value, 0)
    if (total === 0) return (
        <svg width={size} height={size}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--mx-color-e5e5ea)" strokeWidth={strokeWidth} />
        </svg>
    )
    let offset = 0
    return (
        <svg width={size} height={size} className="relative">
            <g style={{ transform: "rotate(-90deg)", transformOrigin: "50% 50%" }}>
                {data.map((seg, i) => {
                    const pct = seg.value / total
                    const dash = pct * circ
                    const el = (
                        <circle key={i} cx={size / 2} cy={size / 2} r={r}
                            fill="none" stroke={seg.color} strokeWidth={strokeWidth}
                            strokeDasharray={`${dash} ${circ - dash}`}
                            strokeDashoffset={-offset * circ}
                            strokeLinecap="butt"
                        />
                    )
                    offset += pct
                    return el
                })}
            </g>
            {centerLabel && (
                <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
                    style={{ fontSize: 11, fontWeight: 700, fill: "var(--color-text-primary)" }}>
                    {centerLabel}
                </text>
            )}
        </svg>
    )
}

// ─── Premium donut chart (Overview Expense Breakdown) ────────────────────────
function PieChart({ data, size = 280, total: totalProp }) {
    const [hovered, setHovered] = useState(null)
    const total = totalProp ?? data.reduce((s, d) => s + d.value, 0)
    const cx = size / 2, cy = size / 2
    const R = size / 2 - 14  // outer radius
    const r = R - 44          // inner radius (ring thickness = 44px)
    const GAP = 0.025         // gap between segments in radians

    if (total === 0) return (
        <svg width={size} height={size}>
            <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none"
                stroke="var(--mx-color-f5f5f7)" strokeWidth={R - r} />
            <text x={cx} y={cy - 8} textAnchor="middle" style={{ fontSize: 13, fontWeight: 700, fill: "var(--color-text-secondary)" }}>No data</text>
        </svg>
    )

    let startAngle = -Math.PI / 2
    const arc = (sa, ea, ro, ri) => {
        const x1 = cx + ro * Math.cos(sa), y1 = cy + ro * Math.sin(sa)
        const x2 = cx + ro * Math.cos(ea), y2 = cy + ro * Math.sin(ea)
        const x3 = cx + ri * Math.cos(ea), y3 = cy + ri * Math.sin(ea)
        const x4 = cx + ri * Math.cos(sa), y4 = cy + ri * Math.sin(sa)
        const large = ea - sa > Math.PI ? 1 : 0
        return `M ${x1} ${y1} A ${ro} ${ro} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${ri} ${ri} 0 ${large} 0 ${x4} ${y4} Z`
    }

    const segments = data.map((seg, i) => {
        const sweep = Math.max((seg.value / total) * 2 * Math.PI - GAP, 0.01)
        const sa = startAngle + GAP / 2
        const ea = sa + sweep
        startAngle += (seg.value / total) * 2 * Math.PI
        return { ...seg, sa, ea, i }
    })

    const hovSeg = hovered != null ? segments[hovered] : null
    const displayValue = hovSeg ? hovSeg.value : total
    const displayLabel = hovSeg ? hovSeg.name : "Total"

    return (
        <svg width={size} height={size} style={{ overflow: "visible" }}>
            {/* Track ring */}
            <circle cx={cx} cy={cy} r={(R + r) / 2} fill="none"
                stroke="var(--mx-color-f5f5f7)" strokeWidth={R - r} />
            {/* Segments */}
            {segments.map((seg, i) => {
                const isHov = hovered === i
                const ro = isHov ? R + 6 : R
                const ri = isHov ? r - 2 : r
                return (
                    <path key={i} d={arc(seg.sa, seg.ea, ro, ri)}
                        fill={seg.color}
                        opacity={hovered != null && !isHov ? 0.35 : 1}
                        style={{ transition: "opacity 0.2s, d 0.15s", cursor: "pointer" }}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered(null)}
                    />
                )
            })}
            {/* Center label */}
            <text x={cx} y={cy - 11} textAnchor="middle"
                style={{ fontSize: 11, fontWeight: 600, fill: "var(--color-text-secondary)", letterSpacing: 0.5 }}>
                {displayLabel}
            </text>
            <text x={cx} y={cy + 11} textAnchor="middle"
                style={{ fontSize: 15, fontWeight: 800, fill: "var(--color-text-primary)" }}>
                {fmtShort(displayValue)}
            </text>
            <text x={cx} y={cy + 27} textAnchor="middle"
                style={{ fontSize: 10, fontWeight: 500, fill: "var(--color-text-secondary)" }}>
                LKR
            </text>
        </svg>
    )
}

// ─── Bar chart ────────────────────────────────────────────────────────────────
function BarChart({ bars, height = 180 }) {
    const max = Math.max(...bars.map(b => b.value), 1)
    return (
        <div className="flex items-end gap-4 px-2" style={{ height }}>
            {bars.map((bar, i) => (
                <div key={i} className="flex flex-col items-center flex-1 gap-2 group min-w-0">
                    <span className="text-[11px] font-bold text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">{fmt(bar.value)}</span>
                    <div className="w-full rounded-t-xl transition-all duration-500 cursor-default"
                        style={{ height: `${Math.max(8, (bar.value / max) * (height - 52))}px`, background: bar.color || "var(--mx-color-c6ff00)" }}
                        title={`${bar.label}: ${fmt(bar.value)}`}
                    />
                    <span className="text-[11px] font-semibold text-[var(--color-text-secondary)] truncate w-full text-center leading-tight">{bar.label}</span>
                </div>
            ))}
        </div>
    )
}

// ─── Period helpers ───────────────────────────────────────────────────────────
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const MONTH_NAMES_FULL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

const firstOfMonth = (year, month) => `${year}-${String(month + 1).padStart(2, "0")}-01`
const lastOfMonth = (year, month) => {
    const last = new Date(year, month + 1, 0)
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`
}

// Given a year+month (0-indexed), return or create the period row in DB
const ensureMonthPeriod = async (userId, year, month) => {
    const start_date = firstOfMonth(year, month)
    const end_date = lastOfMonth(year, month)
    const label = `${MONTH_NAMES_FULL[month]} ${year}`

    const { data: existing } = await supabase
        .from("finance_periods")
        .select("*")
        .eq("user_id", userId)
        .eq("start_date", start_date)
        .eq("end_date", end_date)
        .maybeSingle()

    if (existing) return existing

    const { data: created } = await supabase
        .from("finance_periods")
        .insert({ user_id: userId, label, start_date, end_date, is_active: false })
        .select()
        .single()
    return created
}

// ─── Period picker (filter only — no DB write on select) ─────────────────────
function PeriodPicker({ current, onSelect, onClose }) {
    const now = new Date()
    const [viewYear, setViewYear] = useState(current ? Number(current.start_date.slice(0, 4)) : now.getFullYear())

    const currentKey = current ? current.start_date.slice(0, 7) : null // "YYYY-MM"

    const isFuture = (year, month) => new Date(year, month, 1) > now
    const isSelected = (year, month) => currentKey === `${year}-${String(month + 1).padStart(2, "0")}`

    const handlePick = (year, month) => {
        if (isFuture(year, month)) return
        onSelect(year, month)
        onClose()
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--color-surface)] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-[var(--mx-color-e5e5ea)]" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-[var(--mx-color-c6ff00)]/15 flex items-center justify-center text-[var(--mx-color-c6ff00)]">
                        <CalIcon />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-bold text-[var(--color-text-primary)]">Select Month</h3>
                        <p className="text-[11px] text-[var(--color-text-secondary)]">Periods always start on the 1st</p>
                    </div>
                </div>

                {/* Year nav */}
                <div className="flex items-center justify-between mb-4">
                    <button onClick={() => setViewYear(v => v - 1)}
                        className="p-1.5 rounded-lg hover:bg-[var(--mx-color-f5f5f7)] text-[var(--color-text-secondary)] transition-colors">
                        <Icon size="w-4 h-4" d="M15 19l-7-7 7-7" />
                    </button>
                    <span className="text-[15px] font-bold text-[var(--color-text-primary)]">{viewYear}</span>
                    <button onClick={() => setViewYear(v => v + 1)}
                        disabled={viewYear >= now.getFullYear()}
                        className="p-1.5 rounded-lg hover:bg-[var(--mx-color-f5f5f7)] text-[var(--color-text-secondary)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                        <Icon size="w-4 h-4" d="M9 5l7 7-7 7" />
                    </button>
                </div>

                {/* Month grid */}
                <div className="grid grid-cols-4 gap-2">
                    {MONTH_NAMES.map((name, i) => {
                        const future = isFuture(viewYear, i)
                        const sel = isSelected(viewYear, i)
                        return (
                            <button key={i} onClick={() => handlePick(viewYear, i)} disabled={future}
                                className={`py-3 rounded-xl text-[12px] font-bold transition-all border ${sel
                                    ? "bg-[var(--mx-color-c6ff00)] text-black border-[var(--mx-color-c6ff00)] shadow-sm"
                                    : future
                                        ? "border-transparent text-[var(--color-text-secondary)] opacity-25 cursor-not-allowed"
                                        : "border-[var(--mx-color-e5e5ea)] text-[var(--color-text-primary)] hover:border-[var(--mx-color-c6ff00)]/60 hover:bg-[var(--mx-color-f5f5f7)]"}`}>
                                {name}
                            </button>
                        )
                    })}
                </div>

                <button onClick={onClose}
                    className="w-full mt-4 py-2.5 rounded-xl border border-[var(--mx-color-e5e5ea)] text-[13px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--mx-color-f5f5f7)] transition-colors">
                    Cancel
                </button>
            </div>
        </div>
    )
}

// ─── Fuzzy input ──────────────────────────────────────────────────────────────
function FuzzyInput({ value, onChange, suggestions, placeholder, className = "" }) {
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState(value || "")
    const ref = useRef(null)

    useEffect(() => { setQuery(value || "") }, [value])
    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
        document.addEventListener("mousedown", handler)
        return () => document.removeEventListener("mousedown", handler)
    }, [])

    const filtered = useMemo(() => suggestions.filter(s => fuzzyMatch(s, query)).slice(0, 8), [suggestions, query])

    return (
        <div className={`relative ${className}`} ref={ref}>
            <input value={query} onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true) }}
                onFocus={() => setOpen(true)} placeholder={placeholder} className={inputCls} />
            {open && filtered.length > 0 && (
                <div className="absolute z-40 left-0 right-0 mt-1 bg-[var(--color-surface)] border border-[var(--mx-color-e5e5ea)] rounded-xl shadow-xl overflow-hidden">
                    {filtered.map(s => (
                        <button key={s} type="button" onMouseDown={() => { setQuery(s); onChange(s); setOpen(false) }}
                            className="w-full text-left px-3 py-2 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--mx-color-f5f5f7)] transition-colors first:rounded-t-xl last:rounded-b-xl">
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, color, accent, icon }) {
    return (
        <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4 flex flex-col gap-2 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 rounded-full opacity-[0.06] -translate-y-6 translate-x-6" style={{ background: accent }} />
            <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest">{label}</p>
                {icon && <span className="text-[var(--color-text-secondary)] opacity-60">{icon}</span>}
            </div>
            <p className={`text-[22px] font-black leading-none ${color}`}>{value}</p>
            {sub && <p className="text-[11px] text-[var(--color-text-secondary)] font-medium">{sub}</p>}
        </div>
    )
}

// ─── Section header ───────────────────────────────────────────────────────────
function SectionHeader({ title, children }) {
    return (
        <div className="flex items-center justify-between mb-4">
            <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] tracking-tight">{title}</h3>
            <div className="flex items-center gap-2">{children}</div>
        </div>
    )
}

// ─── Pill button ─────────────────────────────────────────────────────────────
function Btn({ onClick, disabled, variant = "ghost", children, title }) {
    const base = "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-40"
    const variants = {
        primary: "bg-[var(--mx-color-c6ff00)] text-black hover:opacity-90",
        ghost: "bg-[var(--mx-color-f5f5f7)] text-[var(--color-text-secondary)] hover:bg-[var(--mx-color-e5e5ea)] border border-[var(--mx-color-e5e5ea)]",
        outline: "border border-[var(--mx-color-e5e5ea)] text-[var(--color-text-secondary)] hover:bg-[var(--mx-color-f5f5f7)]",
    }
    return <button onClick={onClick} disabled={disabled} title={title} className={`${base} ${variants[variant]}`}>{children}</button>
}

// ─── Entry row (compact, used in both Income and Expenses lists) ──────────────
function EntryRow({ left, sub, badge, right, rightColor, detail, onDelete }) {
    return (
        <div className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--mx-color-f5f5f7)] transition-colors">
            <div className={`w-1.5 h-8 rounded-full flex-shrink-0 ${rightColor === "emerald" ? "bg-emerald-400" : "bg-red-400"}`} />
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">{left}</span>
                    {badge}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                    {sub && <span className="text-[11px] text-[var(--color-text-secondary)] truncate">{sub}</span>}
                    {detail && <span className="text-[10px] text-[var(--color-text-secondary)] opacity-70">{detail}</span>}
                </div>
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0">
                <span className={`text-[13px] font-bold tabular-nums ${rightColor === "emerald" ? "text-emerald-600" : "text-red-500"}`}>{right}</span>
                <button onClick={onDelete}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-secondary)] hover:text-red-500 p-1 rounded-lg hover:bg-red-50">
                    <TrashIcon />
                </button>
            </div>
        </div>
    )
}

// ─── Add form panel (inline, collapsible) ─────────────────────────────────────
function AddPanel({ show, onCancel, onSave, saving, err, children, saveLabel = "Save" }) {
    if (!show) return null
    return (
        <div className="mb-3 p-4 rounded-xl bg-[var(--mx-color-fafafc)] border border-[var(--mx-color-e5e5ea)] space-y-3">
            {children}
            {err && <p className="text-red-500 text-[11px] font-medium">{err}</p>}
            <div className="flex gap-2 pt-1">
                <button onClick={onCancel} className="flex-1 py-2 rounded-xl border border-[var(--mx-color-e5e5ea)] text-[12px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--mx-color-f5f5f7)] transition-colors">Cancel</button>
                <button onClick={onSave} disabled={saving} className="flex-1 py-2 rounded-xl bg-[var(--mx-color-c6ff00)] text-black text-[12px] font-bold hover:opacity-90 transition-opacity disabled:opacity-50">{saving ? "Saving…" : saveLabel}</button>
            </div>
        </div>
    )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Finance() {
    const { user } = useAuth()
    const [tab, setTab] = useState("Overview")
    const [selectedPeriod, setSelectedPeriod] = useState(null)
    const [showPeriodPicker, setShowPeriodPicker] = useState(false)
    const [incomeTypes, setIncomeTypes] = useState([])
    const [expenseCategories, setExpenseCategories] = useState([])
    const [incomeEntries, setIncomeEntries] = useState([])
    const [expenseEntries, setExpenseEntries] = useState([])
    const [subscriptions, setSubscriptions] = useState([])
    const [loading, setLoading] = useState(true)

    const loadEntriesForPeriod = useCallback(async (periodRow) => {
        if (!periodRow) { setIncomeEntries([]); setExpenseEntries([]); return }
        const [incRes, expRes] = await Promise.all([
            supabase.from("finance_income_entries").select("*").eq("user_id", user.id).eq("period_id", periodRow.id).order("entry_date", { ascending: false }),
            supabase.from("finance_expense_entries").select("*").eq("user_id", user.id).eq("period_id", periodRow.id).order("entry_date", { ascending: false }),
        ])
        setIncomeEntries(incRes.data || [])
        setExpenseEntries(expRes.data || [])
    }, [user?.id])

    const fetchAll = useCallback(async () => {
        if (!user?.id) return
        setLoading(true)
        try {
            const now = new Date()
            // Auto-create this month's period if it doesn't exist yet
            const currentMonthPeriod = await ensureMonthPeriod(user.id, now.getFullYear(), now.getMonth())

            const [typesRes, catsRes, subsRes] = await Promise.all([
                supabase.from("finance_income_types").select("*").eq("user_id", user.id).order("name"),
                supabase.from("finance_expense_categories").select("*").eq("user_id", user.id).order("name"),
                supabase.from("subscriptions").select("*").eq("user_id", user.id),
            ])
            setIncomeTypes(typesRes.data || [])
            setExpenseCategories(catsRes.data || [])
            setSubscriptions(subsRes.data || [])

            // Default to current month
            setSelectedPeriod(currentMonthPeriod)
            await loadEntriesForPeriod(currentMonthPeriod)
        } finally {
            setLoading(false)
        }
    }, [user?.id, loadEntriesForPeriod])

    useEffect(() => { fetchAll() }, [fetchAll])

    // Called when user picks a month from PeriodPicker — pure client filter, no DB write
    const handleSelectPeriod = useCallback(async (year, month) => {
        if (!user?.id) return
        const period = await ensureMonthPeriod(user.id, year, month)
        setSelectedPeriod(period)
        await loadEntriesForPeriod(period)
    }, [user?.id, loadEntriesForPeriod])

    const refreshEntries = useCallback(() => loadEntriesForPeriod(selectedPeriod), [selectedPeriod, loadEntriesForPeriod])

    const totalIncome = useMemo(() => incomeEntries.reduce((s, e) => s + Number(e.amount_lkr), 0), [incomeEntries])
    const totalExpenses = useMemo(() => expenseEntries.reduce((s, e) => s + Number(e.amount_lkr), 0), [expenseEntries])
    const netBalance = totalIncome - totalExpenses

    const expenseByCategory = useMemo(() => {
        const map = {}
        expenseEntries.forEach(e => { map[e.category_name] = (map[e.category_name] || 0) + Number(e.amount_lkr) })
        return Object.entries(map).sort((a, b) => b[1] - a[1])
    }, [expenseEntries])

    const donutData = expenseByCategory.map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }))

    const incomeByType = useMemo(() => {
        const map = {}
        incomeEntries.forEach(e => { map[e.income_type_name] = (map[e.income_type_name] || 0) + Number(e.amount_lkr) })
        return Object.entries(map).sort((a, b) => b[1] - a[1])
    }, [incomeEntries])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-[3px] border-[var(--mx-color-c6ff00)] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const TABS = ["Overview", "Income", "Expenses", "Reports"]

    return (
        <div className="max-w-7xl mx-auto space-y-5">
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-[22px] font-black text-[var(--color-text-primary)] tracking-tight">Finance</h1>
                    <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 font-medium">
                        {selectedPeriod
                            ? `${selectedPeriod.label} · ${fmtDate(selectedPeriod.start_date)} – ${fmtDate(selectedPeriod.end_date)}`
                            : "Loading…"}
                    </p>
                </div>
                <button onClick={() => setShowPeriodPicker(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--mx-color-c6ff00)] hover:shadow-sm">
                    <CalIcon />
                    Change Period
                </button>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-0.5 bg-[var(--mx-color-f5f5f7)] rounded-xl p-1 w-fit border border-[var(--mx-color-e5e5ea)]">
                {TABS.map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all ${tab === t
                            ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm border border-[var(--mx-color-e5e5ea)]"
                            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}>
                        {t}
                    </button>
                ))}
            </div>

            {tab === "Overview" && <OverviewTab period={selectedPeriod} totalIncome={totalIncome} totalExpenses={totalExpenses} netBalance={netBalance} incomeEntries={incomeEntries} expenseEntries={expenseEntries} expenseByCategory={expenseByCategory} incomeByType={incomeByType} donutData={donutData} expenseCategories={expenseCategories} />}
            {tab === "Income" && <IncomeTab user={user} period={selectedPeriod} incomeTypes={incomeTypes} incomeEntries={incomeEntries} onRefresh={refreshEntries} />}
            {tab === "Expenses" && <ExpensesTab user={user} period={selectedPeriod} expenseCategories={expenseCategories} expenseEntries={expenseEntries} subscriptions={subscriptions} onRefresh={refreshEntries} />}
            {tab === "Reports" && <ReportsTab user={user} period={selectedPeriod} totalIncome={totalIncome} totalExpenses={totalExpenses} netBalance={netBalance} expenseByCategory={expenseByCategory} incomeByType={incomeByType} donutData={donutData} expenseCategories={expenseCategories} expenseEntries={expenseEntries} incomeEntries={incomeEntries} />}

            {showPeriodPicker && <PeriodPicker current={selectedPeriod} onSelect={handleSelectPeriod} onClose={() => setShowPeriodPicker(false)} />}
        </div>
    )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ period, totalIncome, totalExpenses, netBalance, incomeEntries, expenseEntries, expenseByCategory, incomeByType, donutData, expenseCategories }) {
    const recentEntries = useMemo(() => {
        const inc = incomeEntries.map(e => ({ ...e, _kind: "income" }))
        const exp = expenseEntries.map(e => ({ ...e, _kind: "expense" }))
        return [...inc, ...exp].sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date)).slice(0, 10)
    }, [incomeEntries, expenseEntries])

    const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : null

    return (
        <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Income" value={`LKR ${fmtShort(totalIncome)}`} sub={`${incomeEntries.length} entries`} color="text-emerald-600" accent="#22C55E" />
                <StatCard label="Expenses" value={`LKR ${fmtShort(totalExpenses)}`} sub={`${expenseEntries.length} entries`} color="text-red-500" accent="#EF4444" />
                <StatCard
                    label="Net Balance"
                    value={`${netBalance < 0 ? "−" : ""}LKR ${fmtShort(Math.abs(netBalance))}`}
                    sub={netBalance >= 0 ? "Surplus" : "Deficit"}
                    color={netBalance >= 0 ? "text-emerald-600" : "text-red-500"}
                    accent={netBalance >= 0 ? "#22C55E" : "#EF4444"}
                />
                <StatCard
                    label="Savings Rate"
                    value={savingsRate != null ? `${savingsRate}%` : "—"}
                    sub={savingsRate != null ? (savingsRate >= 20 ? "On track" : "Aim for 20%+") : "No data yet"}
                    color={savingsRate >= 20 ? "text-emerald-600" : savingsRate >= 0 ? "text-amber-500" : "text-red-500"}
                    accent="#c6ff00"
                />
            </div>

            {/* Expense breakdown — full width */}
            {donutData.length > 0 ? (
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                    <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-4">Expense Breakdown</h3>
                    <div className="flex flex-col sm:flex-row gap-8 items-center">
                        <div className="shrink-0">
                            <PieChart data={donutData} size={280} total={totalExpenses} />
                        </div>
                        <div className="flex-1 space-y-2.5 w-full min-w-0">
                            {expenseByCategory.map(([name, value], i) => {
                                const pct = totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : 0
                                const budget = expenseCategories.find(c => c.name === name)?.budget_lkr
                                const over = budget && value > budget
                                return (
                                    <div key={name}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                                <span className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate">{name}</span>
                                                {over && <span className="text-[9px] font-bold text-red-500 shrink-0 px-1.5 py-0.5 rounded-full bg-red-50">OVER</span>}
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0 ml-3">
                                                {budget && <span className={`text-[10px] font-medium ${over ? "text-red-500" : "text-[var(--color-text-secondary)]"}`}>/ {fmt(budget)}</span>}
                                                <span className="text-[12px] font-bold text-[var(--color-text-primary)] tabular-nums">{fmt(value)}</span>
                                                <span className="text-[10px] text-[var(--color-text-secondary)] w-9 text-right">{pct}%</span>
                                            </div>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-[var(--mx-color-f5f5f7)] overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-dashed border-[var(--mx-color-e5e5ea)] p-8 flex items-center justify-center">
                    <p className="text-[12px] text-[var(--color-text-secondary)]">No expenses yet this period.</p>
                </div>
            )}

            {/* Recent activity — full width */}
            <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-3">Recent Activity</h3>
                {recentEntries.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                        <p className="text-[12px] text-[var(--color-text-secondary)]">No entries yet for this period.</p>
                    </div>
                ) : (
                    <div className="space-y-0.5">
                        {recentEntries.map(e => (
                            <div key={e.id} className="flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-[var(--mx-color-f5f5f7)] transition-colors">
                                <div className={`w-1.5 h-7 rounded-full shrink-0 ${e._kind === "income" ? "bg-emerald-400" : "bg-red-400"}`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">{e._kind === "income" ? e.income_type_name : e.category_name}</p>
                                    {e.note && <p className="text-[11px] text-[var(--color-text-secondary)] truncate">{e.note}</p>}
                                </div>
                                <div className="text-right shrink-0">
                                    <p className={`text-[13px] font-bold tabular-nums ${e._kind === "income" ? "text-emerald-600" : "text-red-500"}`}>
                                        {e._kind === "income" ? "+" : "−"}{fmt(e.amount_lkr)}
                                    </p>
                                    <p className="text-[10px] text-[var(--color-text-secondary)]">{fmtDate(e.entry_date)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Income sources bar */}
            {incomeByType.length > 0 && (
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                    <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-4">Income Sources</h3>
                    <BarChart bars={incomeByType.map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] }))} />
                </div>
            )}
        </div>
    )
}

// ─── Income Tab ───────────────────────────────────────────────────────────────
function IncomeTab({ user, period, incomeTypes, incomeEntries, onRefresh }) {
    const [showTypeForm, setShowTypeForm] = useState(false)
    const [newTypeName, setNewTypeName] = useState("")
    const [typeLoading, setTypeLoading] = useState(false)
    const [typeErr, setTypeErr] = useState("")

    const [showEntryForm, setShowEntryForm] = useState(false)
    const [entryType, setEntryType] = useState("")
    const [entryAmount, setEntryAmount] = useState("")
    const [entryDate, setEntryDate] = useState(today())
    const [entryNote, setEntryNote] = useState("")
    const [entryLoading, setEntryLoading] = useState(false)
    const [entryErr, setEntryErr] = useState("")

    const typeNames = useMemo(() => incomeTypes.map(t => t.name), [incomeTypes])

    const handleAddType = async () => {
        if (!newTypeName.trim()) { setTypeErr("Enter a type name"); return }
        if (incomeTypes.some(t => t.name.toLowerCase() === newTypeName.trim().toLowerCase())) { setTypeErr("Type already exists"); return }
        setTypeLoading(true); setTypeErr("")
        const { error } = await supabase.from("finance_income_types").insert({ user_id: user.id, name: newTypeName.trim() })
        setTypeLoading(false)
        if (error) { setTypeErr(error.message); return }
        setNewTypeName(""); setShowTypeForm(false); onRefresh()
    }

    const handleAddEntry = async () => {
        if (!entryType.trim()) { setEntryErr("Select an income type"); return }
        if (!entryAmount || Number(entryAmount) <= 0) { setEntryErr("Enter a valid amount"); return }
        if (!period) { setEntryErr("No financial period set"); return }
        setEntryLoading(true); setEntryErr("")
        const { error } = await supabase.from("finance_income_entries").insert({
            user_id: user.id, period_id: period.id,
            income_type_name: entryType.trim(), amount_lkr: Number(entryAmount),
            note: entryNote.trim() || null, entry_date: entryDate,
        })
        setEntryLoading(false)
        if (error) { setEntryErr(error.message); return }
        setEntryType(""); setEntryAmount(""); setEntryNote(""); setEntryDate(today()); setShowEntryForm(false); onRefresh()
    }

    const handleDeleteEntry = async (id) => {
        if (!window.confirm("Delete this income entry?")) return
        await supabase.from("finance_income_entries").delete().eq("id", id); onRefresh()
    }

    const handleDeleteType = async (id) => {
        if (!window.confirm("Delete this income type?")) return
        await supabase.from("finance_income_types").delete().eq("id", id); onRefresh()
    }

    return (
        <div className="space-y-4">
            {/* Income types */}
            <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                <SectionHeader title="Income Types">
                    <Btn onClick={() => setShowTypeForm(v => !v)}><PlusIcon size="w-3.5 h-3.5" /> Add Type</Btn>
                </SectionHeader>
                <AddPanel show={showTypeForm} onCancel={() => { setShowTypeForm(false); setTypeErr("") }} onSave={handleAddType} saving={typeLoading} err={typeErr} saveLabel="Add Type">
                    <input value={newTypeName} onChange={e => setNewTypeName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddType()}
                        placeholder="e.g. Salary, Freelance, Rental…" className={inputCls} autoFocus />
                </AddPanel>
                <div className="flex flex-wrap gap-2">
                    {incomeTypes.length === 0 && <p className="text-[12px] text-[var(--color-text-secondary)]">No income types yet. Add one above.</p>}
                    {incomeTypes.map(t => (
                        <div key={t.id} className="group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-[var(--mx-color-f5f5f7)] border border-[var(--mx-color-e5e5ea)] hover:border-[var(--mx-color-c6ff00)]/40 transition-colors">
                            <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{t.name}</span>
                            <button onClick={() => handleDeleteType(t.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-secondary)] hover:text-red-500 p-0.5 rounded-full"><TrashIcon /></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add income entry */}
            {period && (
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                    <SectionHeader title={`Entries · ${incomeEntries.length}`}>
                        <Btn onClick={() => setShowEntryForm(v => !v)} variant="primary"><PlusIcon size="w-3.5 h-3.5" /> Add Income</Btn>
                    </SectionHeader>
                    <AddPanel show={showEntryForm} onCancel={() => { setShowEntryForm(false); setEntryErr("") }} onSave={handleAddEntry} saving={entryLoading} err={entryErr} saveLabel="Save Entry">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Income Type</label>
                                <FuzzyInput value={entryType} onChange={setEntryType} suggestions={typeNames} placeholder="Select or type income type" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Amount (LKR)</label>
                                <input type="number" min="0" step="0.01" value={entryAmount} onChange={e => setEntryAmount(e.target.value)} placeholder="0.00" className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Date</label>
                                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Note (optional)</label>
                                <input value={entryNote} onChange={e => setEntryNote(e.target.value)} placeholder="Optional note" className={inputCls} />
                            </div>
                        </div>
                    </AddPanel>

                    {incomeEntries.length === 0 ? (
                        <div className="py-8 text-center">
                            <p className="text-[12px] text-[var(--color-text-secondary)]">No income entries yet. Add your first one above.</p>
                        </div>
                    ) : (
                        <div className="space-y-0.5 max-h-[420px] overflow-y-auto pr-0.5">
                            {/* Column headers */}
                            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 pb-1 mb-1 border-b border-[var(--mx-color-f5f5f7)]">
                                <span className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Type · Note</span>
                                <span className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide text-right">Amount</span>
                                <span className="w-6" />
                            </div>
                            {incomeEntries.map(e => (
                                <EntryRow key={e.id}
                                    left={e.income_type_name}
                                    sub={e.note || fmtDate(e.entry_date)}
                                    detail={e.note ? fmtDate(e.entry_date) : null}
                                    right={`+${fmt(e.amount_lkr)}`}
                                    rightColor="emerald"
                                    onDelete={() => handleDeleteEntry(e.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
            {!period && (
                <div className="rounded-2xl border border-dashed border-[var(--mx-color-e5e5ea)] p-8 text-center">
                    <p className="text-[12px] text-[var(--color-text-secondary)]">Set a financial period first to add income.</p>
                </div>
            )}
        </div>
    )
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────
function ExpensesTab({ user, period, expenseCategories, expenseEntries, subscriptions, onRefresh }) {
    const [showCatForm, setShowCatForm] = useState(false)
    const [newCatName, setNewCatName] = useState("")
    const [newCatBudget, setNewCatBudget] = useState("")
    const [catLoading, setCatLoading] = useState(false)
    const [catErr, setCatErr] = useState("")

    const [showEntryForm, setShowEntryForm] = useState(false)
    const [entryCategory, setEntryCategory] = useState("")
    const [entryAmount, setEntryAmount] = useState("")
    const [entryCurrency, setEntryCurrency] = useState("LKR")
    const [entryDate, setEntryDate] = useState(today())
    const [entryNote, setEntryNote] = useState("")
    const [entryLoading, setEntryLoading] = useState(false)
    const [entryErr, setEntryErr] = useState("")
    const [convertedPreview, setConvertedPreview] = useState(null)
    const [converting, setConverting] = useState(false)

    const [importLoading, setImportLoading] = useState(false)
    const [importMsg, setImportMsg] = useState("")

    const catNames = useMemo(() => expenseCategories.map(c => c.name), [expenseCategories])

    useEffect(() => {
        if (!entryAmount || Number(entryAmount) <= 0 || entryCurrency === "LKR") { setConvertedPreview(null); return }
        let cancelled = false
        setConverting(true)
        fetchCurrencyConversion({ amount: Number(entryAmount), fromCurrency: entryCurrency, toCurrency: "LKR" })
            .then(r => { if (!cancelled) setConvertedPreview(r) })
            .catch(() => { if (!cancelled) setConvertedPreview(null) })
            .finally(() => { if (!cancelled) setConverting(false) })
        return () => { cancelled = true }
    }, [entryAmount, entryCurrency])

    const handleAddCategory = async () => {
        if (!newCatName.trim()) { setCatErr("Enter a category name"); return }
        if (expenseCategories.some(c => c.name.toLowerCase() === newCatName.trim().toLowerCase())) { setCatErr("Category already exists"); return }
        setCatLoading(true); setCatErr("")
        const { error } = await supabase.from("finance_expense_categories").insert({ user_id: user.id, name: newCatName.trim(), budget_lkr: newCatBudget ? Number(newCatBudget) : null })
        setCatLoading(false)
        if (error) { setCatErr(error.message); return }
        setNewCatName(""); setNewCatBudget(""); setShowCatForm(false); onRefresh()
    }

    const handleDeleteCategory = async (id) => {
        if (!window.confirm("Delete this category?")) return
        await supabase.from("finance_expense_categories").delete().eq("id", id); onRefresh()
    }

    const handleAddEntry = async () => {
        if (!entryCategory.trim()) { setEntryErr("Select a category"); return }
        if (!entryAmount || Number(entryAmount) <= 0) { setEntryErr("Enter a valid amount"); return }
        if (!period) { setEntryErr("No financial period set"); return }
        setEntryLoading(true); setEntryErr("")
        let amountLkr = Number(entryAmount)
        if (entryCurrency !== "LKR") {
            try { amountLkr = await fetchCurrencyConversion({ amount: amountLkr, fromCurrency: entryCurrency, toCurrency: "LKR" }) }
            catch { setEntryErr("Currency conversion failed. Try again."); setEntryLoading(false); return }
        }
        const { error } = await supabase.from("finance_expense_entries").insert({
            user_id: user.id, period_id: period.id, category_name: entryCategory.trim(),
            amount_original: Number(entryAmount), currency_original: entryCurrency,
            amount_lkr: amountLkr, note: entryNote.trim() || null, entry_date: entryDate,
        })
        setEntryLoading(false)
        if (error) { setEntryErr(error.message); return }
        setEntryCategory(""); setEntryAmount(""); setEntryCurrency("LKR"); setEntryNote(""); setEntryDate(today()); setShowEntryForm(false); setConvertedPreview(null); onRefresh()
    }

    const handleDeleteEntry = async (id) => {
        if (!window.confirm("Delete this expense?")) return
        await supabase.from("finance_expense_entries").delete().eq("id", id); onRefresh()
    }

    const handleImportSubscriptions = async () => {
        if (!period) { setImportMsg("Set a financial period first."); return }
        if (!subscriptions.length) { setImportMsg("No subscriptions found."); return }
        setImportLoading(true); setImportMsg("")
        const { data: alreadyImported } = await supabase
            .from("finance_expense_entries").select("subscription_id")
            .eq("user_id", user.id).eq("period_id", period.id).eq("is_from_subscription", true).not("subscription_id", "is", null)
        const existingSubIds = new Set((alreadyImported || []).map(e => e.subscription_id))
        const toImport = subscriptions.filter(s => !existingSubIds.has(s.id))
        if (!toImport.length) { setImportLoading(false); setImportMsg("All subscriptions already imported for this period."); return }
        let imported = 0
        for (const sub of toImport) {
            try {
                let amountLkr = Number(sub.amount)
                if (sub.currency && sub.currency !== "LKR") amountLkr = await fetchCurrencyConversion({ amount: amountLkr, fromCurrency: sub.currency, toCurrency: "LKR" })
                await supabase.from("finance_expense_entries").insert({
                    user_id: user.id, period_id: period.id, category_name: sub.name || "Subscription",
                    amount_original: Number(sub.amount), currency_original: sub.currency || "LKR", amount_lkr: amountLkr,
                    note: "Auto-imported from Subscriptions", entry_date: period.start_date, is_from_subscription: true, subscription_id: sub.id,
                })
                imported++
            } catch { /* skip */ }
        }
        setImportLoading(false)
        setImportMsg(`Imported ${imported} subscription${imported !== 1 ? "s" : ""}.`)
        onRefresh()
    }

    return (
        <div className="space-y-4">
            {/* Categories */}
            <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                <SectionHeader title="Expense Categories">
                    <Btn onClick={() => setShowCatForm(v => !v)}><PlusIcon size="w-3.5 h-3.5" /> Add Category</Btn>
                </SectionHeader>
                <AddPanel show={showCatForm} onCancel={() => { setShowCatForm(false); setCatErr("") }} onSave={handleAddCategory} saving={catLoading} err={catErr} saveLabel="Add Category">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Category Name</label>
                            <input value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddCategory()} placeholder="e.g. Food, Rent, Transport…" className={inputCls} autoFocus />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Monthly Budget (LKR, optional)</label>
                            <input type="number" min="0" step="0.01" value={newCatBudget} onChange={e => setNewCatBudget(e.target.value)} placeholder="e.g. 30000" className={inputCls} />
                        </div>
                    </div>
                </AddPanel>
                <div className="flex flex-wrap gap-2">
                    {expenseCategories.length === 0 && <p className="text-[12px] text-[var(--color-text-secondary)]">No categories yet.</p>}
                    {expenseCategories.map(c => (
                        <div key={c.id} className="group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-[var(--mx-color-f5f5f7)] border border-[var(--mx-color-e5e5ea)] hover:border-[var(--mx-color-c6ff00)]/40 transition-colors">
                            <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{c.name}</span>
                            {c.budget_lkr && <span className="text-[10px] text-[var(--color-text-secondary)] font-medium">· LKR {fmtShort(c.budget_lkr)}</span>}
                            <button onClick={() => handleDeleteCategory(c.id)} className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-secondary)] hover:text-red-500 p-0.5 rounded-full"><TrashIcon /></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add expense */}
            {period && (
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                    <SectionHeader title={`Entries · ${expenseEntries.length}`}>
                        <Btn onClick={handleImportSubscriptions} disabled={importLoading} title="Import subscriptions as expenses">
                            <ImportIcon /> {importLoading ? "Importing…" : "Import Subs"}
                        </Btn>
                        <Btn onClick={() => setShowEntryForm(v => !v)} variant="primary">
                            <PlusIcon size="w-3.5 h-3.5" /> Add Expense
                        </Btn>
                    </SectionHeader>

                    {importMsg && (
                        <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--mx-color-f5f5f7)] border border-[var(--mx-color-e5e5ea)]">
                            <span className="text-[11px] font-semibold text-[var(--color-text-secondary)]">{importMsg}</span>
                            <button onClick={() => setImportMsg("")} className="ml-auto text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
                                <Icon size="w-3.5 h-3.5" d="M6 18L18 6M6 6l12 12" />
                            </button>
                        </div>
                    )}

                    <AddPanel show={showEntryForm} onCancel={() => { setShowEntryForm(false); setEntryErr("") }} onSave={handleAddEntry} saving={entryLoading} err={entryErr} saveLabel="Save Expense">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Category</label>
                                <FuzzyInput value={entryCategory} onChange={setEntryCategory} suggestions={catNames} placeholder="Search or type category" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Amount</label>
                                <div className="flex gap-2">
                                    <input type="number" min="0" step="0.01" value={entryAmount} onChange={e => setEntryAmount(e.target.value)} placeholder="0.00"
                                        className="flex-1 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50 transition-shadow" />
                                    <select value={entryCurrency} onChange={e => setEntryCurrency(e.target.value)}
                                        className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-2 py-2 text-[12px] font-bold text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50">
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                {entryCurrency !== "LKR" && (
                                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1 font-medium">
                                        {converting ? "Converting…" : convertedPreview != null ? `≈ ${fmt(convertedPreview)} LKR` : ""}
                                    </p>
                                )}
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Date</label>
                                <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Note (optional)</label>
                                <input value={entryNote} onChange={e => setEntryNote(e.target.value)} placeholder="Optional note" className={inputCls} />
                            </div>
                        </div>
                    </AddPanel>

                    {expenseEntries.length === 0 ? (
                        <div className="py-8 text-center">
                            <p className="text-[12px] text-[var(--color-text-secondary)]">No expense entries yet. Add one or import from subscriptions.</p>
                        </div>
                    ) : (
                        <div className="space-y-0.5 max-h-[420px] overflow-y-auto pr-0.5">
                            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 pb-1 mb-1 border-b border-[var(--mx-color-f5f5f7)]">
                                <span className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Category · Note</span>
                                <span className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide text-right">Amount (LKR)</span>
                                <span className="w-6" />
                            </div>
                            {expenseEntries.map(e => (
                                <EntryRow key={e.id}
                                    left={e.category_name}
                                    sub={e.note || fmtDate(e.entry_date)}
                                    detail={e.note ? fmtDate(e.entry_date) : null}
                                    badge={e.is_from_subscription && (
                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 leading-none">SUB</span>
                                    )}
                                    right={`−${fmt(e.amount_lkr)}`}
                                    rightColor="red"
                                    onDelete={() => handleDeleteEntry(e.id)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
            {!period && (
                <div className="rounded-2xl border border-dashed border-[var(--mx-color-e5e5ea)] p-8 text-center">
                    <p className="text-[12px] text-[var(--color-text-secondary)]">Set a financial period first to add expenses.</p>
                </div>
            )}
        </div>
    )
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab({ user, period, totalIncome, totalExpenses, netBalance, expenseByCategory, incomeByType, donutData, expenseCategories, expenseEntries, incomeEntries }) {
    const [aiSuggestions, setAiSuggestions] = useState("")
    const [aiLoading, setAiLoading] = useState(false)
    const [aiErr, setAiErr] = useState("")

    const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : null
    const topExpense = expenseByCategory[0] || null
    const topIncome = incomeByType[0] || null

    const budgetAlerts = useMemo(() => expenseByCategory.map(([name, spent]) => {
        const cat = expenseCategories.find(c => c.name === name)
        if (!cat?.budget_lkr) return null
        const pct = (spent / cat.budget_lkr) * 100
        return pct >= 80 ? { name, spent, budget: cat.budget_lkr, pct } : null
    }).filter(Boolean), [expenseByCategory, expenseCategories])

    const handleGetAISuggestions = async () => {
        setAiLoading(true); setAiErr(""); setAiSuggestions("")
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const summary = {
                period: period?.label, totalIncome, totalExpenses, netBalance, savingsRate,
                expenseByCategory: expenseByCategory.slice(0, 6).map(([name, value]) => ({ name, value })),
                incomeByType: incomeByType.slice(0, 4).map(([name, value]) => ({ name, value })),
                budgetAlerts: budgetAlerts.map(a => ({ name: a.name, spent: a.spent, budget: a.budget, pct: a.pct })),
                entryCount: incomeEntries.length + expenseEntries.length,
            }
            const message = `You are a personal finance advisor. Analyze this user's financial data for the period "${summary.period || 'unknown'}" and give 3–5 concise, actionable suggestions to improve their financial health. Be specific, practical, and friendly. Data: ${JSON.stringify(summary)}`
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY },
                body: JSON.stringify({ type: "chat", message, userLocalNow: new Date().toISOString(), timezoneOffsetMinutes: new Date().getTimezoneOffset() }),
            })
            const data = await res.json()
            if (data.error) { setAiErr(data.error); return }
            setAiSuggestions(data.summary || data.message || "No suggestions returned.")
        } catch { setAiErr("Failed to get AI suggestions. Make sure your AI Assistant API key is set up.") }
        finally { setAiLoading(false) }
    }

    if (!period) return (
        <div className="rounded-2xl border border-dashed border-[var(--mx-color-e5e5ea)] p-8 text-center">
            <p className="text-[12px] text-[var(--color-text-secondary)]">Set a financial period to view reports.</p>
        </div>
    )

    return (
        <div className="space-y-4">
            {/* Metrics row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Income" value={`LKR ${fmtShort(totalIncome)}`} color="text-emerald-600" accent="#22C55E" />
                <StatCard label="Expenses" value={`LKR ${fmtShort(totalExpenses)}`} color="text-red-500" accent="#EF4444" />
                <StatCard label="Net" value={`${netBalance < 0 ? "−" : ""}LKR ${fmtShort(Math.abs(netBalance))}`} color={netBalance >= 0 ? "text-emerald-600" : "text-red-500"} accent={netBalance >= 0 ? "#22C55E" : "#EF4444"} />
                <StatCard label="Savings Rate" value={savingsRate != null ? `${savingsRate}%` : "—"} color={savingsRate >= 20 ? "text-emerald-600" : "text-amber-500"} accent="#c6ff00" />
            </div>

            {/* Budget alerts */}
            {budgetAlerts.length > 0 && (
                <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-4">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest mb-2.5">Budget Alerts</p>
                    <div className="space-y-2">
                        {budgetAlerts.map(a => (
                            <div key={a.name} className="flex items-center gap-3">
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-[12px] font-semibold text-amber-900">{a.name}</span>
                                        <span className={`text-[11px] font-bold ${a.pct >= 100 ? "text-red-600" : "text-amber-700"}`}>{a.pct.toFixed(0)}%</span>
                                    </div>
                                    <div className="h-1.5 rounded-full bg-amber-200 overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(a.pct, 100)}%`, background: a.pct >= 100 ? "#EF4444" : "#F59E0B" }} />
                                    </div>
                                    <p className="text-[10px] text-amber-700 mt-0.5">{fmt(a.spent)} of {fmt(a.budget)} budget</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Charts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {donutData.length > 0 && (
                    <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                        <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-4">Expense Split</h3>
                        <div className="flex flex-col items-center gap-4">
                            <DonutChart data={donutData} size={130} strokeWidth={24} />
                            <div className="w-full space-y-1.5">
                                {expenseByCategory.slice(0, 6).map(([name, value], i) => (
                                    <div key={name} className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                        <span className="text-[12px] text-[var(--color-text-primary)] flex-1 truncate">{name}</span>
                                        <span className="text-[11px] font-bold text-[var(--color-text-primary)] tabular-nums">{totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : 0}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
                {incomeByType.length > 0 && (
                    <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                        <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-4">Income Sources</h3>
                        <BarChart bars={incomeByType.map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] }))} />
                        <div className="mt-3 space-y-1.5">
                            {incomeByType.map(([name, value], i) => (
                                <div key={name} className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                    <span className="text-[12px] text-[var(--color-text-primary)] flex-1">{name}</span>
                                    <span className="text-[11px] font-bold text-[var(--color-text-primary)] tabular-nums">{fmt(value)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Key insights */}
            <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-3">Key Insights</h3>
                <div className="space-y-2">
                    {topExpense && (
                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50/60 border border-red-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                            <p className="text-[12px] text-[var(--color-text-secondary)]">Biggest expense: <strong className="text-[var(--color-text-primary)]">{topExpense[0]}</strong> at <strong className="text-red-500">{fmt(topExpense[1])}</strong></p>
                        </div>
                    )}
                    {topIncome && (
                        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
                            <p className="text-[12px] text-[var(--color-text-secondary)]">Main income: <strong className="text-[var(--color-text-primary)]">{topIncome[0]}</strong> at <strong className="text-emerald-600">{fmt(topIncome[1])}</strong></p>
                        </div>
                    )}
                    {savingsRate != null && (
                        <div className={`flex items-start gap-2.5 p-3 rounded-xl border ${savingsRate >= 20 ? "bg-emerald-50/60 border-emerald-100" : "bg-amber-50/60 border-amber-100"}`}>
                            <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${savingsRate >= 20 ? "bg-emerald-400" : "bg-amber-400"}`} />
                            <p className="text-[12px] text-[var(--color-text-secondary)]">
                                Saving <strong className={savingsRate >= 20 ? "text-emerald-600" : "text-amber-600"}>{savingsRate}%</strong> of income
                                {savingsRate >= 20 ? " — great work!" : savingsRate >= 0 ? ". Try to reach 20%." : " — spending exceeds income."}
                            </p>
                        </div>
                    )}
                    {totalExpenses === 0 && totalIncome === 0 && (
                        <p className="text-[12px] text-[var(--color-text-secondary)] p-3">No data yet. Add income and expenses to see insights.</p>
                    )}
                </div>
            </div>

            {/* AI suggestions */}
            <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-[var(--mx-color-c6ff00)]/15 flex items-center justify-center text-[var(--mx-color-c6ff00)]">
                            <SparkleIcon />
                        </div>
                        <h3 className="text-[13px] font-bold text-[var(--color-text-primary)]">AI Suggestions</h3>
                    </div>
                    <Btn onClick={handleGetAISuggestions} disabled={aiLoading} variant="primary">
                        {aiLoading ? "Analyzing…" : "Get Suggestions"}
                    </Btn>
                </div>
                {aiErr && <p className="text-red-500 text-[12px] mb-2 font-medium">{aiErr}</p>}
                {!aiSuggestions && !aiLoading && !aiErr && (
                    <p className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">
                        Click <strong>Get Suggestions</strong> for personalized AI advice on your spending and savings. Requires AI Assistant API key.
                    </p>
                )}
                {aiLoading && (
                    <div className="flex items-center gap-2.5 py-2">
                        <div className="w-4 h-4 border-2 border-[var(--mx-color-c6ff00)] border-t-transparent rounded-full animate-spin" />
                        <span className="text-[12px] text-[var(--color-text-secondary)] font-medium">Analyzing your finances…</span>
                    </div>
                )}
                {aiSuggestions && (
                    <div className="text-[13px] text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed bg-[var(--mx-color-fafafc)] rounded-xl p-4 border border-[var(--mx-color-e5e5ea)]">
                        {aiSuggestions}
                    </div>
                )}
            </div>
        </div>
    )
}
