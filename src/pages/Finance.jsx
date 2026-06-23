import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import { fetchCurrencyConversion } from "../lib/commandPalette"

// ─── Currency options (matches Subscriptions) ─────────────────────────────────
const CURRENCIES = ["LKR", "USD", "GBP", "AUD", "EUR"]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n, currency = "LKR") => {
    const num = Number(n)
    if (!Number.isFinite(num)) return "-"
    return `${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

const fmtDate = (d) => {
    if (!d) return ""
    const date = new Date(d)
    if (Number.isNaN(date.getTime())) return d
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}

const today = () => new Date().toISOString().slice(0, 10)

// Simple fuzzy match: every char of query appears in target in order
const fuzzyMatch = (target, query) => {
    if (!query) return true
    const t = target.toLowerCase()
    const q = query.toLowerCase()
    let ti = 0
    for (let qi = 0; qi < q.length; qi++) {
        ti = t.indexOf(q[qi], ti)
        if (ti === -1) return false
        ti++
    }
    return true
}

// ─── Icons ────────────────────────────────────────────────────────────────────
const PlusIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
)
const TrashIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
)
const EditIcon = () => (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
)
const SparkleIcon = () => (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2l2.09 6.26L20 10l-5.91 1.74L12 18l-2.09-6.26L4 10l5.91-1.74L12 2z" />
    </svg>
)
const ImportIcon = () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
)

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = ["Overview", "Income", "Expenses", "Reports"]

// ─── Donut chart (pure SVG, no library) ──────────────────────────────────────
function DonutChart({ data, size = 160, strokeWidth = 28 }) {
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
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
            {data.map((seg, i) => {
                const pct = seg.value / total
                const dash = pct * circ
                const el = (
                    <circle
                        key={i}
                        cx={size / 2} cy={size / 2} r={r}
                        fill="none"
                        stroke={seg.color}
                        strokeWidth={strokeWidth}
                        strokeDasharray={`${dash} ${circ - dash}`}
                        strokeDashoffset={-offset * circ}
                        strokeLinecap="butt"
                    />
                )
                offset += pct
                return el
            })}
        </svg>
    )
}

// ─── Bar chart (pure SVG) ─────────────────────────────────────────────────────
function BarChart({ bars, height = 120 }) {
    const max = Math.max(...bars.map(b => b.value), 1)
    return (
        <div className="flex items-end gap-1.5" style={{ height }}>
            {bars.map((bar, i) => (
                <div key={i} className="flex flex-col items-center flex-1 gap-1">
                    <div
                        className="w-full rounded-t-md transition-all duration-500"
                        style={{
                            height: `${Math.max(4, (bar.value / max) * (height - 24))}px`,
                            background: bar.color || "var(--mx-color-c6ff00)",
                        }}
                        title={`${bar.label}: ${fmt(bar.value)}`}
                    />
                    <span className="text-[9px] font-medium text-[var(--color-text-secondary)] truncate w-full text-center">{bar.label}</span>
                </div>
            ))}
        </div>
    )
}

// ─── Period selector modal ────────────────────────────────────────────────────
function PeriodModal({ current, onSave, onClose }) {
    const [label, setLabel] = useState(current?.label || "")
    const [start, setStart] = useState(current?.start_date || today())
    const [end, setEnd] = useState(current?.end_date || today())
    const [err, setErr] = useState("")

    const handleSave = () => {
        if (!label.trim()) { setErr("Please enter a period name"); return }
        if (!start || !end) { setErr("Please select start and end dates"); return }
        if (end < start) { setErr("End date must be after start date"); return }
        onSave({ label: label.trim(), start_date: start, end_date: end })
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-[var(--color-surface)] rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
                <h3 className="text-[15px] font-bold text-[var(--color-text-primary)] mb-4">Financial Period</h3>
                <div className="space-y-3">
                    <div>
                        <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1">Period Name</label>
                        <input
                            className="w-full rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50"
                            placeholder="e.g. June 2026"
                            value={label}
                            onChange={e => setLabel(e.target.value)}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1">Start Date</label>
                            <input type="date" value={start} onChange={e => setStart(e.target.value)}
                                className="w-full rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50" />
                        </div>
                        <div>
                            <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1">End Date</label>
                            <input type="date" value={end} onChange={e => setEnd(e.target.value)}
                                className="w-full rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50" />
                        </div>
                    </div>
                    {err && <p className="text-red-500 text-[11px] font-medium">{err}</p>}
                </div>
                <div className="flex gap-2 mt-5">
                    <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-[var(--mx-color-e5e5ea)] text-[13px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--mx-color-f5f5f7)] transition-colors">Cancel</button>
                    <button onClick={handleSave} className="flex-1 py-2 rounded-xl bg-[var(--mx-color-c6ff00)] text-black text-[13px] font-bold transition-colors hover:opacity-90">Save Period</button>
                </div>
            </div>
        </div>
    )
}

// ─── Fuzzy dropdown input ─────────────────────────────────────────────────────
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

    const filtered = useMemo(() =>
        suggestions.filter(s => fuzzyMatch(s, query)).slice(0, 8),
        [suggestions, query]
    )

    const handleChange = (e) => {
        setQuery(e.target.value)
        onChange(e.target.value)
        setOpen(true)
    }

    const handleSelect = (s) => {
        setQuery(s)
        onChange(s)
        setOpen(false)
    }

    return (
        <div className={`relative ${className}`} ref={ref}>
            <input
                value={query}
                onChange={handleChange}
                onFocus={() => setOpen(true)}
                placeholder={placeholder}
                className="w-full rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50"
            />
            {open && filtered.length > 0 && (
                <div className="absolute z-30 left-0 right-0 mt-1 bg-[var(--color-surface)] border border-[var(--mx-color-e5e5ea)] rounded-xl shadow-lg overflow-hidden">
                    {filtered.map(s => (
                        <button
                            key={s}
                            type="button"
                            onMouseDown={() => handleSelect(s)}
                            className="w-full text-left px-3 py-2 text-[13px] text-[var(--color-text-primary)] hover:bg-[var(--mx-color-f5f5f7)] transition-colors"
                        >{s}</button>
                    ))}
                </div>
            )}
        </div>
    )
}

// ─── Main Finance page ────────────────────────────────────────────────────────
export default function Finance() {
    const { user } = useAuth()
    const [tab, setTab] = useState("Overview")

    // ── Data state ─────────────────────────────────────────────────────────────
    const [period, setPeriod] = useState(null)
    const [showPeriodModal, setShowPeriodModal] = useState(false)

    const [incomeTypes, setIncomeTypes] = useState([])
    const [expenseCategories, setExpenseCategories] = useState([])
    const [incomeEntries, setIncomeEntries] = useState([])
    const [expenseEntries, setExpenseEntries] = useState([])
    const [subscriptions, setSubscriptions] = useState([])

    const [loading, setLoading] = useState(true)

    // ── Fetch everything ───────────────────────────────────────────────────────
    const fetchAll = useCallback(async () => {
        if (!user?.id) return
        setLoading(true)
        try {
            const [typesRes, catsRes, periodsRes, subsRes] = await Promise.all([
                supabase.from("finance_income_types").select("*").eq("user_id", user.id).order("name"),
                supabase.from("finance_expense_categories").select("*").eq("user_id", user.id).order("name"),
                supabase.from("finance_periods").select("*").eq("user_id", user.id).eq("is_active", true).order("created_at", { ascending: false }).limit(1),
                supabase.from("subscriptions").select("*").eq("user_id", user.id),
            ])
            setIncomeTypes(typesRes.data || [])
            setExpenseCategories(catsRes.data || [])
            const activePeriod = periodsRes.data?.[0] || null
            setPeriod(activePeriod)

            if (activePeriod) {
                const [incRes, expRes] = await Promise.all([
                    supabase.from("finance_income_entries").select("*").eq("user_id", user.id).eq("period_id", activePeriod.id).order("entry_date", { ascending: false }),
                    supabase.from("finance_expense_entries").select("*").eq("user_id", user.id).eq("period_id", activePeriod.id).order("entry_date", { ascending: false }),
                ])
                setIncomeEntries(incRes.data || [])
                setExpenseEntries(expRes.data || [])
            } else {
                setIncomeEntries([])
                setExpenseEntries([])
            }
            setSubscriptions(subsRes.data || [])
        } finally {
            setLoading(false)
        }
    }, [user?.id])

    useEffect(() => { fetchAll() }, [fetchAll])

    // ── Period save ────────────────────────────────────────────────────────────
    const handleSavePeriod = async ({ label, start_date, end_date }) => {
        if (!user?.id) return
        // deactivate any existing active periods
        await supabase.from("finance_periods").update({ is_active: false }).eq("user_id", user.id).eq("is_active", true)
        const { data } = await supabase.from("finance_periods").insert({ user_id: user.id, label, start_date, end_date, is_active: true }).select().single()
        setPeriod(data)
        setIncomeEntries([])
        setExpenseEntries([])
        setShowPeriodModal(false)
    }

    // ── Summary numbers ────────────────────────────────────────────────────────
    const totalIncome = useMemo(() => incomeEntries.reduce((s, e) => s + Number(e.amount_lkr), 0), [incomeEntries])
    const totalExpenses = useMemo(() => expenseEntries.reduce((s, e) => s + Number(e.amount_lkr), 0), [expenseEntries])
    const netBalance = totalIncome - totalExpenses

    // ── Expense breakdown by category ─────────────────────────────────────────
    const expenseByCategory = useMemo(() => {
        const map = {}
        expenseEntries.forEach(e => {
            map[e.category_name] = (map[e.category_name] || 0) + Number(e.amount_lkr)
        })
        return Object.entries(map).sort((a, b) => b[1] - a[1])
    }, [expenseEntries])

    const CHART_COLORS = ["#c6ff00", "#3B82F6", "#F97316", "#A855F7", "#22C55E", "#EF4444", "#F59E0B", "#06B6D4"]

    const donutData = expenseByCategory.map(([name, value], i) => ({
        name, value, color: CHART_COLORS[i % CHART_COLORS.length]
    }))

    // ── Income breakdown by type ───────────────────────────────────────────────
    const incomeByType = useMemo(() => {
        const map = {}
        incomeEntries.forEach(e => {
            map[e.income_type_name] = (map[e.income_type_name] || 0) + Number(e.amount_lkr)
        })
        return Object.entries(map).sort((a, b) => b[1] - a[1])
    }, [incomeEntries])

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-4 border-[var(--mx-color-c6ff00)] border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    return (
        <div className="max-w-5xl mx-auto">
            {/* ── Header ── */}
            <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
                <div>
                    <h1 className="text-[22px] font-bold text-[var(--color-text-primary)]">Finance</h1>
                    <p className="text-[13px] text-[var(--color-text-secondary)] mt-0.5">Track income, expenses, and financial health</p>
                </div>
                <button
                    onClick={() => setShowPeriodModal(true)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-colors border ${period ? "border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] text-[var(--color-text-primary)] hover:bg-[var(--mx-color-f5f5f7)]" : "border-[var(--mx-color-c6ff00)] bg-[var(--mx-color-c6ff00)] text-black hover:opacity-90"}`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" />
                        <line x1="16" y1="2" x2="16" y2="6" strokeLinecap="round" />
                        <line x1="8" y1="2" x2="8" y2="6" strokeLinecap="round" />
                        <line x1="3" y1="10" x2="21" y2="10" strokeLinecap="round" />
                    </svg>
                    {period ? `${period.label} · ${fmtDate(period.start_date)} – ${fmtDate(period.end_date)}` : "Set Financial Period"}
                </button>
            </div>

            {!period && (
                <div className="rounded-2xl border border-dashed border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] p-10 text-center mb-6">
                    <p className="text-[15px] font-semibold text-[var(--color-text-primary)] mb-1">No financial period set</p>
                    <p className="text-[13px] text-[var(--color-text-secondary)] mb-4">Set a period (e.g. this month) to start tracking income and expenses.</p>
                    <button onClick={() => setShowPeriodModal(true)} className="px-5 py-2 rounded-xl bg-[var(--mx-color-c6ff00)] text-black font-bold text-[13px] hover:opacity-90 transition-colors">Set Period</button>
                </div>
            )}

            {/* ── Tabs ── */}
            <div className="flex gap-1 mb-6 bg-[var(--mx-color-f5f5f7)] rounded-xl p-1 w-fit">
                {TABS.map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        className={`px-4 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${tab === t ? "bg-[var(--color-surface)] text-[var(--color-text-primary)] shadow-sm" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"}`}
                    >{t}</button>
                ))}
            </div>

            {/* ── Tab content ── */}
            {tab === "Overview" && (
                <OverviewTab
                    period={period}
                    totalIncome={totalIncome}
                    totalExpenses={totalExpenses}
                    netBalance={netBalance}
                    incomeEntries={incomeEntries}
                    expenseEntries={expenseEntries}
                    expenseByCategory={expenseByCategory}
                    incomeByType={incomeByType}
                    donutData={donutData}
                    CHART_COLORS={CHART_COLORS}
                    expenseCategories={expenseCategories}
                />
            )}
            {tab === "Income" && (
                <IncomeTab
                    user={user}
                    period={period}
                    incomeTypes={incomeTypes}
                    incomeEntries={incomeEntries}
                    onRefresh={fetchAll}
                />
            )}
            {tab === "Expenses" && (
                <ExpensesTab
                    user={user}
                    period={period}
                    expenseCategories={expenseCategories}
                    expenseEntries={expenseEntries}
                    subscriptions={subscriptions}
                    onRefresh={fetchAll}
                />
            )}
            {tab === "Reports" && (
                <ReportsTab
                    user={user}
                    period={period}
                    totalIncome={totalIncome}
                    totalExpenses={totalExpenses}
                    netBalance={netBalance}
                    expenseByCategory={expenseByCategory}
                    incomeByType={incomeByType}
                    donutData={donutData}
                    CHART_COLORS={CHART_COLORS}
                    expenseCategories={expenseCategories}
                    expenseEntries={expenseEntries}
                    incomeEntries={incomeEntries}
                />
            )}

            {showPeriodModal && (
                <PeriodModal
                    current={period}
                    onSave={handleSavePeriod}
                    onClose={() => setShowPeriodModal(false)}
                />
            )}
        </div>
    )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ period, totalIncome, totalExpenses, netBalance, incomeEntries, expenseEntries, expenseByCategory, incomeByType, donutData, CHART_COLORS, expenseCategories }) {
    const recentEntries = useMemo(() => {
        const inc = incomeEntries.map(e => ({ ...e, _kind: "income" }))
        const exp = expenseEntries.map(e => ({ ...e, _kind: "expense" }))
        return [...inc, ...exp].sort((a, b) => new Date(b.entry_date) - new Date(a.entry_date)).slice(0, 8)
    }, [incomeEntries, expenseEntries])

    return (
        <div className="space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard label="Total Income" value={fmt(totalIncome)} color="text-emerald-600" sub={period ? `${fmtDate(period.start_date)} – ${fmtDate(period.end_date)}` : "No period set"} />
                <SummaryCard label="Total Expenses" value={fmt(totalExpenses)} color="text-red-500" sub={`${expenseEntries.length} transactions`} />
                <SummaryCard
                    label="Net Balance"
                    value={fmt(Math.abs(netBalance))}
                    color={netBalance >= 0 ? "text-emerald-600" : "text-red-500"}
                    sub={netBalance >= 0 ? "Surplus" : "Deficit"}
                    prefix={netBalance < 0 ? "−" : ""}
                />
            </div>

            {/* Expense breakdown */}
            {donutData.length > 0 && (
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                    <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-4">Expense Breakdown</h3>
                    <div className="flex flex-col sm:flex-row gap-6 items-center">
                        <div className="shrink-0">
                            <DonutChart data={donutData} />
                        </div>
                        <div className="flex-1 space-y-2 w-full">
                            {expenseByCategory.map(([name, value], i) => {
                                const pct = totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : 0
                                const budget = expenseCategories.find(c => c.name === name)?.budget_lkr
                                return (
                                    <div key={name}>
                                        <div className="flex items-center justify-between mb-0.5">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                                <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{name}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {budget && <span className={`text-[10px] font-medium ${value > budget ? "text-red-500" : "text-[var(--color-text-secondary)]"}`}>/ {fmt(budget)} budget</span>}
                                                <span className="text-[12px] font-bold text-[var(--color-text-primary)]">{fmt(value)}</span>
                                                <span className="text-[10px] text-[var(--color-text-secondary)] w-8 text-right">{pct}%</span>
                                            </div>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-[var(--mx-color-f5f5f7)] overflow-hidden">
                                            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Income breakdown */}
            {incomeByType.length > 0 && (
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                    <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-4">Income Sources</h3>
                    <BarChart bars={incomeByType.map(([label, value], i) => ({ label, value, color: CHART_COLORS[i % CHART_COLORS.length] }))} />
                </div>
            )}

            {/* Recent activity */}
            {recentEntries.length > 0 && (
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                    <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-3">Recent Activity</h3>
                    <div className="space-y-2">
                        {recentEntries.map(e => (
                            <div key={e.id} className="flex items-center justify-between py-1.5 border-b border-[var(--mx-color-f5f5f7)] last:border-0">
                                <div className="flex items-center gap-2.5">
                                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${e._kind === "income" ? "bg-emerald-500" : "bg-red-400"}`} />
                                    <div>
                                        <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">{e._kind === "income" ? e.income_type_name : e.category_name}</p>
                                        {e.note && <p className="text-[11px] text-[var(--color-text-secondary)]">{e.note}</p>}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className={`text-[13px] font-bold ${e._kind === "income" ? "text-emerald-600" : "text-red-500"}`}>
                                        {e._kind === "income" ? "+" : "−"}{fmt(e.amount_lkr)}
                                    </p>
                                    <p className="text-[10px] text-[var(--color-text-secondary)]">{fmtDate(e.entry_date)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {recentEntries.length === 0 && period && (
                <div className="rounded-2xl border border-dashed border-[var(--mx-color-e5e5ea)] p-8 text-center">
                    <p className="text-[13px] text-[var(--color-text-secondary)]">No entries yet for this period. Add income or expenses to get started.</p>
                </div>
            )}
        </div>
    )
}

function SummaryCard({ label, value, color, sub, prefix = "" }) {
    return (
        <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4">
            <p className="text-[11px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-[20px] font-bold ${color} leading-tight`}>{prefix}{value}</p>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{sub}</p>
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
        setTypeLoading(true)
        setTypeErr("")
        const { error } = await supabase.from("finance_income_types").insert({ user_id: user.id, name: newTypeName.trim() })
        setTypeLoading(false)
        if (error) { setTypeErr(error.message); return }
        setNewTypeName("")
        setShowTypeForm(false)
        onRefresh()
    }

    const handleDeleteType = async (id) => {
        if (!window.confirm("Delete this income type?")) return
        await supabase.from("finance_income_types").delete().eq("id", id)
        onRefresh()
    }

    const handleAddEntry = async () => {
        if (!entryType.trim()) { setEntryErr("Select an income type"); return }
        if (!entryAmount || Number(entryAmount) <= 0) { setEntryErr("Enter a valid amount"); return }
        if (!period) { setEntryErr("No financial period set"); return }
        setEntryLoading(true)
        setEntryErr("")
        const { error } = await supabase.from("finance_income_entries").insert({
            user_id: user.id,
            period_id: period.id,
            income_type_name: entryType.trim(),
            amount_lkr: Number(entryAmount),
            note: entryNote.trim() || null,
            entry_date: entryDate,
        })
        setEntryLoading(false)
        if (error) { setEntryErr(error.message); return }
        setEntryType("")
        setEntryAmount("")
        setEntryNote("")
        setEntryDate(today())
        setShowEntryForm(false)
        onRefresh()
    }

    const handleDeleteEntry = async (id) => {
        if (!window.confirm("Delete this income entry?")) return
        await supabase.from("finance_income_entries").delete().eq("id", id)
        onRefresh()
    }

    return (
        <div className="space-y-5">
            {/* Income types manager */}
            <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[13px] font-bold text-[var(--color-text-primary)]">Income Types</h3>
                    <button onClick={() => setShowTypeForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--mx-color-f5f5f7)] text-[12px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--mx-color-e5e5ea)] transition-colors">
                        <PlusIcon /> Add Type
                    </button>
                </div>
                {showTypeForm && (
                    <div className="flex gap-2 mb-3">
                        <input
                            value={newTypeName}
                            onChange={e => setNewTypeName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleAddType()}
                            placeholder="e.g. Salary, Freelance, Rental..."
                            className="flex-1 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50"
                        />
                        <button onClick={handleAddType} disabled={typeLoading} className="px-4 py-2 rounded-xl bg-[var(--mx-color-c6ff00)] text-black text-[12px] font-bold hover:opacity-90 transition-colors disabled:opacity-50">Save</button>
                    </div>
                )}
                {typeErr && <p className="text-red-500 text-[11px] mb-2">{typeErr}</p>}
                <div className="flex flex-wrap gap-2">
                    {incomeTypes.length === 0 && <p className="text-[12px] text-[var(--color-text-secondary)]">No income types yet. Add one above.</p>}
                    {incomeTypes.map(t => (
                        <div key={t.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--mx-color-f5f5f7)] border border-[var(--mx-color-e5e5ea)]">
                            <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{t.name}</span>
                            <button onClick={() => handleDeleteType(t.id)} className="text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"><TrashIcon /></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add income entry */}
            {period && (
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-[13px] font-bold text-[var(--color-text-primary)]">Add Income</h3>
                        <button onClick={() => setShowEntryForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--mx-color-c6ff00)] text-black text-[12px] font-bold hover:opacity-90 transition-colors">
                            <PlusIcon /> Add Entry
                        </button>
                    </div>
                    {showEntryForm && (
                        <div className="space-y-3 mb-4 p-4 rounded-xl bg-[var(--mx-color-fafafc)] border border-[var(--mx-color-e5e5ea)]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1">Income Type</label>
                                    <FuzzyInput value={entryType} onChange={setEntryType} suggestions={typeNames} placeholder="Select or type income type" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1">Amount (LKR)</label>
                                    <input
                                        type="number" min="0" step="0.01"
                                        value={entryAmount} onChange={e => setEntryAmount(e.target.value)}
                                        placeholder="0.00"
                                        className="w-full rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1">Date</label>
                                    <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                                        className="w-full rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1">Note (optional)</label>
                                    <input value={entryNote} onChange={e => setEntryNote(e.target.value)} placeholder="Optional note"
                                        className="w-full rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50" />
                                </div>
                            </div>
                            {entryErr && <p className="text-red-500 text-[11px]">{entryErr}</p>}
                            <div className="flex gap-2">
                                <button onClick={() => setShowEntryForm(false)} className="flex-1 py-2 rounded-xl border border-[var(--mx-color-e5e5ea)] text-[12px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--mx-color-f5f5f7)] transition-colors">Cancel</button>
                                <button onClick={handleAddEntry} disabled={entryLoading} className="flex-1 py-2 rounded-xl bg-[var(--mx-color-c6ff00)] text-black text-[12px] font-bold hover:opacity-90 transition-colors disabled:opacity-50">Save Entry</button>
                            </div>
                        </div>
                    )}
                    {/* Entries list */}
                    {incomeEntries.length === 0 ? (
                        <p className="text-[12px] text-[var(--color-text-secondary)]">No income entries yet for this period.</p>
                    ) : (
                        <div className="space-y-2">
                            {incomeEntries.map(e => (
                                <div key={e.id} className="flex items-center justify-between py-2 border-b border-[var(--mx-color-f5f5f7)] last:border-0">
                                    <div>
                                        <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{e.income_type_name}</p>
                                        {e.note && <p className="text-[11px] text-[var(--color-text-secondary)]">{e.note}</p>}
                                        <p className="text-[10px] text-[var(--color-text-secondary)]">{fmtDate(e.entry_date)}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[14px] font-bold text-emerald-600">{fmt(e.amount_lkr)}</span>
                                        <button onClick={() => handleDeleteEntry(e.id)} className="text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"><TrashIcon /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {!period && (
                <div className="rounded-2xl border border-dashed border-[var(--mx-color-e5e5ea)] p-8 text-center">
                    <p className="text-[13px] text-[var(--color-text-secondary)]">Set a financial period first to add income entries.</p>
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

    // Auto-preview conversion when amount/currency changes
    useEffect(() => {
        if (!entryAmount || Number(entryAmount) <= 0 || entryCurrency === "LKR") {
            setConvertedPreview(null)
            return
        }
        let cancelled = false
        setConverting(true)
        fetchCurrencyConversion({ amount: Number(entryAmount), fromCurrency: entryCurrency, toCurrency: "LKR" })
            .then(result => { if (!cancelled) setConvertedPreview(result) })
            .catch(() => { if (!cancelled) setConvertedPreview(null) })
            .finally(() => { if (!cancelled) setConverting(false) })
        return () => { cancelled = true }
    }, [entryAmount, entryCurrency])

    const handleAddCategory = async () => {
        if (!newCatName.trim()) { setCatErr("Enter a category name"); return }
        if (expenseCategories.some(c => c.name.toLowerCase() === newCatName.trim().toLowerCase())) { setCatErr("Category already exists"); return }
        setCatLoading(true)
        setCatErr("")
        const { error } = await supabase.from("finance_expense_categories").insert({
            user_id: user.id,
            name: newCatName.trim(),
            budget_lkr: newCatBudget ? Number(newCatBudget) : null,
        })
        setCatLoading(false)
        if (error) { setCatErr(error.message); return }
        setNewCatName("")
        setNewCatBudget("")
        setShowCatForm(false)
        onRefresh()
    }

    const handleDeleteCategory = async (id) => {
        if (!window.confirm("Delete this category?")) return
        await supabase.from("finance_expense_categories").delete().eq("id", id)
        onRefresh()
    }

    const handleAddEntry = async () => {
        if (!entryCategory.trim()) { setEntryErr("Select a category"); return }
        if (!entryAmount || Number(entryAmount) <= 0) { setEntryErr("Enter a valid amount"); return }
        if (!period) { setEntryErr("No financial period set"); return }
        setEntryLoading(true)
        setEntryErr("")
        let amountLkr = Number(entryAmount)
        if (entryCurrency !== "LKR") {
            try {
                amountLkr = await fetchCurrencyConversion({ amount: amountLkr, fromCurrency: entryCurrency, toCurrency: "LKR" })
            } catch {
                setEntryErr("Currency conversion failed. Try again.")
                setEntryLoading(false)
                return
            }
        }
        const { error } = await supabase.from("finance_expense_entries").insert({
            user_id: user.id,
            period_id: period.id,
            category_name: entryCategory.trim(),
            amount_original: Number(entryAmount),
            currency_original: entryCurrency,
            amount_lkr: amountLkr,
            note: entryNote.trim() || null,
            entry_date: entryDate,
        })
        setEntryLoading(false)
        if (error) { setEntryErr(error.message); return }
        setEntryCategory("")
        setEntryAmount("")
        setEntryCurrency("LKR")
        setEntryNote("")
        setEntryDate(today())
        setShowEntryForm(false)
        setConvertedPreview(null)
        onRefresh()
    }

    const handleDeleteEntry = async (id) => {
        if (!window.confirm("Delete this expense?")) return
        await supabase.from("finance_expense_entries").delete().eq("id", id)
        onRefresh()
    }

    // ── Import from subscriptions ──────────────────────────────────────────────
    const handleImportSubscriptions = async () => {
        if (!period) { setImportMsg("Set a financial period first."); return }
        if (!subscriptions.length) { setImportMsg("No subscriptions found."); return }

        setImportLoading(true)
        setImportMsg("")

        // Find subscriptions not already imported for this period
        const existingSubIds = new Set(expenseEntries.filter(e => e.is_from_subscription && e.subscription_id).map(e => e.subscription_id))
        const toImport = subscriptions.filter(s => !existingSubIds.has(s.id))

        if (!toImport.length) {
            setImportLoading(false)
            setImportMsg("All subscriptions already imported for this period.")
            return
        }

        let imported = 0
        for (const sub of toImport) {
            try {
                let amountLkr = Number(sub.amount)
                if (sub.currency && sub.currency !== "LKR") {
                    amountLkr = await fetchCurrencyConversion({ amount: amountLkr, fromCurrency: sub.currency, toCurrency: "LKR" })
                }
                await supabase.from("finance_expense_entries").insert({
                    user_id: user.id,
                    period_id: period.id,
                    category_name: sub.name || "Subscription",
                    amount_original: Number(sub.amount),
                    currency_original: sub.currency || "LKR",
                    amount_lkr: amountLkr,
                    note: `Auto-imported from Subscriptions`,
                    entry_date: period.start_date,
                    is_from_subscription: true,
                    subscription_id: sub.id,
                })
                imported++
            } catch {
                // skip failed conversions silently
            }
        }
        setImportLoading(false)
        setImportMsg(`Imported ${imported} subscription${imported !== 1 ? "s" : ""} as expenses.`)
        onRefresh()
    }

    return (
        <div className="space-y-5">
            {/* Categories manager */}
            <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[13px] font-bold text-[var(--color-text-primary)]">Expense Categories</h3>
                    <button onClick={() => setShowCatForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--mx-color-f5f5f7)] text-[12px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--mx-color-e5e5ea)] transition-colors">
                        <PlusIcon /> Add Category
                    </button>
                </div>
                {showCatForm && (
                    <div className="flex gap-2 mb-3 flex-wrap">
                        <input
                            value={newCatName}
                            onChange={e => setNewCatName(e.target.value)}
                            onKeyDown={e => e.key === "Enter" && handleAddCategory()}
                            placeholder="Category name..."
                            className="flex-1 min-w-[140px] rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50"
                        />
                        <input
                            type="number" min="0" step="0.01"
                            value={newCatBudget}
                            onChange={e => setNewCatBudget(e.target.value)}
                            placeholder="Monthly budget (LKR, optional)"
                            className="flex-1 min-w-[160px] rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50"
                        />
                        <button onClick={handleAddCategory} disabled={catLoading} className="px-4 py-2 rounded-xl bg-[var(--mx-color-c6ff00)] text-black text-[12px] font-bold hover:opacity-90 transition-colors disabled:opacity-50">Save</button>
                    </div>
                )}
                {catErr && <p className="text-red-500 text-[11px] mb-2">{catErr}</p>}
                <div className="flex flex-wrap gap-2">
                    {expenseCategories.length === 0 && <p className="text-[12px] text-[var(--color-text-secondary)]">No categories yet.</p>}
                    {expenseCategories.map(c => (
                        <div key={c.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--mx-color-f5f5f7)] border border-[var(--mx-color-e5e5ea)]">
                            <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{c.name}</span>
                            {c.budget_lkr && <span className="text-[10px] text-[var(--color-text-secondary)]">· {fmt(c.budget_lkr)}</span>}
                            <button onClick={() => handleDeleteCategory(c.id)} className="text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"><TrashIcon /></button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Add expense entry */}
            {period && (
                <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                    <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <h3 className="text-[13px] font-bold text-[var(--color-text-primary)]">Add Expense</h3>
                        <div className="flex items-center gap-2">
                            {/* Import from subscriptions */}
                            <button
                                onClick={handleImportSubscriptions}
                                disabled={importLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-f5f5f7)] text-[12px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--mx-color-e5e5ea)] transition-colors disabled:opacity-50"
                                title="Import your subscriptions as expenses"
                            >
                                <ImportIcon /> Import Subscriptions
                            </button>
                            <button onClick={() => setShowEntryForm(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--mx-color-c6ff00)] text-black text-[12px] font-bold hover:opacity-90 transition-colors">
                                <PlusIcon /> Add Expense
                            </button>
                        </div>
                    </div>
                    {importMsg && <p className="text-[12px] text-[var(--color-text-secondary)] mb-2">{importMsg}</p>}

                    {showEntryForm && (
                        <div className="space-y-3 mb-4 p-4 rounded-xl bg-[var(--mx-color-fafafc)] border border-[var(--mx-color-e5e5ea)]">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1">Category</label>
                                    <FuzzyInput value={entryCategory} onChange={setEntryCategory} suggestions={catNames} placeholder="Search or type category" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1">Amount</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number" min="0" step="0.01"
                                            value={entryAmount} onChange={e => setEntryAmount(e.target.value)}
                                            placeholder="0.00"
                                            className="flex-1 rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50"
                                        />
                                        <select
                                            value={entryCurrency}
                                            onChange={e => setEntryCurrency(e.target.value)}
                                            className="rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-2 py-2 text-[13px] font-semibold text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50"
                                        >
                                            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                        </select>
                                    </div>
                                    {entryCurrency !== "LKR" && (
                                        <p className="text-[11px] text-[var(--color-text-secondary)] mt-1">
                                            {converting ? "Converting…" : convertedPreview != null ? `≈ ${fmt(convertedPreview)} LKR` : ""}
                                        </p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1">Date</label>
                                    <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                                        className="w-full rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-[var(--color-text-secondary)] mb-1">Note (optional)</label>
                                    <input value={entryNote} onChange={e => setEntryNote(e.target.value)} placeholder="Optional note"
                                        className="w-full rounded-xl border border-[var(--mx-color-e5e5ea)] bg-[var(--mx-color-fafafc)] px-3 py-2 text-[13px] text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--mx-color-c6ff00)]/50" />
                                </div>
                            </div>
                            {entryErr && <p className="text-red-500 text-[11px]">{entryErr}</p>}
                            <div className="flex gap-2">
                                <button onClick={() => setShowEntryForm(false)} className="flex-1 py-2 rounded-xl border border-[var(--mx-color-e5e5ea)] text-[12px] font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--mx-color-f5f5f7)] transition-colors">Cancel</button>
                                <button onClick={handleAddEntry} disabled={entryLoading} className="flex-1 py-2 rounded-xl bg-[var(--mx-color-c6ff00)] text-black text-[12px] font-bold hover:opacity-90 transition-colors disabled:opacity-50">Save Expense</button>
                            </div>
                        </div>
                    )}

                    {/* Entries list */}
                    {expenseEntries.length === 0 ? (
                        <p className="text-[12px] text-[var(--color-text-secondary)]">No expense entries yet for this period.</p>
                    ) : (
                        <div className="space-y-2">
                            {expenseEntries.map(e => (
                                <div key={e.id} className="flex items-center justify-between py-2 border-b border-[var(--mx-color-f5f5f7)] last:border-0">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{e.category_name}</p>
                                            {e.is_from_subscription && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">SUB</span>}
                                        </div>
                                        {e.note && <p className="text-[11px] text-[var(--color-text-secondary)]">{e.note}</p>}
                                        <p className="text-[10px] text-[var(--color-text-secondary)]">
                                            {fmtDate(e.entry_date)}
                                            {e.currency_original !== "LKR" && ` · ${fmt(e.amount_original, e.currency_original)}`}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-[14px] font-bold text-red-500">−{fmt(e.amount_lkr)}</span>
                                        <button onClick={() => handleDeleteEntry(e.id)} className="text-[var(--color-text-secondary)] hover:text-red-500 transition-colors"><TrashIcon /></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            {!period && (
                <div className="rounded-2xl border border-dashed border-[var(--mx-color-e5e5ea)] p-8 text-center">
                    <p className="text-[13px] text-[var(--color-text-secondary)]">Set a financial period first to add expenses.</p>
                </div>
            )}
        </div>
    )
}

// ─── Reports Tab ──────────────────────────────────────────────────────────────
function ReportsTab({ user, period, totalIncome, totalExpenses, netBalance, expenseByCategory, incomeByType, donutData, CHART_COLORS, expenseCategories, expenseEntries, incomeEntries }) {
    const [aiSuggestions, setAiSuggestions] = useState("")
    const [aiLoading, setAiLoading] = useState(false)
    const [aiErr, setAiErr] = useState("")

    const savingsRate = totalIncome > 0 ? ((netBalance / totalIncome) * 100).toFixed(1) : null
    const topExpense = expenseByCategory[0] || null
    const topIncome = incomeByType[0] || null

    // Budget overspend alerts
    const budgetAlerts = useMemo(() => {
        return expenseByCategory.map(([name, spent]) => {
            const cat = expenseCategories.find(c => c.name === name)
            if (!cat?.budget_lkr) return null
            const pct = (spent / cat.budget_lkr) * 100
            return pct >= 80 ? { name, spent, budget: cat.budget_lkr, pct } : null
        }).filter(Boolean)
    }, [expenseByCategory, expenseCategories])

    const handleGetAISuggestions = async () => {
        setAiLoading(true)
        setAiErr("")
        setAiSuggestions("")
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const summary = {
                period: period?.label,
                totalIncome,
                totalExpenses,
                netBalance,
                savingsRate,
                expenseByCategory: expenseByCategory.slice(0, 6).map(([name, value]) => ({ name, value })),
                incomeByType: incomeByType.slice(0, 4).map(([name, value]) => ({ name, value })),
                budgetAlerts: budgetAlerts.map(a => ({ name: a.name, spent: a.spent, budget: a.budget, pct: a.pct })),
                entryCount: incomeEntries.length + expenseEntries.length,
            }
            const message = `You are a personal finance advisor. Analyze this user's financial data for the period "${summary.period || 'unknown'}" and give 3–5 concise, actionable suggestions to improve their financial health. Be specific, practical, and friendly. Data: ${JSON.stringify(summary)}`
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-assistant`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${session.access_token}`,
                    "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
                },
                body: JSON.stringify({ type: "chat", message, userLocalNow: new Date().toISOString(), timezoneOffsetMinutes: new Date().getTimezoneOffset() }),
            })
            const data = await res.json()
            if (data.error) { setAiErr(data.error); return }
            setAiSuggestions(data.summary || data.message || "No suggestions returned.")
        } catch {
            setAiErr("Failed to get AI suggestions. Make sure your AI assistant API key is set up.")
        } finally {
            setAiLoading(false)
        }
    }

    return (
        <div className="space-y-5">
            {!period ? (
                <div className="rounded-2xl border border-dashed border-[var(--mx-color-e5e5ea)] p-8 text-center">
                    <p className="text-[13px] text-[var(--color-text-secondary)]">Set a financial period to view reports.</p>
                </div>
            ) : (
                <>
                    {/* Key metrics */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <MetricCard label="Income" value={fmt(totalIncome)} color="text-emerald-600" />
                        <MetricCard label="Expenses" value={fmt(totalExpenses)} color="text-red-500" />
                        <MetricCard label="Net Balance" value={`${netBalance >= 0 ? "+" : "−"}${fmt(Math.abs(netBalance))}`} color={netBalance >= 0 ? "text-emerald-600" : "text-red-500"} />
                        <MetricCard label="Savings Rate" value={savingsRate != null ? `${savingsRate}%` : "N/A"} color={savingsRate >= 20 ? "text-emerald-600" : savingsRate >= 0 ? "text-amber-500" : "text-red-500"} />
                    </div>

                    {/* Budget alerts */}
                    {budgetAlerts.length > 0 && (
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                            <p className="text-[12px] font-bold text-amber-800 uppercase tracking-wide">Budget Alerts</p>
                            {budgetAlerts.map(a => (
                                <div key={a.name} className="flex items-center justify-between">
                                    <span className="text-[13px] font-semibold text-amber-900">{a.name}</span>
                                    <span className={`text-[12px] font-bold ${a.pct >= 100 ? "text-red-600" : "text-amber-700"}`}>
                                        {a.pct.toFixed(0)}% of budget · {fmt(a.spent)} / {fmt(a.budget)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Charts side by side */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {donutData.length > 0 && (
                            <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                                <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-4">Expense Split</h3>
                                <div className="flex flex-col items-center gap-4">
                                    <DonutChart data={donutData} size={140} strokeWidth={26} />
                                    <div className="w-full space-y-1">
                                        {expenseByCategory.slice(0, 5).map(([name, value], i) => (
                                            <div key={name} className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                                    <span className="text-[12px] text-[var(--color-text-primary)]">{name}</span>
                                                </div>
                                                <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{totalExpenses > 0 ? ((value / totalExpenses) * 100).toFixed(1) : 0}%</span>
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
                                <div className="mt-3 space-y-1">
                                    {incomeByType.map(([name, value], i) => (
                                        <div key={name} className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                                                <span className="text-[12px] text-[var(--color-text-primary)]">{name}</span>
                                            </div>
                                            <span className="text-[12px] font-semibold text-[var(--color-text-primary)]">{fmt(value)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Key insights */}
                    <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                        <h3 className="text-[13px] font-bold text-[var(--color-text-primary)] mb-3">Key Insights</h3>
                        <div className="space-y-2 text-[13px] text-[var(--color-text-secondary)]">
                            {topExpense && <p>• Your biggest expense is <strong className="text-[var(--color-text-primary)]">{topExpense[0]}</strong> at <strong className="text-red-500">{fmt(topExpense[1])}</strong></p>}
                            {topIncome && <p>• Your main income source is <strong className="text-[var(--color-text-primary)]">{topIncome[0]}</strong> at <strong className="text-emerald-600">{fmt(topIncome[1])}</strong></p>}
                            {savingsRate != null && <p>• You are saving <strong className={savingsRate >= 20 ? "text-emerald-600" : "text-amber-500"}>{savingsRate}%</strong> of your income{savingsRate >= 20 ? " — great work!" : savingsRate >= 0 ? ". Aim for 20%+." : " — you are spending more than you earn."}</p>}
                            {totalExpenses === 0 && totalIncome === 0 && <p>No data yet. Add income and expenses to see insights.</p>}
                        </div>
                    </div>

                    {/* AI suggestions */}
                    <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-5">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <SparkleIcon />
                                <h3 className="text-[13px] font-bold text-[var(--color-text-primary)]">AI Financial Suggestions</h3>
                            </div>
                            <button
                                onClick={handleGetAISuggestions}
                                disabled={aiLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--mx-color-c6ff00)] text-black text-[12px] font-bold hover:opacity-90 transition-colors disabled:opacity-50"
                            >
                                {aiLoading ? "Analyzing…" : "Get Suggestions"}
                            </button>
                        </div>
                        {aiErr && <p className="text-red-500 text-[12px] mb-2">{aiErr}</p>}
                        {!aiSuggestions && !aiLoading && !aiErr && (
                            <p className="text-[12px] text-[var(--color-text-secondary)]">Click "Get Suggestions" to get personalized AI advice based on your financial data. Requires AI Assistant API key.</p>
                        )}
                        {aiLoading && (
                            <div className="flex items-center gap-2 text-[12px] text-[var(--color-text-secondary)]">
                                <div className="w-4 h-4 border-2 border-[var(--mx-color-c6ff00)] border-t-transparent rounded-full animate-spin" />
                                Analyzing your finances…
                            </div>
                        )}
                        {aiSuggestions && (
                            <div className="text-[13px] text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
                                {aiSuggestions}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

function MetricCard({ label, value, color }) {
    return (
        <div className="rounded-2xl border border-[var(--mx-color-e5e5ea)] bg-[var(--color-surface)] p-4">
            <p className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wide mb-1">{label}</p>
            <p className={`text-[16px] font-bold ${color} leading-tight`}>{value}</p>
        </div>
    )
}
