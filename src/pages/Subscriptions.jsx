import { useCallback, useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { useAuth } from "../context/AuthContext"
import { supabase } from "../lib/supabase"
import { fetchCurrencyConversion, fetchCurrencyRate } from "../lib/commandPalette"
import { FaPlus, FaPencilAlt, FaTimes, FaTrashAlt, FaWallet } from "react-icons/fa"

const currencyOptions = ["LKR", "USD", "GBP", "AUD", "EUR"]

const formatCurrency = (value, currency) => {
    const amount = Number(value)
    if (!Number.isFinite(amount)) return "-"
    return `${amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} ${currency}`
}

const formatDate = (dateString) => {
    if (!dateString) return "No date"
    const date = new Date(dateString)
    if (Number.isNaN(date.getTime())) return "Invalid date"
    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    })
}

const getOrdinalSuffix = (day) => {
    const remainder100 = day % 100
    if (remainder100 >= 11 && remainder100 <= 13) return `${day}th`
    const remainder10 = day % 10
    if (remainder10 === 1) return `${day}st`
    if (remainder10 === 2) return `${day}nd`
    if (remainder10 === 3) return `${day}rd`
    return `${day}th`
}

const parseDateParts = (dateString) => {
    if (!dateString || typeof dateString !== "string") return null
    const [yearRaw, monthRaw, dayRaw] = dateString.split("-")
    const year = Number(yearRaw)
    const month = Number(monthRaw)
    const day = Number(dayRaw)
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
    if (month < 1 || month > 12 || day < 1 || day > 31) return null
    return { year, month, day }
}

const getNextMonthlyRenewalDate = (dateString) => {
    const parts = parseDateParts(dateString)
    if (!parts) return null

    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const renewalDay = parts.day

    const getMonthlyCandidate = (year, monthIndex) => {
        const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
        return new Date(year, monthIndex, Math.min(renewalDay, daysInMonth))
    }

    let candidate = getMonthlyCandidate(today.getFullYear(), today.getMonth())
    if (candidate < today) {
        candidate = getMonthlyCandidate(today.getFullYear(), today.getMonth() + 1)
    }

    return candidate
}

const getDaysUntil = (targetDate) => {
    if (!(targetDate instanceof Date) || Number.isNaN(targetDate.getTime())) return null
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const target = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate())
    const msPerDay = 1000 * 60 * 60 * 24
    return Math.ceil((target - today) / msPerDay)
}

const getRenewalUrgency = (nextRenewal) => {
    const days = getDaysUntil(nextRenewal)
    if (days == null || days > 7) return null
    if (days <= 2) {
        return {
            label: `Due in ${days} day${days === 1 ? '' : 's'}`,
            className: 'bg-[#fef2f2] border border-[#fecaca] text-[#b91c1c]',
        }
    }
    return {
        label: `Due in ${days} day${days === 1 ? '' : 's'}`,
        className: 'bg-[#fefce8] border border-[#fde68a] text-[#92400e]',
    }
}

const getSortedSubscriptions = (subs) => {
    return [...subs].sort((a, b) => {
        const nextRenewalA = getNextMonthlyRenewalDate(a.renewal_date)
        const nextRenewalB = getNextMonthlyRenewalDate(b.renewal_date)
        const daysA = getDaysUntil(nextRenewalA) ?? Infinity
        const daysB = getDaysUntil(nextRenewalB) ?? Infinity
        return daysA - daysB
    })
}

