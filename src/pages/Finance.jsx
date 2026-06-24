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
function PeriodPicker({ current, selectedDays, onSelect, onDaysChange, onClose }) {
    const now = new Date()
    const [viewYear, setViewYear] = useState(current ? Number(current.start_date.slice(0, 4)) : now.getFullYear())
    const [step, setStep] = useState("month") // "month" | "day"
    // pendingMonth tracks which month was picked so we can build the day grid
    const [pendingMonth, setPendingMonth] = useState(
        current ? Number(current.start_date.slice(5, 7)) - 1 : now.getMonth()
    )

    const currentKey = current ? current.start_date.slice(0, 7) : null
    const isFuture = (year, month) => new Date(year, month, 1) > now
    const isMonthSelected = (year, month) => currentKey === `${year}-${String(month + 1).padStart(2, "0")}`

    const handlePickMonth = (year, month) => {
        if (isFuture(year, month)) return
        onSelect(year, month) // triggers period load + clears days in parent
        setPendingMonth(month)
        setViewYear(year)
        setStep("day")
    }

    const daysInMonth = new Date(viewYear, pendingMonth + 1, 0).getDate()
    const dayNumbers = Array.from({ length: daysInMonth }, (_, i) => i + 1)

    const toggleDay = (d) => {
        const next = new Set(selectedDays)
        if (next.has(d)) next.delete(d)
        else next.add(d)
        onDaysChange(next)
    }

    const monthLabel = `${MONTH_NAMES_FULL[pendingMonth]} ${viewYear}`

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[var(--color-surface)] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-[var(--mx-color-e5e5ea)]" onClick={e => e.stopPropagation()}>

                {step === "month" ? (<>
                    <div className="flex items-center gap-2.5 mb-5">
                        <div className="w-8 h-8 rounded-xl bg-[var(--mx-color-c6ff00)]/15 flex items-center justify-center text-[var(--mx-color-c6ff00)]">
                            <CalIcon />
                        </div>
                        <div>
                            <h3 className="text-[15px] font-bold text-[var(--color-text-primary)]">Select Month</h3>
                            <p className="text-[11px] text-[var(--color-text-secondary)]">Then optionally filter by specific days</p>
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
                            const sel = isMonthSelected(viewYear, i)
                            return (
                                <button key={i} onClick={() => handlePickMonth(viewYear, i)} disabled={future}
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
                </>) : (<>
                    {/* Day picker step */}
                    <div className="flex items-center gap-2 mb-1">
                        <button onClick={() => setStep("month")}
                            className="p-1 rounded-lg hover:bg-[var(--mx-color-f5f5f7)] text-[var(--color-text-secondary)] transition-colors">
                            <Icon size="w-4 h-4" d="M15 19l-7-7 7-7" />
                        </button>
                        <div>
                            <h3 className="text-[15px] font-bold text-[var(--color-text-primary)]">{monthLabel}</h3>
                            <p className="text-[11px] text-[var(--color-text-secondary)]">Select days to filter · optional</p>
                        </div>
                    </div>

                    {selectedDays.size > 0 && (
                        <div className="flex items-center justify-between mb-3 mt-2 px-0.5">
                            <span className="text-[10px] font-bold text-[var(--color-text-secondary)]">{selectedDays.size} day{selectedDays.size > 1 ? "s" : ""} selected</span>
                            <button onClick={() => onDaysChange(new Set())}
                                className="text-[10px] font-bold text-red-400 hover:text-red-500 transition-colors">Clear all</button>
                        </div>
                    )}

                    {/* Day grid */}
                    <div className="grid grid-cols-7 gap-1.5 mt-3">
                        {dayNumbers.map(d => {
                            const sel = selectedDays.has(d)
                            return (
                                <button key={d} onClick={() => toggleDay(d)}
                                    className={`aspect-square rounded-lg text-[11px] font-bold transition-all border ${sel
                                        ? "bg-[var(--mx-color-c6ff00)] text-black border-[var(--mx-color-c6ff00)] shadow-sm"
                                        : "border-[var(--mx-color-e5e5ea)] text-[var(--color-text-primary)] hover:border-[var(--mx-color-c6ff00)]/60 hover:bg-[var(--mx-color-f5f5f7)]"}`}>
                                    {d}
                                </button>
                            )
                        })}
                    </div>

                    <button onClick={onClose}
                        className="w-full mt-4 py-2.5 rounded-xl bg-[var(--mx-color-c6ff00)] text-black text-[13px] font-bold hover:opacity-90 transition-opacity">
                        {selectedDays.size > 0 ? `Apply ${selectedDays.size} day filter${selectedDays.size > 1 ? "s" : ""}` : "Apply (whole month)"}
                    </button>
                </>)}
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
    const [selectedDays, setSelectedDays] = useState(new Set())
    const [showPeriodPicker, setShowPeriodPicker] = useState(false)
    const [incomeTypes, setIncomeTypes] = useState([])
    const [expenseCategories, setExpenseCategories] = useState([])
    const [incomeEntries, setIncomeEntries] = useState([])
    const [expenseEntries, setExpenseEntries] = useState([])
    const [subscriptions, setSubscriptions] = useState([])
    const [creditCards, setCreditCards] = useState([])
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

            const [typesRes, catsRes, subsRes, cardsRes] = await Promise.all([
                supabase.from("finance_income_types").select("*").eq("user_id", user.id).order("name"),
                supabase.from("finance_expense_categories").select("*").eq("user_id", user.id).order("name"),
                supabase.from("subscriptions").select("*").eq("user_id", user.id),
                supabase.from("finance_credit_cards").select("*").eq("user_id", user.id).order("created_at"),
            ])
            setIncomeTypes(typesRes.data || [])
            setExpenseCategories(catsRes.data || [])
            setSubscriptions(subsRes.data || [])
            setCreditCards(cardsRes.data || [])

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
        setSelectedDays(new Set())
        await loadEntriesForPeriod(period)
    }, [user?.id, loadEntriesForPeriod])

    const refreshEntries = useCallback(() => loadEntriesForPeriod(selectedPeriod), [selectedPeriod, loadEntriesForPeriod])

    const filteredIncomeEntries = useMemo(() => {
        if (selectedDays.size === 0) return incomeEntries
        return incomeEntries.filter(e => selectedDays.has(new Date(e.entry_date).getUTCDate()))
    }, [incomeEntries, selectedDays])

    const filteredExpenseEntries = useMemo(() => {
        if (selectedDays.size === 0) return expenseEntries
        return expenseEntries.filter(e => selectedDays.has(new Date(e.entry_date).getUTCDate()))
    }, [expenseEntries, selectedDays])

    const totalIncome = useMemo(() => filteredIncomeEntries.reduce((s, e) => s + Number(e.amount_lkr), 0), [filteredIncomeEntries])
    const totalExpenses = useMemo(() => filteredExpenseEntries.reduce((s, e) => s + Number(e.amount_lkr), 0), [filteredExpenseEntries])
    const netBalance = totalIncome - totalExpenses

    const expenseByCategory = useMemo(() => {
        const map = {}
        filteredExpenseEntries.forEach(e => { map[e.category_name] = (map[e.category_name] || 0) + Number(e.amount_lkr) })
        return Object.entries(map).sort((a, b) => b[1] - a[1])
    }, [filteredExpenseEntries])

    const donutData = expenseByCategory.map(([name, value], i) => ({ name, value, color: CHART_COLORS[i % CHART_COLORS.length] }))

    const incomeByType = useMemo(() => {
        const map = {}
        filteredIncomeEntries.forEach(e => { map[e.income_type_name] = (map[e.income_type_name] || 0) + Number(e.amount_lkr) })
        return Object.entries(map).sort((a, b) => b[1] - a[1])
    }, [filteredIncomeEntries])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-[3px] border-[var(--mx-color-c6ff00)] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    const TABS = ["Overview", "Income", "Expenses", "Credit Cards", "Reports"]

    return (
        <div className="max-w-7xl mx-auto space-y-5 min-w-0 overflow-x-hidden">
            {/* ── Header ── */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-[22px] font-black text-[var(--color-text-primary)] tracking-tight">Finance</h1>
                    <p className="text-[12px] text-[var(--color-text-secondary)] mt-0.5 font-medium">
                        {selectedPeriod
                            ? `${selectedPeriod.label} · ${fmtDate(selectedPeriod.start_date)} – ${fmtDate(selectedPeriod.end_date)}`
                            : "Loading…"}
                    </p>
                    {selectedDays.size > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Days:</span>
                            {[...selectedDays].sort((a, b) => a - b).map(d => (
                                <span key={d} className="text-[10px] font-bold bg-[var(--mx-color-c6ff00)] text-black px-1.5 py-0.5 rounded-md">{d}</span>
                            ))}
                            <button onClick={() => setSelectedDays(new Set())} className="text-[10px] font-bold text-[var(--color-text-secondary)] hover:text-red-500 transition-colors ml-1">✕ clear</button>
                        </div>
                    )}
                </div>
                <button onClick={() => setShowPeriodPicker(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-all border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] text-[var(--color-text-primary)] hover:border-[var(--mx-color-c6ff00)] hover:shadow-sm">
                    <CalIcon />
                    {selectedDays.size > 0 ? `${selectedDays.size} day${selectedDays.size > 1 ? "s" : ""} filtered` : "Change Period"}
                </button>
            </div>

            {/* ── Tabs ── */}
            <div className="w-full overflow-x-auto">
                <div className="flex gap-0.5 bg-[var(--mx-color-f5f5f7)] rounded-xl p-1 w-fit min-w-full sm:min-w-0 border border-[var(--mx-color-e5e5ea)]">
                    {TABS.map(t => (
                        <button key={t} onClick={() => setTab(t)}
                            className={`px-3 sm:px-4 py-1.5 rounded-lg text-[11px] sm:text-[12px] font-bold transition-all whitespace-nowrap ${tab === t
                                ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm border border-[var(--mx-color-e5e5ea)]"
                                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {tab === "Overview" && <OverviewTab period={selectedPeriod} totalIncome={totalIncome} totalExpenses={totalExpenses} netBalance={netBalance} incomeEntries={filteredIncomeEntries} expenseEntries={filteredExpenseEntries} expenseByCategory={expenseByCategory} incomeByType={incomeByType} donutData={donutData} expenseCategories={expenseCategories} creditCards={creditCards} />}
            {tab === "Income" && <IncomeTab user={user} period={selectedPeriod} incomeTypes={incomeTypes} incomeEntries={filteredIncomeEntries} onRefresh={refreshEntries} />}
            {tab === "Expenses" && <ExpensesTab user={user} period={selectedPeriod} expenseCategories={expenseCategories} expenseEntries={filteredExpenseEntries} subscriptions={subscriptions} onRefresh={refreshEntries} />}
            {tab === "Credit Cards" && <CreditCardsTab user={user} period={selectedPeriod} creditCards={creditCards} onRefreshCards={fetchAll} />}
            {tab === "Reports" && <ReportsTab user={user} period={selectedPeriod} totalIncome={totalIncome} totalExpenses={totalExpenses} netBalance={netBalance} expenseByCategory={expenseByCategory} incomeByType={incomeByType} donutData={donutData} expenseCategories={expenseCategories} expenseEntries={filteredExpenseEntries} incomeEntries={filteredIncomeEntries} />}

            {showPeriodPicker && <PeriodPicker current={selectedPeriod} selectedDays={selectedDays} onSelect={handleSelectPeriod} onDaysChange={setSelectedDays} onClose={() => setShowPeriodPicker(false)} />}
        </div>
    )
}

// ─── Card network logos (SVG text badges) ─────────────────────────────────────
const CARD_NETWORKS = ["Visa", "Mastercard", "Amex", "UnionPay", "JCB", "Discover"]
const CARD_COLORS = ["#3B82F6", "#8B5CF6", "#EC4899", "#F97316", "#10B981", "#F59E0B", "#06B6D4", "#EF4444"]

function NetworkBadge({ network, size = "sm" }) {
    const small = size === "sm"
    const base = small ? "text-[9px] px-1.5 py-0.5 rounded font-black tracking-wide" : "text-[11px] px-2 py-1 rounded-md font-black tracking-wide"
    const styles = {
        Visa: "bg-blue-600 text-white",
        Mastercard: "bg-gradient-to-r from-red-500 to-orange-400 text-white",
        Amex: "bg-blue-800 text-white",
        UnionPay: "bg-red-600 text-white",
        JCB: "bg-green-600 text-white",
        Discover: "bg-orange-500 text-white",
    }
    return <span className={`${base} ${styles[network] || "bg-gray-600 text-white"}`}>{network}</span>
}

// ─── Visual credit card widget ─────────────────────────────────────────────────
function CardVisual({ card }) {
    const utilPct = card.credit_limit_lkr > 0
        ? Math.min((card.current_balance_lkr / card.credit_limit_lkr) * 100, 100)
        : 0
    const available = Math.max(card.credit_limit_lkr - card.current_balance_lkr, 0)
    return (
        <div className="rounded-2xl p-4 relative overflow-hidden flex flex-col gap-3 min-h-[130px]"
            style={{ background: `linear-gradient(135deg, ${card.color}ee 0%, ${card.color}99 100%)` }}>
            {/* Decorative circles */}
            <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full opacity-20 bg-white" />
            <div className="absolute -bottom-4 -right-2 w-16 h-16 rounded-full opacity-10 bg-white" />
            <div className="flex items-start justify-between relative z-10">
                <div className="min-w-0">
                    <p className="text-white/70 text-[10px] font-bold uppercase tracking-widest truncate">{card.bank_name}</p>
                    <p className="text-white text-[14px] font-black truncate leading-tight mt-0.5">{card.nickname || card.card_network + " Card"}</p>
                </div>
                <NetworkBadge network={card.card_network} size="sm" />
            </div>
            <div className="relative z-10 mt-auto">
                <div className="flex items-end justify-between mb-1.5">
                    <div>
                        <p className="text-white/60 text-[9px] font-bold uppercase tracking-wide">Balance</p>
                        <p className="text-white text-[15px] font-black tabular-nums leading-none">{fmtShort(card.current_balance_lkr)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-white/60 text-[9px] font-bold uppercase tracking-wide">Available</p>
                        <p className="text-white text-[13px] font-bold tabular-nums leading-none">{fmtShort(available)}</p>
                    </div>
                </div>
                <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <div className="h-full rounded-full bg-white/80 transition-all duration-700" style={{ width: `${utilPct}%` }} />
                </div>
                <p className="text-white/60 text-[9px] mt-1 font-medium">{utilPct.toFixed(1)}% of {fmtShort(card.credit_limit_lkr)} LKR limit used</p>
            </div>
        </div>
    )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ period, totalIncome, totalExpenses, netBalance, incomeEntries, expenseEntries, expenseByCategory, incomeByType, donutData, expenseCategories, creditCards }) {
    const recentEntries = useMemo(() => {
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - 14)
        const inc = incomeEntries.map(e => ({ ...e, _kind: "income" }))
        const exp = expenseEntries.map(e => ({ ...e, _kind: "expense" }))
        return [...inc, ...exp]
            .filter(e => new Date(e.entry_date) >= cutoff)
            .sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date))
    }, [incomeEntries, expenseEntries])

    const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : null
    const spendRate = totalIncome > 0 ? Math.min((totalExpenses / totalIncome) * 100, 100) : 0

    return (
        <div className="space-y-4 min-w-0 w-full overflow-x-hidden">
            {/* ── Hero metric cards ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.04]" style={{ background: "radial-gradient(circle at 80% 20%, #22C55E 60%, transparent 100%)" }} />
                    <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">Total Income</p>
                    <p className="text-[20px] font-black text-emerald-600 leading-none tabular-nums">{fmtShort(totalIncome)}</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 font-medium">LKR · {incomeEntries.length} entries</p>
                    <div className="mt-3 h-1 rounded-full bg-emerald-100 overflow-hidden">
                        <div className="h-full bg-emerald-400 rounded-full w-full" />
                    </div>
                </div>
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.04]" style={{ background: "radial-gradient(circle at 80% 20%, #EF4444 60%, transparent 100%)" }} />
                    <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">Total Expenses</p>
                    <p className="text-[20px] font-black text-red-500 leading-none tabular-nums">{fmtShort(totalExpenses)}</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 font-medium">LKR · {expenseEntries.length} entries</p>
                    <div className="mt-3 h-1 rounded-full bg-red-100 overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full transition-all duration-700" style={{ width: `${spendRate}%` }} />
                    </div>
                </div>
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.04]" style={{ background: `radial-gradient(circle at 80% 20%, ${netBalance >= 0 ? "#22C55E" : "#EF4444"} 60%, transparent 100%)` }} />
                    <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">Net Balance</p>
                    <p className={`text-[20px] font-black leading-none tabular-nums ${netBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {netBalance < 0 ? "−" : ""}{fmtShort(Math.abs(netBalance))}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 font-medium">LKR · {netBalance >= 0 ? "Surplus" : "Deficit"}</p>
                    <div className="mt-3 h-1 rounded-full bg-[var(--mx-color-f5f5f7)] overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-700 ${netBalance >= 0 ? "bg-emerald-400" : "bg-red-400"}`}
                            style={{ width: totalIncome > 0 ? `${Math.min(Math.abs(netBalance / totalIncome) * 100, 100)}%` : "0%" }} />
                    </div>
                </div>
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4 relative overflow-hidden">
                    <div className="absolute inset-0 opacity-[0.05]" style={{ background: "radial-gradient(circle at 80% 20%, #c6ff00 60%, transparent 100%)" }} />
                    <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">Savings Rate</p>
                    <p className={`text-[20px] font-black leading-none tabular-nums ${savingsRate >= 20 ? "text-emerald-600" : savingsRate >= 0 ? "text-amber-500" : "text-red-500"}`}>
                        {savingsRate != null ? `${savingsRate}%` : "—"}
                    </p>
                    <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 font-medium">
                        {savingsRate != null ? (Number(savingsRate) >= 20 ? "On track ✓" : Number(savingsRate) >= 0 ? "Aim for 20%+" : "Over budget") : "No data yet"}
                    </p>
                    {savingsRate != null && (
                        <div className="mt-3 h-1 rounded-full bg-[var(--mx-color-f5f5f7)] overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700"
                                style={{ width: `${Math.min(Math.max(Number(savingsRate), 0), 100)}%`, background: Number(savingsRate) >= 20 ? "#22C55E" : "#F59E0B" }} />
                        </div>
                    )}
                </div>
            </div>

            {/* ── Expense Breakdown + Recent Activity ── */}
            <div className="grid lg:grid-cols-[1fr_360px] gap-4 finance-main-grid">
                {/* Expense Breakdown */}
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5 flex flex-col finance-main-card min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-5 shrink-0 min-w-0">
                        <div className="min-w-0">
                            <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] truncate">Expense Breakdown</h3>
                            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{expenseByCategory.length} categories this period</p>
                        </div>
                        {donutData.length > 0 && (
                            <span className="text-[11px] font-bold text-[var(--color-text-secondary)] bg-[var(--mx-color-f5f5f7)] px-2.5 py-1 rounded-lg border border-[var(--mx-color-e5e5ea)] tabular-nums shrink-0">
                                {fmtShort(totalExpenses)} LKR
                            </span>
                        )}
                    </div>
                    {donutData.length > 0 ? (
                        <div className="flex flex-col sm:flex-row gap-6 items-center flex-1 min-h-0 min-w-0">
                            <div className="shrink-0 flex justify-center w-full sm:w-auto">
                                <PieChart data={donutData} size={200} total={totalExpenses} />
                            </div>
                            <div className="flex-1 overflow-y-auto min-h-0 w-full min-w-0 space-y-3">
                                {expenseByCategory.map(([name, value], i) => {
                                    const pct = totalExpenses > 0 ? (value / totalExpenses) * 100 : 0
                                    const budget = expenseCategories.find(c => c.name === name)?.budget_lkr
                                    const over = budget && value > budget
                                    return (
                                        <div key={name} className="min-w-0">
                                            <div className="flex items-center gap-2 mb-1.5 min-w-0">
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                                <span className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate flex-1 min-w-0">{name}</span>
                                                {over && <span className="text-[9px] font-bold text-red-500 shrink-0 px-1.5 py-0.5 rounded-full bg-red-50 border border-red-100">OVER</span>}
                                                <span className="text-[11px] font-bold text-[var(--color-text-primary)] tabular-nums shrink-0">{fmtShort(value)}</span>
                                                <span className="text-[10px] text-[var(--color-text-secondary)] shrink-0 tabular-nums">{pct.toFixed(1)}%</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-[var(--mx-color-f5f5f7)] overflow-hidden">
                                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3">
                            <div className="w-12 h-12 rounded-2xl bg-[var(--mx-color-f5f5f7)] flex items-center justify-center">
                                <svg className="w-6 h-6 text-[var(--color-text-secondary)] opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                </svg>
                            </div>
                            <p className="text-[12px] text-[var(--color-text-secondary)]">No expenses yet this period</p>
                        </div>
                    )}
                </div>

                {/* Recent activity */}
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5 flex flex-col finance-main-card min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-4 shrink-0 min-w-0">
                        <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] truncate">Recent Activity</h3>
                        <span className="text-[10px] font-bold text-[var(--color-text-secondary)] bg-[var(--mx-color-f5f5f7)] px-2 py-1 rounded-lg border border-[var(--mx-color-e5e5ea)] shrink-0">last 14d · {recentEntries.length}</span>
                    </div>
                    {recentEntries.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center">
                            <p className="text-[12px] text-[var(--color-text-secondary)]">No entries yet for this period.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto min-h-0 space-y-1">
                            {recentEntries.map(e => (
                                <div key={e.id} className="flex items-center gap-3 px-2.5 py-2.5 rounded-xl hover:bg-[var(--mx-color-f5f5f7)] transition-colors">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[13px] font-black ${e._kind === "income" ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-500"}`}>
                                        {e._kind === "income" ? "↑" : "↓"}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate leading-tight">
                                            {e._kind === "income" ? e.income_type_name : e.category_name}
                                        </p>
                                        <p className="text-[10px] text-[var(--color-text-secondary)] truncate leading-tight mt-0.5">
                                            {e.note || fmtDate(e.entry_date)}
                                        </p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className={`text-[12px] font-bold tabular-nums ${e._kind === "income" ? "text-emerald-600" : "text-red-500"}`}>
                                            {e._kind === "income" ? "+" : "−"}{fmtShort(e.amount_lkr)}
                                        </p>
                                        <p className="text-[10px] text-[var(--color-text-secondary)]">{fmtDate(e.entry_date)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Credit Card Summary ── */}
            {creditCards.length > 0 && (
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5 min-w-0">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-[13px] font-bold text-[var(--color-text-primary)]">Credit Cards</h3>
                            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{creditCards.length} card{creditCards.length > 1 ? "s" : ""} · total debt {fmtShort(creditCards.reduce((s, c) => s + Number(c.current_balance_lkr), 0))} LKR</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {creditCards.map(card => <CardVisual key={card.id} card={card} />)}
                    </div>
                </div>
            )}

            {/* ── Income Sources ── */}
            {incomeByType.length > 0 && (
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5 min-w-0">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-[13px] font-bold text-[var(--color-text-primary)]">Income Sources</h3>
                            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{incomeByType.length} source{incomeByType.length > 1 ? "s" : ""} this period</p>
                        </div>
                    </div>
                    <div className="grid lg:grid-cols-2 gap-6 items-end min-w-0">
                        <div className="min-w-0"><BarChart bars={incomeByType.map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] }))} /></div>
                        <div className="space-y-2.5 min-w-0">
                            {incomeByType.map(([name, value], i) => {
                                const pct = totalIncome > 0 ? ((value / totalIncome) * 100).toFixed(1) : 0
                                return (
                                    <div key={name}>
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                                <span className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate">{name}</span>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0 ml-3">
                                                <span className="text-[11px] font-bold text-emerald-600 tabular-nums">{fmtShort(value)}</span>
                                                <span className="text-[10px] text-[var(--color-text-secondary)] w-8 text-right">{pct}%</span>
                                            </div>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-[var(--mx-color-f5f5f7)] overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-700"
                                                style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
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
                        <div className="flex flex-col">
                            {/* Column headers — pinned, never scrolls */}
                            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 pb-1 mb-1 border-b border-[var(--mx-color-f5f5f7)] shrink-0">
                                <span className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Type · Note</span>
                                <span className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide text-right">Amount</span>
                                <span className="w-6" />
                            </div>
                            <div className="space-y-0.5 max-h-[420px] overflow-y-auto pr-0.5">
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
                    note: "Auto-imported from Subscriptions", entry_date: (() => {
                        if (!sub.renewal_date) return period.start_date
                        const day = new Date(sub.renewal_date).getUTCDate()
                        const periodYear = Number(period.start_date.slice(0, 4))
                        const periodMonth = Number(period.start_date.slice(5, 7))
                        const daysInMonth = new Date(periodYear, periodMonth, 0).getDate()
                        return `${period.start_date.slice(0, 7)}-${String(Math.min(day, daysInMonth)).padStart(2, "0")}`
                    })(), is_from_subscription: true, subscription_id: sub.id,
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
                        <div className="flex flex-col">
                            {/* Column headers — pinned, never scrolls */}
                            <div className="grid grid-cols-[1fr_auto_auto] gap-2 px-3 pb-1 mb-1 border-b border-[var(--mx-color-f5f5f7)] shrink-0">
                                <span className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Category · Note</span>
                                <span className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide text-right">Amount (LKR)</span>
                                <span className="w-6" />
                            </div>
                            <div className="space-y-0.5 max-h-[420px] overflow-y-auto pr-0.5">
                                {expenseEntries.map(e => (
                                    <EntryRow key={e.id}
                                        left={e.category_name}
                                        sub={e.note || fmtDate(e.entry_date)}
                                        detail={e.note ? fmtDate(e.entry_date) : null}
                                        badge={
                                            e.is_cc_repayment
                                                ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-600 leading-none shrink-0">CC REPAY</span>
                                                : e.is_from_subscription
                                                    ? <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 leading-none shrink-0">SUB</span>
                                                    : null
                                        }
                                        right={`−${fmt(e.amount_lkr)}`}
                                        rightColor="red"
                                        onDelete={() => handleDeleteEntry(e.id)}
                                    />
                                ))}
                            </div>
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

// ─── Credit Cards Tab ─────────────────────────────────────────────────────────
function CreditCardsTab({ user, period, creditCards, onRefreshCards }) {
    // ── Add card form state ──
    const [showAddCard, setShowAddCard] = useState(false)
    const [cardBank, setCardBank] = useState("")
    const [cardNetwork, setCardNetwork] = useState("Visa")
    const [cardNickname, setCardNickname] = useState("")
    const [cardLimit, setCardLimit] = useState("")
    const [cardColor, setCardColor] = useState(CARD_COLORS[0])
    const [cardLoading, setCardLoading] = useState(false)
    const [cardErr, setCardErr] = useState("")

    // ── Edit limit state ──
    const [editingLimitId, setEditingLimitId] = useState(null)
    const [editLimitVal, setEditLimitVal] = useState("")

    // ── Selected card for drill-down ──
    const [selectedCardId, setSelectedCardId] = useState(null)

    // ── CC expense form ──
    const [showExpenseForm, setShowExpenseForm] = useState(false)
    const [expCategory, setExpCategory] = useState("")
    const [expAmount, setExpAmount] = useState("")
    const [expCurrency, setExpCurrency] = useState("LKR")
    const [expDate, setExpDate] = useState(today())
    const [expNote, setExpNote] = useState("")
    const [expLoading, setExpLoading] = useState(false)
    const [expErr, setExpErr] = useState("")
    const [expConvPreview, setExpConvPreview] = useState(null)
    const [expConverting, setExpConverting] = useState(false)

    // ── Repayment form ──
    const [showRepayForm, setShowRepayForm] = useState(false)
    const [repayAmount, setRepayAmount] = useState("")
    const [repayDate, setRepayDate] = useState(today())
    const [repayNote, setRepayNote] = useState("")
    const [repayLoading, setRepayLoading] = useState(false)
    const [repayErr, setRepayErr] = useState("")

    // ── Entries for selected card ──
    const [ccExpenses, setCcExpenses] = useState([])
    const [ccRepayments, setCcRepayments] = useState([])
    const [entriesLoading, setEntriesLoading] = useState(false)

    const selectedCard = creditCards.find(c => c.id === selectedCardId) || null

    const loadCardEntries = useCallback(async (cardId) => {
        if (!cardId) return
        setEntriesLoading(true)
        const [expRes, repRes] = await Promise.all([
            supabase.from("finance_cc_expenses").select("*").eq("user_id", user.id).eq("card_id", cardId).order("entry_date", { ascending: false }),
            supabase.from("finance_cc_repayments").select("*").eq("user_id", user.id).eq("card_id", cardId).order("entry_date", { ascending: false }),
        ])
        setCcExpenses(expRes.data || [])
        setCcRepayments(repRes.data || [])
        setEntriesLoading(false)
    }, [user.id])

    useEffect(() => {
        if (selectedCardId) loadCardEntries(selectedCardId)
    }, [selectedCardId, loadCardEntries])

    // Currency conversion preview for CC expense form
    useEffect(() => {
        if (!expAmount || Number(expAmount) <= 0 || expCurrency === "LKR") { setExpConvPreview(null); return }
        let cancelled = false
        setExpConverting(true)
        fetchCurrencyConversion({ amount: Number(expAmount), fromCurrency: expCurrency, toCurrency: "LKR" })
            .then(r => { if (!cancelled) setExpConvPreview(r) })
            .catch(() => { if (!cancelled) setExpConvPreview(null) })
            .finally(() => { if (!cancelled) setExpConverting(false) })
        return () => { cancelled = true }
    }, [expAmount, expCurrency])

    const resetAddCard = () => { setCardBank(""); setCardNetwork("Visa"); setCardNickname(""); setCardLimit(""); setCardColor(CARD_COLORS[0]); setCardErr("") }

    const handleAddCard = async () => {
        if (!cardBank.trim()) { setCardErr("Enter a bank name"); return }
        if (!cardLimit || Number(cardLimit) <= 0) { setCardErr("Enter a valid credit limit"); return }
        setCardLoading(true); setCardErr("")
        const { error } = await supabase.from("finance_credit_cards").insert({
            user_id: user.id,
            bank_name: cardBank.trim(),
            card_network: cardNetwork,
            nickname: cardNickname.trim() || null,
            credit_limit_lkr: Number(cardLimit),
            current_balance_lkr: 0,
            color: cardColor,
        })
        setCardLoading(false)
        if (error) { setCardErr(error.message); return }
        resetAddCard(); setShowAddCard(false); onRefreshCards()
    }

    const handleDeleteCard = async (id) => {
        if (!window.confirm("Delete this credit card and all its history?")) return
        await supabase.from("finance_credit_cards").delete().eq("id", id)
        if (selectedCardId === id) setSelectedCardId(null)
        onRefreshCards()
    }

    const handleSaveLimit = async (cardId) => {
        if (!editLimitVal || Number(editLimitVal) <= 0) return
        await supabase.from("finance_credit_cards").update({ credit_limit_lkr: Number(editLimitVal) }).eq("id", cardId)
        setEditingLimitId(null); onRefreshCards()
    }

    const handleAddCcExpense = async () => {
        if (!expCategory.trim()) { setExpErr("Enter a category"); return }
        if (!expAmount || Number(expAmount) <= 0) { setExpErr("Enter a valid amount"); return }
        if (!selectedCardId) return
        setExpLoading(true); setExpErr("")
        let amountLkr = Number(expAmount)
        if (expCurrency !== "LKR") {
            try { amountLkr = await fetchCurrencyConversion({ amount: amountLkr, fromCurrency: expCurrency, toCurrency: "LKR" }) }
            catch { setExpErr("Currency conversion failed. Try again."); setExpLoading(false); return }
        }
        const { error } = await supabase.from("finance_cc_expenses").insert({
            user_id: user.id, card_id: selectedCardId,
            period_id: period?.id || null,
            category_name: expCategory.trim(),
            amount_original: Number(expAmount), currency_original: expCurrency,
            amount_lkr: amountLkr, note: expNote.trim() || null, entry_date: expDate,
        })
        if (!error) {
            // Update card balance
            await supabase.from("finance_credit_cards")
                .update({ current_balance_lkr: Number(selectedCard.current_balance_lkr) + amountLkr })
                .eq("id", selectedCardId)
        }
        setExpLoading(false)
        if (error) { setExpErr(error.message); return }
        setExpCategory(""); setExpAmount(""); setExpNote(""); setExpDate(today()); setExpCurrency("LKR"); setShowExpenseForm(false)
        onRefreshCards(); loadCardEntries(selectedCardId)
    }

    const handleDeleteCcExpense = async (entry) => {
        if (!window.confirm("Delete this credit card expense?")) return
        await supabase.from("finance_cc_expenses").delete().eq("id", entry.id)
        // Subtract from card balance
        const newBal = Math.max(Number(selectedCard.current_balance_lkr) - Number(entry.amount_lkr), 0)
        await supabase.from("finance_credit_cards").update({ current_balance_lkr: newBal }).eq("id", selectedCardId)
        onRefreshCards(); loadCardEntries(selectedCardId)
    }

    const handleAddRepayment = async () => {
        if (!repayAmount || Number(repayAmount) <= 0) { setRepayErr("Enter a valid amount"); return }
        if (!selectedCardId) return
        setRepayLoading(true); setRepayErr("")
        const amount = Number(repayAmount)
        const cardLabel = selectedCard.nickname || `${selectedCard.bank_name} ${selectedCard.card_network}`
        const expNote = `CC Repayment · ${cardLabel}${repayNote.trim() ? " · " + repayNote.trim() : ""}`

        // Auto-create cash expense entry so it reduces from cash balance
        const { data: expEntry, error: expError } = await supabase
            .from("finance_expense_entries")
            .insert({
                user_id: user.id, period_id: period?.id || null,
                category_name: "Credit Card Repayment",
                amount_original: amount, currency_original: "LKR", amount_lkr: amount,
                note: expNote, entry_date: repayDate,
                is_cc_repayment: true,
            })
            .select("id")
            .single()

        if (expError) { setRepayErr(expError.message); setRepayLoading(false); return }

        // Insert repayment record linked to the expense entry
        const { error } = await supabase.from("finance_cc_repayments").insert({
            user_id: user.id, card_id: selectedCardId,
            period_id: period?.id || null,
            amount_lkr: amount, note: repayNote.trim() || null, entry_date: repayDate,
            linked_expense_id: expEntry.id,
        })
        if (!error) {
            const newBal = Math.max(Number(selectedCard.current_balance_lkr) - amount, 0)
            await supabase.from("finance_credit_cards").update({ current_balance_lkr: newBal }).eq("id", selectedCardId)
        }
        setRepayLoading(false)
        if (error) { setRepayErr(error.message); return }
        setRepayAmount(""); setRepayNote(""); setRepayDate(today()); setShowRepayForm(false)
        onRefreshCards(); loadCardEntries(selectedCardId)
    }

    const handleDeleteRepayment = async (entry) => {
        if (!window.confirm("Delete this repayment? The linked cash expense will also be removed.")) return
        // Delete the linked expense entry first (if exists)
        if (entry.linked_expense_id) {
            await supabase.from("finance_expense_entries").delete().eq("id", entry.linked_expense_id)
        }
        await supabase.from("finance_cc_repayments").delete().eq("id", entry.id)
        // Restore card balance
        const newBal = Number(selectedCard.current_balance_lkr) + Number(entry.amount_lkr)
        await supabase.from("finance_credit_cards").update({ current_balance_lkr: newBal }).eq("id", selectedCardId)
        onRefreshCards(); loadCardEntries(selectedCardId)
    }

    // Combined timeline of expenses + repayments sorted by date
    const timeline = useMemo(() => {
        const exps = ccExpenses.map(e => ({ ...e, _type: "expense" }))
        const reps = ccRepayments.map(r => ({ ...r, _type: "repayment" }))
        return [...exps, ...reps].sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date))
    }, [ccExpenses, ccRepayments])

    const totalCcDebt = creditCards.reduce((s, c) => s + Number(c.current_balance_lkr), 0)
    const totalCcLimit = creditCards.reduce((s, c) => s + Number(c.credit_limit_lkr), 0)
    const totalAvailable = Math.max(totalCcLimit - totalCcDebt, 0)
    const overallUtil = totalCcLimit > 0 ? (totalCcDebt / totalCcLimit) * 100 : 0

    return (
        <div className="space-y-4 min-w-0">
            {/* ── Summary stats ── */}
            {creditCards.length > 0 && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                        { label: "Total Debt", value: fmtShort(totalCcDebt), sub: "LKR owed across all cards", color: totalCcDebt > 0 ? "text-red-500" : "text-emerald-600", bar: overallUtil, barColor: "#EF4444" },
                        { label: "Total Limit", value: fmtShort(totalCcLimit), sub: `${creditCards.length} card${creditCards.length > 1 ? "s" : ""}`, color: "text-[var(--color-text-primary)]", bar: 100, barColor: "#3B82F6" },
                        { label: "Available Credit", value: fmtShort(totalAvailable), sub: "across all cards", color: "text-emerald-600", bar: totalCcLimit > 0 ? (totalAvailable / totalCcLimit) * 100 : 0, barColor: "#22C55E" },
                        { label: "Utilization", value: `${overallUtil.toFixed(1)}%`, sub: overallUtil >= 80 ? "High — pay down soon" : overallUtil >= 30 ? "Moderate" : "Healthy", color: overallUtil >= 80 ? "text-red-500" : overallUtil >= 30 ? "text-amber-500" : "text-emerald-600", bar: Math.min(overallUtil, 100), barColor: overallUtil >= 80 ? "#EF4444" : overallUtil >= 30 ? "#F59E0B" : "#22C55E" },
                    ].map(m => (
                        <div key={m.label} className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4">
                            <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">{m.label}</p>
                            <p className={`text-[18px] font-black leading-none tabular-nums ${m.color}`}>{m.value}</p>
                            <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 font-medium">{m.sub}</p>
                            <div className="mt-3 h-1 rounded-full bg-[var(--mx-color-f5f5f7)] overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.bar}%`, background: m.barColor }} />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Card list + Add card ── */}
            <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5 min-w-0">
                <SectionHeader title={`My Cards · ${creditCards.length}`}>
                    <Btn onClick={() => setShowAddCard(v => !v)} variant="primary"><PlusIcon size="w-3.5 h-3.5" /> Add Card</Btn>
                </SectionHeader>

                {/* Add card form */}
                <AddPanel show={showAddCard} onCancel={() => { setShowAddCard(false); resetAddCard() }} onSave={handleAddCard} saving={cardLoading} err={cardErr} saveLabel="Add Card">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Bank Name</label>
                            <input value={cardBank} onChange={e => setCardBank(e.target.value)} placeholder="e.g. Sampath Bank, HNB, BOC…" className={inputCls} autoFocus />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Card Network</label>
                            <select value={cardNetwork} onChange={e => setCardNetwork(e.target.value)}
                                className={inputCls}>
                                {CARD_NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Nickname (optional)</label>
                            <input value={cardNickname} onChange={e => setCardNickname(e.target.value)} placeholder="e.g. My Sampath Visa" className={inputCls} />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Credit Limit (LKR)</label>
                            <input type="number" min="0" step="1000" value={cardLimit} onChange={e => setCardLimit(e.target.value)} placeholder="e.g. 150000" className={inputCls} />
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Card Color</label>
                            <div className="flex gap-2 flex-wrap">
                                {CARD_COLORS.map(c => (
                                    <button key={c} type="button" onClick={() => setCardColor(c)}
                                        className={`w-7 h-7 rounded-full transition-all border-2 ${cardColor === c ? "border-[var(--color-text-primary)] scale-110" : "border-transparent"}`}
                                        style={{ background: c }} />
                                ))}
                            </div>
                        </div>
                    </div>
                    {/* Preview */}
                    {cardBank && (
                        <div className="mt-2">
                            <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Preview</p>
                            <CardVisual card={{ bank_name: cardBank, card_network: cardNetwork, nickname: cardNickname, credit_limit_lkr: Number(cardLimit) || 0, current_balance_lkr: 0, color: cardColor }} />
                        </div>
                    )}
                </AddPanel>

                {creditCards.length === 0 ? (
                    <div className="py-10 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-[var(--mx-color-f5f5f7)] flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6 text-[var(--color-text-secondary)] opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                            </svg>
                        </div>
                        <p className="text-[12px] text-[var(--color-text-secondary)]">No credit cards added yet.</p>
                        <p className="text-[11px] text-[var(--color-text-secondary)] opacity-60 mt-1">Click "Add Card" to get started.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-1">
                        {creditCards.map(card => {
                            const utilPct = card.credit_limit_lkr > 0 ? Math.min((card.current_balance_lkr / card.credit_limit_lkr) * 100, 100) : 0
                            const isSelected = selectedCardId === card.id
                            return (
                                <div key={card.id} className={`group cursor-pointer transition-all rounded-2xl border-2 ${isSelected ? "border-[var(--mx-color-c6ff00)]" : "border-transparent hover:border-[var(--mx-color-e5e5ea)]"}`}
                                    onClick={() => setSelectedCardId(isSelected ? null : card.id)}>
                                    <CardVisual card={card} />
                                    {/* Inline controls under each card */}
                                    <div className="px-1 pt-2 pb-1 flex items-center gap-2 flex-wrap">
                                        {editingLimitId === card.id ? (
                                            <div className="flex items-center gap-1.5 flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                                                <input type="number" min="0" step="1000" value={editLimitVal}
                                                    onChange={e => setEditLimitVal(e.target.value)}
                                                    className="flex-1 min-w-0 rounded-lg border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-2 py-1 text-[11px] focus:outline-none focus:ring-1 focus:ring-[var(--mx-color-c6ff00)]/50"
                                                    placeholder="New limit" autoFocus />
                                                <button onClick={() => handleSaveLimit(card.id)} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--mx-color-c6ff00)] text-black">Save</button>
                                                <button onClick={() => setEditingLimitId(null)} className="text-[10px] font-bold px-2 py-1 rounded-lg bg-[var(--mx-color-f5f5f7)] text-[var(--color-text-secondary)]">✕</button>
                                            </div>
                                        ) : (
                                            <button onClick={e => { e.stopPropagation(); setEditingLimitId(card.id); setEditLimitVal(card.credit_limit_lkr) }}
                                                className="text-[10px] font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors opacity-0 group-hover:opacity-100 flex items-center gap-1">
                                                <Icon size="w-3 h-3" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /> Edit Limit
                                            </button>
                                        )}
                                        <button onClick={e => { e.stopPropagation(); handleDeleteCard(card.id) }}
                                            className="text-[10px] font-semibold text-red-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 ml-auto flex items-center gap-1">
                                            <TrashIcon /> Delete
                                        </button>
                                    </div>
                                    <p className="px-1 pb-1 text-[10px] text-[var(--color-text-secondary)] font-medium">{isSelected ? "▲ Click to collapse" : "▼ Click to manage"}</p>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* ── Selected card detail panel ── */}
            {selectedCard && (
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5 min-w-0 space-y-5">
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="w-3 h-8 rounded-full shrink-0" style={{ background: selectedCard.color }} />
                        <div className="min-w-0">
                            <h3 className="text-[15px] font-black text-[var(--color-text-primary)] truncate">
                                {selectedCard.nickname || `${selectedCard.bank_name} ${selectedCard.card_network}`}
                            </h3>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                <NetworkBadge network={selectedCard.card_network} size="sm" />
                                <span className="text-[11px] text-[var(--color-text-secondary)]">{selectedCard.bank_name}</span>
                                <span className="text-[11px] text-[var(--color-text-secondary)]">· Limit: {fmtShort(selectedCard.credit_limit_lkr)} LKR</span>
                            </div>
                        </div>
                        <div className="ml-auto flex gap-2 shrink-0">
                            <Btn onClick={() => { setShowRepayForm(v => !v); setShowExpenseForm(false) }} variant="ghost">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                                Repay
                            </Btn>
                            <Btn onClick={() => { setShowExpenseForm(v => !v); setShowRepayForm(false) }} variant="primary">
                                <PlusIcon size="w-3.5 h-3.5" /> Add Expense
                            </Btn>
                        </div>
                    </div>

                    {/* Add CC Expense form */}
                    <AddPanel show={showExpenseForm} onCancel={() => { setShowExpenseForm(false); setExpErr("") }} onSave={handleAddCcExpense} saving={expLoading} err={expErr} saveLabel="Charge to Card">
                        <p className="text-[11px] text-[var(--color-text-secondary)] font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                            This will increase the card balance, not reduce your cash.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Category</label>
                                <input value={expCategory} onChange={e => setExpCategory(e.target.value)} placeholder="e.g. Dining, Shopping, Fuel…" className={inputCls} autoFocus />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Amount</label>
                                <div className="flex gap-2">
                                    <input type="number" min="0" step="0.01" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0.00"
                                        className="flex-1 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50" />
                                    <select value={expCurrency} onChange={e => setExpCurrency(e.target.value)}
                                        className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-2 py-2 text-[12px] font-bold focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50">
                                        {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                </div>
                                {expCurrency !== "LKR" && (
                                    <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">{expConverting ? "Converting…" : expConvPreview != null ? `≈ ${fmt(expConvPreview)} LKR` : ""}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Date</label>
                                <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className={inputCls} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Note (optional)</label>
                                <input value={expNote} onChange={e => setExpNote(e.target.value)} placeholder="Optional note" className={inputCls} />
                            </div>
                        </div>
                    </AddPanel>

                    {/* Repayment form */}
                    <AddPanel show={showRepayForm} onCancel={() => { setShowRepayForm(false); setRepayErr("") }} onSave={handleAddRepayment} saving={repayLoading} err={repayErr} saveLabel="Record Repayment">
                        <p className="text-[11px] text-[var(--color-text-secondary)] font-medium flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                            Repayment reduces the card balance. Track this as a cash expense in the Expenses tab too.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Repayment Amount (LKR)</label>
                                <input type="number" min="0" step="0.01" value={repayAmount} onChange={e => setRepayAmount(e.target.value)} placeholder="0.00" className={inputCls} autoFocus />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Date</label>
                                <input type="date" value={repayDate} onChange={e => setRepayDate(e.target.value)} className={inputCls} />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1.5">Note (optional)</label>
                                <input value={repayNote} onChange={e => setRepayNote(e.target.value)} placeholder="e.g. Monthly payment" className={inputCls} />
                            </div>
                        </div>
                    </AddPanel>

                    {/* Card balance bar */}
                    {!showExpenseForm && !showRepayForm && (
                        <div className="flex flex-col sm:flex-row gap-3 p-4 rounded-xl bg-[var(--mx-color-fafafc)] border border-[var(--mx-color-e5e5ea)]">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1.5 gap-2">
                                    <span className="text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Balance Used</span>
                                    <span className="text-[11px] font-bold text-red-500 tabular-nums shrink-0">{fmtShort(selectedCard.current_balance_lkr)} LKR</span>
                                </div>
                                <div className="h-2 rounded-full bg-[var(--mx-color-e5e5ea)] overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-700"
                                        style={{ width: `${selectedCard.credit_limit_lkr > 0 ? Math.min((selectedCard.current_balance_lkr / selectedCard.credit_limit_lkr) * 100, 100) : 0}%`, background: selectedCard.color }} />
                                </div>
                                <p className="text-[10px] text-[var(--color-text-secondary)] mt-1">Available: {fmtShort(Math.max(selectedCard.credit_limit_lkr - selectedCard.current_balance_lkr, 0))} LKR</p>
                            </div>
                        </div>
                    )}

                    {/* Transaction timeline */}
                    {entriesLoading ? (
                        <div className="flex justify-center py-6">
                            <div className="w-6 h-6 border-2 border-[var(--mx-color-c6ff00)] border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : timeline.length === 0 ? (
                        <div className="py-8 text-center">
                            <p className="text-[12px] text-[var(--color-text-secondary)]">No transactions yet. Add an expense or record a repayment.</p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-3">Transaction History · {timeline.length}</p>
                            <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-0.5">
                                {timeline.map(entry => {
                                    const isRepay = entry._type === "repayment"
                                    return (
                                        <div key={entry.id}
                                            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[var(--mx-color-f5f5f7)] transition-colors min-w-0">
                                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-[13px] font-black ${isRepay ? "bg-emerald-100 text-emerald-700" : "bg-red-50 text-red-500"}`}>
                                                {isRepay ? "↑" : "↓"}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <p className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate">
                                                        {isRepay ? "Repayment" : entry.category_name}
                                                    </p>
                                                    {isRepay ? (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 shrink-0">REPAID</span>
                                                    ) : (
                                                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full shrink-0" style={{ background: selectedCard.color + "22", color: selectedCard.color }}>CC</span>
                                                    )}
                                                </div>
                                                <p className="text-[10px] text-[var(--color-text-secondary)] truncate mt-0.5">
                                                    {entry.note || fmtDate(entry.entry_date)}
                                                    {entry.note ? ` · ${fmtDate(entry.entry_date)}` : ""}
                                                    {!isRepay && entry.currency_original !== "LKR" ? ` · ${entry.amount_original} ${entry.currency_original}` : ""}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0 flex items-center gap-2">
                                                <div>
                                                    <p className={`text-[12px] font-bold tabular-nums ${isRepay ? "text-emerald-600" : "text-red-500"}`}>
                                                        {isRepay ? "−" : "+"}{fmtShort(entry.amount_lkr)} LKR
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => isRepay ? handleDeleteRepayment(entry) : handleDeleteCcExpense(entry)}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-secondary)] hover:text-red-500 p-1 rounded-lg hover:bg-red-50">
                                                    <TrashIcon />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab({ user, period, totalIncome, totalExpenses, netBalance, expenseByCategory, incomeByType, donutData, expenseCategories, expenseEntries, incomeEntries }) {
    const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : null
    const topExpense = expenseByCategory[0] || null
    const topIncome = incomeByType[0] || null
    const expenseRatio = totalIncome > 0 ? ((totalExpenses / totalIncome) * 100).toFixed(1) : null

    const budgetAlerts = useMemo(() => expenseByCategory.map(([name, spent]) => {
        const cat = expenseCategories.find(c => c.name === name)
        if (!cat?.budget_lkr) return null
        const pct = (spent / cat.budget_lkr) * 100
        return pct >= 80 ? { name, spent, budget: cat.budget_lkr, pct } : null
    }).filter(Boolean), [expenseByCategory, expenseCategories])

    if (!period) return (
        <div className="rounded-2xl border border-dashed border-[var(--mx-color-e5e5ea)] p-8 text-center">
            <p className="text-[12px] text-[var(--color-text-secondary)]">Set a financial period to view reports.</p>
        </div>
    )

    return (
        <div className="space-y-3">

            {/* ── Key metrics ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                    { label: "Total Income", value: fmtShort(totalIncome), sub: `${incomeEntries.length} entries`, color: "text-emerald-600", bar: 100, barColor: "#22C55E", bg: "#22C55E" },
                    { label: "Total Expenses", value: fmtShort(totalExpenses), sub: `${expenseEntries.length} entries`, color: "text-red-500", bar: expenseRatio ? Math.min(Number(expenseRatio), 100) : 0, barColor: "#EF4444", bg: "#EF4444" },
                    { label: "Net Balance", value: `${netBalance < 0 ? "−" : ""}${fmtShort(Math.abs(netBalance))}`, sub: netBalance >= 0 ? "Surplus" : "Deficit", color: netBalance >= 0 ? "text-emerald-600" : "text-red-500", bar: totalIncome > 0 ? Math.min(Math.abs(netBalance / totalIncome) * 100, 100) : 0, barColor: netBalance >= 0 ? "#22C55E" : "#EF4444", bg: netBalance >= 0 ? "#22C55E" : "#EF4444" },
                    { label: "Savings Rate", value: savingsRate != null ? `${savingsRate}%` : "—", sub: savingsRate != null ? (Number(savingsRate) >= 20 ? "On track ✓" : "Aim for 20%+") : "No data", color: Number(savingsRate) >= 20 ? "text-emerald-600" : "text-amber-500", bar: savingsRate ? Math.min(Math.max(Number(savingsRate), 0), 100) : 0, barColor: Number(savingsRate) >= 20 ? "#22C55E" : "#F59E0B", bg: "#c6ff00" },
                ].map(m => (
                    <div key={m.label} className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.04]" style={{ background: `radial-gradient(circle at 80% 20%, ${m.bg} 60%, transparent 100%)` }} />
                        <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-widest mb-2">{m.label}</p>
                        <p className={`text-[20px] font-black leading-none tabular-nums ${m.color}`}>{m.value}</p>
                        <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 font-medium">{m.sub}</p>
                        <div className="mt-3 h-1 rounded-full bg-[var(--mx-color-f5f5f7)] overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${m.bar}%`, background: m.barColor }} />
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Expense split donut */}
                {donutData.length > 0 && (
                    <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4 flex flex-col">
                        <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-3">Expense Split</h3>
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="flex justify-center">
                                <DonutChart data={donutData} size={140} strokeWidth={24} />
                            </div>
                            <div className="border-t border-[var(--mx-color-f5f5f7)] pt-2.5 space-y-1.5">
                                {expenseByCategory.slice(0, 6).map(([name, value], i) => {
                                    const pct = totalExpenses > 0 ? ((value / totalExpenses) * 100) : 0
                                    return (
                                        <div key={name} className="flex items-center gap-2 min-w-0">
                                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                            <span className="text-[12px] text-[var(--color-text-primary)] flex-1 truncate">{name}</span>
                                            <span className="text-[12px] font-bold text-[var(--color-text-secondary)] tabular-nums shrink-0">{pct.toFixed(1)}%</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* Income sources */}
                {incomeByType.length > 0 && (
                    <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4 flex flex-col">
                        <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-2.5">Income Sources</h3>
                        <BarChart bars={incomeByType.map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] }))} height={195} />
                        <div className="mt-2.5 space-y-1.5 border-t border-[var(--mx-color-f5f5f7)] pt-2.5">
                            {incomeByType.map(([name, value], i) => (
                                <div key={name} className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                    <span className="text-[12px] text-[var(--color-text-primary)] flex-1 truncate">{name}</span>
                                    <span className="text-[12px] font-bold text-emerald-600 tabular-nums">{fmtShort(value)} LKR</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ── Budget alerts ── */}
            {budgetAlerts.length > 0 && (
                <div className="rounded-2xl border border-amber-200/70 bg-amber-50/40 p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        </div>
                        <p className="text-[13px] font-bold text-amber-800">Budget Alerts · {budgetAlerts.length}</p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2.5">
                        {budgetAlerts.map(a => (
                            <div key={a.name} className="bg-white/60 rounded-xl p-3 border border-amber-100">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[12px] font-bold text-amber-900">{a.name}</span>
                                    <span className={`text-[11px] font-black px-2 py-0.5 rounded-full ${a.pct >= 100 ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700"}`}>{a.pct.toFixed(0)}%</span>
                                </div>
                                <div className="h-1.5 rounded-full bg-amber-100 overflow-hidden mb-1.5">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(a.pct, 100)}%`, background: a.pct >= 100 ? "#EF4444" : "#F59E0B" }} />
                                </div>
                                <p className="text-[10px] text-amber-700 font-medium">{fmtShort(a.spent)} of {fmtShort(a.budget)} LKR</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Key Insights ── */}
            <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4">
                    <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-3">Key Insights</h3>
                    {totalExpenses === 0 && totalIncome === 0 ? (
                        <p className="text-[12px] text-[var(--color-text-secondary)] py-3 text-center">Add income and expenses to see insights.</p>
                    ) : (
                        <div className="divide-y divide-[var(--mx-color-f5f5f7)]">
                            {topExpense && (
                                <div className="flex items-center gap-3 py-2.5 first:pt-0">
                                    <div className="w-7 h-7 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                                        <svg className="w-3.5 h-3.5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Top Expense</p>
                                        <p className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate">{topExpense[0]}</p>
                                    </div>
                                    <p className="text-[13px] font-black text-red-500 tabular-nums shrink-0">{fmtShort(topExpense[1])}</p>
                                </div>
                            )}
                            {topIncome && (
                                <div className="flex items-center gap-3 py-2.5">
                                    <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                                        <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M7 11l5-5m0 0l5 5m-5-5v12" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Main Income</p>
                                        <p className="text-[12px] font-semibold text-[var(--color-text-primary)] truncate">{topIncome[0]}</p>
                                    </div>
                                    <p className="text-[13px] font-black text-emerald-600 tabular-nums shrink-0">{fmtShort(topIncome[1])}</p>
                                </div>
                            )}
                            {savingsRate != null && (
                                <div className="flex items-center gap-3 py-2.5">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border ${Number(savingsRate) >= 20 ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"}`}>
                                        <svg className={`w-3.5 h-3.5 ${Number(savingsRate) >= 20 ? "text-emerald-500" : "text-amber-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Savings Health</p>
                                        <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">
                                            {Number(savingsRate) >= 20 ? "On track — great work!" : Number(savingsRate) >= 0 ? "Aim for 20%+ savings" : "Spending exceeds income"}
                                        </p>
                                    </div>
                                    <p className={`text-[13px] font-black tabular-nums shrink-0 ${Number(savingsRate) >= 20 ? "text-emerald-600" : "text-amber-500"}`}>{savingsRate}%</p>
                                </div>
                            )}
                            {expenseRatio != null && (
                                <div className="flex items-center gap-3 py-2.5 last:pb-0">
                                    <div className="w-7 h-7 rounded-lg bg-[var(--mx-color-f5f5f7)] border border-[var(--mx-color-e5e5ea)] flex items-center justify-center shrink-0">
                                        <svg className="w-3.5 h-3.5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
                                        </svg>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[10px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wide">Expense Ratio</p>
                                        <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">of total income spent</p>
                                    </div>
                                    <p className="text-[13px] font-black text-[var(--color-text-primary)] tabular-nums shrink-0">{expenseRatio}%</p>
                                </div>
                            )}
                        </div>
                    )}
            </div>
        </div>
    )
}