export default function Subscriptions() {
    const { user } = useAuth()
    const [subscriptions, setSubscriptions] = useState([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState("")
    const [message, setMessage] = useState("")
    const [editing, setEditing] = useState(null)
    const [form, setForm] = useState({
        name: "",
        amount: "",
        currency: "LKR",
        renewalDate: "",
    })
    const [conversion, setConversion] = useState(null)
    const [conversionLoading, setConversionLoading] = useState(false)
    const [conversionError, setConversionError] = useState("")
    const [mobileFormOpen, setMobileFormOpen] = useState(false)

    const isMobileViewport = () => typeof window !== "undefined" && window.innerWidth < 1024

    const getSubscriptionsCacheKey = useCallback(() => {
        if (!user?.id) return null
        return `maxien.subscriptions.cache.${user.id}`
    }, [user?.id])

    const loadSubscriptions = useCallback(async ({ force = false } = {}) => {
        if (!user?.id) return

        const cacheKey = getSubscriptionsCacheKey()
        if (!force && cacheKey) {
            const cachedRaw = sessionStorage.getItem(cacheKey)
            if (cachedRaw) {
                try {
                    const cachedItems = JSON.parse(cachedRaw)
                    if (Array.isArray(cachedItems)) {
                        setSubscriptions(cachedItems)
                        return
                    }
                } catch {
                    sessionStorage.removeItem(cacheKey)
                }
            }
        }

        setLoading(true)
        try {
            const { data, error } = await supabase
                .from("subscriptions")
                .select("*")
                .eq("user_id", user.id)
                .order("created_at", { ascending: false })
            if (error) {
                setSubscriptions([])
                return
            }

            const items = data || []
            const uniqueCurrencies = [...new Set(items
                .filter((item) => {
                    const amount = Number(item.amount)
                    const currency = String(item.currency || "").toUpperCase()
                    return currency && currency !== "LKR" && Number.isFinite(amount) && amount > 0
                })
                .map((item) => String(item.currency || "").toUpperCase()))]

            const currencyRates = {}
            await Promise.all(uniqueCurrencies.map(async (currency) => {
                try {
                    const rate = await fetchCurrencyRate({
                        fromCurrency: currency,
                        toCurrency: "LKR",
                    })
                    currencyRates[currency] = rate
                } catch {
                    currencyRates[currency] = null
                }
            }))

            const normalizedItems = items.map((item) => ({
                ...item,
                currency: String(item.currency || "").toUpperCase(),
                converted_lkr: String(item.currency || "").toUpperCase() === "LKR"
                    ? Number(item.amount)
                    : currencyRates[String(item.currency || "").toUpperCase()] != null
                        ? Number(item.amount) * currencyRates[String(item.currency || "").toUpperCase()]
                        : null,
            }))

            setSubscriptions(normalizedItems)
            if (cacheKey) {
                sessionStorage.setItem(cacheKey, JSON.stringify(normalizedItems))
            }
        } catch {
            setSubscriptions([])
        } finally {
            setLoading(false)
        }
    }, [getSubscriptionsCacheKey, user?.id])

    useEffect(() => {
        loadSubscriptions()
    }, [loadSubscriptions])

    useEffect(() => {
        setConversion(null)
        setConversionError("")
        setConversionLoading(false)

        if (!form.amount || !form.currency || form.currency === "LKR") {
            return
        }

        const amount = Number(form.amount)
        if (!Number.isFinite(amount) || amount <= 0) {
            setConversionError("Enter a positive amount to see LKR conversion.")
            return
        }

        const controller = new AbortController()
        const delay = setTimeout(async () => {
            setConversionLoading(true)
            setConversionError("")
            try {
                const converted = await fetchCurrencyConversion({
                    amount,
                    fromCurrency: form.currency,
                    toCurrency: "LKR",
                    signal: controller.signal,
                })
                setConversion(converted)
            } catch (err) {
                if (controller.signal.aborted) return
                setConversionError("Conversion unavailable right now.")
                setConversion(null)
            } finally {
                if (!controller.signal.aborted) {
                    setConversionLoading(false)
                }
            }
        }, 300)

        return () => {
            clearTimeout(delay)
            controller.abort()
        }
    }, [form.amount, form.currency])

    const resetForm = () => {
        setEditing(null)
        setError("")
        setMessage("")
        setForm({
            name: "",
            amount: "",
            currency: "LKR",
            renewalDate: "",
        })
        setConversion(null)
        setConversionError("")
    }

    const openFormForCreate = () => {
        resetForm()
        if (isMobileViewport()) {
            setMobileFormOpen(true)
        }
    }

    const closeMobileOverlay = () => {
        setMobileFormOpen(false)
    }

    const handleSave = async (event) => {
        event.preventDefault()
        setError("")
        setMessage("")

        if (!form.name.trim()) {
            setError("Please enter a subscription name.")
            return
        }

        if (!form.renewalDate) {
            setError("Please choose a renewal date.")
            return
        }

        const amountValue = Number(form.amount)
        if (!Number.isFinite(amountValue) || amountValue < 0) {
            setError("Please enter a valid amount.")
            return
        }

        setSaving(true)

        const payload = {
            user_id: user.id,
            name: form.name.trim(),
            amount: amountValue,
            currency: form.currency,
            renewal_date: form.renewalDate,
            updated_at: new Date().toISOString(),
        }

        try {
            let result
            if (editing?.id) {
                result = await supabase
                    .from("subscriptions")
                    .update(payload)
                    .eq("id", editing.id)
                    .select()
                    .single()
            } else {
                result = await supabase
                    .from("subscriptions")
                    .insert([payload])
                    .select()
                    .single()
            }

            if (result.error) {
                throw result.error
            }

            setMessage(editing ? "Subscription updated." : "Subscription added.")
            resetForm()
            setMobileFormOpen(false)
            loadSubscriptions({ force: true })
        } catch (err) {
            setError(err?.message || "Unable to save subscription.")
        } finally {
            setSaving(false)
        }
    }

    const handleEdit = (item) => {
        setEditing(item)
        setForm({
            name: item.name || "",
            amount: item.amount?.toString() || "",
            currency: item.currency || "LKR",
            renewalDate: item.renewal_date || "",
        })
        setError("")
        setMessage("")
        if (isMobileViewport()) {
            setMobileFormOpen(true)
        }
    }

    const handleDelete = async (id) => {
        const confirmed = window.confirm("Delete this subscription? This cannot be undone.")
        if (!confirmed) return

        try {
            setLoading(true)
            const { error } = await supabase.from("subscriptions").delete().eq("id", id)
            if (error) throw error
            setMessage("Subscription removed.")
            loadSubscriptions({ force: true })
        } catch {
            setError("Unable to delete subscription.")
        } finally {
            setLoading(false)
        }
    }

    const conversionSummary = useMemo(() => {
        if (form.currency === "LKR") {
            return "Amount is already in LKR."
        }
        if (!form.amount) {
            return "Enter an amount to see LKR conversion."
        }
        if (conversionLoading) {
            return "Fetching conversion..."
        }
        if (conversionError) {
            return conversionError
        }
        if (conversion !== null) {
            return `${formatCurrency(conversion, "LKR")}`
        }
        return "Conversion available when a valid amount is entered."
    }, [form.currency, form.amount, conversion, conversionLoading, conversionError])

    const subscriptionSummary = useMemo(() => {
        let totalLkr = 0
        let unavailableCount = 0

        subscriptions.forEach((item) => {
            const value = Number(item.converted_lkr)
            if (Number.isFinite(value)) {
                totalLkr += value
            } else {
                unavailableCount += 1
            }
        })

        return {
            totalLkr,
            unavailableCount,
        }
    }, [subscriptions])

    const formContent = (
        <>
            <div className="mb-3.5">
                <p className="text-[13px] font-semibold text-[#1d1d1f]">Subscription details</p>
                <p className="mt-1 text-[11px] text-[#86868b]">Add your monthly cost and renewal day to keep this list up to date.</p>
            </div>

            {(error || message) && (
                <div className={`mb-3 rounded-lg px-3 py-2 text-[11px] ${error ? "border border-red-100 bg-red-50 text-red-700" : "border border-green-100 bg-green-50 text-green-700"}`}>
                    {error || message}
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-3">
                <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">Name</label>
                    <input
                        value={form.name}
                        onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="Spotify, Notion, Netflix"
                        className="mt-1.5 w-full rounded-lg border border-[#e5e5ea] bg-[#fafafb] px-3 py-2 text-[13px] text-[#1d1d1f] outline-none transition focus:border-[#C6FF00] focus:bg-white"
                    />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">Amount</label>
                        <input
                            value={form.amount}
                            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="mt-1.5 w-full rounded-lg border border-[#e5e5ea] bg-[#fafafb] px-3 py-2 text-[13px] text-[#1d1d1f] outline-none transition focus:border-[#C6FF00] focus:bg-white"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">Currency</label>
                        <select
                            value={form.currency}
                            onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
                            className="mt-1.5 w-full rounded-lg border border-[#e5e5ea] bg-[#fafafb] px-3 py-2 text-[13px] text-[#1d1d1f] outline-none transition focus:border-[#C6FF00] focus:bg-white"
                        >
                            {currencyOptions.map((code) => (
                                <option key={code} value={code}>{code}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#6b7280]">Renewal date</label>
                    <input
                        value={form.renewalDate}
                        onChange={(e) => setForm((prev) => ({ ...prev, renewalDate: e.target.value }))}
                        type="date"
                        className="mt-1.5 w-full rounded-lg border border-[#e5e5ea] bg-[#fafafb] px-3 py-2 text-[13px] text-[#1d1d1f] outline-none transition focus:border-[#C6FF00] focus:bg-white"
                    />
                    <p className="mt-1.5 text-[10px] text-[#86868b]">Repeats monthly on the same day.</p>
                </div>

                <div className="rounded-lg border border-[#e5e5ea] bg-[#f8f9fb] px-3 py-2 text-[12px] text-[#1d1d1f]">
                    <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">LKR conversion</p>
                        <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-[#86868b]">Live</span>
                    </div>
                    <p className="mt-1.5 text-[12px] text-[#52525b]">{conversionSummary}</p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                        type="submit"
                        disabled={saving}
                        className="inline-flex items-center justify-center rounded-lg bg-[#1d1d1f] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-black disabled:opacity-60"
                    >
                        {saving ? "Saving..." : editing ? "Update subscription" : "Save subscription"}
                    </button>
                    {editing && (
                        <button
                            type="button"
                            onClick={() => {
                                resetForm()
                                if (isMobileViewport()) closeMobileOverlay()
                            }}
                            className="inline-flex items-center justify-center rounded-lg border border-[#d2d2d7] bg-white px-4 py-2 text-[12px] font-semibold text-[#1d1d1f] transition hover:border-[#C6FF00]"
                        >
                            Cancel edit
                        </button>
                    )}
                </div>
            </form>
        </>
    )

    const mobileOverlay = mobileFormOpen && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-[130] bg-black/35 backdrop-blur-sm p-2 sm:p-4 lg:hidden" onClick={closeMobileOverlay}>
                <div className="flex min-h-full items-center justify-center">
                    <div
                        className="w-full max-w-[440px] max-h-[calc(100dvh-1rem)] overflow-y-auto rounded-2xl border border-[#d2d2d7]/60 bg-white p-3.5 shadow-[0_18px_48px_rgba(17,24,39,0.2)] sm:max-h-[calc(100dvh-2rem)]"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="mb-2.5 flex items-center justify-between">
                            <p className="text-[13px] font-semibold text-[#1d1d1f]">{editing ? "Edit subscription" : "Add subscription"}</p>
                            <button
                                type="button"
                                onClick={closeMobileOverlay}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5f5f7] text-[#1d1d1f]"
                                aria-label="Close"
                            >
                                <FaTimes className="h-3.5 w-3.5" />
                            </button>
                        </div>
                        {formContent}
                    </div>
                </div>
            </div>,
            document.body,
        )
        : null

    return (
        <div className="animate-in fade-in duration-500 w-full">
            <div className="mx-auto max-w-[1160px] space-y-4 px-0.5 sm:space-y-5">
                <div className="rounded-2xl border border-[#e7e7ec] bg-white px-4 py-3.5 shadow-sm sm:px-5 sm:py-4.5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h1 className="text-[19px] font-bold tracking-tight text-[#1d1d1f] sm:text-[22px]">Subscriptions</h1>
                            <p className="mt-1 text-[11px] text-[#86868b] sm:text-[12px]">Manage recurring costs, renewal dates, and live LKR conversion in one place.</p>
                        </div>
                        <button
                            type="button"
                            onClick={openFormForCreate}
                            className="inline-flex items-center gap-2 rounded-lg border border-[#d2d2d7] bg-[#f9f9fb] px-3.5 py-2 text-[12px] font-semibold text-[#1d1d1f] transition hover:border-[#C6FF00] hover:bg-white"
                        >
                            <FaPlus className="h-3.5 w-3.5" />
                            Add subscription
                        </button>
                    </div>
                </div>

                {mobileOverlay}

                <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-5">
                    <div className="hidden lg:block">
                        <div className="sticky top-5 rounded-2xl border border-[#e7e7ec] bg-white p-4 shadow-sm">
                            {formContent}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-[#e7e7ec] bg-white p-3 shadow-sm sm:p-4">
                        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                            <div className="rounded-xl border border-[#ececf2] bg-[#f8f9fb] px-3 py-2.5">
                                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#86868b]">Monthly total</p>
                                <p className="mt-0.5 text-[19px] font-bold text-[#1d1d1f]">{formatCurrency(subscriptionSummary.totalLkr, "LKR")}</p>
                                {subscriptionSummary.unavailableCount > 0 && (
                                    <p className="mt-1 text-[10px] text-[#86868b]">{subscriptionSummary.unavailableCount} conversion unavailable</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2 rounded-xl border border-[#ececf2] bg-[#fcfcfd] px-3 py-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f3f4f6] text-[#1d1d1f]">
                                    <FaWallet className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                    <p className="text-[12px] font-semibold text-[#1d1d1f]">Your subscriptions</p>
                                    <p className="text-[10px] text-[#86868b]">Sorted by nearest renewal</p>
                                </div>
                            </div>
                        </div>

                        {loading ? (
                            <div className="mt-4 flex items-center gap-2 text-[12px] text-[#86868b]">
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-[#1d1d1f]/60 border-t-transparent"></div>
                                Loading subscriptions...
                            </div>
                        ) : subscriptions.length === 0 ? (
                            <div className="mt-2 rounded-xl border border-dashed border-[#d6d6dd] bg-[#fafafb] px-4 py-7 text-center text-[12px] text-[#86868b]">
                                No subscriptions yet. Add one to start tracking renewals.
                            </div>
                        ) : (
                            <div className="mt-2 max-h-[560px] space-y-2 overflow-y-auto pr-1.5 sm:space-y-2.5">
                                {getSortedSubscriptions(subscriptions).map((item) => {
                                    const nextRenewal = getNextMonthlyRenewalDate(item.renewal_date)
                                    const dayParts = parseDateParts(item.renewal_date)
                                    const urgency = getRenewalUrgency(nextRenewal)

                                    return (
                                        <div key={item.id} className="rounded-xl border border-[#e8e8ef] bg-[#fcfcfd] p-3">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <p className="truncate text-[13px] font-semibold text-[#1d1d1f]">{item.name}</p>
                                                        <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-semibold text-[#475569]">{item.currency}</span>
                                                        <span className="rounded-full bg-[#f5f5f7] px-2 py-0.5 text-[10px] font-semibold text-[#6b7280]">{item.currency === "LKR" ? "Local" : "Converted"}</span>
                                                    </div>
                                                    <p className="mt-1 text-[11px] text-[#6b7280]">
                                                        Next renewal: {nextRenewal
                                                            ? nextRenewal.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                                            : "Invalid date"}
                                                        {dayParts?.day ? ` • Every ${getOrdinalSuffix(dayParts.day)}` : ""}
                                                    </p>
                                                </div>

                                                {urgency ? (
                                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${urgency.className}`}>
                                                        {urgency.label}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex rounded-full border border-[#e5e7eb] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#6b7280]">
                                                        On track
                                                    </span>
                                                )}
                                            </div>

                                            <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                                                <div className="rounded-lg border border-[#e7e7ec] bg-white px-2.5 py-1.5 text-[12px] text-[#4b5563]">
                                                    {item.currency === "LKR"
                                                        ? `Amount in LKR: ${formatCurrency(item.amount, "LKR")}`
                                                        : item.converted_lkr !== null
                                                            ? `Converted to LKR: ${formatCurrency(item.converted_lkr, "LKR")}`
                                                            : "Unable to fetch conversion"}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleEdit(item)}
                                                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#d2d2d7] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#1d1d1f] transition hover:border-[#C6FF00]"
                                                    >
                                                        <FaPencilAlt className="h-3 w-3" />
                                                        Edit
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(item.id)}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#fff1f2] px-2.5 py-1.5 text-[11px] font-semibold text-[#b91c1c] transition hover:bg-[#fee2e2]"
                                                    >
                                                        <FaTrashAlt className="h-3 w-3" />
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
